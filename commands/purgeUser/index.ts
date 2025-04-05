import { ApplicationCommandData, CommandInteraction, CommandInteractionOptionResolver, PermissionsBitField, ChannelType, ComponentType, MessageFlags } from "discord.js";
import applicationCommandData from "./applicationCommandData.json";
import autocomplete_target_id from "./autocomplete/autocomplete_target_id";
import autocomplete_user_id from "./autocomplete/autocomplete_user_id";
import progressEmbed from "./embeds/progressEmbed";
import doneEmbed from "./embeds/doneEmbed";
import errorEmbed from "./embeds/errorEmbed";
import cancelButton from "./buttons/cancelButton";
import processChannels from "./processing/processChannels";
import processForums from "./processing/processForums";
import getChannels from "./utils/getChannels";
import validateTarget from "./utils/validateTarget";
import handleCommands, { isCanceled } from "./utils/handleCommands";

// Track active commands per server
const activeCommands = new Map<string, boolean>();

export default {
  data: applicationCommandData as ApplicationCommandData,

  autocomplete_target_id,
  autocomplete_user_id,

  async execute(interaction: CommandInteraction): Promise<void> {
    const guild = interaction.guild;
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

      const options = interaction.options as CommandInteractionOptionResolver;
      const targetId = options.getString("target_id", true);
      const targetUserId = options.getString("user_id", true);

      // Validate the target and resolve the target name
      const { isValid, targetName } = await validateTarget(guild, targetId);

      if (!isValid) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Invalid Target",
              "The provided target ID does not belong to this server."
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      console.log(`🚀 purgeUser command executed by "${interaction.user.tag}" (${interaction.user.id}) in "${guild.name}" (${guild.id})`);
      console.log(`🔍 Interaction ID: ${interaction.id}`);

      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
      const targetUsername = targetUser ? targetUser.username : "Unknown User";

      const startTime = Date.now();
      const progress: { name: string; value: string; inline: boolean }[] = [];

      const progressEmbedInstance = progressEmbed(
        targetUsername,
        targetName,
        progress
      );

      // Create a cancel button
      const actionRow = cancelButton(interaction.id);

      await interaction.reply({
        embeds: [progressEmbedInstance],
        components: [actionRow],
      });

      const collector = interaction.channel?.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 15 * 60 * 1000, // 15 minutes timeout
      });

      // Use the handleCommands utility
      handleCommands(interaction, collector, interaction.id, (value) => {
        if (!value) {
          activeCommands.delete(guild.id); // Release the lock for this server
        }
      });

      try {
        const channels = getChannels(targetId, guild);
        let totalDeleted = 0;

        for (const channel of channels) {
          if (isCanceled(interaction.id, guild.id)) return;

          let channelDeleted = 0;

          if (channel.type === ChannelType.GuildForum) {
            channelDeleted += await processForums(
              channel,
              targetUserId,
              interaction,
              progress,
              targetUsername,
              targetName,
              guild.id
            );
          } else if (
            channel.type === ChannelType.GuildText ||
            channel.type === ChannelType.PublicThread ||
            channel.type === ChannelType.PrivateThread ||
            channel.type === ChannelType.GuildAnnouncement ||
            channel.type === ChannelType.GuildVoice
          ) {
            channelDeleted += await processChannels(
              channel,
              targetUserId,
              interaction,
              progress,
              targetUsername,
              targetName,
              guild.id
            );
          }

          totalDeleted += channelDeleted;
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        const doneEmbedInstance = doneEmbed(
          targetUsername,
          targetName,
          progress,
          totalDeleted,
          totalTime
        );

        if (!isCanceled(interaction.id, guild.id)) {
          await interaction.editReply({
            embeds: [doneEmbedInstance],
            components: [],
          });
          await interaction.followUp({
            content: `<@${interaction.user.id}> The purge operation has been completed successfully!`,
            flags: MessageFlags.Ephemeral,
          });
          console.log(`✅ Purge (${interaction.id}) operation completed successfully.`);
        }
      } catch (error: any) {
        console.error(`❌ Purge (${interaction.id}) operation failed: ${error.message}`);
        const errorEmbedInstance = errorEmbed(
          "Error Occurred",
          `An error occurred while processing the purge operation: ${error.message}`
        );
        await interaction.editReply({ embeds: [errorEmbedInstance], components: [] });
      }
    } finally {
      activeCommands.delete(guild.id); // Ensure the lock is released
    }
  },
};
