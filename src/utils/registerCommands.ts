import { REST, Routes } from 'discord.js';
import { getBotConfig } from '../core/config';
import { CommandManager } from '../core/commandManager';
import { PurgeUserCommand } from '../commands/purgeUserCommand';
import { HelpCommand } from '../commands/helpCommand';
import { logger } from './logger';
import { LogArea } from '../types/logger';

/**
 * Register all slash commands with Discord
 */
async function registerCommands(): Promise<void> {
  try {
    logger.info(LogArea.NONE, 'Starting command registration...');

    // Get configuration
    const config = getBotConfig();
    
    // Get client ID from the API if not set
    let clientId = config.clientId;
    if (!clientId) {
      const rest = new REST({ version: '10' }).setToken(config.token);
      const application = await rest.get(Routes.oauth2CurrentApplication()) as any;
      clientId = application.id;
    }

    // Set up command manager and register all commands
    const commandManager = new CommandManager();
    commandManager.register(new PurgeUserCommand());
    commandManager.register(new HelpCommand());

    // Build individual slash commands
    const commands = commandManager.getAllCommands().map(cmd => cmd.buildCommand().toJSON());

    // Create REST client and deploy commands
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    await rest.put(
      Routes.applicationCommands(clientId!),
      { body: commands }
    );

    // Log registered commands
    const registeredCommands = commandManager.getAllCommands();
    
    logger.info(LogArea.NONE, `Successfully registered ${registeredCommands.length} commands:`);
    registeredCommands.forEach(cmd => {
      logger.info(LogArea.NONE, `  /${cmd.name} - ${cmd.description}`);
    });
    logger.spacer();

  } catch (error) {
    logger.error(
      LogArea.STARTUP,
      `Failed to register commands: ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  }
}

// Run registration if this file is executed directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  // Validate config first
  const { validateConfig } = require('../core/config');
  validateConfig();
  
  // Run registration
  registerCommands();
}