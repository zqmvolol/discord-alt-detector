# Discord Alt Account Detector Bot

A powerful Discord bot designed to detect and prevent alt accounts from joining your server. Features automatic detection, logging, and customizable alert embeds.

## 🚀 Features

- **Built-in Advanced Alt Detection**:
  - **Trust Level System**: 7 categories from "highly-trusted" to "mega-suspicious"
  - **Multi-factor Analysis**: Account age, status, activity, username patterns, display name, profile badges, boosters, avatars, banners
  - **Weighted Scoring**: Fully configurable weights for each detection factor
  - **Custom Functions**: Adds additional detection logic (mutual servers, previous bans)
  - **No External Dependencies**: All detection logic built-in
  
- **Automatic Actions Based on Trust Level**:
  - mega-suspicious → Auto-ban
  - highly-suspicious → Auto-ban
  - suspicious → Auto-kick
  - newbie → Log only
  - normal/trusted → No action
  
- **Smart Features**:
  - Automatically ban or kick detected alts
  - Store banned alts to prevent rejoining
  - Detailed score breakdowns in embeds
  - Color-coded alerts by trust level
  
- **Rich Logging**:
  - Beautiful embed notifications in Discord
  - File-based logging system
  - Daily log rotation
  - Detailed detection reasons with score breakdown
  
- **Customizable**:
  - Configurable account age requirements
  - Custom suspicious patterns
  - Choose between ban or kick
  - User whitelist support

## 📋 Prerequisites

- Node.js 16.9.0 or higher
- A Discord Bot Token
- Administrator permissions on your Discord server

## 🔧 Installation

1. **Clone or download this bot**

2. **Install dependencies**:
```bash
npm install
```

This will install:
- `discord.js` - Discord API wrapper

**That's it!** All advanced detection is built-in, no external packages required!

3. **Configure the bot**:
   - Edit the config object in `index.js` directly

4. **Set up your bot token and settings**:
```javascript
const config = {
    token: 'YOUR_BOT_TOKEN_HERE',
    logChannelId: 'YOUR_LOG_CHANNEL_ID',
    
    // Configure trust level actions
    trustLevelActions: {
        'mega-suspicious': 'ban',
        'highly-suspicious': 'ban',
        'suspicious': 'kick',
        'newbie': 'log'
    }
};
```

## 🤖 Creating Your Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Add Bot"
5. Under "Privileged Gateway Intents", enable:
   - ✅ **Server Members Intent** ← **CRITICAL!**
   - ✅ **Presence Intent** ← **REQUIRED for advanced detection!**
   - ✅ **Message Content Intent**

**⚠️ IMPORTANT**: The **Presence Intent** is REQUIRED for advanced detection to work! Without it, the bot will fall back to basic detection only.
6. Copy your bot token
7. Go to "OAuth2" > "URL Generator"
8. Select scopes:
   - ✅ `bot`
9. Select permissions:
   - ✅ Ban Members
   - ✅ Kick Members
   - ✅ View Channels
   - ✅ Send Messages
   - ✅ Embed Links
10. Copy the generated URL and invite the bot to your server

## 📝 Configuration Options

```javascript
{
    token: 'YOUR_BOT_TOKEN',              // Your bot token
    logChannelId: 'CHANNEL_ID',           // Where to send alerts
    minAccountAge: 7,                     // Minimum account age (days)
    checkAccountAge: true,                // Enable age checking
    checkNewMembers: true,                // Check new members
    banOnDetection: true,                 // Ban instead of kick
    notifyOnKick: true,                   // Send notification embeds
    whitelistedUsers: [],                 // User IDs to skip checking
    customSuspiciousPatterns: []          // Custom regex patterns
}
```

## 🎯 How It Works

### Trust Level System (Advanced Detection)

When using advanced detection, each member is assigned a trust level:

| Trust Level | Emoji | Description | Default Action |
|------------|-------|-------------|----------------|
| ✅ **highly-trusted** | ✅ | Could apply for staff positions | None |
| ✅ **trusted** | ✅ | Very reliable member | None |
| 🔵 **normal** | 🔵 | Average Discord user | None |
| 🟠 **newbie** | 🟠 | New to Discord, monitor | Log only |
| ⚠️ **suspicious** | ⚠️ | Possible alt account | Kick |
| 🔴 **highly-suspicious** | 🔴 | Almost certainly an alt | Ban |
| 🚫 **mega-suspicious** | 🚫 | Meets all alt criteria | Ban |

### Detection Process

1. **Member Joins Server**
   - Bot receives join event

2. **Check Database**
   - Look for previous detections

3. **Run Detection**
   - **Advanced Mode**: Analyzes 12+ factors with weighted scoring
     - Account age
     - User status (online/idle/dnd/invisible)
     - User activity (playing games, listening to music)
     - Username patterns
     - Display name patterns
     - Profile badges (Hypesquad, Active Developer, Early Supporter, etc.)
     - Server Booster status
     - Custom avatar
     - Nitro banner
     - Custom function score
   - **Basic Mode**: Simple age and pattern checks

4. **Calculate Trust Score**
   - Each factor contributes to overall score
   - Weights can be configured per-factor
   - Custom function adds additional points

5. **Assign Trust Level**
   - Score determines category (mega-suspicious → highly-trusted)

6. **Take Action**
   - Ban, kick, or log based on trust level
   - Send detailed embed to log channel
   - Store in database (prevents rejoining)

### Example Advanced Detection:

```
User joins: "test1234#5678" (2 days old, default avatar)

Scoring:
├─ Age:         +8.0 (2 days old, weight: 2)
├─ Status:      +2.0 (invisible, weight: 1)
├─ Username:    +6.0 (test + numbers, weight: 2)
├─ Avatar:      +3.0 (default, weight: 1.5)
├─ Badges:      +4.0 (no badges, weight: 2)
├─ Custom:      +2.0 (only in 1 server)
└─ TOTAL:       25.0

Trust Level: HIGHLY-SUSPICIOUS
Action: BANNED → Embed sent to log channel
```

## 📊 Log Channel Embed

When an alt is detected, this embed is sent (with trust level):

```
🔴 Alt Account Detection: HIGHLY-SUSPICIOUS

User123#4567 - Almost certainly an alt account

👤 User: User123#4567 (123456789012345678)
📅 Account Created: 2 days ago
⏰ Account Age: 2.0 days

📊 Trust Score Breakdown:
```
Age:         8.0
Status:      2.0
Username:    6.0
Displayname: 3.0
Badges:      4.0
Avatar:      3.0
Banner:      0.0
Booster:     0.0
───────────────────
TOTAL:       26.0
```

⚠️ Detection Reasons:
- Suspicious account age
- Suspicious username pattern
- Default avatar
- No profile badges

🔨 Action Taken: 🔨 Banned

🖼️ Avatar: ❌ Default
🌐 Mutual Servers: 1
🎯 Trust Level: `highly-suspicious`
```

## 📂 File Logging

Logs are stored in the `logs/` directory:
- Filename format: `alt-detections-YYYY-MM-DD.log`
- Contains timestamps, user info, and actions taken
- New file created daily

Example log entry:
```
[2024-01-15T10:30:45.123Z] New member joined: SuspiciousUser#1234 (123456789012345678)
[2024-01-15T10:30:45.456Z] Suspicious account detected: SuspiciousUser#1234 - Reasons: Account age: 1.2 days (minimum: 7 days)
[2024-01-15T10:30:45.789Z] Banned alt account: SuspiciousUser#1234
```

## 🚀 Running the Bot

**Start the bot**:
```bash
npm start
```

**Development mode** (auto-restart on changes):
```bash
npm run dev
```

## ⚙️ Advanced Configuration

### Whitelist Trusted Users

```javascript
whitelistedUsers: [
    '123456789012345678',  // Trusted user 1
    '987654321098765432'   // Trusted user 2
]
```

### Custom Suspicious Patterns

```javascript
customSuspiciousPatterns: [
    /test\d+/i,           // Matches "test123", "test456"
    /throwaway/i,         // Matches "throwaway"
    /^temp/i              // Matches usernames starting with "temp"
]
```

### Ban vs Kick

```javascript
banOnDetection: true,  // Ban detected alts (recommended)
banOnDetection: false  // Kick detected alts (they can rejoin)
```

## 🔒 Security Features

- **Persistent Storage**: Banned alts are stored in memory
- **Rejoin Prevention**: Previously detected alts are auto-banned
- **Detailed Logging**: Full audit trail of all actions
- **Customizable Sensitivity**: Adjust detection thresholds

## ⚙️ Advanced Configuration

### Detection Weights

Fine-tune detection sensitivity by adjusting weights (higher = more important):

```javascript
detectorWeights: {
    ageWeight: 2,                    // Account age (CRITICAL)
    statusWeight: 1,                 // User status
    activityWeight: 1,               // User activity
    usernameWordsWeight: 2,          // Suspicious words (IMPORTANT)
    usernameSymbolsWeight: 1.5,      // Special characters
    displaynameWordsWeight: 1.5,     // Display name words
    displaynameCapsWeight: 0.5,      // Caps in display name
    displaynameSymbolsWeight: 1,     // Symbols in display name
    flagsWeight: 2,                  // Profile badges (IMPORTANT)
    boosterWeight: 2,                // Server booster (IMPORTANT)
    pfpWeight: 1.5,                  // Has avatar
    bannerWeight: 1,                 // Has banner
    customWeight: 1                  // Custom function
}
```

### Trust Level Actions

Customize what happens at each trust level:

```javascript
trustLevelActions: {
    'mega-suspicious': 'ban',        // Options: ban, kick, log, none
    'highly-suspicious': 'ban',
    'suspicious': 'kick',
    'newbie': 'log',
    'normal': 'none',
    'trusted': 'none',
    'highly-trusted': 'none'
}
```

### Detection Modes

All detection is built-in and always uses the advanced multi-factor analysis system!

## 🛠️ Troubleshooting

### Bot doesn't respond to member joins
- Ensure "Server Members Intent" is enabled
- Check bot has proper permissions
- Verify bot role is above member roles

### Embeds not sending
- Check `logChannelId` is correct
- Ensure bot has "Send Messages" and "Embed Links" permissions
- Verify channel exists and bot can see it

### False positives
- Increase `minAccountAge` value
- Add legitimate users to `whitelistedUsers`
- Adjust suspicious patterns

## 📊 Statistics

The bot logs the following metrics:
- Total members checked
- Alts detected and banned/kicked
- Failed join attempts (returning alts)
- Daily activity in log files

## 🤝 Support

For Chicago Loop Roleplay server integration or custom modifications, contact Lopez.

## 📄 License

MIT License - Free to use and modify

## ⚡ Quick Start Checklist

- [ ] Install Node.js 16.9.0+
- [ ] Run `npm install`
- [ ] Create bot on Discord Developer Portal
- [ ] Enable Server Members Intent
- [ ] Copy bot token to config
- [ ] Create log channel and copy ID
- [ ] Invite bot with Ban/Kick permissions
- [ ] Run `npm start`
- [ ] Test by having a new account join

---

**Created for preventing alt accounts on Discord servers**
