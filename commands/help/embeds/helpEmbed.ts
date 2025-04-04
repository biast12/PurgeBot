import { EmbedBuilder } from "discord.js";

export default (): EmbedBuilder => {
    return new EmbedBuilder()
        .setTitle("📖 Help - PurgeBot")
        .setDescription("Here is a guide on how to use the bot's commands:")
        .addFields(
            {
                name: "/purgeuser",
                value: `Deletes all messages from a specific user in a server, category, or channel.\n\n**Usage:**\n- \`/purgeuser target_id:<server/category/channel ID> target_user_id:<user ID>\`\n\n**Notes:**\n- You can delete messages from deleted users.\n- Only one user can be deleted at a time.`,
                inline: false,
            }
        )
        .setColor("#00b0f4")
        .setFooter({
            text: "Getting an unexpected error? join my support server https://discord.gg/ERFffj9Qs7",
            iconURL: "https://i.imgur.com/FugULYw.png",
        });
};
