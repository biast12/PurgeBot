import { Client } from "discord.js";
import { CommandHandler } from "../types";
import purgeUserCommand from "./purgeUser/PurgeUserCommand";
import helpCommand from "./help/HelpCommand";

export class CommandRegistry {
  private commands: Map<string, CommandHandler> = new Map();

  constructor(_client: Client) {
    // Client parameter kept for compatibility but not used since we don't auto-register
    this.loadCommands();
  }

  private loadCommands(): void {
    const commands = [purgeUserCommand, helpCommand];
    
    commands.forEach(command => {
      this.commands.set(command.data.name, command);
    });
  }

  getCommand(name: string): CommandHandler | undefined {
    return this.commands.get(name);
  }

  getAllCommands(): CommandHandler[] {
    return Array.from(this.commands.values());
  }
}