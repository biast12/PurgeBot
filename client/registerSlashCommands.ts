import { Client, REST, Routes } from "discord.js";
import purgeUserCommand from "../commands/purgeUser";
import helpCommand from "../commands/help";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const TOKEN: string = process.env.TOKEN || "";
const CLIENT_ID: string = process.env.CLIENT_ID || "";

export default async function registerSlashCommands(client: Client): Promise<void> {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    try {
        console.log("🔧 Registering slash commands...");

        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: [purgeUserCommand.data, helpCommand.data],
        });

        console.log("✅ Slash commands registered successfully.");
    } catch (error) {
        console.error("❌ Failed to register slash commands:", error);
    }
}
