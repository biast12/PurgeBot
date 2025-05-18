import { ContainerBuilder, TextDisplayBuilder } from "discord.js";

export default () => {
  const container = new ContainerBuilder().setAccentColor(0x00b0f4);
  const ICON_EMOJI_ID: string = process.env.ICON_EMOJI_ID || "1373420483680145490";
  const SUPPORT_SERVER: string = process.env.SUPPORT_SERVER || "https://discord.gg/ERFffj9Qs7";
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("### **📖 Help - PurgeBot**")
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("Here is a guide on how to use the bot's commands:")
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      "`/purgeuser`\nDeletes all messages from a specific user in a server, category, or channel.\n\n**Usage:**\n- `/purgeuser` `target_id:<#channel/server/category ID>` `user_id:<@user ID>`\n\n**Notes:**\n- You can delete messages from deleted users.\n- Only one user can be deleted at a time."
    )
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# <:icon:${ICON_EMOJI_ID}> Getting an unexpected error? join my [support server](${SUPPORT_SERVER}) for help!`
    )
  );
  return [container];
};
