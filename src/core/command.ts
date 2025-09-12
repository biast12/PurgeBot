import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import { CommandContext, AutocompleteContext } from '../types';

export abstract class BaseCommand {
  public abstract readonly name: string;
  public abstract readonly description: string;

  public abstract buildCommand(): SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  
  public abstract execute(context: CommandContext): Promise<void>;
  
  public async handleAutocomplete?(context: AutocompleteContext): Promise<void>;
}