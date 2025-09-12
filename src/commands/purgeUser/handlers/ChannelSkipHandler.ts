import { 
  CommandInteraction,
  Guild,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType
} from "discord.js";
import { CONSTANTS } from "../../../config/constants";

export class ChannelSkipHandler {
  async handle(
    interaction: CommandInteraction,
    guild: Guild,
    categoryId: string,
    categoryName: string
  ): Promise<{ proceed: boolean; skippedChannels?: string[] }> {
    const category = guild.channels.cache.get(categoryId);
    
    if (!category || category.type !== ChannelType.GuildCategory) {
      return { proceed: false };
    }

    // Get all text channels in the category
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

    // Create select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('skip_channels_select')
      .setPlaceholder('Select channels to skip (optional)')
      .setMinValues(0)
      .setMaxValues(Math.min(textChannels.length - 1, 25)) // Can't skip all channels
      .addOptions(textChannels.slice(0, 25));

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    // Create buttons
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

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Channel Selection')
      .setDescription(`You selected the category **${categoryName}**.\n\nWould you like to skip any channels during the purge?`)
      .addFields(
        { name: 'Total Channels', value: textChannels.length.toString(), inline: true },
        { name: 'Category', value: categoryName, inline: true }
      )
      .setFooter({ text: 'Select channels to skip or click Continue to purge all channels' });

    // Send interaction
    await interaction.reply({
      embeds: [embed],
      components: [selectRow, buttonRow]
    });

    // Wait for response
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
                embeds: [
                  new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Invalid Selection')
                    .setDescription('You cannot skip all channels in the category.')
                ],
                components: []
              });
              resolved = true;
              collector.stop();
              resolve({ proceed: false });
            } else {
              await i.update({
                embeds: [
                  new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Selection Confirmed')
                    .setDescription(`Proceeding with purge. Skipping ${selectedChannels.length} channel(s).`)
                ],
                components: []
              });
              resolved = true;
              collector.stop();
              resolve({ proceed: true, skippedChannels: selectedChannels });
            }
          } else if (i.customId === 'skip_cancel') {
            await i.update({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xFFA500)
                  .setTitle('⚠️ Operation Cancelled')
                  .setDescription('The purge operation has been cancelled.')
              ],
              components: []
            });
            resolved = true;
            collector.stop();
            resolve({ proceed: false });
          }
        }
      });

      collector?.on('end', () => {
        if (!resolved) {
          interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⏱️ Selection Timed Out')
                .setDescription('The channel selection has timed out.')
            ],
            components: []
          }).catch(() => {});
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