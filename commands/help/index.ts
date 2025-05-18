import { ApplicationCommandData, CommandInteraction, MessageFlags } from "discord.js";
import applicationCommandData from "./applicationCommandData.json";
import helpComponent from "./components/helpComponent";

export default {
    data: applicationCommandData as ApplicationCommandData,

    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.reply({ components: helpComponent(), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    },
};
