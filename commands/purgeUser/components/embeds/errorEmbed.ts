import { EmbedBuilder } from "discord.js";

export default (title: string, description: string): EmbedBuilder => {
  return new EmbedBuilder()
    .setTitle("❌ " + title)
    .setDescription(description)
    .setColor("#ff0000")
    .setFooter({ text: "Please check the input and try again.", iconURL: "https://i.imgur.com/FugULYw.png" });
};
