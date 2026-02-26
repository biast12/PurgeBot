import { Collection, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from 'discord.js';
import { DatabaseManager } from './DatabaseManager';
import { CustomizationDocument } from '../models/CustomizationDocument';
import { getBotConfig } from '../core/config';

export class CustomizationService {
  private static instance: CustomizationService;
  private cache = new Map<string, CustomizationDocument | null>();

  private constructor() { }

  static getInstance(): CustomizationService {
    if (!CustomizationService.instance) {
      CustomizationService.instance = new CustomizationService();
    }
    return CustomizationService.instance;
  }

  /**
   * Check if an interaction has premium (guild subscription) entitlement
   */
  hasPremiumAccess(interaction: { entitlements: Collection<string, any> }): boolean {
    const { premiumSkuId } = getBotConfig();
    if (!premiumSkuId) return false;
    return interaction.entitlements.some((e: any) => e.skuId === premiumSkuId);
  }

  /**
   * Get customization settings for a guild, with in-memory caching
   */
  async getGuildCustomization(guildId: string): Promise<CustomizationDocument | null> {
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId) ?? null;
    }

    const db = DatabaseManager.getInstance();
    if (!db.isConnected) return null;

    const doc = await db.customizations.findOne({ guild_id: guildId });
    const result = doc ?? null;
    this.cache.set(guildId, result);
    return result;
  }

  /**
   * Save (upsert) customization settings for a guild
   */
  async saveGuildCustomization(
    guildId: string,
    data: Partial<CustomizationDocument> & { updated_by: string; remove_branding: boolean }
  ): Promise<CustomizationDocument> {
    const db = DatabaseManager.getInstance();
    if (!db.isConnected) throw new Error('Database not connected');

    const doc: CustomizationDocument = {
      _id: guildId,
      guild_id: guildId,
      remove_branding: data.remove_branding,
      updated_at: new Date().toISOString(),
      updated_by: data.updated_by,
      ...(data.bot_name ? { bot_name: data.bot_name } : {}),
      ...(data.bot_avatar ? { bot_avatar: data.bot_avatar } : {}),
    };

    await db.customizations.replaceOne({ guild_id: guildId }, doc, { upsert: true });
    this.cache.set(guildId, doc);
    return doc;
  }

  invalidateCache(guildId: string): void {
    this.cache.delete(guildId);
  }

  /**
   * Returns a separator + footer TextDisplay for branding, or null if removed
   */
  async getBrandingFooter(guildId: string | null): Promise<Array<SeparatorBuilder | TextDisplayBuilder> | null> {
    if (!guildId) return null;
    const customization = await this.getGuildCustomization(guildId);
    if (customization?.remove_branding) return null;
    return [
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false),
      new TextDisplayBuilder().setContent('-# Powered by PurgeBot')
    ];
  }
}

export const customizationService = CustomizationService.getInstance();
