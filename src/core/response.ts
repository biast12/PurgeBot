import { 
  ChatInputCommandInteraction,
  ActionRowBuilder,
  InteractionReplyOptions,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  MessageFlags
} from 'discord.js';

export class ResponseBuilder {
  private components: any[] = [];
  private content?: string;

  public setContent(content: string): ResponseBuilder {
    this.content = content;
    return this;
  }

  public addComponent(component: TextDisplayBuilder | ContainerBuilder | SeparatorBuilder | ActionRowBuilder<any>): ResponseBuilder {
    this.components.push(component);
    return this;
  }

  public build(): InteractionReplyOptions {
    const reply: InteractionReplyOptions = {};
    
    if (this.content) reply.content = this.content;
    
    if (this.components.length > 0) {
      reply.components = this.components;
      reply.flags = MessageFlags.IsComponentsV2;
    }
    
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

  // Add ephemeral flag if needed
  if (ephemeral) {
    const currentFlags = (replyOptions.flags as number) || 0;
    replyOptions.flags = currentFlags | MessageFlags.Ephemeral;
  }

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply(replyOptions as any).catch(() => {});
  } else {
    await interaction.reply(replyOptions).catch(() => {});
  }
}

export async function sendError(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  const textDisplay = new TextDisplayBuilder()
    .setContent(`# ❌ Error\n\n${message}`);

  const response = new ResponseBuilder()
    .addComponent(textDisplay);
    
  await sendResponse(interaction, response, true);
}

export async function sendSuccess(
  interaction: ChatInputCommandInteraction,
  message: string,
  ephemeral: boolean = false
): Promise<void> {
  const textDisplay = new TextDisplayBuilder()
    .setContent(`# ✅ Success\n\n${message}`);

  const response = new ResponseBuilder()
    .addComponent(textDisplay);
    
  await sendResponse(interaction, response, ephemeral);
}