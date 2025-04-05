import { ChannelType, Guild } from "discord.js";

export default function getChannels(targetId: string, guild: Guild): any[] {
  if (targetId === guild.id) {
    return Array.from(
      guild.channels.cache.filter(
        (ch) =>
          ch.type === ChannelType.GuildText ||
          ch.type === ChannelType.GuildForum ||
          ch.type === ChannelType.GuildAnnouncement ||
          ch.type === ChannelType.GuildVoice
      ).values()
    );
  }
  const targetChannel = guild.channels.cache.get(targetId);
  if (!targetChannel) throw new Error("The provided ID does not exist.");
  if (targetChannel.isThread()) {
    return [targetChannel];
  }
  if (targetChannel.type === ChannelType.GuildCategory) {
    return Array.from(
      guild.channels.cache
        .filter(
          (ch) =>
            ch.parentId === targetChannel.id &&
            (ch.type === ChannelType.GuildText ||
              ch.type === ChannelType.GuildForum ||
              ch.type === ChannelType.GuildAnnouncement ||
              ch.type === ChannelType.GuildVoice)
        )
        .values()
    );
  }
  if (
    targetChannel.type === ChannelType.GuildText ||
    targetChannel.type === ChannelType.GuildForum ||
    targetChannel.type === ChannelType.GuildAnnouncement ||
    targetChannel.type === ChannelType.GuildVoice
  ) {
    return [targetChannel];
  }
  throw new Error(
    "The provided ID is neither a server, category, text, forum, announcement, voice channel, nor thread."
  );
}
