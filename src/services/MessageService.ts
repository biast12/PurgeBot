import { 
  Message
} from "discord.js";
import { TextBasedChannel } from "../types";
import { CONSTANTS, ERROR_CODES } from "../config/constants";
import { RateLimiter } from "../utils/RateLimiter";

export class MessageService {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter();
  }

  async fetchUserMessages(
    channel: TextBasedChannel,
    userId: string,
    onCancel: () => boolean,
    days?: number | null,
    excludeMessageId?: string
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
        });

        if (messages.size === 0) break;

        messages.forEach((msg: Message) => {
          if (excludeMessageId && msg.id === excludeMessageId) return;
          
          if (msg.author?.id === userId) {
            if (!days || msg.createdTimestamp >= cutoffTime) {
              userMessages.push(msg);
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
    excludeMessageId?: string
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
        });

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
              roleMessages.push(msg);
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
    excludeMessageId?: string
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
        });

        if (messages.size === 0) break;

        messages.forEach((msg: Message) => {
          if (excludeMessageId && msg.id === excludeMessageId) return;
          
          if (!msg.system) {
            if (!days || msg.createdTimestamp >= cutoffTime) {
              allMessages.push(msg);
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
    excludeMessageId?: string
  ): Promise<Message[]> {
    const inactiveMessages: Message[] = [];
    let lastMessageId: string | undefined;
    const cutoffTime = days ? Date.now() - (days * 24 * 60 * 60 * 1000) : 0;

    await guild.members.fetch().catch(() => {});
    const currentMembers = new Set(guild.members.cache.keys());

    while (!onCancel()) {
      try {
        const messages = await this.rateLimiter.execute(async () => {
          return await channel.messages.fetch({
            limit: CONSTANTS.FETCH_LIMIT,
            before: lastMessageId
          });
        });

        if (messages.size === 0) break;

        messages.forEach((msg: Message) => {
          if (excludeMessageId && msg.id === excludeMessageId) return;
          
          if (!msg.system && !currentMembers.has(msg.author.id)) {
            if (!days || msg.createdTimestamp >= cutoffTime) {
              inactiveMessages.push(msg);
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
    let deleted = 0;
    const chunkSize = CONSTANTS.BULK_DELETE_CHUNK_SIZE;
    
    for (let i = 0; i < messages.length; i += chunkSize) {
      if (onCancel()) {
        console.log(`Bulk delete cancelled after ${deleted} messages`);
        break;
      }
      
      const chunk = messages.slice(i, i + Math.min(chunkSize, CONSTANTS.BULK_DELETE_LIMIT));
      
      try {
        if ('bulkDelete' in channel) {
          const result = await this.rateLimiter.execute(async () => {
            return await (channel as any).bulkDelete(chunk, true);
          });
          deleted += result.size;
          if (operationId && result.size > 0) {
            const { operationManager } = await import('./OperationManager');
            const currentTotal = operationManager.getDeletedCount(operationId);
            operationManager.updateDeletedCount(operationId, currentTotal + result.size);
          }
        } else {
          deleted += await this.individualDelete(channel, chunk, onCancel, undefined, operationId);
        }
      } catch (error: any) {
        console.error(`Error bulk deleting messages:`, error);
        deleted += await this.individualDelete(channel, chunk, onCancel, undefined, operationId);
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
    
    for (let i = 0; i < messages.length; i++) {
      if (onCancel()) break;
      
      const message = messages[i];
      
      try {
        await this.rateLimiter.execute(async () => {
          await message.delete();
        });
        
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
        if (error.code !== ERROR_CODES.UNKNOWN_MESSAGE) {
          console.error(`Error deleting message ${message.id}:`, error);
        }
      }
    }
    if (onProgress && deleted > 0) {
      await onProgress(deleted, messages.length);
    }
    
    return deleted;
  }
}

export const messageService = new MessageService();