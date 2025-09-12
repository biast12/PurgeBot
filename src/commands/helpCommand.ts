import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BaseCommand } from '../core/command';
import { CommandContext } from '../types';
import { ResponseBuilder, sendResponse } from '../core/response';

export class HelpCommand extends BaseCommand {
  public readonly name = 'help';
  public readonly description = 'Get information about the bot and its commands';

  public buildCommand(): SlashCommandBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description) as SlashCommandBuilder;
  }

  public async execute(context: CommandContext): Promise<void> {
    const { interaction } = context;
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📚 PurgeBot Help')
      .setDescription('PurgeBot helps you manage and clean up messages in your Discord server.')
      .addFields(
        {
          name: '🗑️ /purgeuser',
          value: 'Delete all messages from a specific user in your server, a category, or a channel.',
          inline: false
        },
        {
          name: 'Parameters',
          value: 
            '• `target_id` - The server, category, or channel to purge from\n' +
            '• `user_id` - The ID of the user whose messages to delete\n' +
            '• `skip_channels` - (Optional) Skip specific channels when purging a category',
          inline: false
        },
        {
          name: '📋 Features',
          value: 
            '• Purge messages server-wide, by category, or by channel\n' +
            '• Smart rate limiting to avoid Discord API limits\n' +
            '• Progress tracking with real-time updates\n' +
            '• Support for deleted users (using their ID)\n' +
            '• Cancel operations at any time\n' +
            '• Automatic handling of old messages (>14 days)',
          inline: false
        },
        {
          name: '⚠️ Requirements',
          value: 'Administrator permissions are required to use the purge command.',
          inline: false
        },
        {
          name: '💡 Tips',
          value: 
            '• Use autocomplete to easily select targets and users\n' +
            '• You can purge messages from deleted users by entering their ID\n' +
            '• The bot will automatically handle rate limits\n' +
            '• Messages older than 14 days are deleted individually (slower)',
          inline: false
        }
      )
      .setFooter({ 
        text: 'PurgeBot - Efficient Message Management',
        iconURL: interaction.client.user?.displayAvatarURL()
      })
      .setTimestamp();

    const inviteButton = new ButtonBuilder()
      .setLabel('Invite Bot')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.com/oauth2/authorize?client_id=1356612233878179921&permissions=294205352960&integration_type=0&scope=bot')
      .setEmoji('🔗');

    const supportButton = new ButtonBuilder()
      .setLabel('Support Server')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.gg/7XPzPxHh7W')
      .setEmoji('❓');

    const githubButton = new ButtonBuilder()
      .setLabel('GitHub')
      .setStyle(ButtonStyle.Link)
      .setURL('https://github.com/biast12/PurgeBot')
      .setEmoji('📂');

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(inviteButton, supportButton, githubButton);

    const response = new ResponseBuilder()
      .addEmbed(embed)
      .addComponent(row);

    await sendResponse(interaction, response);
  }
}