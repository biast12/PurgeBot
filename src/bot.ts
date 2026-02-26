import { Client, GatewayIntentBits, Interaction, AutocompleteInteraction, ModalSubmitInteraction, ActivityType, PresenceUpdateStatus } from 'discord.js';
import { validateConfig, getBotConfig } from './core/config';
import { CommandManager } from './core/commandManager';
import { PurgeCommand } from './commands/purgeCommand';
import { HelpCommand } from './commands/helpCommand';
import { AdminCommand } from './commands/adminCommand';
import { CustomizeCommand } from './commands/customizeCommand';
import { sendError } from './core/response';
import { logger } from './utils/logger';
import { LogArea, LogLevel } from './types/logger';
import { DatabaseManager } from './services/DatabaseManager';
import { AdminManager } from './config/admins';

export class PurgeBot {
  private client: Client;
  private commandManager: CommandManager;

  constructor() {
    validateConfig();

    logger.configure({
      consoleEnabled: true,
      minLevel: LogLevel.INFO
    });

    // Initialize admin permissions
    AdminManager.initialize();

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      allowedMentions: { parse: [] }
    });

    this.commandManager = new CommandManager();
    this.registerCommands();
    this.setupEventHandlers();
  }

  private registerCommands(): void {
    this.commandManager.register(new PurgeCommand());
    this.commandManager.register(new HelpCommand());
    this.commandManager.register(new AdminCommand());
    this.commandManager.register(new CustomizeCommand());
  }

  private updatePresence(): void {
    const serverCount = this.client.guilds.cache.size;
    this.client.user?.setPresence({
      activities: [{
        name: `🗑️ /purge in ${serverCount} servers`,
        type: ActivityType.Custom
      }],
      status: PresenceUpdateStatus.Online
    });
  }

  private setupEventHandlers(): void {
    this.client.once('clientReady', () => {
      const serverCount = this.client.guilds.cache.size;
      logger.info(LogArea.STARTUP, `PurgeBot is online as ${this.client.user?.tag}`);
      logger.info(LogArea.STARTUP, `Serving ${serverCount} guilds`);

      // Set Rich Presence and custom status
      this.updatePresence();

      logger.spacer('=', undefined, LogLevel.INFO);
    });

    this.client.on('interactionCreate', async (interaction: Interaction) => {
      await this.handleInteraction(interaction);
    });

    this.client.on('guildCreate', (guild) => {
      logger.info(LogArea.STARTUP, `Joined new guild: ${guild.name} (${guild.id})`);
      this.updatePresence();
    });

    this.client.on('guildDelete', (guild) => {
      if (!guild.available) return;
      logger.info(LogArea.STARTUP, `Left guild: ${guild.name} (${guild.id})`);
      this.updatePresence();
    });

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        const commandName = interaction.commandName;

        if (this.commandManager.hasCommand(commandName)) {
          await this.commandManager.execute(commandName, {
            client: this.client,
            interaction
          });
        }
      } else if (interaction.isAutocomplete()) {
        await this.handleAutocomplete(interaction);
      } else if (interaction.isModalSubmit()) {
        await this.handleModalSubmit(interaction);
      }
    } catch (error) {
      logger.error(LogArea.COMMANDS, `Error handling interaction: ${error}`);

      if (interaction.isChatInputCommand() && !interaction.replied && !interaction.deferred) {
        await sendError(interaction, 'An unexpected error occurred. Please try again later.');
      }
    }
  }

  private async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId === 'customize_modal') {
      const command = this.commandManager.getCommand('customize');
      if (command instanceof CustomizeCommand) {
        await command.handleModalSubmit(interaction);
      }
    }
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const commandName = interaction.commandName;

    if (this.commandManager.hasCommand(commandName)) {
      const command = this.commandManager.getCommand(commandName);
      if (command?.handleAutocomplete) {
        await command.handleAutocomplete({
          client: this.client,
          interaction
        });
      }
    }
  }

  private async shutdown(): Promise<void> {
    logger.info(LogArea.SHUTDOWN, 'Shutting down gracefully...');

    // Disconnect from MongoDB
    try {
      const db = DatabaseManager.getInstance();
      if (db.isConnected) {
        await db.disconnect();
        logger.info(LogArea.SHUTDOWN, 'MongoDB disconnected');
      }
    } catch (error) {
      logger.error(LogArea.SHUTDOWN, `Error disconnecting from MongoDB: ${error}`);
    }

    await this.client.destroy();
    logger.info(LogArea.SHUTDOWN, 'Bot shut down successfully');
    process.exit(0);
  }

  public async start(): Promise<void> {
    const { databaseUrl, token } = getBotConfig();

    // Connect to MongoDB if databaseUrl is provided
    if (databaseUrl) {
      logger.info(LogArea.STARTUP, 'Connecting to MongoDB...');
      try {
        const db = DatabaseManager.getInstance();
        await db.connect(databaseUrl);
        logger.enableDatabase();
        logger.info(LogArea.STARTUP, 'MongoDB connected - error logging enabled');
      } catch (error) {
        logger.error(LogArea.STARTUP, `Failed to connect to MongoDB: ${error}`);
        logger.warning(LogArea.STARTUP, 'Continuing without database error logging');
      }
    } else {
      logger.warning(LogArea.STARTUP, 'DATABASE_URL not set - error logging disabled');
    }

    await this.client.login(token);
  }
}

if (require.main === module) {
  const bot = new PurgeBot();
  bot.start().catch(error => {
    logger.error(LogArea.STARTUP, `Failed to start bot: ${error}`);
    process.exit(1);
  });
}