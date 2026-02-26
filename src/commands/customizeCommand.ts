import {
  SlashCommandBuilder,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  FileUploadBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
  ContainerBuilder,
  PermissionsBitField,
  MessageFlags,
  InteractionContextType,
  ModalSubmitInteraction,
  Guild,
} from 'discord.js';
import { BaseCommand } from '../core/command';
import { CommandContext } from '../types';
import { sendError } from '../core/response';
import { customizationService } from '../services/CustomizationService';
import { getBotConfig } from '../core/config';
import { logger } from '../utils/logger';
import { LogArea } from '../types/logger';

export class CustomizeCommand extends BaseCommand {
  public readonly name = 'customize';
  public readonly description = 'Customize the bot\'s appearance for this server (Premium)';

  public buildCommand(): SlashCommandBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand(sub => sub
        .setName('edit')
        .setDescription('Edit the bot\'s name, avatar, and branding for this server')
      )
      .addSubcommand(sub => sub
        .setName('clear')
        .setDescription('Reset the bot\'s name and avatar back to defaults for this server')
      ) as SlashCommandBuilder;
  }

  public async execute(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild;

    if (!guild) {
      await sendError(interaction, 'This command can only be used within a server.');
      return;
    }

    // Require Administrator permission
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      await sendError(interaction, 'You need the **Administrator** permission to customize the bot.');
      return;
    }

    // Check premium (guild subscription) entitlement
    if (!customizationService.hasPremiumAccess(interaction)) {
      const { premiumSkuId } = getBotConfig();

      const mainContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              '# ✨ Premium Feature\n\n' +
              'Customizing the bot requires a **Server Subscription**.\n\n' +
              '**What you get:**\n' +
              '• Custom bot nickname for this server\n' +
              '• Custom bot avatar for this server\n' +
              '• Remove the "Powered by PurgeBot" footer'
            )
        );

      const components: any[] = [mainContainer];

      if (premiumSkuId) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Premium)
            .setSKUId(premiumSkuId)
        );
        components.push(row);
      }

      await interaction.reply({
        components,
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] as any,
      });
      return;
    }

    const subcommand = (interaction as any).options.getSubcommand();

    if (subcommand === 'edit') {
      await this.executeEdit(interaction, guild);
    } else if (subcommand === 'clear') {
      await this.executeClear(interaction, guild);
    }
  }

  private async executeEdit(interaction: any, guild: Guild): Promise<void> {
    // Load current settings to pre-fill the modal
    const current = await customizationService.getGuildCustomization(guild.id);

    const modal = new ModalBuilder()
      .setTitle('Customize PurgeBot')
      .setCustomId('customize_modal')
      .addLabelComponents(
        new LabelBuilder()
          .setLabel('Bot Name')
          .setDescription('Nickname for this server. Leave blank to reset to default.')
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId('bot_name')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(32)
              .setPlaceholder('PurgeBot')
              .setValue(current?.bot_name ?? '')
          ),
        new LabelBuilder()
          .setLabel('Bot Avatar')
          .setDescription('Upload a new avatar (JPG, PNG, GIF, WebP). Only changes the avatar in this server.')
          .setFileUploadComponent(
            new FileUploadBuilder()
              .setCustomId('bot_avatar')
              .setRequired(false)
          ),
        new LabelBuilder()
          .setLabel('Branding')
          .setDescription('Control the "Powered by PurgeBot" footer shown in this server.')
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId('remove_branding')
              .setMinValues(1)
              .setMaxValues(1)
              .addOptions(
                {
                  label: 'Keep branding',
                  value: 'false',
                  description: 'Show the "Powered by PurgeBot" footer',
                  default: !(current?.remove_branding ?? false),
                },
                {
                  label: 'Remove branding',
                  value: 'true',
                  description: 'Hide the "Powered by PurgeBot" footer',
                  default: current?.remove_branding ?? false,
                }
              )
          )
      );

    await interaction.showModal(modal);
  }

  private async executeClear(interaction: any, guild: Guild): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const errors: string[] = [];
    const applied: string[] = [];

    // Reset nickname and avatar via PATCH /guilds/{id}/members/@me
    try {
      await guild.members.editMe({ nick: null, avatar: null });
      applied.push('**Bot Name:** Reset to default');
      applied.push('**Bot Avatar:** Reset to default');
    } catch (err) {
      errors.push('Failed to reset name/avatar. Ensure I have **Manage Nicknames** permission.');
      logger.error(LogArea.COMMANDS, `Failed to editMe (clear) for guild ${guild.id}: ${err}`);
    }

    // Preserve branding setting, remove name and avatar from DB
    const existing = await customizationService.getGuildCustomization(guild.id);
    try {
      await customizationService.saveGuildCustomization(guild.id, {
        updated_by: interaction.user.id,
        remove_branding: existing?.remove_branding ?? false,
      });
      applied.push('**Branding:** Setting preserved');
    } catch (err) {
      errors.push('Failed to save settings to database.');
      logger.error(LogArea.COMMANDS, `Failed to save customization (clear) for guild ${guild.id}: ${err}`);
    }

    const lines: string[] = ['# ✅ Bot Reset\n'];

    if (applied.length > 0) {
      lines.push('**Cleared:**');
      applied.forEach(a => lines.push(`• ${a}`));
    }

    if (errors.length > 0) {
      lines.push('\n**⚠️ Some changes failed:**');
      errors.forEach(e => lines.push(`• ${e}`));
    }

    await interaction.editReply({
      components: [
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(lines.join('\n'))
        )
      ],
      flags: MessageFlags.IsComponentsV2 as any,
    });
  }

  public async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    // Re-validate admin permission
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      await interaction.reply({
        components: [
          new TextDisplayBuilder()
            .setContent('# ❌ Error\n\nYou need the **Administrator** permission to customize the bot.')
        ],
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] as any,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const errors: string[] = [];
    const applied: string[] = [];

    // --- Read modal fields ---
    let newName: string | null = null;
    let removeBranding = false;
    let avatarAttachment: any = null;

    try {
      const nameField = interaction.fields.getField('bot_name') as any;
      const brandingField = interaction.fields.getField('remove_branding') as any;
      const avatarField = interaction.fields.getField('bot_avatar') as any;

      newName = nameField?.value?.trim() || null;
      removeBranding = brandingField?.values?.[0] === 'true';
      avatarAttachment = avatarField?.attachments?.first() ?? null;
    } catch (err) {
      await interaction.editReply({
        components: [new TextDisplayBuilder().setContent('# ❌ Error\n\nFailed to read modal fields.')],
        flags: MessageFlags.IsComponentsV2 as any,
      });
      return;
    }

    // --- Validate avatar ---
    if (avatarAttachment) {
      const contentType: string = avatarAttachment.contentType ?? '';
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(contentType.split(';')[0].trim())) {
        errors.push(`Invalid avatar file type: \`${contentType || 'unknown'}\`. Allowed: JPG, PNG, GIF, WebP.`);
        avatarAttachment = null;
      } else if (avatarAttachment.size > 8 * 1024 * 1024) {
        errors.push('Avatar file exceeds the 8 MB size limit.');
        avatarAttachment = null;
      }
    }

    // --- Abort early on validation errors ---
    if (errors.length > 0) {
      await interaction.editReply({
        components: [new TextDisplayBuilder().setContent(`# ❌ Validation Error\n\n${errors.join('\n')}`)],
        flags: MessageFlags.IsComponentsV2 as any,
      });
      return;
    }

    // --- Download avatar if provided (needed before editMe call) ---
    let avatarBase64: string | undefined;
    if (avatarAttachment) {
      try {
        const res = await fetch(avatarAttachment.url);
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType: string = avatarAttachment.contentType ?? 'image/png';
        avatarBase64 = `data:${contentType};base64,${buffer.toString('base64')}`;
      } catch (err) {
        errors.push('Failed to download the uploaded avatar image.');
        logger.error(LogArea.COMMANDS, `Failed to download avatar for guild ${guild.id}: ${err}`);
      }
    }

    // --- Apply nickname + avatar via PATCH /guilds/{id}/members/@me (both are per-guild) ---
    try {
      await guild.members.editMe({
        nick: newName,
        ...(avatarBase64 ? { avatar: avatarBase64 } : {}),
      });
      applied.push(`**Bot Name:** ${newName ? `\`${newName}\`` : 'Reset to default'}`);
      if (avatarBase64) applied.push('**Bot Avatar:** Updated for this server');
    } catch (err) {
      errors.push('Failed to apply name/avatar. Ensure I have **Manage Nicknames** permission and my role is not above the server owner\'s.');
      logger.error(LogArea.COMMANDS, `Failed to editMe for guild ${guild.id}: ${err}`);
    }

    // --- Preserve existing avatar in DB if not uploading a new one ---
    let storedAvatar: string | undefined = avatarBase64;
    if (!storedAvatar) {
      const existing = await customizationService.getGuildCustomization(guild.id);
      storedAvatar = existing?.bot_avatar;
    }

    // --- Save to MongoDB ---
    try {
      await customizationService.saveGuildCustomization(guild.id, {
        updated_by: interaction.user.id,
        remove_branding: removeBranding,
        ...(newName ? { bot_name: newName } : {}),
        ...(storedAvatar ? { bot_avatar: storedAvatar } : {}),
      });
      applied.push(`**Branding:** ${removeBranding ? 'Footer removed' : 'Footer kept'}`);
    } catch (err) {
      errors.push('Failed to save settings to database. Your changes may not persist after a restart.');
      logger.error(LogArea.COMMANDS, `Failed to save customization for guild ${guild.id}: ${err}`);
    }

    // --- Build response ---
    const lines: string[] = ['# ✅ Bot Customized\n'];

    if (applied.length > 0) {
      lines.push('**Changes applied:**');
      applied.forEach(a => lines.push(`• ${a}`));
    }

    if (errors.length > 0) {
      lines.push('\n**⚠️ Some changes failed:**');
      errors.forEach(e => lines.push(`• ${e}`));
    }

    await interaction.editReply({
      components: [
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(lines.join('\n'))
        )
      ],
      flags: MessageFlags.IsComponentsV2 as any,
    });
  }
}
