import { AutocompleteInteraction, ChannelType } from "discord.js";

export default async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedValue = interaction.options.getFocused();
  const guild = interaction.guild;

  if (!guild) {
    await interaction.respond([]);
    return;
  }

  const options: { name: string; value: string }[] = [];

  // Add the server itself as the first option
  options.push({
    name: `${guild.name}`,
    value: guild.id,
  });

  // Add categories and their channels
  guild.channels.cache
    .filter((ch) => ch.type === ChannelType.GuildCategory)
    .forEach((category) => {
      options.push({
        name: `${category.name}`,
        value: category.id,
      });

      // Add channels under the category
      guild.channels.cache
        .filter((ch) => ch.parentId === category.id)
        .forEach((channel) => {
          options.push({
            name: `${channel.name}`,
            value: channel.id,
          });
        });
    });

  // Add uncategorized channels
  guild.channels.cache
    .filter((ch) => !ch.parentId && ch.type !== ChannelType.GuildCategory)
    .forEach((channel) => {
      options.push({
        name: `Channel: ${channel.name}`,
        value: channel.id,
      });
    });

  // Filter options based on the user's input
  const filtered = options.filter((option) =>
    option.name.toLowerCase().includes(focusedValue.toLowerCase())
  );

  await interaction.respond(filtered.slice(0, 25)); // Discord allows a maximum of 25 options
}
