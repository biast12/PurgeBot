export interface CustomizationDocument {
  guild_id: string;
  bot_name?: string;       // guild nickname override (1–32 chars)
  bot_avatar?: string;     // base64 data URI stored for reference
  remove_branding: boolean;
  updated_at: string;      // ISO timestamp
  updated_by: string;      // user ID who last updated
}
