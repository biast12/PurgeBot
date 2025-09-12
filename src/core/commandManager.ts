import { BaseCommand } from './command';
import { CommandContext } from '../types';

export class CommandManager {
  private commands = new Map<string, BaseCommand>();

  public register(command: BaseCommand): void {
    this.commands.set(command.name, command);
  }

  public async execute(commandName: string, context: CommandContext): Promise<void> {
    const command = this.commands.get(commandName);
    if (!command) {
      throw new Error(`Unknown command: ${commandName}`);
    }

    await command.execute(context);
  }

  public getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }

  public getCommand(commandName: string): BaseCommand | undefined {
    return this.commands.get(commandName);
  }

  public hasCommand(commandName: string): boolean {
    return this.commands.has(commandName);
  }
}