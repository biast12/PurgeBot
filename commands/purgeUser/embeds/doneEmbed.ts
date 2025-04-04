import { EmbedBuilder } from "discord.js";

export default (
  targetUsername: string,
  targetName: string,
  progress: { name: string; value: string; inline: boolean }[],
  totalDeleted: number,
  totalTime: string
): EmbedBuilder => {
  const totalSeconds = parseFloat(totalTime);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const timeParts = [];
  if (days > 0) timeParts.push(`${days}d`);
  if (hours > 0) timeParts.push(`${hours}h`);
  if (minutes > 0) timeParts.push(`${minutes}m`);
  if (seconds > 0) timeParts.push(`${seconds}s`);

  const formattedTime = timeParts.join(" ");

  return new EmbedBuilder()
    .setTitle(`🎉 Purge Complete`)
    .setDescription(`Successfully purged messages from **${targetUsername}** in **${targetName}**.`)
    .addFields(
      ...progress,
      {
        name: "Summary",
        value: `🗑️ **Total Messages Deleted:** ${totalDeleted}\n⏱️ **Total Time Taken:** ${formattedTime}`,
        inline: false,
      }
    )
    .setColor("#32e600")
    .setFooter({ text: "Purge operation completed successfully.", iconURL: "https://i.imgur.com/FugULYw.png" });
};
