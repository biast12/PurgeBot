import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from "discord.js";
import cancelButton from "./buttons/cancelButton";

export default (
  targetUsername: string,
  targetName: string,
  progress: { name: string; value: string; inline: boolean }[],
  interactionId: string
) => {
  const ICON_EMOJI_ID: string = process.env.ICON_EMOJI_ID || "1373420483680145490";
  const container = new ContainerBuilder().setAccentColor(0x00b0f4);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("### **🔄 Purging Messages**")
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `Purging messages from **${targetUsername}** in **${targetName}**.`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));
  if (progress.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        progress.map((f) => `**${f.name}**: ${f.value}`).join("\n")
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
