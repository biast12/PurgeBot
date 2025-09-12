import { 
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  InteractionReplyOptions
} from 'discord.js';

export class ResponseBuilder {
  private embeds: EmbedBuilder[] = [];
  private components: ActionRowBuilder<any>[] = [];
  private content?: string;

  public setContent(content: string): ResponseBuilder {
    this.content = content;
    return this;
  }

  public addEmbed(embed: EmbedBuilder): ResponseBuilder {
    this.embeds.push(embed);
    return this;
  }

  public addComponent(component: ActionRowBuilder<any>): ResponseBuilder {
    this.components.push(component);
    return this;
  }

  public build(): InteractionReplyOptions {
    const reply: InteractionReplyOptions = {};
    
    if (this.content) reply.content = this.content;
    if (this.embeds.length > 0) reply.embeds = this.embeds;
    if (this.components.length > 0) reply.components = this.components;
    
    return reply;
  }
}

export async function sendResponse(
  interaction: ChatInputCommandInteraction,
  response: ResponseBuilder | string,
  ephemeral: boolean = false
): Promise<void> {
  const replyOptions = 
    typeof response === 'string' 
      ? { content: response }
      : response.build();

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(replyOptions as any).catch(() => {});
  } else {
    await interaction.reply({ ...replyOptions, ephemeral }).catch(() => {});
  }
}

export async function sendError(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('❌ Error')
    .setDescription(message)
    .setTimestamp();

  const response = new ResponseBuilder().addEmbed(embed);
  await sendResponse(interaction, response, true);
}

export async function sendSuccess(
  interaction: ChatInputCommandInteraction,
  message: string,
  ephemeral: boolean = false
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Success')
    .setDescription(message)
    .setTimestamp();

  const response = new ResponseBuilder().addEmbed(embed);
  await sendResponse(interaction, response, ephemeral);
}