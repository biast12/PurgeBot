import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";

export default function cancelButton(interactionId: string) {
    const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel-${interactionId}`)
        .setLabel("🗙 Cancel")
        .setStyle(ButtonStyle.Danger);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton);
}
