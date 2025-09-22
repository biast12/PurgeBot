import { messageService } from "../services/MessageService";
import { logger } from "./logger";
import { LogArea } from "../types/logger";

export class RateLimitMonitor {
  private intervalId?: NodeJS.Timeout;
  private metricsHistory: any[] = [];
  private maxHistorySize = 100;

  start(intervalMs: number = 30000): void {
    if (this.intervalId) {
      this.stop();
    }

    this.intervalId = setInterval(() => {
      this.logMetrics();
    }, intervalMs);

    logger.info(LogArea.API, `Rate limit monitoring started (interval: ${intervalMs}ms)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info(LogArea.API, "Rate limit monitoring stopped");
    }
  }

  private logMetrics(): void {
    const metrics = messageService.getRateLimiterMetrics();

    // Store in history
    this.metricsHistory.push({
      timestamp: Date.now(),
      ...metrics
    });

    // Trim history
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Log significant events
    if (metrics.rateLimitHits > 0) {
      logger.warning(LogArea.API,
        `Rate limit status: ${metrics.rateLimitHits} hits, ` +
        `${metrics.successfulRequests}/${metrics.totalRequests} successful, ` +
        `delay: ${metrics.currentDelay}ms (x${metrics.dynamicDelayMultiplier.toFixed(2)})`
      );
    }

    // Log bucket status
    if (metrics.buckets && metrics.buckets.length > 0) {
      for (const bucket of metrics.buckets) {
        if (bucket.remaining < bucket.limit * 0.2) {
          logger.warning(LogArea.API,
            `Bucket ${bucket.name}: LOW - ${bucket.remaining}/${bucket.limit} remaining`
          );
        }
      }
    }
  }

  getMetrics(): any {
    return messageService.getRateLimiterMetrics();
  }

  getHistory(): any[] {
    return this.metricsHistory;
  }

  getSummary(): any {
    const current = this.getMetrics();
    const history = this.getHistory();

    if (history.length === 0) {
      return current;
    }

    // Calculate averages from history
    const avgDelay = history.reduce((sum, m) => sum + m.currentDelay, 0) / history.length;
    const avgMultiplier = history.reduce((sum, m) => sum + m.dynamicDelayMultiplier, 0) / history.length;
    const totalRateLimitHits = history.reduce((sum, m) => sum + (m.rateLimitHits || 0), 0);

    return {
      current,
      historical: {
        averageDelay: Math.round(avgDelay),
        averageMultiplier: avgMultiplier.toFixed(2),
        totalRateLimitHits,
        sampleSize: history.length
      }
    };
  }

  reset(): void {
    this.metricsHistory = [];
    messageService.resetRateLimiterMetrics();
    logger.info(LogArea.API, "Rate limit metrics reset");
  }
}

export const rateLimitMonitor = new RateLimitMonitor();