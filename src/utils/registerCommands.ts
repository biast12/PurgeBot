import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { getBotConfig } from '../core/config';
import { CommandManager } from '../core/commandManager';
import { PurgeCommand } from '../commands/purgeCommand';
import { HelpCommand } from '../commands/helpCommand';
import { AdminCommand } from '../commands/adminCommand';
import { CustomizeCommand } from '../commands/customizeCommand';
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
    const adminGuildId = config.adminGuildId;

    // Register global commands (purge, help, customize)
    commandManager.register(new PurgeCommand());
    commandManager.register(new HelpCommand());
    commandManager.register(new CustomizeCommand());

    const globalCommands = commandManager.getAllCommands().map(cmd => cmd.buildCommand().toJSON());

    const rest = new REST({ version: '10' }).setToken(config.token);

    // Register global commands
    await rest.put(
      Routes.applicationCommands(clientId!),
      { body: globalCommands }
    );

    logger.info(LogArea.NONE, `Successfully registered ${globalCommands.length} global commands:`);
    commandManager.getAllCommands().forEach(cmd => {
      logger.info(LogArea.NONE, `  /${cmd.name} - ${cmd.description}`);
    });

    // Register admin commands to guild if ADMIN_GUILD_ID is set
    if (adminGuildId) {
      const adminCommandManager = new CommandManager();
      adminCommandManager.register(new AdminCommand());

      const adminCommands = adminCommandManager.getAllCommands().map(cmd => cmd.buildCommand().toJSON());

      await rest.put(
        Routes.applicationGuildCommands(clientId!, adminGuildId),
        { body: adminCommands }
      );

      logger.info(LogArea.NONE, `Successfully registered ${adminCommands.length} admin commands to guild ${adminGuildId}:`);
      adminCommandManager.getAllCommands().forEach(cmd => {
        logger.info(LogArea.NONE, `  /${cmd.name} - ${cmd.description}`);
      });
    } else {
      logger.warning(LogArea.NONE, 'adminGuildId not set - admin commands will not be registered');
    }

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
  const { validateConfig } = require('../core/config');
  validateConfig();

  registerCommands();
}