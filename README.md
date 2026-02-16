# 🧹 PurgeBot - The Ultimate Discord Message Management Solution

> **Effortlessly manage your Discord server's message history with the most powerful and reliable purge bot available.**

[![Invite Bot](https://img.shields.io/badge/Invite-PurgeBot-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/oauth2/authorize?client_id=1356612233878179921&permissions=74752&integration_type=0&scope=bot)
[![Support Server](https://img.shields.io/badge/Support-Server-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://biast12.com/botsupport)
[![GitHub](https://img.shields.io/badge/Open_Source-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/biast12/PurgeBot)

## 🚀 Why Choose PurgeBot?

Managing message history in Discord has never been easier. PurgeBot is the **premium solution** trusted by server administrators who demand **performance**, **reliability**, and **precision** in their moderation tools.

### 🎯 Surgical Precision

- Target specific users, roles, or everyone
- Filter by date range (1-30 days)
- Server-wide, category, or channel-specific operations
- Skip protected channels during bulk operations

### 💪 Powerful Features

#### **5 Specialized Purge Commands**

- **`/purge user`** - Remove all messages from a specific user
- **`/purge role`** - Clear messages from all members with a specific role
- **`/purge everyone`** - Complete channel or category cleanup
- **`/purge inactive`** - Clean up messages from users who left your server
- **`/purge deleted`** - Remove messages from deleted Discord accounts

#### **🔍 Advanced Content Filtering**

Filter messages with precision using our intelligent filtering system:

- **Smart Auto-Detection** - Automatically detects regex patterns vs plain text
- **Multiple Filter Modes**:
  - `contains` - Messages containing specific text
  - `regex` - Advanced pattern matching
  - `exact` - Exact message matches
  - `starts_with` - Messages starting with text
  - `ends_with` - Messages ending with text
- **Case Sensitivity Control** - Optional case-sensitive matching

#### **📊 Admin Commands & Error Logging**

For self-hosted instances, PurgeBot includes powerful admin tools:

- **MongoDB Error Logging** - Persistent error tracking with full context (guild, channel, user, stack traces)
- **Remote Error Management** - View and manage errors directly from Discord:
  - `/admin error list` - View recent errors
  - `/admin error check <error_id>` - Detailed error information
  - `/admin error delete <error_id>` - Remove specific error
  - `/admin error clear [filters]` - Bulk deletion with filters (level, area, date)
- **Guild-Specific Registration** - Admin commands only appear in your designated support server
- **No SSH Required** - Manage and debug your bot entirely from Discord

#### **Real-Time Progress Tracking**

Watch your purge operations in real-time with:

- Message count and channel tracking
- One-click cancellation for any operation

## 🛡️ Security & Permissions

PurgeBot respects Discord's permission system:

### Required Bot Permissions:

- `Send Messages` - Send the progress and completed view
- `View Channel` - Access channel content
- `Read Message History` - Scan existing messages
- `Manage Messages` - Delete targeted messages

### User Requirements:

- Users must have `Manage Messages` permission to execute purge commands
- Server administrators maintain full control over who can use PurgeBot

## 🎮 Perfect For:

- **Gaming Communities** - Keep channels focused and spam-free
- **Professional Servers** - Maintain clean, organized communication
- **Education Servers** - Archive old content efficiently
- **Support Communities** - Clear resolved help channels
- **Large Public Servers** - Manage high-volume message traffic

## 🚦 Getting Started is Easy!

### 1️⃣ Add PurgeBot to Your Server

[![Add to Discord](https://img.shields.io/badge/Add%20to-Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/oauth2/authorize?client_id=1356612233878179921&permissions=76800&integration_type=0&scope=bot)

### 2️⃣ Use `/help` to See All Commands

### 3️⃣ Start Purging with Confidence!

### 📖 Example Commands

**Purge Commands:**

```bash
# Delete spam messages from a specific user
/purge user target_id:channel user:@spammer filter:spam

# Remove all messages with links from a role
/purge role target_id:server role:@members filter:"https://" filter_mode:contains

# Clean up messages matching a regex pattern
/purge everyone target_id:channel filter:"(buy|sell|trade)" filter_mode:regex days:7

# Delete messages starting with specific prefix (case-sensitive)
/purge inactive target_id:category filter:"!" filter_mode:starts_with case_sensitive:true
```

**Admin Commands** (Self-hosted only, requires setup):

```bash
# View recent errors
/admin error list limit:25

# Check specific error details
/admin error check error_id:ABC12345

# Delete specific error
/admin error delete error_id:ABC12345

# Clear errors by level
/admin error clear level:ERROR

# Clear errors older than 30 days
/admin error clear older_than_days:30

# Clear errors by area
/admin error clear area:COMMANDS
```

## 💬 Need Help?

- **[Join Our Support Server](https://biast12.com/botsupport)** - Get instant help from our team
- **[Report Issues](https://github.com/biast12/PurgeBot/issues)** - Help us improve PurgeBot

## 🔧 Self-Hosting (Advanced Users)

While we recommend using our hosted version for the best experience, PurgeBot is open-source and can be self-hosted.

<details>
<summary>View Self-Hosting Instructions</summary>

### Prerequisites

- Node.js 18.0.0 or higher
- Discord Bot Token
- MongoDB Atlas account (optional - for error logging)

### Quick Installation

1. Clone the repository:

```bash
git clone https://github.com/biast12/PurgeBot
cd PurgeBot
```

2. Install dependencies:

```bash
npm install
```

3. Configure your environment (create `.env` file):

```env
# Required
TOKEN=your_bot_token_here

# Optional - Error Logging (requires MongoDB Atlas)
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/PurgeBot

# Optional - Admin Commands
ADMIN_IDS=your_discord_user_id,other_admin_ids
ADMIN_GUILD_ID=your_support_server_id
```

**Environment Variables:**

- `TOKEN` - Your Discord bot token (required)
- `DATABASE_URL` - MongoDB connection string for error logging (optional)
- `ADMIN_IDS` - Comma-separated Discord user IDs authorized for admin commands (optional)
- `ADMIN_GUILD_ID` - Guild ID where admin commands are registered (optional)

4. Register commands:

```bash
npm run build
npm run register  # Register global and admin commands
```

5. Start the bot:

```bash
npm start         # Development (with ts-node)
npm run start:prod  # Production (compiled)
```

### MongoDB Error Logging Setup (Optional)

PurgeBot can persist errors to MongoDB Atlas for remote debugging and analysis:

1. **Create MongoDB Atlas Account** (free tier available)
   - Visit [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free M0 cluster

2. **Configure Database Access**
   - Go to "Database Access" → "Add New Database User"
   - Create user with "Read and write to any database" permission
   - Save the username and password

3. **Get Connection String**
   - Click "Connect" on your cluster → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user's password

4. **Add to `.env`:**

   ```env
   DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/PurgeBot
   ```

**Error Logging Features:**

- Automatic error capture with full context (guild, channel, user, stack traces)
- Indexed for fast queries (by level, area, guild, timestamp)
- Remote access via Discord admin commands (no SSH needed)

### Admin Commands Setup (Optional)

Configure admin commands for remote bot management:

1. **Get Your Discord User ID:**
   - Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
   - Right-click your username → "Copy User ID"

2. **Get Your Admin Guild ID:**
   - Right-click your support server → "Copy Server ID"

3. **Add to `.env`:**

   ```env
   ADMIN_IDS=648679147085889536,1356612233878179921
   ADMIN_GUILD_ID=1412752753348055111
   ```

4. **Register Commands:**

   ```bash
   npm run register
   ```

   Admin commands will only appear in the specified guild.

### Troubleshooting

#### Admin Commands Not Appearing

- Verify `ADMIN_GUILD_ID` is set correctly in `.env`
- Run `npm run register` after changing configuration
- Admin commands only appear in the specified guild, not globally

### Build Scripts

**Windows:**

- `run.bat` - Start the bot
- `run.sh` - Start the bot (Linux/macOS)

</details>

## 🏆 Why We're Different

Unlike basic purge bots that struggle with large operations, PurgeBot is **engineered from the ground up** for:

- **Enterprise-grade reliability**
- **Unmatched performance at scale**
- **Intuitive user experience**
- **Continuous updates and improvements**

## 🎯 Ready to Transform Your Server Management?

Don't let message clutter slow down your community. Join thousands of server owners who trust PurgeBot for their message management needs.

[![Invite PurgeBot Now](https://img.shields.io/badge/🚀_Invite_PurgeBot_Now-7289DA?style=for-the-badge)](https://discord.com/oauth2/authorize?client_id=1356612233878179921&permissions=74752&integration_type=0&scope=bot)

---

<div align="center">

**PurgeBot** - *Professional Message Management for Discord*

[![License](https://img.shields.io/github/license/biast12/PurgeBot?style=flat-square)](LICENSE)
[![Discord](https://img.shields.io/discord/1412752753348055111?style=flat-square&logo=discord&logoColor=white)](https://biast12.com/botsupport)
[![GitHub Stars](https://img.shields.io/github/stars/biast12/PurgeBot?style=flat-square)](https://github.com/biast12/PurgeBot/stargazers)

</div>
