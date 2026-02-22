import { SlashCommandBuilder, PermissionsBitField, InteractionContextType } from 'discord.js';
import { BaseCommand } from '../core/command';
import { CommandContext, AutocompleteContext } from '../types';
import { sendError } from '../core/response';
import { operationManager } from '../services/OperationManager';
import { purgeService } from '../services/PurgeService';
import { ValidationService } from '../services/ValidationService';
import { ChannelSkipHandler } from './handlers/ChannelSkipHandler';
import { AutocompleteService } from './services/AutocompleteService';
import { logger } from '../utils/logger';
import { LogArea } from '../types/logger';
import { PurgeProgressUI } from '../services/PurgeProgressUI';
import { ContentFilter, FilterMode } from '../services/ContentFilter';

export class PurgeCommand extends BaseCommand {
  public readonly name = 'purge';
  public readonly description = 'Purge messages from your server';

  private validationService: ValidationService;
  private autocompleteService: AutocompleteService;
  private channelSkipHandler: ChannelSkipHandler;
  private progressUI: PurgeProgressUI;

  constructor() {
    super();
    this.validationService = new ValidationService();
    this.autocompleteService = new AutocompleteService();
    this.channelSkipHandler = new ChannelSkipHandler();
    this.progressUI = new PurgeProgressUI();
  }

  public buildCommand(): SlashCommandBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommand(subcommand =>
        subcommand
          .setName('user')
          .setDescription('Delete all messages from a specific user')
          .addStringOption(option =>
            option
              .setName('target_id')
              .setDescription('The server, category, or channel to purge messages from')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addUserOption(option =>
            option
              .setName('user')
              .setDescription('The user whose messages will be deleted')
              .setRequired(true)
          )
          .addIntegerOption(option =>
            option
              .setName('days')
              .setDescription('Only delete messages from the last X days (1-30)')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(30)
          )
          .addStringOption(option =>
            option
              .setName('filter')
              .setDescription('Only delete messages matching this filter (text or regex)')
              .setRequired(false)
          )
          .addStringOption(option =>
            option
              .setName('filter_mode')
              .setDescription('How to interpret the filter')
              .setRequired(false)
              .addChoices(
                { name: 'Contains text', value: 'contains' },
                { name: 'Regex pattern', value: 'regex' },
                { name: 'Exact match', value: 'exact' },
                { name: 'Starts with', value: 'starts_with' },
                { name: 'Ends with', value: 'ends_with' }
              )
          )
          .addBooleanOption(option =>
            option
              .setName('case_sensitive')
              .setDescription('Make filter case-sensitive (default: false)')
              .setRequired(false)
          )
          .addBooleanOption(option =>
            option
              .setName('skip_channels')
              .setDescription('Skip specific channels when purging (category mode only)')
              .setRequired(false)
          )
          .addBooleanOption(option =>
            option
              .setName('include_threads')
              .setDescription('Include messages from threads (default: false)')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('role')
          .setDescription('Delete all messages from users with a specific role')
          .addStringOption(option =>
            option
              .setName('target_id')
              .setDescription('The server, category, or channel to purge messages from')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addRoleOption(option =>
            option
              .setName('role')
              .setDescription('The role whose members\' messages will be deleted')
              .setRequired(true)
          )
          .addIntegerOption(option =>
            option
              .setName('days')
              .setDescription('Only delete messages from the last X days (1-30)')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(30)
          )
          .addStringOption(option =>
            option
              .setName('filter')
              .setDescription('Only delete messages matching this filter (text or regex)')
              .setRequired(false)
          )
          .addStringOption(option =>
            option
              .setName('filter_mode')
              .setDescription('How to interpret the filter')
              .setRequired(false)
              .addChoices(
                { name: 'Contains text', value: 'contains' },
                { name: 'Regex pattern', value: 'regex' },
                { name: 'Exact match', value: 'exact' },
                { name: 'Starts with', value: 'starts_with' },
                { name: 'Ends with', value: 'ends_with' }
              )
          )
          .addBooleanOption(option =>
            option
              .setName('case_sensitive')
              .setDescription('Make filter case-sensitive (default: false)')
              .setRequired(false)
          )
          .addBooleanOption(option =>
            option
              .setName('skip_channels')
              .setDescription('Skip specific channels when purging (category mode only)')
              .setRequired(false)
          )
          .addBooleanOption(option =>
            option
              .setName('include_threads')
              .setDescription('Include messages from threads (default: false)')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('everyone')
          .setDescription('Delete all messages in the target (use with extreme caution)')
          .addStringOption(option =>
            option
              .setName('target_id')
              .setDescription('The category or channel to purge all messages from')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addIntegerOption(option =>
            option
              .setName('days')
              .setDescription('Only delete messages from the last X days (1-30)')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(30)
          )
          .addStringOption(option =>
            option
              .setName('filter')
              .setDescription('Only delete messages matching this filter (text or regex)')
              .setRequired(false)
          )
          .addStringOption(option =>
            option
              .setName('filter_mode')
              .setDescription('How to interpret the filter')
              .setRequired(false)
              .addChoices(
                { name: 'Contains text', value: 'contains' },
                { name: 'Regex pattern', value: 'regex' },
                { name: 'Exact match', value: 'exact' },
                { name: 'Starts with', value: 'starts_with' },
                { name: 'Ends with', value: 'ends_with' }
              )
          )
          .addBooleanOption(option =>
            option
              .setName('case_sensitive')
              .setDescription('Make filter case-sensitive (default: false)')
              .setRequired(false)
          )
          .addBooleanOption(option =>
            option
              .setName('skip_channels')
              .setDescription('Skip specific channels when purging (category mode only)')
              .setRequired(false)
          )
          .addBooleanOption(option =>
            option
              .setName('include_threads')
              .setDescription('Include messages from threads (default: false)')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('inactive')
          .setDescription('Delete messages from users no longer in the server')
          .addStringOption(option =>
            option
              .setName('target_id')
              .setDescription('The server, category, or channel to purge messages from')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addIntegerOption(option =>
            option
              .setName('days')
              .setDescription('Only delete messages from the last X days (1-30)')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(30)
          )
          .addStringOption(option =>
            option
              .setName('filter')
              .setDescription('Only delete messages matching this filter (text or regex)')
              .setRequired(false)
          )
          .addStringOption(option =>
            option
              .setName('filter_mode')
              .setDescription('How to interpret the filter')
              .setRequired(false)
              .addChoices(
                { name: 'Contains text', value: 'contains' },
                { name: 'Regex pattern', value: 'regex' },
                { name: 'Exact match', value: 'exact' },
                { name: 'Starts with', value: 'starts_with' },
                { name: 'Ends with', value: 'ends_with' }
              )
          )
          .addBooleanOption(option =>
            option
              .setName('case_sensitive')
              .setDescription('Make filter case-sensitive (default: false)')
              .setRequired(false)
          )
          .addBooleanOption(option =>
            option
              .setName('skip_channels')
              .setDescription('Skip specific channels when purging (category mode only)')
              .setRequired(false)
          )
          .addBooleanOption(option =>
            option
              .setName('include_threads')
              .setDescription('Include messages from threads (default: false)')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('deleted')
          .setDescription('Delete messages from deleted user accounts')
          .addStringOption(option =>
            option
              .setName('target_id')
              .setDescription('The server, category, or channel to purge messages from')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addIntegerOption(option =>
            option
              .setName('days')
              .setDescription('Only delete messages from the last X days (1-30)')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(30)
          )
          .addStringOption(option =>
            option
              .setName('filter')
              .setDescription('Only delete messages matching this filter (text or regex)')
              .setRequired(false)
          )
          .addStringOption(option =>
            option
              .setName('filter_mode')
              .setDescription('How to interpret the filter')
              .setRequired(false)
              .addChoices(
                { name: 'Contains text', value: 'contains' },
                { name: 'Regex pattern', value: 'regex' },
                { name: 'Exact match', value: 'exact' },
                { name: 'Starts with', value: 'starts_with' },
                { name: 'Ends with', value: 'ends_with' }
              )
          )
          .addBooleanOption(option =>
            option
              .setName('case_sensitive')
              .setDescription('Make filter case-sensitive (default: false)')
              .setRequired(false)
          )
          .addBooleanOption(option =>
            option
              .setName('skip_channels')
              .setDescription('Skip specific channels when purging (category mode only)')
              .setRequired(false)
          )
          .addBooleanOption(option =>
            option
              .setName('include_threads')
              .setDescription('Include messages from threads (default: false)')
              .setRequired(false)
          )
      )
      .setContexts(InteractionContextType.Guild) as SlashCommandBuilder;
  }

  public async execute(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild;

    if (!guild) {
      await sendError(interaction, 'This command can only be used within a server.');
      return;
    }

    if (operationManager.isGuildLocked(guild.id)) {
      await sendError(interaction, 'Another purge operation is already running in this server. Please wait for it to complete.');
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      await sendError(interaction, 'You need Manage Messages permission to use this command.');
      return;
    }

    const botMember = guild.members.me;
    if (!botMember) {
      await sendError(interaction, 'Could not verify bot permissions.');
      return;
    }

    const requiredPermissions = [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.ManageMessages
    ];

    const missingPermissions = requiredPermissions.filter(perm => !botMember.permissions.has(perm));

    if (missingPermissions.length > 0) {
      const permissionNames = missingPermissions.map(perm => {
        switch (perm) {
          case PermissionsBitField.Flags.ViewChannel: return 'View Channel';
          case PermissionsBitField.Flags.ReadMessageHistory: return 'Read Message History';
          case PermissionsBitField.Flags.ManageMessages: return 'Manage Messages';
          default: return 'Unknown';
        }
      }).join(', ');

      await sendError(interaction, `I'm missing required permissions: ${permissionNames}. Please ensure I have these permissions to purge messages.`);
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'user':
        await this.handleUserPurge(context);
        break;
      case 'role':
        await this.handleRolePurge(context);
        break;
      case 'everyone':
        await this.handleEveryonePurge(context);
        break;
      case 'inactive':
        await this.handleInactivePurge(context);
        break;
      case 'deleted':
        await this.handleDeletedPurge(context);
        break;
    }
  }

  private createContentFilter(interaction: any): ContentFilter | undefined {
    const filter = interaction.options.getString('filter');
    if (!filter) return undefined;

    const filterModeStr = interaction.options.getString('filter_mode');
    const caseSensitive = interaction.options.getBoolean('case_sensitive') || false;

    let mode: FilterMode;
    if (filterModeStr) {
      switch (filterModeStr) {
        case 'regex':
          mode = FilterMode.REGEX;
          break;
        case 'exact':
          mode = FilterMode.EXACT;
          break;
        case 'starts_with':
          mode = FilterMode.STARTS_WITH;
          break;
        case 'ends_with':
          mode = FilterMode.ENDS_WITH;
          break;
        case 'contains':
        default:
          mode = FilterMode.CONTAINS;
          break;
      }
    } else {
      const regexChars = /[.*+?^${}()|[\]\\]/;
      if (regexChars.test(filter)) {
        mode = FilterMode.REGEX;
      } else {
        mode = FilterMode.CONTAINS;
      }
    }

    if (mode === FilterMode.REGEX) {
      const validation = ContentFilter.validateRegex(filter);
      if (!validation.valid) {
        throw new Error(`Invalid regex pattern: ${validation.error}`);
      }
    }

    return new ContentFilter({
      pattern: filter,
      mode,
      caseSensitive
    });
  }

  private async handleUserPurge(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild!;

    const targetId = interaction.options.getString('target_id', true);
    const user = interaction.options.getUser('user', true);
    const userId = user.id;
    const days = interaction.options.getInteger('days');
    const skipChannels = interaction.options.getBoolean('skip_channels') || false;
    const includeThreads = interaction.options.getBoolean('include_threads') || false;

    let contentFilter: ContentFilter | undefined;
    try {
      contentFilter = this.createContentFilter(interaction);
    } catch (error: any) {
      await sendError(interaction, error.message);
      return;
    }

    const validation = await this.validationService.validateTarget(guild, targetId);
    if (!validation.isValid) {
      await sendError(interaction, validation.error || 'The specified target is not valid.');
      return;
    }

    const purgeOptions = {
      type: 'user' as const,
      userId,
      days,
      contentFilter,
      includeThreads
    };

    if (skipChannels && validation.targetType === 'category') {
      const skipResult = await this.channelSkipHandler.handle(
        interaction,
        guild,
        targetId,
        validation.targetName!
      );

      if (!skipResult.proceed) return;

      await this.startPurge(
        context,
        guild,
        targetId,
        purgeOptions,
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(context, guild, targetId, purgeOptions, []);
    }
  }

  private async handleRolePurge(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild!;

    const targetId = interaction.options.getString('target_id', true);
    const role = interaction.options.getRole('role', true);
    const days = interaction.options.getInteger('days');
    const skipChannels = interaction.options.getBoolean('skip_channels') || false;
    const includeThreads = interaction.options.getBoolean('include_threads') || false;

    let contentFilter: ContentFilter | undefined;
    try {
      contentFilter = this.createContentFilter(interaction);
    } catch (error: any) {
      await sendError(interaction, error.message);
      return;
    }

    const validation = await this.validationService.validateTarget(guild, targetId);
    if (!validation.isValid) {
      await sendError(interaction, validation.error || 'The specified target is not valid.');
      return;
    }

    const purgeOptions = {
      type: 'role' as const,
      roleId: role.id,
      roleName: role.name,
      days,
      contentFilter,
      includeThreads
    };

    if (skipChannels && validation.targetType === 'category') {
      const skipResult = await this.channelSkipHandler.handle(
        interaction,
        guild,
        targetId,
        validation.targetName!
      );

      if (!skipResult.proceed) return;

      await this.startPurge(
        context,
        guild,
        targetId,
        purgeOptions,
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(
        context,
        guild,
        targetId,
        purgeOptions,
        []
      );
    }
  }

  private async handleEveryonePurge(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild!;

    const targetId = interaction.options.getString('target_id', true);
    const days = interaction.options.getInteger('days');
    const skipChannels = interaction.options.getBoolean('skip_channels') || false;
    const includeThreads = interaction.options.getBoolean('include_threads') || false;

    let contentFilter: ContentFilter | undefined;
    try {
      contentFilter = this.createContentFilter(interaction);
    } catch (error: any) {
      await sendError(interaction, error.message);
      return;
    }

    if (targetId === guild.id) {
      await sendError(interaction, 'Server-wide purge of all messages is not allowed for safety. Please select a specific category or channel.');
      return;
    }

    const validation = await this.validationService.validateTarget(guild, targetId);
    if (!validation.isValid) {
      await sendError(interaction, validation.error || 'The specified target is not valid.');
      return;
    }

    if (skipChannels && validation.targetType === 'category') {
      const skipResult = await this.channelSkipHandler.handle(
        interaction,
        guild,
        targetId,
        validation.targetName!
      );

      if (!skipResult.proceed) return;

      await this.startPurge(
        context,
        guild,
        targetId,
        { type: 'everyone', days, contentFilter, includeThreads },
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(context, guild, targetId, { type: 'everyone', days, contentFilter, includeThreads }, []);
    }
  }

  private async handleInactivePurge(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild!;

    const targetId = interaction.options.getString('target_id', true);
    const days = interaction.options.getInteger('days');
    const skipChannels = interaction.options.getBoolean('skip_channels') || false;
    const includeThreads = interaction.options.getBoolean('include_threads') || false;

    let contentFilter: ContentFilter | undefined;
    try {
      contentFilter = this.createContentFilter(interaction);
    } catch (error: any) {
      await sendError(interaction, error.message);
      return;
    }

    const validation = await this.validationService.validateTarget(guild, targetId);
    if (!validation.isValid) {
      await sendError(interaction, validation.error || 'The specified target is not valid.');
      return;
    }

    if (skipChannels && validation.targetType === 'category') {
      const skipResult = await this.channelSkipHandler.handle(
        interaction,
        guild,
        targetId,
        validation.targetName!
      );

      if (!skipResult.proceed) return;

      await this.startPurge(
        context,
        guild,
        targetId,
        { type: 'inactive', days, contentFilter, includeThreads },
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(context, guild, targetId, { type: 'inactive', days, contentFilter, includeThreads }, []);
    }
  }

  private async handleDeletedPurge(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild!;

    const targetId = interaction.options.getString('target_id', true);
    const userId = '456226577798135808';
    const days = interaction.options.getInteger('days');
    const skipChannels = interaction.options.getBoolean('skip_channels') || false;
    const includeThreads = interaction.options.getBoolean('include_threads') || false;

    let contentFilter: ContentFilter | undefined;
    try {
      contentFilter = this.createContentFilter(interaction);
    } catch (error: any) {
      await sendError(interaction, error.message);
      return;
    }

    const validation = await this.validationService.validateTarget(guild, targetId);
    if (!validation.isValid) {
      await sendError(interaction, validation.error || 'The specified target is not valid.');
      return;
    }

    if (skipChannels && validation.targetType === 'category') {
      const skipResult = await this.channelSkipHandler.handle(
        interaction,
        guild,
        targetId,
        validation.targetName!
      );

      if (!skipResult.proceed) return;

      await this.startPurge(
        context,
        guild,
        targetId,
        { type: 'user', userId, days, contentFilter, includeThreads },
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(context, guild, targetId, { type: 'user', userId, days, contentFilter, includeThreads }, []);
    }
  }

  private async startPurge(
    context: CommandContext,
    guild: any,
    targetId: string,
    purgeOptions: any,
    skipChannels: string[]
  ): Promise<void> {
    const { interaction } = context;

    if (targetId !== guild.id) {
      const targetChannel = guild.channels.cache.get(targetId);
      if (targetChannel && targetChannel.permissionsFor) {
        const botMember = guild.members.me;
        if (botMember) {
          const channelPerms = targetChannel.permissionsFor(botMember);
          const missingChannelPerms = [];

          if (!channelPerms?.has(PermissionsBitField.Flags.ViewChannel)) {
            missingChannelPerms.push('View Channel');
          }
          if (!channelPerms?.has(PermissionsBitField.Flags.ReadMessageHistory)) {
            missingChannelPerms.push('Read Message History');
          }
          if (!channelPerms?.has(PermissionsBitField.Flags.ManageMessages)) {
            missingChannelPerms.push('Manage Messages');
          }

          if (missingChannelPerms.length > 0) {
            await sendError(interaction, `I'm missing the following permissions in ${targetChannel.name}: **${missingChannelPerms.join(', ')}**`);
            return;
          }
        }
      }
    }

    const operationId = operationManager.createOperation(interaction, guild.id);

    try {
      let targetDescription = '';

      if (purgeOptions.type === 'user') {
        const user = await context.client.users.fetch(purgeOptions.userId).catch(() => null);
        targetDescription = user?.username || 'Unknown User';
      } else if (purgeOptions.type === 'role') {
        targetDescription = `role @${purgeOptions.roleName}`;
      } else if (purgeOptions.type === 'everyone') {
        targetDescription = 'everyone';
      } else if (purgeOptions.type === 'inactive') {
        targetDescription = 'inactive users';
      }

      const target = targetId === guild.id ? guild : guild.channels.cache.get(targetId);
      const targetName = target?.name || 'Unknown Target';

      const responseMessageId = await this.progressUI.sendInitialProgress(interaction, {
        userName: targetDescription,
        targetName,
        operationId
      });

      const progressHandler = async (update: any) => {
        if (operationManager.isOperationCancelled(operationId)) {
          return;
        }

        await this.progressUI.updateProgress(interaction, {
          userName: targetDescription,
          targetName,
          ...update,
          operationId
        });
      };

      const optionsWithExclude = {
        targetId,
        skipChannels,
        ...purgeOptions,
        excludeMessageId: responseMessageId
      };

      const result = await purgeService.purgeMessages(
        guild,
        optionsWithExclude,
        operationId,
        progressHandler
      );

      const wasCancelled = operationManager.isOperationCancelled(operationId);

      if (result.success) {
        if (!wasCancelled) {
          await this.progressUI.sendCompletion(interaction, {
            userName: targetDescription,
            targetName,
            totalDeleted: result.totalDeleted,
            duration: result.duration,
            channels: result.channels
          });
        }
      } else {
        if (!wasCancelled) {
          await sendError(interaction, result.errors.join(', '));
        }
        logger.error(LogArea.PURGE, `Purge ${wasCancelled ? 'cancelled' : 'failed'}: ${result.errors.join(', ')}`);
      }
    } catch (error: any) {
      await logger.logError(
        LogArea.COMMANDS,
        `Error during purge operation`,
        error,
        {
          guildId: guild.id,
          guildName: guild.name,
          channelId: interaction.channelId,
          userId: interaction.user.id,
          command: `purge ${purgeOptions.type}`,
          metadata: {
            operationId,
            targetId,
            purgeType: purgeOptions.type,
            skipChannelsCount: skipChannels.length
          }
        }
      );
      await sendError(interaction, 'An unexpected error occurred during the purge operation.');
    } finally {
      operationManager.completeOperation(operationId);
    }
  }

  public async handleAutocomplete(context: AutocompleteContext): Promise<void> {
    const { interaction } = context;
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'target_id') {
      const subcommand = interaction.options.getSubcommand();
      const excludeServer = subcommand === 'everyone';
      await this.autocompleteService.handleTargetAutocomplete(interaction, excludeServer);
    }
  }
}