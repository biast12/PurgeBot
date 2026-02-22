import { LogLevel, LogArea, LoggerConfig } from '../types/logger';
import { DatabaseManager } from '../services/DatabaseManager';
import { ErrorDocument, ErrorDocumentBuilder } from '../models/ErrorDocument';

export class BotLogger {
  private static instance: BotLogger;
  private initialized = false;
  private consoleEnabled = true;
  private minLevel = LogLevel.INFO;
  private dbEnabled = false;
  private db: DatabaseManager;

  private constructor() {
    if (!this.initialized) {
      this.initialized = true;
    }
    this.db = DatabaseManager.getInstance();
  }

  public static getInstance(): BotLogger {
    if (!BotLogger.instance) {
      BotLogger.instance = new BotLogger();
    }
    return BotLogger.instance;
  }

  private getColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[90m',     // Gray
      [LogLevel.INFO]: '\x1b[92m',      // Green
      [LogLevel.WARNING]: '\x1b[93m',   // Yellow
      [LogLevel.ERROR]: '\x1b[91m',     // Red
      [LogLevel.CRITICAL]: '\x1b[95m',  // Magenta
      [LogLevel.NONE]: '\x1b[37m'       // White/default
    };
    return colors[level] || '';
  }

  private resetColor(): string {
    return '\x1b[0m';
  }

  private shouldLog(level: LogLevel): boolean {
    if (level === LogLevel.NONE) {
      return true;
    }

    const levelOrder = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARNING,
      LogLevel.ERROR,
      LogLevel.CRITICAL
    ];

    return levelOrder.indexOf(level) >= levelOrder.indexOf(this.minLevel);
  }

  private formatMessage(level: LogLevel, area: LogArea, message: string): string {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: 'UTC'
    });
    const color = this.getColor(level);
    const reset = this.resetColor();

    if (level === LogLevel.NONE && area === LogArea.NONE) {
      return `${color}[${timestamp}] ${message}${reset}`;
    } else if (level === LogLevel.NONE) {
      return `${color}[${timestamp}] [${area.padEnd(10)}] ${message}${reset}`;
    } else if (area === LogArea.NONE) {
      return `${color}[${timestamp}] [${level.padEnd(8)}] ${message}${reset}`;
    } else {
      return `${color}[${timestamp}] [${level.padEnd(8)}] [${area.padEnd(10)}] ${message}${reset}`;
    }
  }


  public configure(config: Partial<LoggerConfig>): void {
    if (config.consoleEnabled !== undefined) {
      this.consoleEnabled = config.consoleEnabled;
    }
    if (config.minLevel !== undefined) {
      this.minLevel = config.minLevel;
    }
  }

  public log(level: LogLevel, area: LogArea, message: string): void {
    if (!this.shouldLog(level)) {
      return;
    }

    if (this.consoleEnabled) {
      const formatted = this.formatMessage(level, area, message);
      try {
        console.log(formatted);
      } catch (error) {
        const safeFormatted = formatted.replace(/[\u0000-\u001F\u007F-\u009F]/g, '?');
        console.log(safeFormatted);
      }
    }
  }


  public debug(area: LogArea, message: string): void {
    this.log(LogLevel.DEBUG, area, message);
  }

  public info(area: LogArea, message: string): void {
    this.log(LogLevel.INFO, area, message);
  }

  public warning(area: LogArea, message: string): void {
    this.log(LogLevel.WARNING, area, message);
  }

  public error(area: LogArea, message: string): void {
    this.log(LogLevel.ERROR, area, message);
  }

  public critical(area: LogArea, message: string): void {
    this.log(LogLevel.CRITICAL, area, message);
  }

  public print(message: string): void {
    this.log(LogLevel.NONE, LogArea.NONE, message);
  }

  public spacer(char: string = '=', length?: number, color?: LogLevel): void {
    let terminalWidth = length;

    if (!terminalWidth) {
      try {
        terminalWidth = process.stdout.columns || 100;
      } catch {
        terminalWidth = 100;
      }
    }

    const colorCode = color ? this.getColor(color) : '\x1b[36m'; // Cyan by default
    const reset = this.resetColor();
    const output = `${colorCode}${char.repeat(terminalWidth)}${reset}`;

    try {
      console.log(output);
    } catch {
      const safeOutput = output.replace(/[\u0000-\u001F\u007F-\u009F]/g, '?');
      console.log(safeOutput);
    }
  }

  public get isDebugEnabled(): boolean {
    return this.minLevel === LogLevel.DEBUG;
  }

  public get currentLogLevel(): LogLevel {
    return this.minLevel;
  }

  public setLogLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public enableConsole(): void {
    this.consoleEnabled = true;
  }

  public disableConsole(): void {
    this.consoleEnabled = false;
  }

  /**
   * Enable database logging
   */
  public enableDatabase(): void {
    this.dbEnabled = true;
  }

  /**
   * Log error to console and database (if enabled)
   * @returns error_id if saved to database, undefined otherwise
   */
  async logError(
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
  ): Promise<string | undefined> {
    // Log to console (existing behavior)
    this.error(area, message);
    if (error?.stack) {
      console.error(error.stack);
    }

    // Save to database if enabled
    if (this.dbEnabled) {
      try {
        const errorDoc = ErrorDocumentBuilder.create(
          'ERROR',
          area,
          message,
          error,
          context
        );

        await this.db.errors.insertOne(errorDoc as any);
        return errorDoc._id;
      } catch (dbError) {
        // Fallback: if database fails, at least we have console logs
        console.error('Failed to save error to database:', dbError);
      }
    }

    return undefined;
  }

  /**
   * Log critical error to console and database
   * @returns error_id if saved to database
   */
  async logCritical(
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
  ): Promise<string | undefined> {
    this.critical(area, message);
    if (error?.stack) {
      console.error(error.stack);
    }

    if (this.dbEnabled) {
      try {
        const errorDoc = ErrorDocumentBuilder.create(
          'CRITICAL',
          area,
          message,
          error,
          context
        );

        await this.db.errors.insertOne(errorDoc as any);
        return errorDoc._id;
      } catch (dbError) {
        console.error('Failed to save critical error to database:', dbError);
      }
    }

    return undefined;
  }

  /**
   * Get a specific error by ID
   */
  async getError(errorId: string): Promise<ErrorDocument | null> {
    if (!this.dbEnabled) return null;

    try {
      return await this.db.errors.findOne({ _id: errorId }) as ErrorDocument | null;
    } catch (error) {
      console.error('Failed to fetch error:', error);
      return null;
    }
  }

  /**
   * Get recent errors
   */
  async getRecentErrors(limit: number = 10, guildId?: string): Promise<ErrorDocument[]> {
    if (!this.dbEnabled) return [];

    try {
      const query: any = {};
      if (guildId) {
        query.guild_id = guildId;
      }

      return await this.db.errors
        .find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray() as ErrorDocument[];
    } catch (error) {
      console.error('Failed to fetch recent errors:', error);
      return [];
    }
  }

  /**
   * Delete a specific error by ID
   */
  async deleteError(errorId: string): Promise<boolean> {
    if (!this.dbEnabled) return false;

    try {
      const result = await this.db.errors.deleteOne({ _id: errorId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Failed to delete error:', error);
      return false;
    }
  }

  /**
   * Clear errors matching the provided filters
   */
  async clearErrors(filters: {
    area?: LogArea;
    level?: string;
    guildId?: string;
    olderThanDays?: number;
    messagePattern?: string;
  }): Promise<number> {
    if (!this.dbEnabled) return 0;

    try {
      const query: any = {};

      if (filters.area) {
        query.area = filters.area;
      }

      if (filters.level) {
        query.level = filters.level.toUpperCase();
      }

      if (filters.guildId) {
        query.guild_id = filters.guildId;
      }

      if (filters.olderThanDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - filters.olderThanDays);
        query.timestamp = { $lt: cutoffDate.toISOString() };
      }

      if (filters.messagePattern) {
        query.message = { $regex: filters.messagePattern, $options: 'i' };
      }

      const result = await this.db.errors.deleteMany(query);
      return result.deletedCount;
    } catch (error) {
      console.error('Failed to clear errors:', error);
      return 0;
    }
  }
}

export const logger = BotLogger.getInstance();