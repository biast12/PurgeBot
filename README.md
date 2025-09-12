# PurgeBot

PurgeBot is a high-performance Discord bot designed for efficient message management with a clean, maintainable architecture.

## Features

- **Smart Message Purging** - Delete messages from specific users across servers, categories, or channels
- **Advanced Rate Limiting** - Intelligent queue-based system with exponential backoff
- **Real-time Progress Tracking** - Live updates with progress bars and status information
- **Flexible Targeting** - Support for server-wide, category, or channel-specific operations
- **Channel Skipping** - Optionally skip specific channels when purging categories
- **Deleted User Support** - Purge messages from users who have left the server
- **Cancellable Operations** - Stop purge operations at any time
- **Automatic Error Recovery** - Graceful handling of API limits and errors

## Commands

### `/purgeuser`
Deletes all messages from a specific user in a server, category, or channel.

**Parameters:**
- `target_id` (required) - The server, category, or channel to purge messages from
- `user_id` (required) - The ID of the user whose messages will be deleted
- `skip_channels` (optional) - Skip specific channels when purging a category

### `/help`
Provides comprehensive information about the bot's commands and features.

## Invite the Bot

You can invite this version of the bot to your server using the following link:

[Invite PurgeBot](https://discord.com/oauth2/authorize?client_id=1356612233878179921&permissions=294205352960&integration_type=0&scope=bot)

## Installation

### Quick Setup (Recommended)

#### Windows:
```batch
# 1. Build the project
build.bat

# 2. Register slash commands with Discord (only needed once or when commands change)
register_commands.bat

# 3. Start the bot
run_prod.bat
```

#### Linux/macOS:
```bash
# 1. Build the project
./build.sh

# 2. Register slash commands with Discord (only needed once or when commands change)
./register_commands.sh

# 3. Start the bot
./run_prod.sh
```

**Note:** Command registration is separate from running the bot. You only need to register commands once initially, or when you modify command definitions.

### Manual Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/biast12/PurgeBot
   cd PurgeBot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Create a `.env` file in the root directory:
   ```env
   TOKEN=your_bot_token_here
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Start the bot:**
   ```bash
   npm start
   ```

## Development

### Development Mode

#### Windows:
```batch
run_dev.bat
```

#### Linux/macOS:
```bash
./run_dev.sh
```

### NPM Scripts

```bash
# Build the project
npm run build

# Start in production
npm start

# Development mode with watch
npm run dev

# Register slash commands with Discord
npm run register

# Clean and rebuild
npm run rebuild
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
