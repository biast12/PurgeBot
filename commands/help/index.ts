import { CommandInteraction, ApplicationCommandData, MessageFlags } from "discord.js";
import applicationCommandData from "./applicationCommandData.json";
import helpEmbed from "./embeds/helpEmbed";

export default {
    data: applicationCommandData as ApplicationCommandData,

    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.reply({ embeds: [helpEmbed()], flags: MessageFlags.Ephemeral });
    },
};
