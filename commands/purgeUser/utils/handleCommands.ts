import { CommandInteraction, MessageComponentInteraction, MessageFlags } from "discord.js";
import { ContainerBuilder, TextDisplayBuilder } from "discord.js";

const activeCommands = new Map<string, Map<string, boolean>>();

export function isCanceled(interactionId: string, guildId: string): boolean {
  const serverCommands = activeCommands.get(guildId);
  return serverCommands?.get(interactionId) ?? false;
}

export default function handleCommands(
  interaction: CommandInteraction,
  collector: any,
  interactionId: string,
  setProcessingFlag: (value: boolean) => void
) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  const serverCommands = activeCommands.get(guildId) || new Map<string, boolean>();
  serverCommands.set(interactionId, false);
  activeCommands.set(guildId, serverCommands);

  collector?.on("collect", async (buttonInteraction: MessageComponentInteraction) => {
    if (buttonInteraction.customId === `cancel-${interactionId}`) {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: "Only the user who initiated the command can cancel it.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Mark the command as canceled
      serverCommands.set(interactionId, true);
      activeCommands.set(guildId, serverCommands);
      setProcessingFlag(true); // Notify the main process to stop

      // Attempt to update the interaction reply
      try {
        console.log(`❌ Interaction ${interaction.id} canceled`);
        await interaction.editReply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xff0000)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("### ❌ Operation Canceled")
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("The purge operation was canceled by the user.")
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error: any) {
        if (error.code === 50027) {
          if (!isCanceled(interactionId, guildId)) {
            console.error("❌ Interaction token expired. Cannot edit the reply.");
            await buttonInteraction.reply({
              content: `${interaction.user.id} The interaction token has expired, but the command is still processing. Please wait for it to complete.`,
              flags: MessageFlags.Ephemeral,
            });
          }
        } else {
          console.error("❌ Error editing interaction reply:", error);
        }
      }

      // Reset the processing flag
      setProcessingFlag(false);

      // Stop the collector
      collector.stop();
    }
  });
}
