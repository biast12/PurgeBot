import { TextChannel, ThreadChannel, NewsChannel, VoiceChannel, ChannelType, CommandInteraction } from "discord.js";
import fetchMessages from "./fetchMessages";
import deleteMessages from "./deleteMessages";
import progressEmbed from "../embeds/progressEmbed";
import { isCanceled } from "../utils/handleCommands";
import generateProgressBar from "../utils/generateProgressBar";

export default async (
  channel: TextChannel | ThreadChannel | NewsChannel | VoiceChannel,
  targetUserId: string,
  interaction: CommandInteraction,
  progress: { name: string; value: string; inline: boolean }[],
  targetUsername: string,
  targetName: string,
  guildId: string
): Promise<number> => {
  // Validate the channel object
  if (!channel || !channel.messages || typeof channel.messages.fetch !== "function") {
    throw new TypeError("Invalid channel object passed to processMessages.");
  }

  // Ensure the channel is either a TextChannel or ThreadChannel
  if (
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.PublicThread &&
    channel.type !== ChannelType.PrivateThread &&
    channel.type !== ChannelType.GuildAnnouncement &&
    channel.type !== ChannelType.GuildVoice
  ) {
    throw new TypeError("Unsupported channel type passed to processMessages.");
  }

  let totalDeleted = 0;

  progress.push({
    name: `Channel: ${channel.name}`,
    value: `Progress: Fetching messages...\nDeleted Messages: Processing...`,
    inline: false,
  });

  if (isCanceled(interaction.id, guildId)) return totalDeleted;

  if (!isCanceled(interaction.id, guildId)) {
    await interaction.editReply({
      embeds: [progressEmbed(targetUsername, targetName, progress)],
    });
  }

  const userMessages = await fetchMessages(channel, targetUserId, () => isCanceled(interaction.id, guildId));

  if (isCanceled(interaction.id, guildId)) return totalDeleted;

  const messagesToDelete = userMessages.filter(
    (msg) => msg.createdTimestamp > Date.now() - 1209600000
  );
  const oldMessages = userMessages.filter(
    (msg) => msg.createdTimestamp <= Date.now() - 1209600000
  );

  totalDeleted += await deleteMessages(channel, messagesToDelete, () => isCanceled(interaction.id, guildId), false);

  if (isCanceled(interaction.id, guildId)) return totalDeleted;

  totalDeleted += await deleteMessages(channel, oldMessages, () => isCanceled(interaction.id, guildId), true, async (current, total) => {
    const progressBar = generateProgressBar(current, total);

    progress[progress.length - 1].value = `Progress: ${progressBar}\nDeleted Messages: ${current}/${total}`;
    if (!isCanceled(interaction.id, guildId)) {
      await interaction.editReply({
        embeds: [progressEmbed(targetUsername, targetName, progress)],
      });
    }
  });

  if (isCanceled(interaction.id, guildId)) return totalDeleted;

  if (!isCanceled(interaction.id, guildId)) {
    progress[progress.length - 1].value = `Progress: Completed\nDeleted Messages: ${totalDeleted}`;
    await interaction.editReply({
      embeds: [progressEmbed(targetUsername, targetName, progress)],
    });
  }

  return totalDeleted;
};
