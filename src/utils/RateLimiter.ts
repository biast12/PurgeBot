import { CONSTANTS, ERROR_CODES } from "../config/constants";

interface QueueItem<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

export class RateLimiter {
  private queue: QueueItem<any>[] = [];
  private processing = false;
  private retryDelay: number = CONSTANTS.DEFAULT_RETRY_DELAY;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ execute: fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      try {
        const result = await this.executeWithRetry(item.execute);
        item.resolve(result);
        this.retryDelay = CONSTANTS.DEFAULT_RETRY_DELAY; // Reset delay on success
      } catch (error) {
        item.reject(error);
      }
      
      // Small delay between operations to avoid hitting rate limits
      await this.delay(100);
    }
    
    this.processing = false;
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (error.code === ERROR_CODES.RATE_LIMITED && retries < CONSTANTS.MAX_RETRIES) {
        const delay = error.retry_after || this.retryDelay;
        console.warn(`Rate limited. Retrying after ${delay}ms...`);
        
        await this.delay(delay);
        
        // Exponential backoff
        this.retryDelay = Math.min(this.retryDelay * 2, CONSTANTS.MAX_RETRY_DELAY);
        
        return this.executeWithRetry(fn, retries + 1);
      }
      
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}