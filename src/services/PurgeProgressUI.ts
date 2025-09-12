import { 
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { CONSTANTS } from "../config/constants";
import { operationManager } from "./OperationManager";
import { ResponseBuilder, sendResponse } from "../core/response";

export class PurgeProgressUI {
  async sendInitialProgress(
    interaction: ChatInputCommandInteraction,
    data: {
      userName: string;
      targetName: string;
      operationId?: string;
    }
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle("🔄 Purge in Progress")
      .setDescription(`Purging messages from **${data.userName}** in **${data.targetName}**`)
      .addFields(
        { name: "Status", value: "Starting purge operation...", inline: false }
      )
      .setTimestamp();

    const response = new ResponseBuilder().addEmbed(embed);
    
    if (data.operationId) {
      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_${data.operationId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🛑");
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(cancelButton);
      
      response.addComponent(row);
      this.setupCancelCollector(interaction, data.operationId);
    }

    await sendResponse(interaction, response);
  }

  async updateProgress(
    interaction: ChatInputCommandInteraction,
    data: any
  ): Promise<void> {
    if (!interaction.replied && !interaction.deferred) return;

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle("🔄 Purge in Progress")
      .setDescription(`Purging messages from **${data.userName}** in **${data.targetName}**`)
      .setTimestamp();

    const fields = [];
    
    if (data.type === 'channel_start') {
      fields.push({
        name: `📁 Processing: ${data.channelName}`,
        value: "Fetching messages...",
        inline: false
      });
    } else if (data.type === 'channel_progress') {
      const percentage = Math.round((data.current / data.total) * 100);
      const progressBar = this.createProgressBar(percentage);
      
      fields.push({
        name: `📁 Processing: ${data.channelName}`,
        value: `${progressBar} ${percentage}% (${data.current}/${data.total})`,
        inline: false
      });
    } else if (data.type === 'channel_complete') {
      fields.push({
        name: `✅ Completed: ${data.channelName}`,
        value: `Deleted ${data.deleted} messages`,
        inline: false
      });
    }

    embed.addFields(fields);

    const response = new ResponseBuilder().addEmbed(embed);
    
    if (data.operationId) {
      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_${data.operationId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🛑");
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(cancelButton);
      
      response.addComponent(row);
    }

    await interaction.editReply(response.build() as any).catch(() => {});
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
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle("✅ Purge Complete")
      .setDescription(`Successfully purged messages from **${data.userName}** in **${data.targetName}**`)
      .addFields(
        { name: "Total Messages Deleted", value: data.totalDeleted.toString(), inline: true },
        { name: "Duration", value: `${data.duration.toFixed(2)} seconds`, inline: true },
        { name: "Channels Processed", value: data.channels.length.toString(), inline: true }
      )
      .setTimestamp();

    if (data.channels.length <= 10) {
      const channelList = data.channels
        .filter(ch => ch.deleted > 0)
        .map(ch => `• ${ch.channelName}: ${ch.deleted} messages`)
        .join("\n");
      
      if (channelList) {
        embed.addFields({
          name: "Channel Breakdown",
          value: channelList,
          inline: false
        });
      }
    }

    const response = new ResponseBuilder().addEmbed(embed);
    await interaction.editReply(response.build() as any).catch(() => {});

    await interaction.followUp({
      content: `<@${interaction.user.id}> The purge operation has been completed successfully!`,
      ephemeral: true
    }).catch(() => {});
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
          ephemeral: true
        });
        return;
      }

      operationManager.cancelOperation(operationId);
      
      await i.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle("⚠️ Operation Cancelled")
            .setDescription("The purge operation has been cancelled by the user.")
            .setTimestamp()
        ],
        components: []
      });
      
      collector.stop();
    });
  }
}