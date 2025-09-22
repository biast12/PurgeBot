import { Client, GatewayIntentBits, Interaction, AutocompleteInteraction } from 'discord.js';
import { validateConfig, getBotConfig } from './core/config';
import { CommandManager } from './core/commandManager';
import { PurgeCommand } from './commands/purgeCommand';
import { HelpCommand } from './commands/helpCommand';
import { sendError } from './core/response';
import { logger } from './utils/logger';
import { LogArea, LogLevel } from './types/logger';

export class PurgeBot {
  private client: Client;
  private commandManager: CommandManager;

  constructor() {
    validateConfig();

    logger.configure({
      consoleEnabled: true,
      minLevel: LogLevel.INFO
    });

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
  }

  private setupEventHandlers(): void {
    this.client.once('clientReady', () => {
      logger.info(LogArea.STARTUP, `PurgeBot is online as ${this.client.user?.tag}`);
      logger.info(LogArea.STARTUP, `Serving ${this.client.guilds.cache.size} guilds`);
      logger.spacer('=', undefined, LogLevel.INFO);
    });

    this.client.on('interactionCreate', async (interaction: Interaction) => {
      await this.handleInteraction(interaction);
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
      }
    } catch (error) {
      logger.error(LogArea.COMMANDS, `Error handling interaction: ${error}`);

      if (interaction.isChatInputCommand() && !interaction.replied && !interaction.deferred) {
        await sendError(interaction, 'An unexpected error occurred. Please try again later.');
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

  private shutdown(): void {
    logger.info(LogArea.STARTUP, 'Shutting down bot...');
    this.client.destroy();
    process.exit(0);
  }

  public async start(): Promise<void> {
    const config = getBotConfig();
    await this.client.login(config.token);
  }
}

if (require.main === module) {
  const bot = new PurgeBot();
  bot.start().catch(error => {
    logger.error(LogArea.STARTUP, `Failed to start bot: ${error}`);
    process.exit(1);
  });
}