import { Guild, ChannelType } from "discord.js";
import { ValidationResult } from "../types";

export class ValidationService {
  async validateTarget(guild: Guild, targetId: string): Promise<ValidationResult & { targetType?: string }> {
    if (targetId === guild.id) {
      return {
        isValid: true,
        targetName: guild.name,
        targetType: 'server'
      };
    }

    const channel = guild.channels.cache.get(targetId);
    
    if (!channel) {
      return {
        isValid: false,
        error: "Target not found in this server"
      };
    }

    if (channel.type === ChannelType.GuildCategory) {
      const hasTextChannels = guild.channels.cache.some(
        ch => ch.parentId === targetId && this.isTextBasedChannel(ch.type)
      );
      
      if (!hasTextChannels) {
        return {
          isValid: false,
          error: "Category has no text channels"
        };
      }
      
      return {
        isValid: true,
        targetName: channel.name,
        targetType: 'category'
      };
    }

    if (this.isTextBasedChannel(channel.type)) {
      return {
        isValid: true,
        targetName: channel.name,
        targetType: 'channel'
      };
    }

    return {
      isValid: false,
      error: "Target must be a text channel, category, or the server itself"
    };
  }

  validateUserId(userId: string): boolean {
    return /^\d{17,19}$/.test(userId);
  }

  private isTextBasedChannel(type: ChannelType): boolean {
    return [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildVoice,
      ChannelType.GuildForum,
      ChannelType.PublicThread,
      ChannelType.PrivateThread
    ].includes(type);
  }
}