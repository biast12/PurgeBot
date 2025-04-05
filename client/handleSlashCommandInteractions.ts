import { Interaction, CommandInteraction, AutocompleteInteraction } from "discord.js";
import helpCommand from "../commands/help";
import purgeUserCommand from "../commands/purgeUser";

export default async function handleSlashCommands(interaction: Interaction): Promise<void> {
  if (interaction.isCommand()) {
    if (interaction.commandName === "help") {
      await helpCommand.execute(interaction as CommandInteraction);
    } else if (interaction.commandName === "purgeuser") {
      await purgeUserCommand.execute(interaction as CommandInteraction);
    }
  } else if (interaction.isAutocomplete()) {
    if (interaction.commandName === "purgeuser") {
      const focusedOption = interaction.options.getFocused(true).name;

      if (focusedOption === "target_id") {
        await purgeUserCommand.autocomplete_target_id(interaction as AutocompleteInteraction);
      } else if (focusedOption === "user_id") {
        await purgeUserCommand.autocomplete_user_id(interaction as AutocompleteInteraction);
      }
    }
  }
}