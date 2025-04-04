import { AutocompleteInteraction } from "discord.js";

export default async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedValue = interaction.options.getFocused();
  const guild = interaction.guild;

  if (!guild) {
    await interaction.respond([]);
    return;
  }

  const options: { name: string; value: string }[] = [];

  // Add all members of the server
  const members = await guild.members.fetch();
  members.forEach((member) => {
    options.push({
      name: `${member.user.tag}`,
      value: member.user.id,
    });
  });

  // Add a "Deleted User" option
  options.push({
    name: "Deleted User",
    value: "456226577798135808",
  });

  // Filter options based on the user's input
  const filtered = options.filter((option) =>
    option.name.toLowerCase().includes(focusedValue.toLowerCase())
  );

  await interaction.respond(filtered.slice(0, 25)); // Discord allows a maximum of 25 options
}