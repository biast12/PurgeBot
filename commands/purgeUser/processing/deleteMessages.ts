import { TextChannel, ThreadChannel, Message } from "discord.js";

export default async function deleteMessages(
  channel: TextChannel | ThreadChannel,
  messages: Message[],
  isCanceled: () => boolean,
  isOld: boolean,
  updateProgress?: (current: number, total: number) => Promise<void>
): Promise<number> {
  let totalDeleted = 0;

  if (!isOld) {
    if (messages.length > 0 && !isCanceled()) {
      await channel.bulkDelete(messages, true).catch(() => { });
      totalDeleted += messages.length;
    }
  } else {
    for (let i = 0; i < messages.length; i++) {
      if (isCanceled()) {
        break; // Stop processing if canceled
      }
      const msg = messages[i];
      try {
        if (!isCanceled()) {
          await msg.delete();
        }

        totalDeleted++;

        if (updateProgress) {
          await updateProgress(i + 1, messages.length);
        }

      } catch (error: any) {
        console.error(`❌ Error deleting message ${msg.id}:`, error);

        if (error.code === 429) {
          const retryAfter = error.retry_after || 1000;
          console.warn(`⚠️ Rate limited while deleting message ${msg.id}. Retrying after ${retryAfter}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          continue;
        }
      }
    }
  }

  return totalDeleted;
}
