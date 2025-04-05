import { ApplicationCommandData, CommandInteraction, CommandInteractionOptionResolver, PermissionsBitField, ComponentType, MessageFlags } from "discord.js";
import applicationCommandData from "./applicationCommandData.json";
import autocomplete_target_id from "./autocomplete/autocomplete_target_id";
import autocomplete_user_id from "./autocomplete/autocomplete_user_id";
import errorEmbed from "./components/embeds/errorEmbed";
import selectMenuEmbed from "./components/embeds/selectMenuEmbed";
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
        embeds: [
          errorEmbed(
            "Invalid Context",
            "This command can only be used within a server."
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (activeCommands.get(guild.id)) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Command Already in Progress",
            "Another command is already in progress in this server. Please wait for it to finish before starting a new one."
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    activeCommands.set(guild.id, true); // Lock the command for this server
    try {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Permission Denied",
              "Administrator permissions are required to use this command."
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      let skipChannels: string[] = [];
      if (targetSkip) {
        const { actionRow, targetCategory, error } = skipSelectMenu(guild, targetId);

        if (error) {
          await interaction.reply({
            embeds: [error],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const categoryName = guild.channels.cache.get(targetId)?.name || "Unknown Category";

        await interaction.reply({
          embeds: [selectMenuEmbed(categoryName)],
          components: [actionRow],
        });

        const collector = interaction.channel?.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60 * 1000, // 1 minute timeout
        });

        collector?.on("collect", async (i) => {
          if (i.user.id !== interaction.user.id) return;

          skipChannels = i.values;
          await i.update({ components: [] }); // Clear the components
          collector.stop();
          if (skipChannels.length === targetCategory.children.cache.size) {
            await interaction.editReply({
              embeds: [errorEmbed("Invalid Selection", "You cannot skip all channels in the category.")],
            });
            return;
          }

          await startPurgeProcess(guild, interaction, activeCommands, targetId, targetUserId, skipChannels);
        });

        collector?.on("end", async (collected, reason) => {
          if (reason === "time") {
            await interaction.editReply({ embeds: [errorEmbed("Timeout", "Channel selection timed out.")], components: [] });
          }
          activeCommands.delete(guild.id); // Ensure the lock is released after collector ends
        });
      } else {
        await startPurgeProcess(guild, interaction, activeCommands, targetId, targetUserId, skipChannels);
        activeCommands.delete(guild.id); // Ensure the lock is released after purge process completes
      }
    } catch (error) {
      console.error("Error executing command:", error);
      await interaction.reply({
        embeds: [
          errorEmbed(
            "Command Execution Error",
            "An error occurred while executing the command. Please try again later."
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};
