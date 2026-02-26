import { MongoClient, Db, Collection } from 'mongodb';
import { ErrorDocument } from '../models/ErrorDocument';
import { CustomizationDocument } from '../models/CustomizationDocument';

/**
 * MongoDB connection manager for error logging
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private client: MongoClient | null = null;
  private db: Db | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Connect to MongoDB
   */
  async connect(uri: string): Promise<void> {
    if (this.client) return; // Already connected

    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(); // Uses default database from URI

    // Create indexes for efficient querying
    await this.createIndexes();
  }

  /**
   * Create indexes on the errors collection for optimal query performance
   */
  private async createIndexes(): Promise<void> {
    const errors = this.errors;

    // Index for recent errors
    await errors.createIndex({ timestamp: -1 });

    // Index for guild-specific errors
    await errors.createIndex({ guild_id: 1, timestamp: -1 });

    // Index for error level filtering
    await errors.createIndex({ level: 1, timestamp: -1 });

    // Index for area filtering
    await errors.createIndex({ area: 1, timestamp: -1 });

    // Index for customizations lookup by guild
    await this.customizations.createIndex({ guild_id: 1 }, { unique: true });
  }

  /**
   * Get the errors collection
   */
  get errors(): Collection<ErrorDocument> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection<ErrorDocument>('errors');
  }

  /**
   * Get the customizations collection
   */
  get customizations(): Collection<CustomizationDocument> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection<CustomizationDocument>('customizations');
  }

  /**
   * Check if database is connected
   */
  get isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}
