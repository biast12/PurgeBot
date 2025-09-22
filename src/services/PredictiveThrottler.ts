import { logger } from "../utils/logger";
import { LogArea } from "../types/logger";

export interface RateLimitPrediction {
  willHitLimit: boolean;
  timeToLimit: number; // milliseconds until we hit the limit
  recommendedDelay: number; // recommended delay to avoid hitting limit
  confidence: number; // 0-1 confidence score
  remainingCapacity: number; // estimated remaining requests
}

interface RequestHistory {
  timestamp: number;
  bucket: string;
  responseTime: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

export interface BucketPattern {
  averageRequestRate: number; // requests per second
  peakRequestRate: number;
  averageResponseTime: number;
  rateLimitCapacity: number;
  rateLimitWindow: number; // milliseconds
  lastReset: number;
  requestsInWindow: number;
}

export class PredictiveThrottler {
  private requestHistory: RequestHistory[] = [];
  private bucketPatterns: Map<string, BucketPattern> = new Map();
  private readonly historySize: number = 1000;
  private readonly predictionWindow: number = 60000; // Look ahead 1 minute
  private readonly safetyMargin: number = 0.8; // Use only 80% of rate limit capacity

  /**
   * Record a request for analysis
   */
  public recordRequest(
    bucket: string,
    responseTime: number,
    rateLimitRemaining?: number,
    rateLimitReset?: number
  ): void {
    const now = Date.now();

    // Add to history
    this.requestHistory.push({
      timestamp: now,
      bucket,
      responseTime,
      rateLimitRemaining,
      rateLimitReset
    });

    // Trim history if too large
    if (this.requestHistory.length > this.historySize) {
      this.requestHistory = this.requestHistory.slice(-this.historySize);
    }

    // Update bucket pattern
    this.updateBucketPattern(bucket, responseTime, rateLimitRemaining, rateLimitReset);
  }

  /**
   * Predict if we will hit rate limits soon
   */
  public predictRateLimit(bucket: string): RateLimitPrediction {
    const pattern = this.bucketPatterns.get(bucket);

    if (!pattern || pattern.rateLimitCapacity === 0) {
      // No data yet, return safe defaults
      return {
        willHitLimit: false,
        timeToLimit: Infinity,
        recommendedDelay: 0,
        confidence: 0,
        remainingCapacity: Infinity
      };
    }

    const now = Date.now();
    const recentRequests = this.getRecentRequests(bucket, 10000); // Last 10 seconds
    const currentRate = recentRequests.length / 10; // Requests per second

    // Calculate time until reset
    const timeUntilReset = Math.max(0, pattern.lastReset + pattern.rateLimitWindow - now);

    // Estimate remaining capacity
    const requestsInCurrentWindow = this.countRequestsInWindow(
      bucket,
      now - (pattern.rateLimitWindow - timeUntilReset)
    );
    const remainingCapacity = Math.max(0,
      pattern.rateLimitCapacity * this.safetyMargin - requestsInCurrentWindow
    );

    // Predict if we'll hit the limit
    const projectedRequests = currentRate * (timeUntilReset / 1000);
    const willHitLimit = projectedRequests > remainingCapacity;

    // Calculate time to limit at current rate
    let timeToLimit = Infinity;
    if (currentRate > 0) {
      timeToLimit = (remainingCapacity / currentRate) * 1000;
    }

    // Calculate recommended delay to avoid hitting limit
    let recommendedDelay = 0;
    if (willHitLimit && timeUntilReset > 0) {
      // We need to slow down - calculate optimal delay
      const targetRate = remainingCapacity / (timeUntilReset / 1000);
      if (targetRate > 0) {
        recommendedDelay = Math.max(0, (1000 / targetRate) - (1000 / currentRate));
      }
    }

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(pattern, recentRequests.length);

    // Apply predictive adjustments based on trends
    const trend = this.analyzeTrend(bucket);
    if (trend.accelerating) {
      // Request rate is increasing, be more conservative
      recommendedDelay *= 1.2;
      timeToLimit *= 0.8;
    }

    return {
      willHitLimit,
      timeToLimit: Math.max(0, timeToLimit),
      recommendedDelay: Math.round(recommendedDelay),
      confidence,
      remainingCapacity: Math.round(remainingCapacity)
    };
  }

  /**
   * Get preemptive delay recommendation
   */
  public getPreemptiveDelay(bucket: string): number {
    const prediction = this.predictRateLimit(bucket);

    if (prediction.confidence > 0.7 && prediction.timeToLimit < this.predictionWindow) {
      const urgency = 1 - (prediction.timeToLimit / this.predictionWindow);
      const baseDelay = prediction.recommendedDelay;

      const scaledDelay = baseDelay * (1 + urgency);

      if (scaledDelay > 100) {
        logger.info(LogArea.API,
          `Predictive throttling for ${bucket}: ${scaledDelay}ms delay ` +
          `(${prediction.remainingCapacity} requests remaining, ` +
          `${Math.round(prediction.timeToLimit / 1000)}s to limit)`
        );
      }

      return Math.round(scaledDelay);
    }

    return 0;
  }

  /**
   * Update bucket pattern based on new data
   */
  private updateBucketPattern(
    bucket: string,
    responseTime: number,
    rateLimitRemaining?: number,
    rateLimitReset?: number
  ): void {
    const pattern = this.bucketPatterns.get(bucket) || {
      averageRequestRate: 0,
      peakRequestRate: 0,
      averageResponseTime: 0,
      rateLimitCapacity: 0,
      rateLimitWindow: 60000, // Default 1 minute window
      lastReset: 0,
      requestsInWindow: 0
    };

    // Update response time average
    pattern.averageResponseTime = pattern.averageResponseTime * 0.9 + responseTime * 0.1;

    // Update rate limit info if available
    if (rateLimitRemaining !== undefined && rateLimitReset !== undefined) {
      const now = Date.now();

      // Detect rate limit window reset
      if (rateLimitReset > pattern.lastReset) {
        pattern.lastReset = rateLimitReset;
        pattern.requestsInWindow = 0;

        // Infer capacity from remaining + used
        const used = pattern.rateLimitCapacity - rateLimitRemaining;
        if (used >= 0 && pattern.rateLimitCapacity === 0) {
          pattern.rateLimitCapacity = rateLimitRemaining + used;
        }
      }

      // Update capacity estimate if we have better data
      if (rateLimitRemaining > pattern.rateLimitCapacity) {
        pattern.rateLimitCapacity = rateLimitRemaining;
      }

      // Estimate window size
      if (rateLimitReset > now) {
        const estimatedWindow = (rateLimitReset - now) * 1.5; // Assume we're ~2/3 through window
        pattern.rateLimitWindow = Math.max(pattern.rateLimitWindow, estimatedWindow);
      }
    }

    // Calculate request rates
    const recentRequests = this.getRecentRequests(bucket, 10000);
    if (recentRequests.length > 1) {
      const duration = (recentRequests[recentRequests.length - 1].timestamp - recentRequests[0].timestamp) / 1000;
      if (duration > 0) {
        const currentRate = recentRequests.length / duration;
        pattern.averageRequestRate = pattern.averageRequestRate * 0.7 + currentRate * 0.3;
        pattern.peakRequestRate = Math.max(pattern.peakRequestRate * 0.95, currentRate);
      }
    }

    pattern.requestsInWindow++;
    this.bucketPatterns.set(bucket, pattern);
  }

  /**
   * Get recent requests for a bucket
   */
  private getRecentRequests(bucket: string, windowMs: number): RequestHistory[] {
    const cutoff = Date.now() - windowMs;
    return this.requestHistory.filter(
      req => req.bucket === bucket && req.timestamp > cutoff
    );
  }

  /**
   * Count requests in current rate limit window
   */
  private countRequestsInWindow(bucket: string, windowStart: number): number {
    return this.requestHistory.filter(
      req => req.bucket === bucket && req.timestamp > windowStart
    ).length;
  }

  /**
   * Analyze request trend
   */
  private analyzeTrend(bucket: string): { accelerating: boolean; rate: number } {
    const shortWindow = this.getRecentRequests(bucket, 5000);
    const longWindow = this.getRecentRequests(bucket, 20000);

    if (shortWindow.length < 2 || longWindow.length < 5) {
      return { accelerating: false, rate: 0 };
    }

    const shortRate = shortWindow.length / 5;
    const longRate = longWindow.length / 20;

    return {
      accelerating: shortRate > longRate * 1.2,
      rate: shortRate
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(pattern: BucketPattern, sampleSize: number): number {
    let confidence = 0;

    // More samples = higher confidence
    confidence += Math.min(0.3, sampleSize / 100);

    // Known rate limit capacity = higher confidence
    if (pattern.rateLimitCapacity > 0) {
      confidence += 0.3;
    }

    // Stable request rate = higher confidence
    if (pattern.averageRequestRate > 0 && pattern.peakRequestRate > 0) {
      const stability = pattern.averageRequestRate / pattern.peakRequestRate;
      confidence += stability * 0.2;
    }

    // Recent data = higher confidence
    if (pattern.lastReset > Date.now() - 60000) {
      confidence += 0.2;
    }

    return Math.min(1, confidence);
  }

  /**
   * Get metrics for monitoring
   */
  public getMetrics(): {
    buckets: Array<{
      name: string;
      pattern: BucketPattern;
      prediction: RateLimitPrediction;
    }>;
    historySize: number;
  } {
    const buckets = Array.from(this.bucketPatterns.entries()).map(([name, pattern]) => ({
      name,
      pattern,
      prediction: this.predictRateLimit(name)
    }));

    return {
      buckets,
      historySize: this.requestHistory.length
    };
  }

  /**
   * Clear history for a bucket
   */
  public clearBucketHistory(bucket: string): void {
    this.requestHistory = this.requestHistory.filter(req => req.bucket !== bucket);
    this.bucketPatterns.delete(bucket);
  }

  /**
   * Clear all history
   */
  public clearAllHistory(): void {
    this.requestHistory = [];
    this.bucketPatterns.clear();
  }
}

export const predictiveThrottler = new PredictiveThrottler();