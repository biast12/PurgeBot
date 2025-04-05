# PurgeBot

PurgeBot is a Discord bot that allows you to delete messages from a specific user in a server, category, or channel.

## Features

- Purge messages from a specific user.
- Target a server, category, or channel for purging.
- Provides progress updates during the purge operation.
- Cancel ongoing purge operations.
- Supports purging messages from deleted users.

## Commands

- `/purgeuser` - Deletes all messages from a specific user in a server, category, or channel.
  - `target_id`: The server, category, or channel to purge messages from.
  - `user_id`: The ID of the user whose messages will be deleted.
- `/help` - Provides information about the bot's commands.

## Invite the Bot

You can invite this version of the bot to your server using the following link:

[Invite PurgeBot](https://discord.com/oauth2/authorize?client_id=1356612233878179921&permissions=294205352960&integration_type=0&scope=bot)

## Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/biast12/PurgeBot
   ```

2. Install the dependencies:

   ```sh
   npm install
   ```

3. Create a `.env` file based on `.env.example` and fill in the required values:

   ```env
   TOKEN=<your_bot_token>
   ```

4. Build the project:

   ```sh
   npm run build
   ```

5. Start the bot:

   ```sh
   npm run start
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
