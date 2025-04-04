import { EmbedBuilder } from "discord.js";

export default (description: string, title: string = "Error Occurred"): EmbedBuilder => {
  return new EmbedBuilder()
    .setTitle("❌ " + title)
    .setDescription(description)
    .setColor("#ff0000")
    .setFooter({ text: "Please check the input and try again.", iconURL: "https://i.imgur.com/FugULYw.png" });
};
