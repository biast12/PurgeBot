import { EmbedBuilder } from "discord.js";

export default (
  targetUsername: string,
  targetName: string,
  progress: { name: string; value: string; inline: boolean }[]
): EmbedBuilder => {
  const limitedProgress = progress.slice(-25); // Keep only the last 25 items

  return new EmbedBuilder()
    .setTitle(`🔄 Purging Messages`)
    .setDescription(`Purging messages from **${targetUsername}**\nIn **${targetName}**.`)
    .addFields(...limitedProgress)
    .setColor("#00b0f4")
    .setFooter({ text: "This process may take some time. Please wait...", iconURL: "https://i.imgur.com/FugULYw.png" });
};
