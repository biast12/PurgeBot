import { 
  Guild, 
  ChannelType,
  ForumChannel
} from "discord.js";
import { 
  PurgeOptions, 
  PurgeResult, 
  TextBasedChannel,
  SupportedChannel
} from "../types";
import { messageService } from "./MessageService";
import { operationManager } from "./OperationManager";

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
      const channels = await this.getTargetChannels(guild, options.targetId, options.skipChannels || []);
      
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
    skipChannels: string[]
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

    return channels;
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
          options.contentFilter
        );
        break;

      case 'everyone':
        messages = await messageService.fetchAllMessages(
          channel,
          () => operationManager.isOperationCancelled(operationId),
          options.days,
          excludeMessageId,
          options.contentFilter
        );
        break;

      case 'inactive':
        messages = await messageService.fetchInactiveUserMessages(
          channel,
          guild || channel.guild,
          () => operationManager.isOperationCancelled(operationId),
          options.days,
          excludeMessageId,
          options.contentFilter
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
      ChannelType.GuildForum,
      ChannelType.PublicThread,
      ChannelType.PrivateThread
    ].includes(channel.type);
  }
}

export const purgeService = new PurgeService();