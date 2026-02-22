import {
  Client,
  ChatInputCommandInteraction,
  TextChannel,
  ThreadChannel,
  NewsChannel,
  VoiceChannel,
  ForumChannel,
  AutocompleteInteraction
} from "discord.js";
import { ContentFilter } from "../services/ContentFilter";

export type SupportedChannel = TextChannel | ThreadChannel | NewsChannel | VoiceChannel | ForumChannel;
export type TextBasedChannel = TextChannel | ThreadChannel | NewsChannel | VoiceChannel;

export interface CommandContext {
  client: Client;
  interaction: ChatInputCommandInteraction;
}

export interface AutocompleteContext {
  client: Client;
  interaction: AutocompleteInteraction;
}

export interface PurgeOptions {
  targetId: string;
  targetType?: 'server' | 'category' | 'channel';
  userId?: string;
  roleId?: string;
  roleName?: string;
  type?: 'user' | 'role' | 'everyone' | 'inactive';
  contentFilter?: ContentFilter;
  days?: number | null;
  skipChannels?: string[];
  excludeMessageId?: string;
  includeThreads?: boolean;
  includeBots?: boolean;
}

export interface PurgeProgress {
  channelName: string;
  totalMessages: number;
  deletedMessages: number;
  status: 'fetching' | 'deleting' | 'completed' | 'error';
  error?: string;
}

export interface PurgeResult {
  success: boolean;
  totalDeleted: number;
  duration: number;
  errors: string[];
  channels: {
    channelId: string;
    channelName: string;
    deleted: number;
  }[];
}


export interface ValidationResult {
  isValid: boolean;
  targetName?: string;
  targetType?: 'server' | 'category' | 'channel';
  error?: string;
}

export interface ProgressUpdate {
  type: 'channel_start' | 'channel_progress' | 'channel_complete' | 'operation_complete';
  channelName?: string;
  current?: number;
  total?: number;
  deleted?: number;
}

export interface RateLimitConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export interface BotConfig {
  token: string;
  rateLimit: RateLimitConfig;
}

export type CommandHandler = {
  data: any;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: Record<string, (interaction: AutocompleteInteraction) => Promise<void>>;
};

export interface OperationState {
  id: string;
  guildId: string;
  cancelled: boolean;
  startTime: number;
  interaction: ChatInputCommandInteraction;
  deletedCount?: number;
}