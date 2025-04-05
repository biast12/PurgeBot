import { Client, REST, Routes } from "discord.js";
import helpCommand from "../commands/help";
import purgeUserCommand from "../commands/purgeUser";

export default async function registerSlashCommands(client: Client, TOKEN: string): Promise<void> {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    try {
        console.log("🔧 Registering slash commands...");

        const clientId = client.application?.id;
        if (!clientId) {
            throw new Error("Client ID could not be retrieved. Ensure the client is logged in.");
        }

        await rest.put(Routes.applicationCommands(clientId), {
            body: [helpCommand.data, purgeUserCommand.data],
        });

        console.log("✅ Slash commands registered successfully.");
    } catch (error) {
        console.error("❌ Failed to register slash commands:", error);
    }
}
