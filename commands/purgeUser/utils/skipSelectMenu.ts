import { Guild, ActionRowBuilder, StringSelectMenuBuilder, ChannelType } from "discord.js";
import errorEmbed from "../components/embeds/errorEmbed";

export default function skipSelectMenu(guild: Guild, targetId: string) {
    const targetCategory = guild.channels.cache.get(targetId);

    if (!targetCategory) {
        if (targetId === guild.id) {
            return {
                error: errorEmbed(
                    "Invalid Target",
                    "You must select a category to display its channels. Selecting a server or a single channel is not allowed."
                ),
            };
        } else {
            return {
                error: errorEmbed(
                    "Invalid Target",
                    "The provided target ID does not exist in this server."
                ),
            };
        }
    }

    if (targetCategory.type !== ChannelType.GuildCategory) {
        return {
            error: errorEmbed(
                "Invalid Target",
                "You must select a category to display its channels. Selecting a server or a single channel is not allowed."
            ),
        };
    }

    const channels = targetCategory.children
        .cache.filter((channel) => channel.isTextBased())
        .map((channel) => ({
            label: channel.name,
            value: channel.id,
        }))
        .slice(0, 25); // Limit to a maximum of 25 channels

    if (channels.length === 0) {
        return {
            error: errorEmbed(
                "No Channels Found",
                "The selected category does not contain any text-based channels."
            ),
        };
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_skip_channels")
        .setPlaceholder("Select channels to skip")
        .setMinValues(1)
        .setMaxValues(channels.length)
        .addOptions(channels);

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    return { actionRow, targetCategory };
}
