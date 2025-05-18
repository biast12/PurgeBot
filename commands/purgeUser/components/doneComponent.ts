import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from "discord.js";

export default (
  targetUsername: string,
  targetName: string,
  progress: { name: string; value: string; inline: boolean }[],
  totalDeleted: number,
  totalTime: string
) => {
  const totalSeconds = parseFloat(totalTime);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const TRASH_EMOJI_ID: string = process.env.TRASH_EMOJI_ID || "1373451073011847209";
  const TIME_EMOJI_ID: string = process.env.TIME_EMOJI_ID || "1373451085112541305";
  const ICON_EMOJI_ID: string = process.env.ICON_EMOJI_ID || "1373420483680145490";

  const timeParts = [];
  if (days > 0) timeParts.push(`${days}d`);
  if (hours > 0) timeParts.push(`${hours}h`);
  if (minutes > 0) timeParts.push(`${minutes}m`);
  if (seconds > 0) timeParts.push(`${seconds}s`);

  const formattedTime = timeParts.join(" ");

  const container = new ContainerBuilder().setAccentColor(0x32e600);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("### **🎉 Purge Complete**")
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `Successfully purged messages from **${targetUsername}** in **${targetName}**.`
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
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### Summary\n<:trash:${TRASH_EMOJI_ID}> Total Messages Deleted: ${totalDeleted}\n<:time:${TIME_EMOJI_ID}> Total Time Taken: ${formattedTime}`
    )
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `<:icon:${ICON_EMOJI_ID}> Purge operation completed successfully.`
    )
  );

  return [container];
};
