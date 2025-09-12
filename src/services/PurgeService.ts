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
  async purgeUserMessages(
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

    try {
      const channels = await this.getTargetChannels(guild, options.targetId, options.skipChannels);
      
      for (const channel of channels) {
        if (operationManager.isOperationCancelled(operationId)) {
          result.success = false;
          result.errors.push("Operation was cancelled");
          break;
        }

        const channelResult = await this.purgeChannel(
          channel,
          options.userId,
          operationId,
          onProgress
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
    
    // If targetId is the guild ID, get all channels
    if (targetId === guild.id) {
      guild.channels.cache.forEach(channel => {
        if (this.isTextBasedChannel(channel) && !skipChannels.includes(channel.id)) {
          channels.push(channel as SupportedChannel);
        }
      });
    } else {
      const target = guild.channels.cache.get(targetId);
      
      if (!target) {
        throw new Error("Target channel or category not found");
      }

      // If it's a category, get all channels in it
      if (target.type === ChannelType.GuildCategory) {
        guild.channels.cache.forEach(channel => {
          if (channel.parentId === targetId && 
              this.isTextBasedChannel(channel) && 
              !skipChannels.includes(channel.id)) {
            channels.push(channel as SupportedChannel);
          }
        });
      } else if (this.isTextBasedChannel(target)) {
        // Single channel
        channels.push(target as SupportedChannel);
      } else {
        throw new Error("Target is not a valid text channel or category");
      }
    }

    return channels;
  }

  private async purgeChannel(
    channel: SupportedChannel,
    userId: string,
    operationId: string,
    onProgress?: (update: any) => Promise<void>
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

      // Handle forum channels differently
      if (channel.type === ChannelType.GuildForum) {
        result.deleted = await this.purgeForumChannel(
          channel as ForumChannel,
          userId,
          operationId,
          onProgress
        );
      } else {
        result.deleted = await this.purgeTextChannel(
          channel as TextBasedChannel,
          userId,
          operationId,
          onProgress
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
    userId: string,
    operationId: string,
    onProgress?: (update: any) => Promise<void>
  ): Promise<number> {
    const messages = await messageService.fetchUserMessages(
      channel,
      userId,
      () => operationManager.isOperationCancelled(operationId)
    );

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
      }
    );

    return deleted;
  }

  private async purgeForumChannel(
    forum: ForumChannel,
    userId: string,
    operationId: string,
    onProgress?: (update: any) => Promise<void>
  ): Promise<number> {
    let totalDeleted = 0;
    
    // Fetch active threads
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
        userId,
        operationId,
        onProgress
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