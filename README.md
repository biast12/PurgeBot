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

3. Configure your bot token:

```env
TOKEN=your_bot_token_here
```

4. Build and start:

```bash
npm run build
npm run register  # Register commands (once)
npm start
```

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
