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

export class PurgeUserCommand extends BaseCommand {
  public readonly name = 'purgeuser';
  public readonly description = 'Delete all messages of a user in a server, category, or channel';
  
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
      .addStringOption(option =>
        option
          .setName('target_id')
          .setDescription('The server, category, or channel to purge messages from')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('user_id')
          .setDescription('The ID of the user whose messages will be deleted')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addBooleanOption(option =>
        option
          .setName('skip_channels')
          .setDescription('Skip specific channels when purging (category mode only)')
          .setRequired(false)
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

    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      await sendError(interaction, 'You need Administrator permissions to use this command.');
      return;
    }

    const targetId = interaction.options.getString('target_id', true);
    const userId = interaction.options.getString('user_id', true);
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
        userId,
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(context, guild, targetId, userId, []);
    }
  }

  private async startPurge(
    context: CommandContext,
    guild: any,
    targetId: string,
    userId: string,
    skipChannels: string[]
  ): Promise<void> {
    const { interaction } = context;
    const operationId = operationManager.createOperation(interaction, guild.id);
    
    try {
      const user = await context.client.users.fetch(userId).catch(() => null);
      const userName = user?.username || 'Unknown User';
      
      const target = targetId === guild.id ? guild : guild.channels.cache.get(targetId);
      const targetName = target?.name || 'Unknown Target';
      
      logger.info(LogArea.PURGE, `Starting purge for user ${userName} in ${targetName}`);
      
      await this.progressUI.sendInitialProgress(interaction, {
        userName,
        targetName,
        operationId
      });

      const progressHandler = async (update: any) => {
        await this.progressUI.updateProgress(interaction, {
          userName,
          targetName,
          ...update,
          operationId
        });
      };

      const result = await purgeService.purgeUserMessages(
        guild,
        { targetId, userId, skipChannels },
        operationId,
        progressHandler
      );

      if (result.success) {
        await this.progressUI.sendCompletion(interaction, {
          userName,
          targetName,
          totalDeleted: result.totalDeleted,
          duration: result.duration,
          channels: result.channels
        });
        logger.info(LogArea.PURGE, `Purge completed: ${result.totalDeleted} messages deleted in ${result.duration}s`);
      } else {
        await sendError(interaction, result.errors.join(', '));
        logger.error(LogArea.PURGE, `Purge failed: ${result.errors.join(', ')}`);
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
      await this.autocompleteService.handleTargetAutocomplete(interaction);
    } else if (focusedOption.name === 'user_id') {
      await this.autocompleteService.handleUserAutocomplete(interaction);
    }
  }
}