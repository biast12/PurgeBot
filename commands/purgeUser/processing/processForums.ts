import { ForumChannel, CommandInteraction, ThreadChannel } from "discord.js";
import fetchMessages from "./fetchMessages";
import deleteMessages from "./deleteMessages";
import progressEmbed from "../embeds/progressEmbed";
import { isCanceled } from "../utils/handleCommands";
import generateProgressBar from "../utils/generateProgressBar";

export default async (
  forum: ForumChannel,
  targetUserId: string,
  interaction: CommandInteraction,
  progress: { name: string; value: string; inline: boolean }[],
  targetUsername: string,
  targetName: string,
  guildId: string
): Promise<number> => {
  let totalDeleted = 0;

  progress.push({
    name: `Forum: ${forum.name}`,
    value: `Progress: Fetching threads...\nDeleted Messages: Processing...`,
    inline: false,
  });

  if (isCanceled(interaction.id, guildId)) return totalDeleted;

  if (!isCanceled(interaction.id, guildId)) {
    await interaction.editReply({
      embeds: [progressEmbed(targetUsername, targetName, progress)],
    });
  }

  // Fetch all threads and track their archived state
  const activeThreads = await forum.threads.fetchActive();
  const archivedThreads = await forum.threads.fetchArchived();

  const allThreads = [
    ...activeThreads.threads.map(thread => ({ thread, wasArchived: false })),
    ...archivedThreads.threads.map(thread => ({ thread, wasArchived: true })),
  ];

  if (isCanceled(interaction.id, guildId)) return totalDeleted;

  // Calculate the total number of messages to delete
  let totalMessagesToDelete = 0;
  const threadMessagesMap: { thread: ThreadChannel; messages: number }[] = [];

  for (const { thread } of allThreads) {
    if (isCanceled(interaction.id, guildId)) return totalDeleted;

    const userMessages = await fetchMessages(thread, targetUserId, () => isCanceled(interaction.id, guildId));
    threadMessagesMap.push({ thread, messages: userMessages.length });
    totalMessagesToDelete += userMessages.length;
  }

  // Process each thread
  let currentDeleted = 0;

  for (const { thread, wasArchived } of allThreads) {
    if (isCanceled(interaction.id, guildId)) return totalDeleted;

    // Unarchive the thread if it was archived
    if (wasArchived) {
      await thread.setArchived(false).catch((error) => {
        console.error(`❌ Error unarchiving thread ${thread.id}:`, error);
      });
    }

    const userMessages = await fetchMessages(thread, targetUserId, () => isCanceled(interaction.id, guildId));

    if (isCanceled(interaction.id, guildId)) return totalDeleted;

    const messagesToDelete = userMessages.filter(
      (msg) => msg.createdTimestamp > Date.now() - 1209600000
    );
    const oldMessages = userMessages.filter(
      (msg) => msg.createdTimestamp <= Date.now() - 1209600000
    );

    currentDeleted += await deleteMessages(thread, messagesToDelete, () => isCanceled(interaction.id, guildId), false, async (current) => {
      if (isCanceled(interaction.id, guildId)) return;

      const progressBar = generateProgressBar(currentDeleted + current, totalMessagesToDelete);

      progress[progress.length - 1].value = `Progress: ${progressBar}\nDeleted Messages: ${currentDeleted + current}/${totalMessagesToDelete}`;
      if (!isCanceled(interaction.id, guildId)) {
        await interaction.editReply({
          embeds: [progressEmbed(targetUsername, targetName, progress)],
        });
      }
    });

    if (isCanceled(interaction.id, guildId)) return totalDeleted;

    currentDeleted += await deleteMessages(thread, oldMessages, () => isCanceled(interaction.id, guildId), true, async (current) => {
      const progressBar = generateProgressBar(currentDeleted + current, totalMessagesToDelete);

      progress[progress.length - 1].value = `Progress: ${progressBar}\nDeleted Messages: ${currentDeleted + current}/${totalMessagesToDelete}`;
      if (!isCanceled(interaction.id, guildId)) {
        await interaction.editReply({
          embeds: [progressEmbed(targetUsername, targetName, progress)],
        });
      }
    });

    if (isCanceled(interaction.id, guildId)) return totalDeleted;

    // Re-archive the thread if it was originally archived
    if (wasArchived) {
      await thread.setArchived(true).catch((error) => {
        console.error(`❌ Error re-archiving thread ${thread.id}:`, error);
      });
    }

    const progressBar = generateProgressBar(currentDeleted, totalMessagesToDelete);

    progress[progress.length - 1].value = `Progress: ${progressBar}\nDeleted Messages: ${currentDeleted}/${totalMessagesToDelete}`;
    if (!isCanceled(interaction.id, guildId)) {
      await interaction.editReply({
        embeds: [progressEmbed(targetUsername, targetName, progress)],
      });
    }
  }

  if (isCanceled(interaction.id, guildId)) return totalDeleted;

  if (!isCanceled(interaction.id, guildId)) {
    progress[progress.length - 1].value = `Progress: Completed\nDeleted Messages: ${totalDeleted}`;
    await interaction.editReply({
      embeds: [progressEmbed(targetUsername, targetName, progress)],
    });
  }

  return currentDeleted;
};
