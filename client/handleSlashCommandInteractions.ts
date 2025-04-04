import { Interaction, CommandInteraction, AutocompleteInteraction, Client } from "discord.js";
import purgeUserCommand from "../commands/purgeUser";
import helpCommand from "../commands/help";

export default async function handleSlashCommands(
  interaction: Interaction,
  client: Client
): Promise<void> {
  if (interaction.isCommand()) {
    if (interaction.commandName === "purgeuser") {
      await purgeUserCommand.execute(interaction as CommandInteraction, client);
    } else if (interaction.commandName === "help") {
      await helpCommand.execute(interaction as CommandInteraction);
    }
  } else if (interaction.isAutocomplete()) {
    if (interaction.commandName === "purgeuser") {
      const focusedOption = interaction.options.getFocused(true).name;

      if (focusedOption === "target_id") {
        await purgeUserCommand.autocomplete_target_id(interaction as AutocompleteInteraction);
      } else if (focusedOption === "target_user_id") {
        await purgeUserCommand.autocomplete_target_user_id(interaction as AutocompleteInteraction);
      }
    }
  }
}