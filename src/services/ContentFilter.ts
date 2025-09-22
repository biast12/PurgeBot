import { Message } from 'discord.js';
import { logger } from '../utils/logger';
import { LogArea } from '../types/logger';

export enum FilterMode {
  CONTAINS = 'contains',
  REGEX = 'regex',
  EXACT = 'exact',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with'
}

export interface ContentFilterOptions {
  pattern: string;
  mode: FilterMode;
  caseSensitive?: boolean;
  invertMatch?: boolean; // If true, keep messages that DON'T match
}

export class ContentFilter {
  private compiledRegex?: RegExp;
  private normalizedPattern: string;

  constructor(private options: ContentFilterOptions) {
    this.normalizedPattern = options.caseSensitive
      ? options.pattern
      : options.pattern.toLowerCase();

    if (options.mode === FilterMode.REGEX) {
      try {
        const flags = options.caseSensitive ? 'g' : 'gi';
        this.compiledRegex = new RegExp(options.pattern, flags);
      } catch (error) {
        logger.error(LogArea.SERVICES, `Invalid regex pattern: ${options.pattern}`);
        throw new Error(`Invalid regex pattern: ${error}`);
      }
    }
  }

  /**
   * Check if a message matches the filter criteria
   */
  public matches(message: Message): boolean {
    if (!message.content || message.content.length === 0) {
      return this.options.invertMatch || false;
    }

    const content = this.options.caseSensitive
      ? message.content
      : message.content.toLowerCase();

    let isMatch = false;

    switch (this.options.mode) {
      case FilterMode.CONTAINS:
        isMatch = content.includes(this.normalizedPattern);
        break;

      case FilterMode.REGEX:
        if (this.compiledRegex) {
          this.compiledRegex.lastIndex = 0; // Reset regex state
          isMatch = this.compiledRegex.test(message.content);
        }
        break;

      case FilterMode.EXACT:
        isMatch = content === this.normalizedPattern;
        break;

      case FilterMode.STARTS_WITH:
        isMatch = content.startsWith(this.normalizedPattern);
        break;

      case FilterMode.ENDS_WITH:
        isMatch = content.endsWith(this.normalizedPattern);
        break;

      default:
        isMatch = false;
    }

    return this.options.invertMatch ? !isMatch : isMatch;
  }

  /**
   * Validate a regex pattern without throwing
   */
  public static validateRegex(pattern: string): { valid: boolean; error?: string } {
    try {
      new RegExp(pattern);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid regex pattern'
      };
    }
  }

  /**
   * Create multiple filters from a list of keywords
   */
  public static createKeywordFilters(
    keywords: string[],
    caseSensitive = false,
    invertMatch = false
  ): ContentFilter[] {
    return keywords.map(keyword => new ContentFilter({
      pattern: keyword,
      mode: FilterMode.CONTAINS,
      caseSensitive,
      invertMatch
    }));
  }

  /**
   * Check if a message matches ANY of the provided filters
   */
  public static matchesAny(message: Message, filters: ContentFilter[]): boolean {
    return filters.some(filter => filter.matches(message));
  }

  /**
   * Check if a message matches ALL of the provided filters
   */
  public static matchesAll(message: Message, filters: ContentFilter[]): boolean {
    return filters.every(filter => filter.matches(message));
  }
}