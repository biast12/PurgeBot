import { LogArea } from '../types/logger';

/**
 * Error document structure stored in MongoDB
 */
export interface ErrorDocument {
  _id: string;                    // 8-character UUID
  timestamp: string;              // ISO format (UTC)
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  area: LogArea;
  message: string;
  stack_trace?: string;           // Full stack trace
  guild_id?: string;
  guild_name?: string;
  channel_id?: string;
  channel_name?: string;
  user_id?: string;
  command?: string;               // Command name that triggered error
  context?: Record<string, any>;  // Additional context data
}

/**
 * Builder class for creating ErrorDocument instances
 */
export class ErrorDocumentBuilder {
  /**
   * Create an error document with all relevant context
   */
  static create(
    level: string,
    area: LogArea,
    message: string,
    error?: Error,
    context?: {
      guildId?: string;
      guildName?: string;
      channelId?: string;
      channelName?: string;
      userId?: string;
      command?: string;
      metadata?: Record<string, any>;
    }
  ): ErrorDocument {
    return {
      _id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      level: level as any,
      area,
      message,
      stack_trace: error?.stack,
      guild_id: context?.guildId,
      guild_name: context?.guildName,
      channel_id: context?.channelId,
      channel_name: context?.channelName,
      user_id: context?.userId,
      command: context?.command,
      context: context?.metadata
    };
  }

  /**
   * Generate 8-character error ID (uppercase alphanumeric)
   */
  private static generateErrorId(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }
}
