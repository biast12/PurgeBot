import { logger } from "../utils/logger";
import { LogArea } from "../types/logger";
import { CONSTANTS } from "../config/constants";

export interface BatchMetrics {
  successCount: number;
  errorCount: number;
  averageProcessingTime: number;
  lastBatchSize: number;
  lastBatchTime: number;
  rateLimitHits: number;
  totalProcessed: number;
}

export interface PerformanceMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  networkLatency: number;
  queueDepth: number;
  activeOperations: number;
}

export class BatchOptimizer {
  private batchMetrics: Map<string, BatchMetrics> = new Map();
  private currentBatchSize: number = CONSTANTS.BULK_DELETE_CHUNK_SIZE;
  private minBatchSize: number = 10;
  private maxBatchSize: number = CONSTANTS.BULK_DELETE_LIMIT;
  private performanceMetrics: PerformanceMetrics = {
    networkLatency: 0,
    queueDepth: 0,
    activeOperations: 0
  };

  // Adaptive parameters
  private readonly targetSuccessRate: number = 0.95; // 95% success rate target
  private readonly targetResponseTime: number = 1000; // Target 1 second per batch
  private readonly adjustmentFactor: number = 0.2; // How aggressively to adjust
  private readonly smoothingFactor: number = 0.3; // For exponential moving average

  /**
   * Get optimal batch size based on current conditions
   */
  public getOptimalBatchSize(channelId: string, messageCount?: number): number {
    const metrics = this.batchMetrics.get(channelId) || this.createDefaultMetrics();

    // Start with current batch size
    let optimalSize = this.currentBatchSize;

    // Adjust based on success rate
    const successRate = this.calculateSuccessRate(metrics);
    if (successRate < this.targetSuccessRate) {
      // Reduce batch size if we're getting errors
      optimalSize = Math.max(
        this.minBatchSize,
        Math.floor(optimalSize * (1 - this.adjustmentFactor))
      );
    }

    // Adjust based on processing time
    if (metrics.averageProcessingTime > 0) {
      const timeRatio = this.targetResponseTime / metrics.averageProcessingTime;
      if (timeRatio > 1.2) {
        // We can increase batch size
        optimalSize = Math.min(
          this.maxBatchSize,
          Math.ceil(optimalSize * (1 + this.adjustmentFactor * (timeRatio - 1)))
        );
      } else if (timeRatio < 0.8) {
        // We should decrease batch size
        optimalSize = Math.max(
          this.minBatchSize,
          Math.floor(optimalSize * timeRatio)
        );
      }
    }

    // Adjust based on rate limit pressure
    if (metrics.rateLimitHits > 0) {
      const rateLimitPressure = metrics.rateLimitHits / Math.max(1, metrics.totalProcessed);
      if (rateLimitPressure > 0.1) {
        // More than 10% rate limit hits, reduce batch size
        optimalSize = Math.max(
          this.minBatchSize,
          Math.floor(optimalSize * (1 - rateLimitPressure))
        );
      }
    }

    // Adjust based on server load
    optimalSize = this.adjustForServerLoad(optimalSize);

    // Special handling for small message counts
    if (messageCount && messageCount < optimalSize) {
      optimalSize = messageCount;
    }

    // Apply smoothing to avoid drastic changes
    const smoothedSize = Math.round(
      this.currentBatchSize * (1 - this.smoothingFactor) +
      optimalSize * this.smoothingFactor
    );

    // Ensure we stay within bounds
    const finalSize = Math.max(this.minBatchSize, Math.min(this.maxBatchSize, smoothedSize));

    // Log significant changes
    if (Math.abs(finalSize - this.currentBatchSize) > 10) {
      logger.info(LogArea.API,
        `Batch size adjusted from ${this.currentBatchSize} to ${finalSize} ` +
        `(success rate: ${(successRate * 100).toFixed(1)}%, avg time: ${metrics.averageProcessingTime}ms)`
      );
    }

    this.currentBatchSize = finalSize;
    return finalSize;
  }

  /**
   * Update metrics after batch processing
   */
  public updateBatchMetrics(
    channelId: string,
    batchSize: number,
    processingTime: number,
    success: boolean,
    rateLimitHit: boolean = false
  ): void {
    const metrics = this.batchMetrics.get(channelId) || this.createDefaultMetrics();

    // Update counts
    metrics.totalProcessed++;
    if (success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }
    if (rateLimitHit) {
      metrics.rateLimitHits++;
    }

    // Update average processing time (exponential moving average)
    if (metrics.averageProcessingTime === 0) {
      metrics.averageProcessingTime = processingTime;
    } else {
      metrics.averageProcessingTime =
        metrics.averageProcessingTime * (1 - this.smoothingFactor) +
        processingTime * this.smoothingFactor;
    }

    // Update last batch info
    metrics.lastBatchSize = batchSize;
    metrics.lastBatchTime = Date.now();

    this.batchMetrics.set(channelId, metrics);

    // Update network latency estimate
    this.updateNetworkLatency(processingTime, batchSize);
  }

  /**
   * Update performance metrics
   */
  public updatePerformanceMetrics(metrics: Partial<PerformanceMetrics>): void {
    this.performanceMetrics = {
      ...this.performanceMetrics,
      ...metrics
    };
  }

  /**
   * Adjust batch size based on server load
   */
  private adjustForServerLoad(baseSize: number): number {
    let adjustedSize = baseSize;

    // Reduce batch size if queue is getting deep
    if (this.performanceMetrics.queueDepth > 100) {
      const queuePressure = Math.min(1, this.performanceMetrics.queueDepth / 500);
      adjustedSize = Math.floor(baseSize * (1 - queuePressure * 0.5));
    }

    // Reduce batch size if many operations are active
    if (this.performanceMetrics.activeOperations > 5) {
      const loadFactor = Math.min(1, this.performanceMetrics.activeOperations / 10);
      adjustedSize = Math.floor(adjustedSize * (1 - loadFactor * 0.3));
    }

    // Reduce batch size if network latency is high
    if (this.performanceMetrics.networkLatency > 500) {
      const latencyFactor = Math.min(1, this.performanceMetrics.networkLatency / 2000);
      adjustedSize = Math.floor(adjustedSize * (1 - latencyFactor * 0.4));
    }

    // Consider CPU and memory if available
    if (this.performanceMetrics.cpuUsage && this.performanceMetrics.cpuUsage > 0.7) {
      adjustedSize = Math.floor(adjustedSize * 0.7);
    }
    if (this.performanceMetrics.memoryUsage && this.performanceMetrics.memoryUsage > 0.8) {
      adjustedSize = Math.floor(adjustedSize * 0.6);
    }

    return Math.max(this.minBatchSize, adjustedSize);
  }

  /**
   * Calculate success rate for a channel
   */
  private calculateSuccessRate(metrics: BatchMetrics): number {
    const total = metrics.successCount + metrics.errorCount;
    if (total === 0) return 1;
    return metrics.successCount / total;
  }

  /**
   * Update network latency estimate
   */
  private updateNetworkLatency(processingTime: number, batchSize: number): void {
    // Estimate latency per message
    const latencyPerMessage = processingTime / Math.max(1, batchSize);

    // Update with exponential moving average
    if (this.performanceMetrics.networkLatency === 0) {
      this.performanceMetrics.networkLatency = latencyPerMessage;
    } else {
      this.performanceMetrics.networkLatency =
        this.performanceMetrics.networkLatency * 0.7 + latencyPerMessage * 0.3;
    }
  }

  /**
   * Create default metrics for a new channel
   */
  private createDefaultMetrics(): BatchMetrics {
    return {
      successCount: 0,
      errorCount: 0,
      averageProcessingTime: 0,
      lastBatchSize: this.currentBatchSize,
      lastBatchTime: 0,
      rateLimitHits: 0,
      totalProcessed: 0
    };
  }

  /**
   * Get current batch size
   */
  public getCurrentBatchSize(): number {
    return this.currentBatchSize;
  }

  /**
   * Get metrics for monitoring
   */
  public getMetrics(): {
    currentBatchSize: number;
    channels: Array<{ id: string; metrics: BatchMetrics }>;
    performance: PerformanceMetrics;
  } {
    return {
      currentBatchSize: this.currentBatchSize,
      channels: Array.from(this.batchMetrics.entries()).map(([id, metrics]) => ({
        id,
        metrics
      })),
      performance: this.performanceMetrics
    };
  }

  /**
   * Reset metrics for a channel
   */
  public resetChannelMetrics(channelId: string): void {
    this.batchMetrics.delete(channelId);
  }

  /**
   * Reset all metrics
   */
  public resetAllMetrics(): void {
    this.batchMetrics.clear();
    this.currentBatchSize = CONSTANTS.BULK_DELETE_CHUNK_SIZE;
    this.performanceMetrics = {
      networkLatency: 0,
      queueDepth: 0,
      activeOperations: 0
    };
  }
}

export const batchOptimizer = new BatchOptimizer();