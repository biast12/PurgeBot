import { LogArea } from '../types/logger';

export interface ErrorDocument {
  id: number;
  timestamp: string;               // ISO format (UTC)
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  area: LogArea;
  message: string;
  stack_trace?: string;            // Full stack trace
  guild_id?: string;
  guild_name?: string;
  channel_id?: string;
  channel_name?: string;
  user_id?: string;
  command?: string;                // Command name that triggered error
  context?: Record<string, any>;  // Additional context data
}

export class ErrorDocumentBuilder {
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
  ): Omit<ErrorDocument, 'id'> {
    return {
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
      context: context?.metadata,
    };
  }
}
