import { Client, GatewayIntentBits, Interaction } from "discord.js";
import dotenv from "dotenv";
import registerSlashCommands from "./client/registerSlashCommands";
import handleSlashCommandInteractions from "./client/handleSlashCommandInteractions";

// Load environment variables from .env file
dotenv.config();

// Configuration variables
const TOKEN: string = process.env.TOKEN || "";

// Initialize the Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Register the slash commands when the bot is ready
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  await registerSlashCommands(client);
});

// Handle slash command interactions
client.on("interactionCreate", async (interaction: Interaction) => {
  await handleSlashCommandInteractions(interaction, client);
});

// Log in the bot
client.login(TOKEN);
