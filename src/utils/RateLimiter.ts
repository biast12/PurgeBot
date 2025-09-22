import { CONSTANTS, ERROR_CODES } from "../config/constants";
import { logger } from "./logger";
import { LogArea } from "../types/logger";
import { predictiveThrottler } from "../services/PredictiveThrottler";

interface QueueItem<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  priority?: number;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  resetAfter: number;
  bucket?: string;
}

interface RateLimitState {
  [bucket: string]: {
    limit: number;
    remaining: number;
    reset: number;
    lastRequest: number;
    averageResponseTime: number;
    requestCount: number;
  };
}

export class RateLimiter {
  private queue: QueueItem<any>[] = [];
  private processing = false;
  private baseDelay: number = 100;
  private currentDelay: number = 100;
  private rateLimitState: RateLimitState = {};
  private globalRateLimitReset?: number;
  private dynamicDelayMultiplier: number = 1.0;

  private metrics = {
    totalRequests: 0,
    rateLimitHits: 0,
    averageDelay: 0,
    successfulRequests: 0,
    failedRequests: 0
  };

  constructor(private options: {
    baseDelay?: number;
    maxDelay?: number;
    enableMetrics?: boolean;
  } = {}) {
    this.baseDelay = options.baseDelay || 100;
    this.currentDelay = this.baseDelay;
  }

  async execute<T>(
    fn: () => Promise<T>,
    bucket: string = 'default',
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const item = { execute: fn, resolve, reject, priority };

      if (priority > 0) {
        const insertIndex = this.queue.findIndex(i => (i.priority || 0) < priority);
        if (insertIndex === -1) {
          this.queue.push(item);
        } else {
          this.queue.splice(insertIndex, 0, item);
        }
      } else {
        this.queue.push(item);
      }

      this.processQueue(bucket);
    });
  }

  private async processQueue(bucket: string = 'default'): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      if (this.globalRateLimitReset && Date.now() < this.globalRateLimitReset) {
        const waitTime = this.globalRateLimitReset - Date.now();
        logger.info(LogArea.API, `Waiting ${waitTime}ms for global rate limit reset`);
        await this.delay(waitTime);
        this.globalRateLimitReset = undefined;
      }

      const bucketState = this.rateLimitState[bucket];
      if (bucketState) {
        if (bucketState.remaining === 0 && Date.now() < bucketState.reset) {
          const waitTime = bucketState.reset - Date.now();
          logger.info(LogArea.API, `Bucket ${bucket}: Waiting ${waitTime}ms for rate limit reset`);
          await this.delay(waitTime);
        }
      }

      const predictiveDelay = predictiveThrottler.getPreemptiveDelay(bucket);
      if (predictiveDelay > 0) {
        await this.delay(predictiveDelay);
      }

      const item = this.queue.shift()!;
      const startTime = Date.now();

      try {
        const result = await this.executeWithDynamicRetry(item.execute, bucket);

        this.metrics.totalRequests++;
        this.metrics.successfulRequests++;
        const responseTime = Date.now() - startTime;
        this.updateBucketMetrics(bucket, responseTime);

        const bucketState = this.rateLimitState[bucket];
        if (bucketState) {
          predictiveThrottler.recordRequest(
            bucket,
            responseTime,
            bucketState.remaining,
            bucketState.reset
          );
        } else {
          predictiveThrottler.recordRequest(bucket, responseTime);
        }

        item.resolve(result);

        this.adjustDynamicDelay(bucket);

      } catch (error) {
        this.metrics.failedRequests++;
        item.reject(error);
      }

      await this.delay(this.currentDelay);
    }

    this.processing = false;
  }

  private async executeWithDynamicRetry<T>(
    fn: () => Promise<T>,
    bucket: string,
    retries = 0
  ): Promise<T> {
    try {
      const result = await fn();

      if (result && typeof result === 'object' && 'headers' in (result as any)) {
        this.updateRateLimitInfo(bucket, (result as any).headers);
      }

      return result;
    } catch (error: any) {
      if (error.code === ERROR_CODES.RATE_LIMITED || error.status === 429) {
        this.metrics.rateLimitHits++;

        if (retries < CONSTANTS.MAX_RETRIES) {
          const retryAfter = this.extractRetryAfter(error);

          if (error.global) {
            this.globalRateLimitReset = Date.now() + retryAfter;
            logger.warning(LogArea.API, `Global rate limit hit. Waiting ${retryAfter}ms`);
          } else {
            logger.warning(LogArea.API, `Rate limited on bucket ${bucket}. Waiting ${retryAfter}ms`);
          }

          this.dynamicDelayMultiplier = Math.min(this.dynamicDelayMultiplier * 1.5, 10);

          await this.delay(retryAfter);
          return this.executeWithDynamicRetry(fn, bucket, retries + 1);
        }
      }

      throw error;
    }
  }

  private updateRateLimitInfo(bucket: string, headers: any): void {
    if (!headers) return;

    const info: Partial<RateLimitInfo> = {};

    if (headers['x-ratelimit-limit']) {
      info.limit = parseInt(headers['x-ratelimit-limit']);
    }
    if (headers['x-ratelimit-remaining']) {
      info.remaining = parseInt(headers['x-ratelimit-remaining']);
    }
    if (headers['x-ratelimit-reset']) {
      info.reset = parseInt(headers['x-ratelimit-reset']) * 1000; // Convert to ms
    }
    if (headers['x-ratelimit-reset-after']) {
      info.resetAfter = parseFloat(headers['x-ratelimit-reset-after']) * 1000;
    }
    if (headers['x-ratelimit-bucket']) {
      info.bucket = headers['x-ratelimit-bucket'];
    }

    if (info.limit !== undefined) {
      const actualBucket = info.bucket || bucket;
      this.rateLimitState[actualBucket] = {
        limit: info.limit,
        remaining: info.remaining || 0,
        reset: info.reset || (Date.now() + (info.resetAfter || 60000)),
        lastRequest: Date.now(),
        averageResponseTime: this.rateLimitState[actualBucket]?.averageResponseTime || 0,
        requestCount: (this.rateLimitState[actualBucket]?.requestCount || 0) + 1
      };

      predictiveThrottler.recordRequest(
        actualBucket,
        0, // Response time will be updated elsewhere
        info.remaining,
        info.reset || (Date.now() + (info.resetAfter || 60000))
      );

      if (this.options.enableMetrics) {
        logger.info(LogArea.API,
          `Bucket ${actualBucket}: ${info.remaining}/${info.limit} remaining, resets in ${info.resetAfter}ms`
        );
      }
    }
  }

  private updateBucketMetrics(bucket: string, responseTime: number): void {
    if (!this.rateLimitState[bucket]) {
      this.rateLimitState[bucket] = {
        limit: 0,
        remaining: 0,
        reset: 0,
        lastRequest: Date.now(),
        averageResponseTime: responseTime,
        requestCount: 1
      };
    } else {
      const state = this.rateLimitState[bucket];
      state.averageResponseTime =
        (state.averageResponseTime * state.requestCount + responseTime) / (state.requestCount + 1);
      state.requestCount++;
      state.lastRequest = Date.now();
    }
  }

  private adjustDynamicDelay(bucket: string): void {
    const bucketState = this.rateLimitState[bucket];

    if (!bucketState) {
      this.currentDelay = this.baseDelay;
      return;
    }

    const { limit, remaining, reset } = bucketState;

    if (limit > 0) {
      const timeUntilReset = Math.max(0, reset - Date.now());
      const remainingRatio = remaining / limit;

      if (remainingRatio < 0.2) {
        this.dynamicDelayMultiplier = Math.min(this.dynamicDelayMultiplier * 2, 10);
      } else if (remainingRatio < 0.5) {
        this.dynamicDelayMultiplier = Math.min(this.dynamicDelayMultiplier * 1.2, 5);
      } else if (remainingRatio > 0.8 && this.dynamicDelayMultiplier > 1) {
        this.dynamicDelayMultiplier = Math.max(this.dynamicDelayMultiplier * 0.9, 1);
      }

      if (remaining > 0 && timeUntilReset > 0) {
        const optimalDelay = Math.max(
          this.baseDelay,
          Math.min(
            timeUntilReset / remaining,
            this.options.maxDelay || CONSTANTS.MAX_RETRY_DELAY
          )
        );
        this.currentDelay = Math.floor(optimalDelay * this.dynamicDelayMultiplier);
      } else {
        this.currentDelay = Math.floor(this.baseDelay * this.dynamicDelayMultiplier);
      }
    } else {
      this.currentDelay = Math.floor(this.baseDelay * this.dynamicDelayMultiplier);
    }

    if (this.options.enableMetrics) {
      logger.info(LogArea.API,
        `Adjusted delay to ${this.currentDelay}ms (multiplier: ${this.dynamicDelayMultiplier.toFixed(2)})`
      );
    }
  }

  private extractRetryAfter(error: any): number {
    if (error.retry_after) {
      return error.retry_after;
    }
    if (error.response?.headers?.['retry-after']) {
      return parseInt(error.response.headers['retry-after']) * 1000;
    }
    if (error.response?.data?.retry_after) {
      return error.response.data.retry_after * 1000;
    }

    return Math.min(
      CONSTANTS.DEFAULT_RETRY_DELAY * Math.pow(2, this.metrics.rateLimitHits),
      CONSTANTS.MAX_RETRY_DELAY
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getMetrics() {
    return {
      ...this.metrics,
      currentDelay: this.currentDelay,
      dynamicDelayMultiplier: this.dynamicDelayMultiplier,
      queueLength: this.queue.length,
      buckets: Object.keys(this.rateLimitState).map(bucket => ({
        name: bucket,
        ...this.rateLimitState[bucket],
        prediction: predictiveThrottler.predictRateLimit(bucket)
      }))
    };
  }

  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      rateLimitHits: 0,
      averageDelay: 0,
      successfulRequests: 0,
      failedRequests: 0
    };
    predictiveThrottler.clearAllHistory();
  }

  public clearQueue(): void {
    this.queue = [];
  }

  public getPredictiveMetrics() {
    return predictiveThrottler.getMetrics();
  }
}