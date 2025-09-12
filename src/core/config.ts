import * as dotenv from 'dotenv';

dotenv.config();

export interface BotConfig {
  token: string;
  clientId?: string;
}

let config: BotConfig | null = null;

export function validateConfig(): void {
  const token = process.env.TOKEN;
  
  if (!token || token.length === 0) {
    throw new Error('Missing TOKEN in environment variables. Please set it in the .env file.');
  }

  // Extract client ID from token if not provided
  let clientId = process.env.CLIENT_ID;
  if (!clientId) {
    try {
      // Discord tokens are base64 encoded and the client ID is the first part
      const tokenParts = Buffer.from(token.split('.')[0], 'base64').toString();
      clientId = tokenParts;
    } catch {
      // If we can't extract it, we'll get it from the API later
    }
  }

  config = {
    token,
    clientId
  };
}

export function getBotConfig(): BotConfig {
  if (!config) {
    throw new Error('Configuration not initialized. Call validateConfig() first.');
  }
  return config;
}