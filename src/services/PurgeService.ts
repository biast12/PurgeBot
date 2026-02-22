import {
  Guild,
  ChannelType,
  ForumChannel,
  ThreadChannel
} from "discord.js";
import {
  PurgeOptions,
  PurgeResult,
  TextBasedChannel,
  SupportedChannel
} from "../types";
import { messageService } from "./MessageService";
import { operationManager } from "./OperationManager";
import { ParallelProcessor } from "./ParallelProcessor";
import { logger } from "../utils/logger";
import { LogArea } from "../types/logger";
import { CONSTANTS, ERROR_CODES } from "../config/constants";

export class PurgeService {
  async purgeMessages(
    guild: Guild,
    options: PurgeOptions,
    operationId: string,
    onProgress?: (update: any) => Promise<void>
  ): Promise<PurgeResult> {
    if (options.type === undefined) {
      options.type = 'user';
    }
    return this.executePurge(guild, options, operationId, onProgress);
  }

  async purgeUserMessages(
    guild: Guild,
    options: PurgeOptions,
    operationId: string,
    onProgress?: (update: any) => Promise<void>
  ): Promise<PurgeResult> {
    return this.purgeMessages(
      guild,
      { ...options, type: 'user' },
      operationId,
      onProgress
    );
  }

  private async executePurge(
    guild: Guild,
    options: PurgeOptions,
    operationId: string,
    onProgress?: (update: any) => Promise<void>
  ): Promise<PurgeResult> {
    const startTime = Date.now();
    const result: PurgeResult = {
      success: true,
      totalDeleted: 0,
      duration: 0,
      errors: [],
      channels: []
    };

    let runningTotal = 0;

    try {
      const channels = await this.getTargetChannels(guild, options.targetId, options.skipChannels || [], options.includeThreads || false);

      const useParallel = channels.length >= CONSTANTS.MIN_CHANNELS_FOR_PARALLEL &&
        !options.targetType?.includes('channel');

      if (useParallel) {
        const processor = new ParallelProcessor({
          maxWorkers: Math.min(CONSTANTS.MAX_PARALLEL_WORKERS, channels.length),
          maxRetries: CONSTANTS.PARALLEL_RETRY_ATTEMPTS,
          workerTimeout: CONSTANTS.WORKER_TIMEOUT,
          priorityBoost: {
            smallChannels: 20,
            largeChannels: -10,
            thresholdMessages: 1000
          }
        });

        const channelResults: Map<string, any> = new Map();

        processor.on('channelComplete', async (data: any) => {
          if (data.result) {
            channelResults.set(data.channelName, data.result);
            runningTotal += data.result.deleted || 0;
            operationManager.updateDeletedCount(operationId, runningTotal);

            if (onProgress) {
              await onProgress({
                type: 'channel_complete',
                channelName: data.channelName,
                deleted: data.result.deleted || 0
              });
            }
          }
        });

        processor.on('channelError', (data: any) => {
          logger.error(LogArea.PURGE, `Channel ${data.channelName} failed: ${data.error}`);
          result.errors.push(`${data.channelName}: ${data.error}`);
        });

        processor.addChannels(channels, options, operationId);

        // Start parallel processing
        await processor.start(async (channel, opts, opId) => {
          return this.purgeChannel(channel, opts, opId, undefined, guild);
        });

        // Collect results
        result.totalDeleted = runningTotal;
        result.channels = Array.from(channelResults.values());

      } else {
        // Use sequential processing for single channel or when parallel is not beneficial
        for (const channel of channels) {
          if (operationManager.isOperationCancelled(operationId)) {
            result.success = false;
            result.errors.push("Operation was cancelled");
            break;
          }

          const wrappedProgress = async (update: any) => {
            if (update.type === 'channel_complete' && update.deleted) {
              runningTotal += update.deleted;
              operationManager.updateDeletedCount(operationId, runningTotal);
            }

            if (onProgress) {
              await onProgress(update);
            }
          };

          const channelResult = await this.purgeChannel(
            channel,
            options,
            operationId,
            wrappedProgress,
            guild
          );

          result.totalDeleted += channelResult.deleted;
          result.channels.push(channelResult);

          if (channelResult.error) {
            result.errors.push(channelResult.error);
          }
        }
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message || "Unknown error occurred");
    }

    result.duration = (Date.now() - startTime) / 1000;
    return result;
  }

  private async getTargetChannels(
    guild: Guild,
    targetId: string,
    skipChannels: string[],
    includeThreads: boolean = false
  ): Promise<SupportedChannel[]> {
    const channels: SupportedChannel[] = [];

    if (targetId === guild.id) {
      await guild.channels.fetch();

      for (const channel of guild.channels.cache.values()) {
        if (this.isTextBasedChannel(channel) && !skipChannels.includes(channel.id)) {
          try {
            const fetchedChannel = await guild.channels.fetch(channel.id);
            if (fetchedChannel && this.isTextBasedChannel(fetchedChannel)) {
              channels.push(fetchedChannel as SupportedChannel);
            }
          } catch (err) {
            console.error(`Could not fetch channel ${channel.id}:`, err);
            channels.push(channel as SupportedChannel);
          }
        }
      }
    } else {
      let target;
      try {
        target = await guild.channels.fetch(targetId);
      } catch (err) {
        console.error(`Could not fetch target ${targetId}:`, err);
        target = guild.channels.cache.get(targetId);
      }

      if (!target) {
        throw new Error("Target channel or category not found");
      }

      if (target.type === ChannelType.GuildCategory) {
        await guild.channels.fetch();

        for (const channel of guild.channels.cache.values()) {
          if (channel.parentId === targetId &&
            this.isTextBasedChannel(channel) &&
            !skipChannels.includes(channel.id)) {
            try {
              const fetchedChannel = await guild.channels.fetch(channel.id);
              if (fetchedChannel && this.isTextBasedChannel(fetchedChannel)) {
                channels.push(fetchedChannel as SupportedChannel);
              }
            } catch (err) {
              console.error(`Could not fetch channel ${channel.id}:`, err);
              channels.push(channel as SupportedChannel);
            }
          }
        }
      } else if (this.isTextBasedChannel(target)) {
        channels.push(target as SupportedChannel);
      } else {
        throw new Error("Target is not a valid text channel or category");
      }
    }

    if (includeThreads) {
      const threads = await this.fetchThreadsForChannels(channels, guild);
      channels.push(...threads);
    }

    return channels;
  }

  private async fetchThreadsForChannels(
    channels: SupportedChannel[],
    _guild: Guild
  ): Promise<ThreadChannel[]> {
    const allThreads: ThreadChannel[] = [];

    for (const channel of channels) {
      if (channel.type === ChannelType.GuildText ||
          channel.type === ChannelType.GuildAnnouncement) {
        try {
          const activeThreads = await channel.threads.fetchActive();
          allThreads.push(...activeThreads.threads.values());

          const archivedPublic = await channel.threads.fetchArchived({ type: 'public' });
          allThreads.push(...archivedPublic.threads.values());

          try {
            const archivedPrivate = await channel.threads.fetchArchived({ type: 'private' });
            allThreads.push(...archivedPrivate.threads.values());
          } catch (error: any) {
            // May fail if bot lacks ManageThreads permission, continue with other threads
            if (error.code !== ERROR_CODES.MISSING_ACCESS) {
              await logger.logError(
                LogArea.PURGE,
                `Failed to fetch private threads for channel ${channel.name}`,
                error,
                {
                  channelId: channel.id,
                  channelName: channel.name,
                  guildId: channel.guild?.id,
                  guildName: channel.guild?.name,
                  metadata: { channelType: channel.type, threadType: 'private' }
                }
              );
            }
          }
        } catch (error: any) {
          await logger.logError(
            LogArea.PURGE,
            `Failed to fetch threads for channel ${channel.name}`,
            error,
            {
              channelId: channel.id,
              channelName: channel.name,
              guildId: channel.guild?.id,
              guildName: channel.guild?.name,
              metadata: { channelType: channel.type }
            }
          );
        }
      }
    }

    return allThreads;
  }

  private async purgeChannel(
    channel: SupportedChannel,
    options: PurgeOptions,
    operationId: string,
    onProgress?: (update: any) => Promise<void>,
    guild?: Guild
  ): Promise<{ channelId: string; channelName: string; deleted: number; error?: string }> {
    const result = {
      channelId: channel.id,
      channelName: channel.name,
      deleted: 0,
      error: undefined as string | undefined
    };

    try {
      if (onProgress) {
        await onProgress({
          type: 'channel_start',
          channelName: channel.name
        });
      }

      if (channel.type === ChannelType.GuildForum) {
        result.deleted = await this.purgeForumChannel(
          channel as ForumChannel,
          options,
          operationId,
          onProgress,
          guild
        );
      } else {
        result.deleted = await this.purgeTextChannel(
          channel as TextBasedChannel,
          options,
          operationId,
          onProgress,
          guild
        );
      }

      if (onProgress) {
        await onProgress({
          type: 'channel_complete',
          channelName: channel.name,
          deleted: result.deleted
        });
      }
    } catch (error: any) {
      console.error(`Error purging channel ${channel.name}:`, error);
      result.error = error.message || "Unknown error";
    }

    return result;
  }

  private async purgeTextChannel(
    channel: any,
    options: PurgeOptions,
    operationId: string,
    onProgress?: (update: any) => Promise<void>,
    guild?: Guild
  ): Promise<number> {
    let messages: any[] = [];

    const excludeMessageId = options.excludeMessageId;

    switch (options.type) {
      case 'user':
        messages = await messageService.fetchUserMessages(
          channel,
          options.userId!,
          () => operationManager.isOperationCancelled(operationId),
          options.days,
          excludeMessageId,
          options.contentFilter
        );
        break;

      case 'role':
        messages = await messageService.fetchRoleMessages(
          channel,
          options.roleId!,
          () => operationManager.isOperationCancelled(operationId),
          options.days,
          guild,
          excludeMessageId,
          options.contentFilter,
          options.includeBots
        );
        break;

      case 'everyone':
        messages = await messageService.fetchAllMessages(
          channel,
          () => operationManager.isOperationCancelled(operationId),
          options.days,
          excludeMessageId,
          options.contentFilter,
          options.includeBots
        );
        break;

      case 'inactive':
        messages = await messageService.fetchInactiveUserMessages(
          channel,
          guild || channel.guild,
          () => operationManager.isOperationCancelled(operationId),
          options.days,
          excludeMessageId,
          options.contentFilter,
          options.includeBots
        );
        break;

      default:
        messages = await messageService.fetchUserMessages(
          channel,
          options.userId!,
          () => operationManager.isOperationCancelled(operationId),
          options.days,
          excludeMessageId,
          options.contentFilter
        );
    }

    if (messages.length === 0) return 0;

    const deleted = await messageService.deleteMessages(
      channel,
      messages,
      () => operationManager.isOperationCancelled(operationId),
      async (current, total) => {
        if (onProgress) {
          await onProgress({
            type: 'channel_progress',
            channelName: channel.name,
            current,
            total
          });
        }
      },
      operationId
    );

    return deleted;
  }

  private async purgeForumChannel(
    forum: ForumChannel,
    options: PurgeOptions,
    operationId: string,
    onProgress?: (update: any) => Promise<void>,
    guild?: Guild
  ): Promise<number> {
    let totalDeleted = 0;

    const activeThreads = await forum.threads.fetchActive();
    const archivedThreads = await forum.threads.fetchArchived();

    const allThreads = [
      ...activeThreads.threads.values(),
      ...archivedThreads.threads.values()
    ];

    for (const thread of allThreads) {
      if (operationManager.isOperationCancelled(operationId)) break;

      const deleted = await this.purgeTextChannel(
        thread,
        options,
        operationId,
        onProgress,
        guild
      );

      totalDeleted += deleted;
    }

    return totalDeleted;
  }

  private isTextBasedChannel(channel: any): boolean {
    return [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildVoice,
      ChannelType.GuildForum
    ].includes(channel.type);
  }
}

export const purgeService = new PurgeService();