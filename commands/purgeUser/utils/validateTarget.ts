import { Guild, GuildChannel, ThreadChannel } from "discord.js";

export default async function validateTarget(
  guild: Guild,
  targetId: string
): Promise<{ isValid: boolean; targetName: string }> {
  if (targetId === guild.id) {
    // The target is the server itself
    return { isValid: true, targetName: guild.name };
  }

  const targetChannel = guild.channels.cache.get(targetId) || await guild.channels.fetch(targetId).catch(() => null) as GuildChannel | ThreadChannel;

  if (targetChannel) {
    // The target is a valid channel, category, or thread
    return { isValid: true, targetName: targetChannel.name };
  }

  // The target is invalid
  return { isValid: false, targetName: "Unknown Target" };
}
