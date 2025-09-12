/**
 * Logger types and enums for structured logging
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  NONE = 'NONE'
}

export enum LogArea {
  BOT = 'BOT',
  COMMANDS = 'COMMANDS',
  EVENTS = 'EVENTS',
  API = 'API',
  CONFIG = 'CONFIG',
  STARTUP = 'STARTUP',
  SHUTDOWN = 'SHUTDOWN',
  PURGE = 'PURGE',
  NONE = 'NONE'
}

export interface LoggerConfig {
  consoleEnabled: boolean;
  minLevel: LogLevel;
}