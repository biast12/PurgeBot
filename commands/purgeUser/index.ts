import { ApplicationCommandData, CommandInteraction, CommandInteractionOptionResolver, PermissionsBitField, ComponentType, MessageFlags, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import applicationCommandData from "./applicationCommandData.json";
import autocomplete_target_id from "./autocomplete/autocomplete_target_id";
import autocomplete_user_id from "./autocomplete/autocomplete_user_id";
import errorComponent from "./components/errorComponent";
import skipSelectMenu from "./utils/skipSelectMenu";
import startPurgeProcess from "./utils/startPurgeProcess";

// Track active commands per server
const activeCommands = new Map<string, boolean>();

export default {
  data: applicationCommandData as ApplicationCommandData,

  autocomplete_target_id,
  autocomplete_user_id,

  async execute(interaction: CommandInteraction): Promise<void> {
    const guild = interaction.guild;
    const options = interaction.options as CommandInteractionOptionResolver;
    const targetId = options.getString("target_id", true);
    const targetUserId = options.getString("user_id", true);
    const targetSkip = options.getBoolean("target_skip", false);

    if (!guild) {
      await interaction.reply({
        components: errorComponent(
          "Invalid Context",
          "This command can only be used within a server."
        ),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
      return;
    }

    if (activeCommands.get(guild.id)) {
      await interaction.reply({
        components: errorComponent(
          "Command Already in Progress",
          "Another command is already in progress in this server. Please wait for it to finish before starting a new one."
        ),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
      return;
    }

    activeCommands.set(guild.id, true); // Lock the command for this server
    try {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({
          components: errorComponent(
            "Permission Denied",
            "Administrator permissions are required to use this command."
          ),
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        return;
      }

      let skipChannels: string[] = [];
      if (targetSkip) {
        const { actionRow, targetCategory, error } = skipSelectMenu(guild, targetId);

        if (error) {
          await interaction.reply({
            components: error,
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          });
          return;
        }

        const categoryName = guild.channels.cache.get(targetId)?.name || "Unknown Category";

        const selectMenuRow = new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(actionRow.components[0]);
        const submitButtonRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId("submit_skip_channels")
              .setLabel("Continue")
              .setStyle(ButtonStyle.Primary)
          );

        let selectedChannels: string[] = [];

        await interaction.reply({
          components: [
            new TextDisplayBuilder().setContent(`You have selected the category **${categoryName}**.`),
            new TextDisplayBuilder().setContent("Please select the channels you want to skip from the dropdown menu below."),
            selectMenuRow,
            submitButtonRow,
          ],
          flags: MessageFlags.IsComponentsV2,
        });

        const collector = interaction.channel?.createMessageComponentCollector({
          componentType: ComponentType.Button,
        });
        const selectCollector = interaction.channel?.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
        });

        selectCollector?.on("collect", async (i) => {
          if (i.user.id !== interaction.user.id) return;
          selectedChannels = i.values;
          await i.deferUpdate();
        });

        collector?.on("collect", async (i) => {
          if (i.user.id !== interaction.user.id) return;
          if (i.customId === "submit_skip_channels") {
            // Use the last selected values or default to empty
            const skipChannels = selectedChannels.length > 0 ? selectedChannels : [];
            if (skipChannels.length === targetCategory.children.cache.size) {
              await i.update({
                components: errorComponent("Invalid Selection", "You cannot skip all channels in the category."),
                flags: MessageFlags.IsComponentsV2,
              });
              return;
            }
            await startPurgeProcess(guild, interaction, activeCommands, targetId, targetUserId, skipChannels);
            collector.stop();
            selectCollector?.stop();
          }
        });
      } else {
        await startPurgeProcess(guild, interaction, activeCommands, targetId, targetUserId, skipChannels);
        activeCommands.delete(guild.id); // Ensure the lock is released after purge process completes
      }
    } catch (error) {
      console.error("Error executing command:", error);
      await interaction.reply({
        components: errorComponent(
          "Command Execution Error",
          "An error occurred while executing the command. Please try again later."
        ),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  }
};
