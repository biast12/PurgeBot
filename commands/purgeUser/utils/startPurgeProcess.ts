import { Guild, CommandInteraction, ChannelType, MessageFlags, ComponentType } from "discord.js";
import validateTarget from "../utils/validateTarget";
import handleCommands from "../utils/handleCommands";
import getChannels from "../utils/getChannels";
import processChannels from "../processing/processChannels";
import processForums from "../processing/processForums";
import progressComponent from "../components/progressComponent";
import doneComponent from "../components/doneComponent";
import errorComponent from "../components/errorComponent";
import { isCanceled } from "../utils/handleCommands";

export default async function startPurgeProcess(
    guild: Guild,
    interaction: CommandInteraction,
    activeCommands: Map<string, boolean>,
    targetId: string,
    targetUserId: string,
    skipChannels: string[]
): Promise<void> {
    // Validate the target and resolve the target name
    const { isValid, targetName } = await validateTarget(guild, targetId);

    if (!isValid) {
        await interaction.editReply({
            components: errorComponent(
                "Invalid Target",
                "The provided target ID does not belong to this server."
            ),
        });
        return;
    }

    console.log(`🚀 purgeUser command executed by "${interaction.user.tag}" (${interaction.user.id}) in "${guild.name}" (${guild.id})`);
    console.log(`🔍 Interaction ID: ${interaction.id}`);

    const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
    const targetUsername = targetUser ? targetUser.username : "Unknown User";

    const startTime = Date.now();
    const progress: { name: string; value: string; inline: boolean }[] = [];

    const progressComponentInstances = progressComponent(
        targetUsername,
        targetName,
        progress,
        interaction.id
    );

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
            components: [...progressComponentInstances],
            flags: MessageFlags.IsComponentsV2,
        });
    } else {
        await interaction.reply({
            components: [...progressComponentInstances],
            flags: MessageFlags.IsComponentsV2,
        });
    }

    const collector = interaction.channel?.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 15 * 60 * 1000, // 15 minutes timeout
    });

    // Use the handleCommands utility
    handleCommands(interaction, collector, interaction.id, (value) => {
        if (!value) {
            activeCommands.delete(guild.id); // Release the lock for this server
        }
    });

    try {
        const channels = getChannels(targetId, guild).filter(
            (channel) => !skipChannels.includes(channel.id)
        );
        let totalDeleted = 0;

        for (const channel of channels) {
            if (isCanceled(interaction.id, guild.id)) return;

            let channelDeleted = 0;

            if (channel.type === ChannelType.GuildForum) {
                channelDeleted += await processForums(
                    channel,
                    targetUserId,
                    interaction,
                    progress,
                    targetUsername,
                    targetName,
                    guild.id
                );
            } else if (
                channel.type === ChannelType.GuildText ||
                channel.type === ChannelType.PublicThread ||
                channel.type === ChannelType.PrivateThread ||
                channel.type === ChannelType.GuildAnnouncement ||
                channel.type === ChannelType.GuildVoice
            ) {
                channelDeleted += await processChannels(
                    channel,
                    targetUserId,
                    interaction,
                    progress,
                    targetUsername,
                    targetName,
                    guild.id
                );
            }

            totalDeleted += channelDeleted;
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        const doneComponentInstance = doneComponent(
            targetUsername,
            targetName,
            progress,
            totalDeleted,
            totalTime
        );
        if (!isCanceled(interaction.id, guild.id)) {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({
                    components: doneComponentInstance,
                    flags: MessageFlags.IsComponentsV2,
                });
            } else {
                await interaction.reply({
                    components: doneComponentInstance,
                    flags: MessageFlags.IsComponentsV2,
                });
            }
            await interaction.followUp({
                content: `<@${interaction.user.id}> The purge operation has been completed successfully!`,
                flags: MessageFlags.Ephemeral,
            });
            console.log(`✅ Purge (${interaction.id}) operation completed successfully.`);
        }
    } catch (error: any) {
        console.error(`❌ Purge (${interaction.id}) operation failed: ${error.message}`);
        const errorComponentInstance = errorComponent(
            "Error Occurred",
            `An error occurred while processing the purge operation: ${error.message}`
        );
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ components: errorComponentInstance, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        } else {
            await interaction.reply({ components: errorComponentInstance, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }
    }
}
