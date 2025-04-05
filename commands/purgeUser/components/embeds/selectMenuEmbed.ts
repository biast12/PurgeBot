import { EmbedBuilder } from "discord.js";

export default (categoryName: string): EmbedBuilder => {
  return new EmbedBuilder()
    .setTitle("Select Channels to Skip")
    .setDescription(
      `You have selected the category **${categoryName}**.\n` +
      "Please select the channels you want to skip from the dropdown menu below."
    )
    .setColor("#00b0f4")
    .setFooter({ text: "You have 60 seconds to make your selection.", iconURL: "https://i.imgur.com/FugULYw.png" });
};
