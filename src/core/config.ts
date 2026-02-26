import * as fs from 'fs';
import * as path from 'path';

export interface BotConfig {
  token: string;
  clientId?: string;
  databaseUrl?: string;
  adminIds?: string[];
  adminGuildId?: string;
  premiumSkuId?: string;
}

let config: BotConfig | null = null;

function loadConfigFile(): Record<string, unknown> {
  const configPath = path.join(process.cwd(), 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('config.json not found. Copy config.example.json to config.json and fill in your values.');
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    throw new Error('config.json is not valid JSON.');
  }
}

export function validateConfig(): void {
  const raw = loadConfigFile();

  const token = raw.token as string | undefined;
  if (!token || token.length === 0) {
    throw new Error('Missing "token" in config.json.');
  }

  // Extract client ID from token if not explicitly provided
  let clientId = raw.clientId as string | undefined;
  if (!clientId) {
    try {
      clientId = Buffer.from(token.split('.')[0], 'base64').toString();
    } catch {
      // Will be fetched from the API later
    }
  }

  config = {
    token,
    clientId,
    databaseUrl: raw.databaseUrl as string | undefined,
    adminIds: raw.adminIds as string[] | undefined,
    adminGuildId: raw.adminGuildId as string | undefined,
    premiumSkuId: raw.premiumSkuId as string | undefined,
  };
}

export function getBotConfig(): BotConfig {
  if (!config) {
    throw new Error('Configuration not initialized. Call validateConfig() first.');
  }
  return config;
}
