import {
  Message
} from "discord.js";
import { TextBasedChannel } from "../types";
import { CONSTANTS, ERROR_CODES } from "../config/constants";
import { RateLimiter } from "../utils/RateLimiter";
import { ContentFilter } from "./ContentFilter";
import { batchOptimizer } from "./BatchOptimizer";
import { threadArchiveService } from "./ThreadArchiveService";

export class MessageService {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter({
      baseDelay: 100,
      maxDelay: 5000,
      enableMetrics: false // Set to true for debugging
    });
  }

  async fetchUserMessages(
    channel: TextBasedChannel,
    userId: string,
    onCancel: () => boolean,
    days?: number | null,
    excludeMessageId?: string,
    contentFilter?: ContentFilter
  ): Promise<Message[]> {
    const userMessages: Message[] = [];
    let lastMessageId: string | undefined;
    const cutoffTime = days ? Date.now() - (days * 24 * 60 * 60 * 1000) : 0;

    while (!onCancel()) {
      try {
        const messages = await this.rateLimiter.execute(async () => {
          return await channel.messages.fetch({
            limit: CONSTANTS.FETCH_LIMIT,
            before: lastMessageId
          });
        }, `fetch_${channel.id}`);

        if (messages.size === 0) break;

        messages.forEach((msg: Message) => {
          if (excludeMessageId && msg.id === excludeMessageId) return;

          if (msg.author?.id === userId) {
            if (!days || msg.createdTimestamp >= cutoffTime) {
              // Apply content filter if provided
              if (!contentFilter || contentFilter.matches(msg)) {
                userMessages.push(msg);
              }
            }
          }
        });

        if (days && messages.last()?.createdTimestamp && messages.last()!.createdTimestamp < cutoffTime) {
          break;
        }

        lastMessageId = messages.last()?.id;
        if (!lastMessageId) break;

      } catch (error) {
        console.error(`Error fetching messages in channel ${channel.id}:`, error);
        break;
      }
    }

    return userMessages;
  }

  async fetchRoleMessages(
    channel: any,
    roleId: string,
    onCancel: () => boolean,
    days?: number | null,
    guild?: any,
    excludeMessageId?: string,
    contentFilter?: ContentFilter
  ): Promise<Message[]> {
    const roleMessages: Message[] = [];
    let lastMessageId: string | undefined;
    const cutoffTime = days ? Date.now() - (days * 24 * 60 * 60 * 1000) : 0;
    const guildRef = guild || channel.guild;
    if (guildRef) {
      try {
        await guildRef.members.fetch();
      } catch (err) {
      }
    }

    while (!onCancel()) {
      try {
        const messages = await this.rateLimiter.execute(async () => {
          return await channel.messages.fetch({
            limit: CONSTANTS.FETCH_LIMIT,
            before: lastMessageId
          });
        }, `fetch_${channel.id}`);

        if (messages.size === 0) break;

        for (const msg of messages.values()) {
          if (msg.system) continue;
          if (excludeMessageId && msg.id === excludeMessageId) continue;
          let member = msg.member;
          const guildToUse = guildRef || guild || channel.guild;
          if (!member && guildToUse) {
            try {
              member = await guildToUse.members.fetch(msg.author.id).catch(() => null);
            } catch {
              member = null;
            }
          }

          if (member && member.roles.cache.has(roleId)) {
            if (!days || msg.createdTimestamp >= cutoffTime) {
              // Apply content filter if provided
              if (!contentFilter || contentFilter.matches(msg)) {
                roleMessages.push(msg);
              }
            }
          }
        }

        if (days && messages.last()?.createdTimestamp && messages.last()!.createdTimestamp < cutoffTime) {
          break;
        }

        lastMessageId = messages.last()?.id;
        if (!lastMessageId) break;

      } catch (error) {
        console.error(`Error fetching messages in channel ${channel.id}:`, error);
        break;
      }
    }

    return roleMessages;
  }

  async fetchAllMessages(
    channel: any,
    onCancel: () => boolean,
    days?: number | null,
    excludeMessageId?: string,
    contentFilter?: ContentFilter
  ): Promise<Message[]> {
    const allMessages: Message[] = [];
    let lastMessageId: string | undefined;
    const cutoffTime = days ? Date.now() - (days * 24 * 60 * 60 * 1000) : 0;

    while (!onCancel()) {
      try {
        const messages = await this.rateLimiter.execute(async () => {
          return await channel.messages.fetch({
            limit: CONSTANTS.FETCH_LIMIT,
            before: lastMessageId
          });
        }, `fetch_${channel.id}`);

        if (messages.size === 0) break;

        messages.forEach((msg: Message) => {
          if (excludeMessageId && msg.id === excludeMessageId) return;

          if (!msg.system) {
            if (!days || msg.createdTimestamp >= cutoffTime) {
              // Apply content filter if provided
              if (!contentFilter || contentFilter.matches(msg)) {
                allMessages.push(msg);
              }
            }
          }
        });

        if (days && messages.last()?.createdTimestamp && messages.last()!.createdTimestamp < cutoffTime) {
          break;
        }

        lastMessageId = messages.last()?.id;
        if (!lastMessageId) break;

      } catch (error) {
        console.error(`Error fetching messages in channel ${channel.id}:`, error);
        break;
      }
    }

    return allMessages;
  }

  async fetchInactiveUserMessages(
    channel: any,
    guild: any,
    onCancel: () => boolean,
    days?: number | null,
    excludeMessageId?: string,
    contentFilter?: ContentFilter
  ): Promise<Message[]> {
    const inactiveMessages: Message[] = [];
    let lastMessageId: string | undefined;
    const cutoffTime = days ? Date.now() - (days * 24 * 60 * 60 * 1000) : 0;

    await guild.members.fetch().catch(() => { });
    const currentMembers = new Set(guild.members.cache.keys());

    while (!onCancel()) {
      try {
        const messages = await this.rateLimiter.execute(async () => {
          return await channel.messages.fetch({
            limit: CONSTANTS.FETCH_LIMIT,
            before: lastMessageId
          });
        }, `fetch_${channel.id}`);

        if (messages.size === 0) break;

        messages.forEach((msg: Message) => {
          if (excludeMessageId && msg.id === excludeMessageId) return;

          if (!msg.system && !currentMembers.has(msg.author.id)) {
            if (!days || msg.createdTimestamp >= cutoffTime) {
              // Apply content filter if provided
              if (!contentFilter || contentFilter.matches(msg)) {
                inactiveMessages.push(msg);
              }
            }
          }
        });

        if (days && messages.last()?.createdTimestamp && messages.last()!.createdTimestamp < cutoffTime) {
          break;
        }

        lastMessageId = messages.last()?.id;
        if (!lastMessageId) break;

      } catch (error) {
        console.error(`Error fetching messages in channel ${channel.id}:`, error);
        break;
      }
    }

    return inactiveMessages;
  }

  async deleteMessages(
    channel: TextBasedChannel,
    messages: Message[],
    onCancel: () => boolean,
    onProgress?: (current: number, total: number) => Promise<void>,
    operationId?: string
  ): Promise<number> {
    if (messages.length === 0) return 0;

    const now = Date.now();
    const bulkDeletable = messages.filter(
      msg => now - msg.createdTimestamp < CONSTANTS.MESSAGE_AGE_LIMIT
    );
    const oldMessages = messages.filter(
      msg => now - msg.createdTimestamp >= CONSTANTS.MESSAGE_AGE_LIMIT
    );

    let deleted = 0;

    if (bulkDeletable.length > 0 && !onCancel()) {
      deleted += await this.bulkDelete(channel, bulkDeletable, onCancel, operationId);
    }

    if (oldMessages.length > 0 && !onCancel()) {
      deleted += await this.individualDelete(
        channel,
        oldMessages,
        onCancel,
        async (current, _total) => {
          if (onProgress) {
            await onProgress(deleted + current, messages.length);
          }
        },
        operationId
      );
    }

    return deleted;
  }

  private async bulkDelete(
    channel: TextBasedChannel,
    messages: Message[],
    onCancel: () => boolean,
    operationId?: string
  ): Promise<number> {
    // Skip bulk delete for archived threads, use individual delete instead
    if (threadArchiveService.isArchivedThread(channel)) {
      return await this.individualDelete(channel, messages, onCancel, undefined, operationId);
    }

    let deleted = 0;

    // Update performance metrics
    const rateLimiterMetrics = this.rateLimiter.getMetrics();
    batchOptimizer.updatePerformanceMetrics({
      queueDepth: rateLimiterMetrics.queueLength,
      activeOperations: rateLimiterMetrics.buckets.length
    });

    // Get optimal batch size for this channel
    let chunkSize = batchOptimizer.getOptimalBatchSize(channel.id, messages.length);

    for (let i = 0; i < messages.length; i += chunkSize) {
      if (onCancel()) {
        console.log(`Bulk delete cancelled after ${deleted} messages`);
        break;
      }

      // Recalculate optimal size for each batch based on performance
      if (i > 0) {
        chunkSize = batchOptimizer.getOptimalBatchSize(channel.id, messages.length - i);
      }

      const chunk = messages.slice(i, i + Math.min(chunkSize, CONSTANTS.BULK_DELETE_LIMIT));

      const startTime = Date.now();
      let batchSuccess = false;
      let rateLimitHit = false;

      try {
        if ('bulkDelete' in channel) {
          const result = await this.rateLimiter.execute(async () => {
            return await (channel as any).bulkDelete(chunk, true);
          }, `delete_${channel.id}`, 1);
          deleted += result.size;
          batchSuccess = true;

          if (operationId && result.size > 0) {
            const { operationManager } = await import('./OperationManager');
            const currentTotal = operationManager.getDeletedCount(operationId);
            operationManager.updateDeletedCount(operationId, currentTotal + result.size);
          }
        } else {
          deleted += await this.individualDelete(channel, chunk, onCancel, undefined, operationId);
          batchSuccess = true;
        }
      } catch (error: any) {
        console.error(`Error bulk deleting messages:`, error);

        // Check if it's a rate limit error
        if (error.code === ERROR_CODES.RATE_LIMITED || error.status === 429) {
          rateLimitHit = true;
        }

        // Fall back to individual deletion
        deleted += await this.individualDelete(channel, chunk, onCancel, undefined, operationId);
        batchSuccess = false;
      } finally {
        // Update batch metrics
        const processingTime = Date.now() - startTime;
        batchOptimizer.updateBatchMetrics(
          channel.id,
          chunk.length,
          processingTime,
          batchSuccess,
          rateLimitHit
        );
      }
    }

    return deleted;
  }

  private async individualDelete(
    _channel: TextBasedChannel,
    messages: Message[],
    onCancel: () => boolean,
    onProgress?: (current: number, total: number) => Promise<void>,
    operationId?: string
  ): Promise<number> {
    let deleted = 0;

    // Handle archived threads
    const isArchivedThread = threadArchiveService.isArchivedThread(_channel);
    let threadState = null;

    if (isArchivedThread) {
      threadState = threadArchiveService.captureState(_channel as any);
      const unarchived = await threadArchiveService.unarchive(_channel as any);
      if (!unarchived) {
        console.error(`Cannot delete messages from archived thread: unable to unarchive`);
        return 0;
      }
    }

    for (let i = 0; i < messages.length; i++) {
      if (onCancel()) break;

      const message = messages[i];

      try {
        await this.rateLimiter.execute(async () => {
          await message.delete();
        }, `delete_${_channel.id}`, 0);

        deleted++;

        if (operationId && deleted % 5 === 0) {
          const { operationManager } = await import('./OperationManager');
          const currentTotal = operationManager.getDeletedCount(operationId);
          operationManager.updateDeletedCount(operationId, currentTotal + 5);
        }
        if (onProgress && i % CONSTANTS.PROGRESS_UPDATE_INTERVAL === 0) {
          await onProgress(i + 1, messages.length);
        }
      } catch (error: any) {
        // Enhanced error handling for threads
        if (error.code === ERROR_CODES.THREAD_ARCHIVED) {
          console.error(`Thread became archived during deletion, stopping`);
          break;
        } else if (error.code !== ERROR_CODES.UNKNOWN_MESSAGE) {
          console.error(`Error deleting message ${message.id}:`, error);
        }
      }
    }
    if (onProgress && deleted > 0) {
      await onProgress(deleted, messages.length);
    }

    // Restore archive state
    if (isArchivedThread && threadState) {
      await threadArchiveService.restoreState(_channel as any, threadState);
    }

    return deleted;
  }
  // Expose rate limiter metrics for monitoring
  public getRateLimiterMetrics() {
    return this.rateLimiter.getMetrics();
  }

  public resetRateLimiterMetrics() {
    this.rateLimiter.resetMetrics();
  }

  // Expose batch optimizer metrics
  public getBatchOptimizerMetrics() {
    return batchOptimizer.getMetrics();
  }

  public resetBatchOptimizerMetrics(channelId?: string) {
    if (channelId) {
      batchOptimizer.resetChannelMetrics(channelId);
    } else {
      batchOptimizer.resetAllMetrics();
    }
  }
}

export const messageService = new MessageService();