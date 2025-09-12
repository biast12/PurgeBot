import { AutocompleteInteraction, ChannelType } from "discord.js";

export class AutocompleteService {
  async handleTargetAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const guild = interaction.guild;
    
    if (!guild) {
      await interaction.respond([]);
      return;
    }

    const choices = [];
    
    // Add server option
    if (guild.name.toLowerCase().includes(focusedValue) || focusedValue === '') {
      choices.push({
        name: `📍 Server: ${guild.name}`,
        value: guild.id
      });
    }

    // Add categories
    const categories = guild.channels.cache
      .filter(ch => ch.type === ChannelType.GuildCategory)
      .filter(ch => ch.name.toLowerCase().includes(focusedValue));
    
    categories.forEach(category => {
      // Check if category has text channels
      const hasTextChannels = guild.channels.cache.some(
        ch => ch.parentId === category.id && this.isTextChannel(ch.type)
      );
      
      if (hasTextChannels) {
        choices.push({
          name: `📁 Category: ${category.name}`,
          value: category.id
        });
      }
    });

    // Add text channels
    const channels = guild.channels.cache
      .filter(ch => this.isTextChannel(ch.type))
      .filter(ch => ch.name.toLowerCase().includes(focusedValue));
    
    channels.forEach(channel => {
      const prefix = this.getChannelPrefix(channel.type);
      choices.push({
        name: `${prefix} ${channel.name}`,
        value: channel.id
      });
    });

    // Limit to 25 choices (Discord's limit)
    await interaction.respond(choices.slice(0, 25));
  }

  async handleUserAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused();
    const guild = interaction.guild;
    
    if (!guild) {
      await interaction.respond([]);
      return;
    }

    const choices = [];
    
    // If input looks like a user ID, suggest it
    if (/^\d{17,19}$/.test(focusedValue)) {
      choices.push({
        name: `User ID: ${focusedValue}`,
        value: focusedValue
      });
    }

    // Search members if input is not purely numeric
    if (focusedValue.length >= 2 && !/^\d+$/.test(focusedValue)) {
      try {
        const members = await guild.members.fetch({ query: focusedValue, limit: 10 });
        
        members.forEach(member => {
          choices.push({
            name: `${member.user.username} (${member.user.id})`,
            value: member.user.id
          });
        });
      } catch (error) {
        console.error("Error fetching members for autocomplete:", error);
      }
    }

    // Add hint for deleted users
    if (choices.length === 0 && focusedValue.length > 0) {
      choices.push({
        name: "💡 Enter a valid user ID (17-19 digits)",
        value: focusedValue || "000000000000000000"
      });
    }

    await interaction.respond(choices.slice(0, 25));
  }

  private isTextChannel(type: ChannelType): boolean {
    return [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildVoice,
      ChannelType.GuildForum
    ].includes(type);
  }

  private getChannelPrefix(type: ChannelType): string {
    switch (type) {
      case ChannelType.GuildText:
        return "💬";
      case ChannelType.GuildAnnouncement:
        return "📢";
      case ChannelType.GuildVoice:
        return "🔊";
      case ChannelType.GuildForum:
        return "💭";
      default:
        return "📝";
    }
  }
}