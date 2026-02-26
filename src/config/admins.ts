import { getBotConfig } from '../core/config';

/**
 * Admin permission management for authorized admins
 */
export class AdminManager {
  private static admins: Set<string> = new Set();

  /**
   * Initialize admin permissions from config.json
   */
  static initialize(): void {
    const { adminIds } = getBotConfig();
    if (adminIds) {
      adminIds.forEach(id => this.admins.add(id.trim()));
    }

    // Warn if no admins are configured
    if (this.admins.size === 0) {
      console.warn('⚠️  WARNING: No admin users configured. Set "adminIds" in config.json to use admin commands.');
    }
  }

  /**
   * Check if user is an authorized admin
   */
  static isAuthorized(userId: string): boolean {
    return this.admins.has(userId);
  }

  /**
   * Get all admin IDs
   */
  static getAdminIds(): string[] {
    return Array.from(this.admins);
  }
}
