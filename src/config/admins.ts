/**
 * Admin permission management for authorized admins
 */
export class AdminManager {
  private static admins: Set<string> = new Set();

  /**
   * Initialize admin permissions from environment variables
   */
  static initialize(): void {
    // Load admins from env (comma-separated)
    const adminIds = process.env.ADMIN_IDS;
    if (adminIds) {
      adminIds.split(',').forEach(id => this.admins.add(id.trim()));
    }

    // Warn if no admins are configured
    if (this.admins.size === 0) {
      console.warn('⚠️  WARNING: No admin users configured. Set ADMIN_IDS in .env to use admin commands.');
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
