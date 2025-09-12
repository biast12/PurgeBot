import { 
  PermissionsBitField,
  ApplicationCommandOptionType,
  AutocompleteInteraction
} from "discord.js";
import { CommandHandler } from "../../types";
import { operationManager } from "../../services/OperationManager";
import { purgeService } from "../../services/PurgeService";
import { ValidationService } from "../../services/ValidationService";
import { UIService } from "../../services/UIService";
import { ChannelSkipHandler } from "./handlers/ChannelSkipHandler";
import { AutocompleteService } from "./services/AutocompleteService";

class PurgeUserCommand implements CommandHandler {
  private validationService: ValidationService;
  private uiService: UIService;
  private autocompleteService: AutocompleteService;
  private channelSkipHandler: ChannelSkipHandler;

  constructor() {
    this.validationService = new ValidationService();
    this.uiService = new UIService();
    this.autocompleteService = new AutocompleteService();
    this.channelSkipHandler = new ChannelSkipHandler();
  }

  data = {
    name: "purgeuser",
    description: "Delete all messages of a user in a server, category, or channel",
    options: [
      {
        name: "target_id",
        description: "The server, category, or channel to purge messages from",
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: true
      },
      {
        name: "user_id", 
        description: "The ID of the user whose messages will be deleted",
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: true
      },
      {
        name: "skip_channels",
        description: "Skip specific channels when purging (category mode only)",
        type: ApplicationCommandOptionType.Boolean,
        required: false
      }
    ]
  };

  autocomplete = {
    target_id: async (interaction: AutocompleteInteraction) => {
      await this.autocompleteService.handleTargetAutocomplete(interaction);
    },
    user_id: async (interaction: AutocompleteInteraction) => {
      await this.autocompleteService.handleUserAutocomplete(interaction);
    }
  };

  async execute(interaction: any): Promise<void> {
    const guild = interaction.guild;
    
    // Validate guild context
    if (!guild) {
      await this.uiService.sendError(interaction, 
        "Invalid Context", 
        "This command can only be used within a server."
      );
      return;
    }

    // Check for existing operations
    if (operationManager.isGuildLocked(guild.id)) {
      await this.uiService.sendError(interaction,
        "Operation in Progress",
        "Another purge operation is already running in this server. Please wait for it to complete."
      );
      return;
    }

    // Validate permissions
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      await this.uiService.sendError(interaction,
        "Insufficient Permissions",
        "You need Administrator permissions to use this command."
      );
      return;
    }

    // Extract options
    const options = interaction.options;
    const targetId = options.getString("target_id", true);
    const userId = options.getString("user_id", true);
    const skipChannels = options.getBoolean("skip_channels") || false;

    // Validate target
    const validation = await this.validationService.validateTarget(guild, targetId);
    if (!validation.isValid) {
      await this.uiService.sendError(interaction,
        "Invalid Target",
        validation.error || "The specified target is not valid."
      );
      return;
    }

    // Handle channel skipping for categories
    if (skipChannels && validation.targetType === 'category') {
      const skipResult = await this.channelSkipHandler.handle(
        interaction,
        guild,
        targetId,
        validation.targetName!
      );
      
      if (!skipResult.proceed) return;
      
      await this.startPurge(
        interaction,
        guild,
        targetId,
        userId,
        skipResult.skippedChannels || []
      );
    } else {
      await this.startPurge(interaction, guild, targetId, userId, []);
    }
  }

  private async startPurge(
    interaction: any,
    guild: any,
    targetId: string,
    userId: string,
    skipChannels: string[]
  ): Promise<void> {
    // Create operation
    const operationId = operationManager.createOperation(interaction, guild.id);
    
    try {
      // Fetch user info
      const user = await interaction.client.users.fetch(userId).catch(() => null);
      const userName = user?.username || "Unknown User";
      
      // Get target name
      const target = targetId === guild.id ? guild : guild.channels.cache.get(targetId);
      const targetName = target?.name || "Unknown Target";
      
      // Send initial progress message
      await this.uiService.sendProgress(interaction, {
        userName,
        targetName,
        status: "Starting purge operation...",
        operationId
      });

      // Setup progress handler
      const progressHandler = async (update: any) => {
        await this.uiService.updateProgress(interaction, {
          userName,
          targetName,
          ...update,
          operationId
        });
      };

      // Execute purge
      const result = await purgeService.purgeUserMessages(
        guild,
        { targetId, userId, skipChannels },
        operationId,
        progressHandler
      );

      // Send completion message
      if (result.success) {
        await this.uiService.sendCompletion(interaction, {
          userName,
          targetName,
          totalDeleted: result.totalDeleted,
          duration: result.duration,
          channels: result.channels
        });
      } else {
        await this.uiService.sendError(interaction,
          "Purge Failed",
          result.errors.join(", ")
        );
      }
    } catch (error: any) {
      console.error(`Error in purge operation ${operationId}:`, error);
      await this.uiService.sendError(interaction,
        "Operation Failed",
        "An unexpected error occurred during the purge operation."
      );
    } finally {
      operationManager.completeOperation(operationId);
    }
  }
}

export default new PurgeUserCommand();