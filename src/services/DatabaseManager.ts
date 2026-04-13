import { Pool } from 'pg';
import { ErrorDocument } from '../models/ErrorDocument';
import { CustomizationDocument } from '../models/CustomizationDocument';
import { LogArea } from '../types/logger';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: Pool | null = null;
  private connected = false;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async connect(uri: string): Promise<void> {
    if (this.pool) return;

    this.pool = new Pool({ connectionString: uri });
    const client = await this.pool.connect();
    client.release();
    this.connected = true;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
    }
  }

  private get db(): Pool {
    if (!this.pool) throw new Error('Database not connected');
    return this.pool;
  }

  private rowToError(row: any): ErrorDocument {
    return {
      id: row.id,
      timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
      level: row.level,
      area: row.area,
      message: row.message,
      stack_trace: row.stack_trace ?? undefined,
      guild_id: row.guild_id ?? undefined,
      guild_name: row.guild_name ?? undefined,
      channel_id: row.channel_id ?? undefined,
      channel_name: row.channel_name ?? undefined,
      user_id: row.user_id ?? undefined,
      command: row.command ?? undefined,
      context: row.context ?? undefined,
    };
  }

  private rowToCustomization(row: any): CustomizationDocument {
    return {
      guild_id: row.guild_id,
      bot_name: row.bot_name ?? undefined,
      bot_avatar: row.bot_avatar ?? undefined,
      remove_branding: row.remove_branding,
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      updated_by: row.updated_by,
    };
  }

  get errors() {
    return {
      insert: async (doc: Omit<ErrorDocument, 'id'>): Promise<number> => {
        const res = await this.db.query(
          `INSERT INTO errors (timestamp, level, area, message, stack_trace, guild_id, guild_name, channel_id, channel_name, user_id, command, context)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            doc.timestamp, doc.level, doc.area, doc.message,
            doc.stack_trace ?? null, doc.guild_id ?? null, doc.guild_name ?? null,
            doc.channel_id ?? null, doc.channel_name ?? null, doc.user_id ?? null,
            doc.command ?? null, doc.context ? JSON.stringify(doc.context) : null,
          ]
        );
        return res.rows[0].id;
      },

      getById: async (id: number): Promise<ErrorDocument | null> => {
        const res = await this.db.query('SELECT * FROM errors WHERE id = $1', [id]);
        return res.rows[0] ? this.rowToError(res.rows[0]) : null;
      },

      getMany: async (options: { guildId?: string; limit?: number } = {}): Promise<ErrorDocument[]> => {
        const params: any[] = [];
        let sql = 'SELECT * FROM errors';

        if (options.guildId) {
          params.push(options.guildId);
          sql += ` WHERE guild_id = $${params.length}`;
        }

        sql += ' ORDER BY timestamp DESC';

        if (options.limit) {
          params.push(options.limit);
          sql += ` LIMIT $${params.length}`;
        }

        const res = await this.db.query(sql, params);
        return res.rows.map(row => this.rowToError(row));
      },

      delete: async (id: number): Promise<boolean> => {
        const res = await this.db.query('DELETE FROM errors WHERE id = $1', [id]);
        return (res.rowCount ?? 0) > 0;
      },

      clear: async (filters: {
        area?: LogArea;
        level?: string;
        guildId?: string;
        olderThanDays?: number;
        messagePattern?: string;
      }): Promise<number> => {
        const conditions: string[] = [];
        const params: any[] = [];

        if (filters.area) {
          params.push(filters.area);
          conditions.push(`area = $${params.length}`);
        }
        if (filters.level) {
          params.push(filters.level.toUpperCase());
          conditions.push(`level = $${params.length}`);
        }
        if (filters.guildId) {
          params.push(filters.guildId);
          conditions.push(`guild_id = $${params.length}`);
        }
        if (filters.olderThanDays) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - filters.olderThanDays);
          params.push(cutoff.toISOString());
          conditions.push(`timestamp < $${params.length}`);
        }
        if (filters.messagePattern) {
          params.push(`%${filters.messagePattern}%`);
          conditions.push(`message ILIKE $${params.length}`);
        }

        const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
        const res = await this.db.query(`DELETE FROM errors${where}`, params);
        return res.rowCount ?? 0;
      },
    };
  }

  get customizations() {
    return {
      get: async (guildId: string): Promise<CustomizationDocument | null> => {
        const res = await this.db.query('SELECT * FROM customizations WHERE guild_id = $1', [guildId]);
        return res.rows[0] ? this.rowToCustomization(res.rows[0]) : null;
      },

      upsert: async (doc: CustomizationDocument): Promise<void> => {
        await this.db.query(
          `INSERT INTO customizations (guild_id, bot_name, bot_avatar, remove_branding, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (guild_id) DO UPDATE SET
             bot_name = EXCLUDED.bot_name,
             bot_avatar = EXCLUDED.bot_avatar,
             remove_branding = EXCLUDED.remove_branding,
             updated_at = EXCLUDED.updated_at,
             updated_by = EXCLUDED.updated_by`,
          [
            doc.guild_id, doc.bot_name ?? null, doc.bot_avatar ?? null,
            doc.remove_branding, doc.updated_at, doc.updated_by,
          ]
        );
      },
    };
  }
}
