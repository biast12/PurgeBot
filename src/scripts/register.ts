import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import purgeUserCommand from "../commands/purgeUser/PurgeUserCommand";
import helpCommand from "../commands/help/HelpCommand";

// Load environment variables
dotenv.config();

async function registerCommands() {
  const token = process.env.TOKEN;
  
  if (!token) {
    console.error("❌ No TOKEN found in environment variables");
    process.exit(1);
  }

  const commands = [
    purgeUserCommand.data,
    helpCommand.data
  ];

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log("🔄 Starting command registration...");
    console.log(`📋 Registering ${commands.length} commands`);
    
    // Get the application ID from the token
    const application = await rest.get(Routes.oauth2CurrentApplication()) as any;
    const applicationId = application.id;
    
    console.log(`🤖 Application ID: ${applicationId}`);
    
    // Register commands globally
    const data = await rest.put(
      Routes.applicationCommands(applicationId),
      { body: commands }
    ) as any[];
    
    console.log(`✅ Successfully registered ${data.length} global application commands:`);
    data.forEach(cmd => {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
    });
    
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
    process.exit(1);
  }
}

// Run the registration
registerCommands().then(() => {
  console.log("\n✨ Command registration complete!");
  process.exit(0);
});