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
    onCancel: () => boolean
  ): Promise<Message[]> {
    const userMessages: Message[] = [];
    let lastMessageId: string | undefined;

    while (!onCancel()) {
      try {
        const messages = await this.rateLimiter.execute(async () => {
          return await channel.messages.fetch({
            limit: CONSTANTS.FETCH_LIMIT,
            before: lastMessageId
          });
        });

        if (messages.size === 0) break;

        // Filter messages from the target user
        messages.forEach(msg => {
          if (msg.author?.id === userId) {
            userMessages.push(msg);
          }
        });

        lastMessageId = messages.last()?.id;
        if (!lastMessageId) break;

      } catch (error) {
        console.error(`Error fetching messages in channel ${channel.id}:`, error);
        break;
      }
    }

    return userMessages;
  }

  async deleteMessages(
    channel: TextBasedChannel,
    messages: Message[],
    onCancel: () => boolean,
    onProgress?: (current: number, total: number) => Promise<void>
  ): Promise<number> {
    if (messages.length === 0) return 0;

    // Separate messages by age (14 days threshold for bulk delete)
    const now = Date.now();
    const bulkDeletable = messages.filter(
      msg => now - msg.createdTimestamp < CONSTANTS.MESSAGE_AGE_LIMIT
    );
    const oldMessages = messages.filter(
      msg => now - msg.createdTimestamp >= CONSTANTS.MESSAGE_AGE_LIMIT
    );

    let deleted = 0;

    // Bulk delete newer messages
    if (bulkDeletable.length > 0 && !onCancel()) {
      deleted += await this.bulkDelete(channel, bulkDeletable, onCancel);
    }

    // Individual delete for older messages
    if (oldMessages.length > 0 && !onCancel()) {
      deleted += await this.individualDelete(
        channel, 
        oldMessages, 
        onCancel,
        async (current, _total) => {
          if (onProgress) {
            await onProgress(deleted + current, messages.length);
          }
        }
      );
    }

    return deleted;
  }

  private async bulkDelete(
    channel: TextBasedChannel,
    messages: Message[],
    onCancel: () => boolean
  ): Promise<number> {
    let deleted = 0;
    
    // Process in chunks of 100 (Discord's bulk delete limit)
    for (let i = 0; i < messages.length; i += CONSTANTS.BULK_DELETE_LIMIT) {
      if (onCancel()) break;
      
      const chunk = messages.slice(i, i + CONSTANTS.BULK_DELETE_LIMIT);
      
      try {
        if ('bulkDelete' in channel) {
          const result = await this.rateLimiter.execute(async () => {
            return await (channel as any).bulkDelete(chunk, true);
          });
          deleted += result.size;
        } else {
          // Fall back to individual deletion for channels without bulkDelete
          deleted += await this.individualDelete(channel, chunk, onCancel);
        }
      } catch (error: any) {
        console.error(`Error bulk deleting messages:`, error);
        // Fall back to individual deletion for this chunk
        deleted += await this.individualDelete(channel, chunk, onCancel);
      }
    }
    
    return deleted;
  }

  private async individualDelete(
    _channel: TextBasedChannel,
    messages: Message[],
    onCancel: () => boolean,
    onProgress?: (current: number, total: number) => Promise<void>
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
        
        // Update progress at intervals
        if (onProgress && i % CONSTANTS.PROGRESS_UPDATE_INTERVAL === 0) {
          await onProgress(i + 1, messages.length);
        }
      } catch (error: any) {
        // Ignore messages that are already deleted or can't be deleted
        if (error.code !== ERROR_CODES.UNKNOWN_MESSAGE) {
          console.error(`Error deleting message ${message.id}:`, error);
        }
      }
    }
    
    // Final progress update
    if (onProgress && deleted > 0) {
      await onProgress(deleted, messages.length);
    }
    
    return deleted;
  }
}

export const messageService = new MessageService();