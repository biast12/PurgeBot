import { Client, GatewayIntentBits, Events } from "discord.js";
import dotenv from "dotenv";
import { CommandRegistry } from "./commands/CommandRegistry";
import { InteractionHandler } from "./handlers/InteractionHandler";

dotenv.config();

class PurgeBot {
  private client: Client;
  private commandRegistry: CommandRegistry;
  private interactionHandler: InteractionHandler;

  constructor() {
    this.validateEnvironment();
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.commandRegistry = new CommandRegistry(this.client);
    this.interactionHandler = new InteractionHandler(this.commandRegistry);
    
    this.setupEventHandlers();
  }

  private validateEnvironment(): void {
    const token = process.env.TOKEN;
    
    if (!token || token.length === 0) {
      throw new Error("Missing TOKEN in environment variables. Please set it in the .env file.");
    }
  }

  private setupEventHandlers(): void {
    this.client.once(Events.ClientReady, async (client) => {
      console.log(`✅ Logged in as ${client.user?.tag}`);
      console.log(`📊 Serving ${client.guilds.cache.size} guilds`);
      console.log(`📝 Commands loaded: ${this.commandRegistry.getAllCommands().map(cmd => cmd.data.name).join(', ')}`);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      try {
        await this.interactionHandler.handle(interaction);
      } catch (error) {
        console.error("❌ Error handling interaction:", error);
      }
    });

    this.client.on(Events.Error, (error) => {
      console.error("❌ Client error:", error);
    });

    this.client.on(Events.Warn, (warning) => {
      console.warn("⚠️ Client warning:", warning);
    });
  }

  async start(): Promise<void> {
    try {
      await this.client.login(process.env.TOKEN);
    } catch (error) {
      console.error("❌ Failed to login:", error);
      process.exit(1);
    }
  }
}

// Start the bot
const bot = new PurgeBot();
bot.start().catch(console.error);