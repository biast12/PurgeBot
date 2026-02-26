import {
  ChatInputCommandInteraction,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ContainerBuilder
} from "discord.js";
import { CONSTANTS } from "../config/constants";
import { operationManager } from "./OperationManager";
import { customizationService } from "./CustomizationService";

export class PurgeProgressUI {
  async sendInitialProgress(
    interaction: ChatInputCommandInteraction,
    data: {
      userName: string;
      targetName: string;
      operationId?: string;
    }
  ): Promise<string | undefined> {
    const mainContainer = new ContainerBuilder();

    mainContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# 🔄 Purge in Progress\n\nPurging messages from **${data.userName}** in **${data.targetName}**`),
      new TextDisplayBuilder()
        .setContent("**Status**\nStarting purge operation...")
    );

    const components: any[] = [mainContainer];

    if (data.operationId) {
      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_${data.operationId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🛑");

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(cancelButton);

      components.push(row);
      this.setupCancelCollector(interaction, data.operationId);
    }

    const payload: any = {
      components: components,
      flags: MessageFlags.IsComponentsV2
    };

    let messageId: string | undefined;
    try {
      if (interaction.replied) {
        await interaction.editReply(payload);
        const reply = await interaction.fetchReply();
        messageId = reply.id;
      } else if (interaction.deferred) {
        await interaction.editReply(payload);
        const reply = await interaction.fetchReply();
        messageId = reply.id;
      } else {
        await interaction.reply(payload);
        const reply = await interaction.fetchReply();
        messageId = reply.id;
      }
    } catch (error) {
      console.error('Error sending initial progress:', error);
      messageId = undefined;
    }

    return messageId;
  }

  async updateProgress(
    interaction: ChatInputCommandInteraction,
    data: any
  ): Promise<void> {
    if (!interaction.replied && !interaction.deferred) return;

    if (data.operationId && operationManager.isOperationCancelled(data.operationId)) {
      return;
    }

    const mainContainer = new ContainerBuilder();

    mainContainer.addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# 🔄 Purge in Progress\n\nPurging messages from **${data.userName}** in **${data.targetName}**`)
    );

    if (data.type === 'channel_start') {
      mainContainer.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`**📁 Processing: ${data.channelName}**\nFetching messages...`)
      );
    } else if (data.type === 'channel_progress') {
      const percentage = Math.round((data.current / data.total) * 100);
      const progressBar = this.createProgressBar(percentage);

      mainContainer.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`**📁 Processing: ${data.channelName}**\n${progressBar} ${percentage}% (${data.current}/${data.total})`)
      );
    } else if (data.type === 'channel_complete') {
      mainContainer.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`**✅ Completed: ${data.channelName}**\nDeleted ${data.deleted} messages`)
      );
    }

    const components: any[] = [mainContainer];

    if (data.operationId) {
      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_${data.operationId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🛑");

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(cancelButton);

      components.push(row);
    }

    await interaction.editReply({
      components: components,
      flags: MessageFlags.IsComponentsV2
    } as any).catch(() => { });
  }

  async sendCompletion(
    interaction: ChatInputCommandInteraction,
    data: {
      userName: string;
      targetName: string;
      totalDeleted: number;
      duration: number;
      channels: any[];
    }
  ): Promise<void> {
    const mainContainer = new ContainerBuilder();

    const textComponents = [
      new TextDisplayBuilder()
        .setContent(`# ✅ Purge Complete\n\nSuccessfully purged messages from **${data.userName}** in **${data.targetName}**`),
      new TextDisplayBuilder()
        .setContent(`**Total Messages Deleted:** ${data.totalDeleted}`),
      new TextDisplayBuilder()
        .setContent(`**Duration:** ${data.duration.toFixed(2)} seconds`),
      new TextDisplayBuilder()
        .setContent(`**Channels Processed:** ${data.channels.length}`)
    ];

    if (data.channels.length <= 10 && data.channels.some(ch => ch.deleted > 0)) {
      const channelList = data.channels
        .filter(ch => ch.deleted > 0)
        .map(ch => `• ${ch.channelName}: ${ch.deleted} messages`)
        .join("\n");

      textComponents.push(
        new TextDisplayBuilder()
          .setContent(`\n**Channel Breakdown**\n${channelList}`)
      );
    }

    mainContainer.addTextDisplayComponents(...textComponents);

    const components: any[] = [mainContainer];

    // Append branding footer unless removed for this guild
    const footer = await customizationService.getBrandingFooter(interaction.guildId);
    if (footer) components.push(...footer);

    await interaction.editReply({
      components: components,
      flags: MessageFlags.IsComponentsV2
    } as any).catch(() => { });

    await interaction.followUp({
      content: `<@${interaction.user.id}> The purge operation has been completed successfully!`,
      flags: MessageFlags.Ephemeral
    }).catch(() => { });
  }

  private createProgressBar(percentage: number): string {
    const filled = Math.floor((percentage / 100) * CONSTANTS.PROGRESS_BAR_LENGTH);
    const empty = CONSTANTS.PROGRESS_BAR_LENGTH - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
  }

  private setupCancelCollector(interaction: ChatInputCommandInteraction, operationId: string): void {
    const collector = interaction.channel?.createMessageComponentCollector({
      filter: (i) => i.customId === `cancel_${operationId}`,
      time: CONSTANTS.INTERACTION_TIMEOUT
    });

    collector?.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: "You cannot cancel this operation.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      operationManager.cancelOperation(operationId);

      const deletedCount = operationManager.getDeletedCount(operationId);

      const cancelContainer = new ContainerBuilder();
      const cancelMessage = deletedCount > 0
        ? `# ⚠️ Operation Cancelled\n\nThe purge operation has been cancelled by the user.\n\n**Messages deleted before cancellation:** ${deletedCount}`
        : "# ⚠️ Operation Cancelled\n\nThe purge operation has been cancelled by the user.";

      cancelContainer.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(cancelMessage)
      );

      await i.update({
        components: [cancelContainer],
        flags: MessageFlags.IsComponentsV2
      } as any);

      collector.stop();
    });
  }
}