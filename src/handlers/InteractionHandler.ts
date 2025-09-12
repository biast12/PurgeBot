import { 
  Interaction, 
  CommandInteraction, 
  AutocompleteInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction
} from "discord.js";
import { CommandRegistry } from "../commands/CommandRegistry";

export class InteractionHandler {
  private commandRegistry: CommandRegistry;

  constructor(commandRegistry: CommandRegistry) {
    this.commandRegistry = commandRegistry;
  }

  async handle(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        await this.handleCommand(interaction);
      } else if (interaction.isAutocomplete()) {
        await this.handleAutocomplete(interaction);
      } else if (interaction.isButton()) {
        await this.handleButton(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await this.handleSelectMenu(interaction);
      }
    } catch (error) {
      console.error(`Error handling interaction ${interaction.id}:`, error);
      await this.sendErrorResponse(interaction);
    }
  }

  private async handleCommand(interaction: any): Promise<void> {
    const command = this.commandRegistry.getCommand(interaction.commandName);
    
    if (!command) {
      await interaction.reply({
        content: "Unknown command",
        ephemeral: true
      });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      await this.sendErrorResponse(interaction);
    }
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const command = this.commandRegistry.getCommand(interaction.commandName);
    
    if (!command?.autocomplete) return;

    const focusedOption = interaction.options.getFocused(true);
    const handler = command.autocomplete[focusedOption.name];
    
    if (handler) {
      try {
        await handler(interaction);
      } catch (error) {
        console.error(`Error handling autocomplete for ${interaction.commandName}.${focusedOption.name}:`, error);
        await interaction.respond([]);
      }
    }
  }

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    // Button interactions will be handled by specific components
    // This is a placeholder for global button handling if needed
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate().catch(() => {});
    }
  }

  private async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    // Select menu interactions will be handled by specific components
    // This is a placeholder for global select menu handling if needed
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate().catch(() => {});
    }
  }

  private async sendErrorResponse(interaction: Interaction): Promise<void> {
    const errorMessage = {
      content: "An error occurred while processing your request.",
      ephemeral: true
    };

    if ((interaction.isCommand() || interaction.isMessageComponent()) && 'reply' in interaction) {
      const interactionWithReply = interaction as CommandInteraction | ButtonInteraction | StringSelectMenuInteraction;
      if (interactionWithReply.replied || interactionWithReply.deferred) {
        await interactionWithReply.editReply(errorMessage).catch(() => {});
      } else {
        await interactionWithReply.reply(errorMessage).catch(() => {});
      }
    }
  }
}