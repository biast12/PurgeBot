import { TextChannel, ThreadChannel, Message } from "discord.js";

export default async function fetchMessages(
  channel: TextChannel | ThreadChannel,
  targetUserId: string,
  isCanceled: () => boolean
): Promise<Message[]> {
  // Validate the channel object
  if (!channel || !channel.messages || typeof channel.messages.fetch !== "function") {
    throw new TypeError("Invalid channel object passed to fetchMessages.");
  }

  let lastMessageId: string | null = null;
  const userMessages: Message[] = [];

  while (true) {
    const fetchOptions: { limit: number; before?: string } = { limit: 100, before: lastMessageId || undefined };
    if (isCanceled()) {
      break; // Stop processing if canceled
    }

    try {
      const messages = await channel.messages.fetch(fetchOptions);
      if (messages.size === 0) break;

      messages.forEach((msg: Message) => {
        if (msg.author?.id === targetUserId) {
          userMessages.push(msg);
        }
      });

      lastMessageId = messages.last()?.id || null;
      if (!lastMessageId) break;

    } catch (error: any) {
      console.error(`❌ Error fetching messages:`, error);

      if (error.code === 429) {
        const retryAfter = error.retry_after || 1000;
        console.warn(`⚠️ Rate limited. Retrying after ${retryAfter}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        continue;
      }

      break;
    }
  }

  return userMessages;
}
