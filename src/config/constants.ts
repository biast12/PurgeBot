export const CONSTANTS = {
  // Discord API limits
  BULK_DELETE_LIMIT: 100,
  MESSAGE_AGE_LIMIT: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
  FETCH_LIMIT: 100,
  
  // Interaction timeouts
  INTERACTION_TIMEOUT: 15 * 60 * 1000, // 15 minutes
  INTERACTION_EXPIRY_WARNING: 14 * 60 * 1000 + 50 * 1000, // 14:50 minutes
  
  // Rate limiting
  DEFAULT_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 60000,
  MAX_RETRIES: 3,
  
  // UI
  PROGRESS_BAR_LENGTH: 20,
  PROGRESS_UPDATE_INTERVAL: 10, // Update progress every N messages
  
  // Permissions
  REQUIRED_PERMISSIONS: ['Administrator'] as const,
} as const;

export const ERROR_CODES = {
  INVALID_COMMAND: 50027,
  RATE_LIMITED: 429,
  MISSING_PERMISSIONS: 50013,
  UNKNOWN_MESSAGE: 10008,
  UNKNOWN_CHANNEL: 10003,
} as const;