import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
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
          .addBooleanOption(option =>
            option
              .setName('skip_channels')
              .setDescription('Skip specific channels when purging (category mode only)')
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
          .addBooleanOption(option =>
            option
              .setName('skip_channels')
              .setDescription('Skip specific channels when purging (category mode only)')
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
          .addBooleanOption(option =>
            option
              .setName('skip_channels')
              .setDescription('Skip specific channels when purging (category mode only)')
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
          .addBooleanOption(option =>
            option
              .setName('skip_channels')
              .setDescription('Skip specific channels when purging (category mode only)')
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
          .addBooleanOption(option =>
            option
              .setName('skip_channels')
              .setDescription('Skip specific channels when purging (category mode only)')
              .setRequired(false)
          )
      ) as SlashCommandBuilder;
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

    // Check bot permissions
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
        switch(perm) {
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

  private async handleUserPurge(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild!;
    
    const targetId = interaction.options.getString('target_id', true);
    const user = interaction.options.getUser('user', true);
    const userId = user.id;
    const days = interaction.options.getInteger('days');
    const skipChannels = interaction.options.getBoolean('skip_channels') || false;

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
        { type: 'user', userId, days },
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(context, guild, targetId, { type: 'user', userId, days }, []);
    }
  }

  private async handleRolePurge(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild!;
    
    const targetId = interaction.options.getString('target_id', true);
    const role = interaction.options.getRole('role', true);
    const days = interaction.options.getInteger('days');
    const skipChannels = interaction.options.getBoolean('skip_channels') || false;

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
        { type: 'role', roleId: role.id, roleName: role.name, days },
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(
        context, 
        guild, 
        targetId, 
        { type: 'role', roleId: role.id, roleName: role.name, days }, 
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
        { type: 'everyone', days },
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(context, guild, targetId, { type: 'everyone', days }, []);
    }
  }

  private async handleInactivePurge(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild!;
    
    const targetId = interaction.options.getString('target_id', true);
    const days = interaction.options.getInteger('days');
    const skipChannels = interaction.options.getBoolean('skip_channels') || false;

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
        { type: 'inactive', days },
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(context, guild, targetId, { type: 'inactive', days }, []);
    }
  }

  private async handleDeletedPurge(context: CommandContext): Promise<void> {
    const { interaction } = context;
    const guild = interaction.guild!;
    
    const targetId = interaction.options.getString('target_id', true);
    const userId = '456226577798135808';
    const days = interaction.options.getInteger('days');
    const skipChannels = interaction.options.getBoolean('skip_channels') || false;

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
        { type: 'user', userId, days },
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(context, guild, targetId, { type: 'user', userId, days }, []);
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
      logger.error(LogArea.PURGE, `Error in purge operation ${operationId}: ${error.message}`);
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