import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize
} from 'discord.js';
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

    const response = new ResponseBuilder();

    response.addComponent(
      new TextDisplayBuilder()
        .setContent('# PurgeBot\n\nPowerful message management for Discord servers.')
    );

    response.addComponent(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true)
    );

    response.addComponent(
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('## Bot Commands'),
          new TextDisplayBuilder()
            .setContent(
              '**`/purge user`** - Delete messages from a specific user\n' +
              '**`/purge role`** - Delete messages from role members\n' +
              '**`/purge everyone`** - Clear all messages (channel/category only)\n' +
              '**`/purge inactive`** - Remove messages from ex-members\n' +
              '**`/purge webhook`** - Delete messages sent by webhooks\n' +
              '**`/purge deleted`** - Clean up deleted account messages'
            )
        )
    );

    response.addComponent(
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('## Parameters'),
          new TextDisplayBuilder()
            .setContent(
              '**• target_id** - Where to purge (server/category/channel)\n' +
              '**• days** - Time limit (1-30 days)\n' +
              '**• skip_channels** - Exclude channels (category mode)\n' +
              '**• include_threads** - Include messages from threads (default: false)\n' +
              '**• include_bots** - Include bot messages (`role`, `everyone`, `inactive` only, default: false)\n' +
              '**• user/role** - Target for specific commands'
            )
        )
    );

    response.addComponent(
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('## Filtering'),
          new TextDisplayBuilder()
            .setContent(
              '**• filter** - Text or regex pattern to match messages\n' +
              '**• filter_mode** - How to match (contains/regex/exact/starts_with/ends_with)\n' +
              '**• case_sensitive** - Make filter case-sensitive (default: false)\n\n' +
              '-# Auto-detects regex patterns when filter_mode is not specified'
            )
        )
    );

    response.addComponent(
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent('## Required Permissions'),
          new TextDisplayBuilder()
            .setContent(
              '**Manage Messages** - To see channels and their content\n' +
              '**View Channel** - To access existing messages for purging\n' +
              '**Read History** - To delete messages\n\n' +
              '-# Users need **Manage Messages** permission to use the purge commands.'
            )
        )
    );

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Invite Bot')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com/oauth2/authorize?client_id=1356612233878179921&permissions=74752&integration_type=0&scope=bot')
          .setEmoji('🔗'),
        new ButtonBuilder()
          .setLabel('Support')
          .setStyle(ButtonStyle.Link)
          .setURL('https://biast12.com/botsupport')
          .setEmoji('❓'),
      );

    response.addComponent(row);

    await sendResponse(interaction, response);
  }
}