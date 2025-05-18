import { ContainerBuilder, TextDisplayBuilder } from "discord.js";
import cancelButton from "./buttons/cancelButton";

export default (
  targetUsername: string,
  targetName: string,
  progress: { name: string; value: string; inline: boolean }[],
  interactionId: string
) => {
  const ICON_EMOJI_ID: string = process.env.ICON_EMOJI_ID || "1373420483680145490";
  const limitedProgress = progress.slice(-25); // Keep only the last 25 items
  const container = new ContainerBuilder().setAccentColor(0x00b0f4);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("### 🔄 Purging Messages")
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `Purging messages from **${targetUsername}**\nIn **${targetName}**.`
    )
  );
  if (limitedProgress.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        limitedProgress.map((f) => `**${f.name}**: ${f.value}`).join("\n")
      )
    );
  }
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# <:icon:${ICON_EMOJI_ID}> This process may take some time. Please wait...`
    )
  );
  // Return both the container and the cancel button separately
  return [container, cancelButton(interactionId)];
};
