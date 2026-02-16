import { SupportedChannel, PurgeOptions } from "../types";
import { logger } from "../utils/logger";
import { LogArea } from "../types/logger";
import { operationManager } from "./OperationManager";
import { EventEmitter } from "events";

interface ChannelTask {
  channel: SupportedChannel;
  options: PurgeOptions;
  operationId: string;
  priority: number;
  retryCount?: number;
}

interface WorkerStatus {
  id: number;
  busy: boolean;
  currentChannel?: string;
  startTime?: number;
  processedCount: number;
  errorCount: number;
}

interface ProcessorOptions {
  maxWorkers?: number;
  maxRetries?: number;
  workerTimeout?: number;
  priorityBoost?: {
    smallChannels?: number; // Boost priority for small channels (quick wins)
    largeChannels?: number; // Lower priority for large channels
    thresholdMessages?: number; // Message count threshold
  };
}

export class ParallelProcessor extends EventEmitter {
  private queue: ChannelTask[] = [];
  private workers: WorkerStatus[] = [];
  private processing: boolean = false;
  private maxWorkers: number;
  private maxRetries: number;
  private workerTimeout: number;
  private processedChannels: Set<string> = new Set();
  private failedChannels: Map<string, Error> = new Map();

  // Metrics
  private metrics = {
    totalChannels: 0,
    processedChannels: 0,
    failedChannels: 0,
    totalMessages: 0,
    averageChannelTime: 0,
    currentQueueSize: 0,
    activeWorkers: 0
  };

  constructor(private options: ProcessorOptions = {}) {
    super();
    this.maxWorkers = options.maxWorkers || 3; // Default to 3 parallel workers
    this.maxRetries = options.maxRetries || 2;
    this.workerTimeout = options.workerTimeout || 300000; // 5 minutes default

    // Initialize workers
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push({
        id: i,
        busy: false,
        processedCount: 0,
        errorCount: 0
      });
    }
  }

  /**
   * Add channels to the processing queue
   */
  public addChannels(
    channels: SupportedChannel[],
    options: PurgeOptions,
    operationId: string
  ): void {
    this.metrics.totalChannels += channels.length;

    for (const channel of channels) {
      // Calculate priority based on estimated processing time
      const priority = this.calculatePriority(channel);

      const task: ChannelTask = {
        channel,
        options,
        operationId,
        priority,
        retryCount: 0
      };

      // Insert task in priority order (higher priority first)
      const insertIndex = this.queue.findIndex(t => t.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(task);
      } else {
        this.queue.splice(insertIndex, 0, task);
      }
    }

    this.metrics.currentQueueSize = this.queue.length;
  }

  /**
   * Start processing the queue
   */
  public async start(
    processFn: (channel: SupportedChannel, options: PurgeOptions, operationId: string) => Promise<any>
  ): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    this.emit('start', { queueSize: this.queue.length });

    // Start worker loops
    const workerPromises = this.workers.map(worker =>
      this.workerLoop(worker, processFn)
    );

    // Wait for all workers to complete
    await Promise.all(workerPromises);

    this.processing = false;
    this.emit('complete', this.getMetrics());
  }

  /**
   * Worker loop that processes tasks from the queue
   */
  private async workerLoop(
    worker: WorkerStatus,
    processFn: (channel: SupportedChannel, options: PurgeOptions, operationId: string) => Promise<any>
  ): Promise<void> {
    while (this.processing && (this.queue.length > 0 || this.hasActiveTasks())) {
      // Check if operation is cancelled
      if (this.queue.length > 0 && this.queue[0].operationId) {
        if (operationManager.isOperationCancelled(this.queue[0].operationId)) {
          break;
        }
      }

      // Get next task from queue
      const task = this.queue.shift();
      if (!task) {
        // No tasks available, wait a bit
        await this.delay(100);
        continue;
      }

      // Mark worker as busy
      worker.busy = true;
      worker.currentChannel = task.channel.name;
      worker.startTime = Date.now();
      this.metrics.activeWorkers = this.workers.filter(w => w.busy).length;
      this.metrics.currentQueueSize = this.queue.length;

      try {
        // Process channel with timeout
        const result = await this.processWithTimeout(
          processFn(task.channel, task.options, task.operationId),
          this.workerTimeout,
          task.channel.name
        );

        // Mark as processed
        this.processedChannels.add(task.channel.id);
        worker.processedCount++;
        this.metrics.processedChannels++;

        // Update average processing time
        const processingTime = Date.now() - worker.startTime;
        this.updateAverageTime(processingTime);

        this.emit('channelComplete', {
          workerId: worker.id,
          channelName: task.channel.name,
          processingTime,
          result
        });
      } catch (error: any) {
        worker.errorCount++;

        // Handle retry logic
        if (task.retryCount! < this.maxRetries) {
          task.retryCount!++;
          task.priority -= 10; // Lower priority for retries

          logger.warning(LogArea.PURGE,
            `Worker ${worker.id}: Error in ${task.channel.name}, retrying (${task.retryCount}/${this.maxRetries})`
          );

          // Re-add to queue for retry
          this.queue.push(task);
        } else {
          // Max retries reached, mark as failed
          this.failedChannels.set(task.channel.id, error);
          this.metrics.failedChannels++;

          this.emit('channelError', {
            workerId: worker.id,
            channelName: task.channel.name,
            error: error.message
          });

          await logger.logError(
            LogArea.PURGE,
            `Worker ${worker.id}: Failed to process ${task.channel.name} after ${this.maxRetries} retries`,
            error,
            {
              channelId: task.channel.id,
              channelName: task.channel.name,
              guildId: task.channel.guild?.id,
              guildName: task.channel.guild?.name,
              metadata: {
                operationId: task.operationId,
                workerId: worker.id,
                retryCount: task.retryCount || 0,
                operationType: 'parallelProcessing'
              }
            }
          );
        }
      } finally {
        // Mark worker as available
        worker.busy = false;
        worker.currentChannel = undefined;
        worker.startTime = undefined;
        this.metrics.activeWorkers = this.workers.filter(w => w.busy).length;
      }
    }
  }

  /**
   * Process with timeout to prevent hanging
   */
  private async processWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    channelName: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Channel ${channelName} processing timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Calculate priority for a channel based on estimated processing time
   */
  private calculatePriority(channel: SupportedChannel): number {
    let priority = 100; // Base priority

    // Boost priority for likely smaller channels (process quick wins first)
    // Categories are not part of SupportedChannel, so this check isn't needed

    // Additional priority adjustments can be added based on:
    // - Channel message count (if available)
    // - Channel type
    // - Previous processing history

    if (this.options.priorityBoost) {
      // This would require fetching message count which might be expensive
      // For now, we'll use channel type as a heuristic
      if (channel.type === 5 || channel.type === 10 || channel.type === 11) { // News, announcement threads
        priority += this.options.priorityBoost.smallChannels || 10;
      }
    }

    return priority;
  }

  /**
   * Check if any workers are still busy
   */
  private hasActiveTasks(): boolean {
    return this.workers.some(w => w.busy);
  }

  /**
   * Update average processing time
   */
  private updateAverageTime(newTime: number): void {
    const totalProcessed = this.metrics.processedChannels;
    if (totalProcessed === 1) {
      this.metrics.averageChannelTime = newTime;
    } else {
      this.metrics.averageChannelTime =
        (this.metrics.averageChannelTime * (totalProcessed - 1) + newTime) / totalProcessed;
    }
  }

  /**
   * Stop all processing
   */
  public stop(): void {
    this.processing = false;
    this.queue = [];
  }

  /**
   * Get current metrics
   */
  public getMetrics() {
    return {
      ...this.metrics,
      workers: this.workers.map(w => ({
        id: w.id,
        busy: w.busy,
        currentChannel: w.currentChannel,
        processedCount: w.processedCount,
        errorCount: w.errorCount,
        uptime: w.startTime ? Date.now() - w.startTime : 0
      })),
      failedChannels: Array.from(this.failedChannels.entries()).map(([id, error]) => ({
        channelId: id,
        error: error.message
      }))
    };
  }

  /**
   * Get estimated time remaining
   */
  public getEstimatedTimeRemaining(): number {
    if (this.metrics.averageChannelTime === 0 || this.metrics.activeWorkers === 0) {
      return 0;
    }

    const remainingChannels = this.queue.length + this.workers.filter(w => w.busy).length;
    const effectiveWorkers = Math.min(this.maxWorkers, remainingChannels);

    return Math.ceil(
      (remainingChannels * this.metrics.averageChannelTime) / effectiveWorkers
    );
  }

  /**
   * Adjust number of workers dynamically
   */
  public setMaxWorkers(count: number): void {
    const oldCount = this.maxWorkers;
    this.maxWorkers = Math.max(1, Math.min(count, 10)); // Between 1 and 10

    if (this.maxWorkers > oldCount) {
      // Add new workers
      for (let i = oldCount; i < this.maxWorkers; i++) {
        this.workers.push({
          id: i,
          busy: false,
          processedCount: 0,
          errorCount: 0
        });
      }
    } else if (this.maxWorkers < oldCount) {
      // Remove excess workers (only if not busy)
      this.workers = this.workers.slice(0, this.maxWorkers);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}