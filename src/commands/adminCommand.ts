import { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, ChatInputCommandInteraction, EmbedBuilder, Colors, MessageFlags } from 'discord.js';
import { BaseCommand } from '../core/command';
import { CommandContext } from '../types';
import { logger } from '../utils/logger';
import { LogArea } from '../types/logger';
import { AdminManager } from '../config/admins';

export class AdminCommand extends BaseCommand {
  public readonly name = 'admin';
  public readonly description = 'Admin commands for error management';

  buildCommand(): SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommandGroup(group =>
        group
          .setName('error')
          .setDescription('Error management commands')
          .addSubcommand(sub =>
            sub
              .setName('check')
              .setDescription('View details of a specific error')
              .addStringOption(opt =>
                opt
                  .setName('error_id')
                  .setDescription('The error ID to check')
                  .setRequired(true)
              )
          )
          .addSubcommand(sub =>
            sub
              .setName('list')
              .setDescription('List recent errors')
              .addIntegerOption(opt =>
                opt
                  .setName('limit')
                  .setDescription('Number of errors to show (max 25)')
                  .setMinValue(1)
                  .setMaxValue(25)
              )
              .addStringOption(opt =>
                opt
                  .setName('guild_id')
                  .setDescription('Filter errors by guild ID')
                  .setRequired(false)
              )
          )
          .addSubcommand(sub =>
            sub
              .setName('delete')
              .setDescription('Delete a specific error')
              .addStringOption(opt =>
                opt
                  .setName('error_id')
                  .setDescription('The error ID to delete')
                  .setRequired(true)
              )
          )
          .addSubcommand(sub =>
            sub
              .setName('clear')
              .setDescription('Clear errors with optional filters')
              .addStringOption(opt =>
                opt
                  .setName('level')
                  .setDescription('Filter by error level')
                  .setChoices(
                    { name: 'ERROR', value: 'ERROR' },
                    { name: 'CRITICAL', value: 'CRITICAL' },
                    { name: 'WARNING', value: 'WARNING' }
                  )
              )
              .addStringOption(opt =>
                opt
                  .setName('area')
                  .setDescription('Filter by area')
                  .setChoices(
                    { name: 'BOT', value: 'BOT' },
                    { name: 'COMMANDS', value: 'COMMANDS' },
                    { name: 'EVENTS', value: 'EVENTS' },
                    { name: 'API', value: 'API' },
                    { name: 'CONFIG', value: 'CONFIG' },
                    { name: 'STARTUP', value: 'STARTUP' },
                    { name: 'SHUTDOWN', value: 'SHUTDOWN' },
                    { name: 'PURGE', value: 'PURGE' },
                    { name: 'SERVICES', value: 'SERVICES' }
                  )
              )
              .addIntegerOption(opt =>
                opt
                  .setName('older_than_days')
                  .setDescription('Delete errors older than X days')
                  .setMinValue(1)
              )
          )
      );
  }

  async execute(context: CommandContext): Promise<void> {
    const { interaction } = context;

    // Check admin permission
    if (!AdminManager.isAuthorized(interaction.user.id)) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('⛔ Unauthorized')
        .setDescription('You do not have permission to use admin commands.');

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'error') {
      switch (subcommand) {
        case 'check':
          await this.handleErrorCheck(interaction);
          break;
        case 'list':
          await this.handleErrorList(interaction);
          break;
        case 'delete':
          await this.handleErrorDelete(interaction);
          break;
        case 'clear':
          await this.handleErrorClear(interaction);
          break;
      }
    }
  }

  private async handleErrorCheck(interaction: ChatInputCommandInteraction): Promise<void> {
    const errorId = interaction.options.getString('error_id', true);

    const error = await logger.getError(errorId);

    if (!error) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('❌ Error Not Found')
        .setDescription(`No error found with ID \`${errorId}\``);

      await interaction.followUp({
        embeds: [embed]
      });
      return;
    }

    // Format timestamp for Discord
    const timestamp = Math.floor(new Date(error.timestamp).getTime() / 1000);

    const embed = new EmbedBuilder()
      .setColor(error.level === 'CRITICAL' ? Colors.DarkRed : Colors.Orange)
      .setTitle(`🔍 Error Details: ${error._id}`)
      .addFields(
        { name: 'Level', value: error.level, inline: true },
        { name: 'Area', value: error.area, inline: true },
        { name: 'Timestamp', value: `<t:${timestamp}:F>`, inline: false },
        { name: 'Message', value: error.message || 'No message', inline: false }
      );

    if (error.guild_id) {
      embed.addFields({
        name: 'Guild',
        value: `${error.guild_name || 'Unknown'} (\`${error.guild_id}\`)`,
        inline: false
      });
    }

    if (error.channel_id) {
      embed.addFields({
        name: 'Channel',
        value: `${error.channel_name || 'Unknown'} (\`${error.channel_id}\`)`,
        inline: false
      });
    }

    if (error.user_id) {
      embed.addFields({ name: 'User ID', value: error.user_id, inline: true });
    }

    if (error.command) {
      embed.addFields({ name: 'Command', value: error.command, inline: true });
    }

    if (error.stack_trace) {
      const stackPreview = error.stack_trace.substring(0, 1000);
      embed.addFields({
        name: 'Stack Trace',
        value: `\`\`\`${stackPreview}${error.stack_trace.length > 1000 ? '...' : ''}\`\`\``,
        inline: false
      });
    }

    if (error.context) {
      const contextStr = JSON.stringify(error.context, null, 2).substring(0, 1000);
      embed.addFields({
        name: 'Context',
        value: `\`\`\`json\n${contextStr}\`\`\``,
        inline: false
      });
    }

    await interaction.followUp({ embeds: [embed] });
  }

  private async handleErrorList(interaction: ChatInputCommandInteraction): Promise<void> {
    const limit = interaction.options.getInteger('limit') || 10;
    const guildId = interaction.options.getString('guild_id') || undefined;

    const errors = await logger.getRecentErrors(limit, guildId);

    if (errors.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ No Errors')
        .setDescription('No errors found in the database.');

      await interaction.followUp({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(`📋 Recent Errors (${errors.length})`)
      .setDescription(
        errors
          .map(err => {
            const timestamp = Math.floor(new Date(err.timestamp).getTime() / 1000);
            const levelEmoji = err.level === 'CRITICAL' ? '🔴' : err.level === 'ERROR' ? '🟠' : '🟡';
            const messagePreview =
              err.message.length > 80 ? `${err.message.substring(0, 80)}...` : err.message;
            return `${levelEmoji} \`${err._id}\` - **${err.area}** - <t:${timestamp}:R>\n${messagePreview}`;
          })
          .join('\n\n')
      );

    await interaction.followUp({ embeds: [embed] });
  }

  private async handleErrorDelete(interaction: ChatInputCommandInteraction): Promise<void> {
    const errorId = interaction.options.getString('error_id', true);

    const deleted = await logger.deleteError(errorId);

    if (deleted) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Error Deleted')
        .setDescription(`Successfully deleted error \`${errorId}\``);

      await interaction.followUp({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('❌ Deletion Failed')
        .setDescription(`Error \`${errorId}\` not found or already deleted.`);

      await interaction.followUp({ embeds: [embed] });
    }
  }

  private async handleErrorClear(interaction: ChatInputCommandInteraction): Promise<void> {
    const level = interaction.options.getString('level') || undefined;
    const area = interaction.options.getString('area') as LogArea | undefined;
    const olderThanDays = interaction.options.getInteger('older_than_days') || undefined;

    const deletedCount = await logger.clearErrors({
      level,
      area,
      olderThanDays
    });

    const filters: string[] = [];
    if (level) filters.push(`Level: ${level}`);
    if (area) filters.push(`Area: ${area}`);
    if (olderThanDays) filters.push(`Older than ${olderThanDays} days`);

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle('🗑️ Errors Cleared')
      .setDescription(`Deleted ${deletedCount} error(s)`)
      .addFields({
        name: 'Filters Applied',
        value: filters.length > 0 ? filters.join('\n') : 'None (cleared all)',
        inline: false
      });

    await interaction.followUp({ embeds: [embed] });
  }
}
