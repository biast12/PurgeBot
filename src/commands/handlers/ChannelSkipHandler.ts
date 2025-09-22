import {
  ChatInputCommandInteraction,
  Guild,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
  ContainerBuilder,
  MessageFlags,
  ChannelType
} from "discord.js";
import { CONSTANTS } from "../../config/constants";

export class ChannelSkipHandler {
  async handle(
    interaction: ChatInputCommandInteraction,
    guild: Guild,
    categoryId: string,
    categoryName: string
  ): Promise<{ proceed: boolean; skippedChannels?: string[] }> {
    const category = guild.channels.cache.get(categoryId);

    if (!category || category.type !== ChannelType.GuildCategory) {
      return { proceed: false };
    }

    const textChannels = guild.channels.cache
      .filter(ch => ch.parentId === categoryId && this.isTextChannel(ch.type))
      .map(ch => ({
        label: ch.name,
        value: ch.id,
        description: `Skip ${ch.name} during purge`,
        emoji: this.getChannelEmoji(ch.type)
      }));

    if (textChannels.length === 0) {
      return { proceed: false };
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('skip_channels_select')
      .setPlaceholder('Select channels to skip (optional)')
      .setMinValues(0)
      .setMaxValues(Math.min(textChannels.length - 1, 25))
      .addOptions(textChannels.slice(0, 25));

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    const continueButton = new ButtonBuilder()
      .setCustomId('skip_continue')
      .setLabel('Continue')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅');

    const cancelButton = new ButtonBuilder()
      .setCustomId('skip_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌');

    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(continueButton, cancelButton);

    const components = [];

    components.push(
      new TextDisplayBuilder()
        .setContent(`# Channel Selection\n\nYou selected the category **${categoryName}**.\n\nWould you like to skip any channels during the purge?`)
    );

    components.push(
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`**Total Channels:** ${textChannels.length}`),
          new TextDisplayBuilder()
            .setContent(`**Category:** ${categoryName}`)
        )
    );

    components.push(
      new TextDisplayBuilder()
        .setContent('_Select channels to skip or click Continue to purge all channels_')
    );

    components.push(selectRow);
    components.push(buttonRow);

    await interaction.reply({
      components: components,
      flags: MessageFlags.IsComponentsV2
    } as any);

    return new Promise((resolve) => {
      let selectedChannels: string[] = [];
      let resolved = false;

      const collector = interaction.channel?.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: CONSTANTS.INTERACTION_TIMEOUT
      });

      collector?.on('collect', async (i) => {
        if (resolved) return;

        if (i.isStringSelectMenu() && i.customId === 'skip_channels_select') {
          selectedChannels = i.values;
          await i.deferUpdate();
        } else if (i.isButton()) {
          if (i.customId === 'skip_continue') {
            if (selectedChannels.length === textChannels.length) {
              await i.update({
                components: [
                  new TextDisplayBuilder()
                    .setContent('# ❌ Invalid Selection\n\nYou cannot skip all channels in the category.')
                ],
                flags: MessageFlags.IsComponentsV2
              } as any);
              resolved = true;
              collector.stop();
              resolve({ proceed: false });
            } else {
              await i.deferUpdate();
              resolved = true;
              collector.stop();
              resolve({ proceed: true, skippedChannels: selectedChannels });
            }
          } else if (i.customId === 'skip_cancel') {
            await i.update({
              components: [
                new TextDisplayBuilder()
                  .setContent('# ⚠️ Operation Cancelled\n\nThe purge operation has been cancelled.')
              ],
              flags: MessageFlags.IsComponentsV2
            } as any);
            resolved = true;
            collector.stop();
            resolve({ proceed: false });
          }
        }
      });

      collector?.on('end', () => {
        if (!resolved) {
          interaction.editReply({
            components: [
              new TextDisplayBuilder()
                .setContent('# ⏱️ Selection Timed Out\n\nThe channel selection has timed out.')
            ],
            flags: MessageFlags.IsComponentsV2
          } as any).catch(() => { });
          resolve({ proceed: false });
        }
      });
    });
  }

  private isTextChannel(type: ChannelType): boolean {
    return [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildVoice,
      ChannelType.GuildForum
    ].includes(type);
  }

  private getChannelEmoji(type: ChannelType): string {
    switch (type) {
      case ChannelType.GuildText:
        return '💬';
      case ChannelType.GuildAnnouncement:
        return '📢';
      case ChannelType.GuildVoice:
        return '🔊';
      case ChannelType.GuildForum:
        return '💭';
      default:
        return '📝';
    }
  }
}