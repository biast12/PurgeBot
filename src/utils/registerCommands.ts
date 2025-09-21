import { REST, Routes } from 'discord.js';
import { getBotConfig } from '../core/config';
import { CommandManager } from '../core/commandManager';
import { PurgeCommand } from '../commands/purgeCommand';
import { HelpCommand } from '../commands/helpCommand';
import { logger } from './logger';
import { LogArea } from '../types/logger';

async function registerCommands(): Promise<void> {
  try {
    logger.info(LogArea.NONE, 'Starting command registration...');

    const config = getBotConfig();

    let clientId = config.clientId;
    if (!clientId) {
      const rest = new REST({ version: '10' }).setToken(config.token);
      const application = await rest.get(Routes.oauth2CurrentApplication()) as any;
      clientId = application.id;
    }

    const commandManager = new CommandManager();
    commandManager.register(new PurgeCommand());
    commandManager.register(new HelpCommand());

    const commands = commandManager.getAllCommands().map(cmd => cmd.buildCommand().toJSON());

    const rest = new REST({ version: '10' }).setToken(config.token);
    
    await rest.put(
      Routes.applicationCommands(clientId!),
      { body: commands }
    );

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

if (require.main === module) {
  require('dotenv').config();

  const { validateConfig } = require('../core/config');
  validateConfig();

  registerCommands();
}