# 🚀 Quick Start Guide

## Step-by-Step Setup (5 minutes)

### 1️⃣ Create Your Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **"New Application"**
3. Name it (e.g., "Alt Detector")
4. Go to **"Bot"** section in left menu
5. Click **"Add Bot"** → Confirm
6. **Copy your token** (you'll need this!)

### 2️⃣ Enable Required Intents

Still in the Bot section:
- Scroll to **"Privileged Gateway Intents"**
- Enable these (ALL REQUIRED):
  - ✅ **Presence Intent** (REQUIRED for advanced detection!)
  - ✅ **Server Members Intent** (REQUIRED!)
  - ✅ **Message Content Intent**

**⚠️ Without Presence Intent, you'll only get basic detection!**

### 3️⃣ Generate Invite Link

1. Go to **"OAuth2"** → **"URL Generator"**
2. Select **Scopes**:
   - ✅ `bot`
3. Select **Bot Permissions**:
   - ✅ Ban Members
   - ✅ Kick Members
   - ✅ View Channels
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Message History
4. **Copy the generated URL** at the bottom
5. **Open URL in browser** → Select your server → Authorize

### 4️⃣ Get Your Log Channel ID

1. Open Discord
2. Enable Developer Mode:
   - Settings → Advanced → Developer Mode → ON
3. Right-click the channel where you want alerts
4. Click **"Copy Channel ID"**

### 5️⃣ Configure the Bot

Open `index.js` and edit these lines:

```javascript
const config = {
    token: 'YOUR_BOT_TOKEN_HERE',        // ← Paste your bot token
    logChannelId: 'YOUR_LOG_CHANNEL_ID', // ← Paste channel ID
    minAccountAge: 7,                    // ← Days (adjust as needed)
    banOnDetection: true,                // ← true = ban, false = kick
    useAdvancedDetection: true,          // ← Use discord-alt-detector (recommended!)
};
```

**What's Advanced Detection?**
- Uses the `discord-alt-detector` NPM package
- Analyzes 12+ factors (age, status, badges, avatar, etc.)
- Assigns trust levels: highly-trusted → mega-suspicious
- 80%+ detection success rate
- Configurable weights for each factor

### 6️⃣ Install and Run

```bash
# Install dependencies
npm install

# Start the bot
npm start
```

## ✅ Verify It's Working

You should see:
```
✅ Bot logged in as: YourBot#1234
📊 Monitoring: 1 server(s)
⚙️ Configuration:
   - Detection Mode: ADVANCED (discord-alt-detector)
   - Minimum Account Age: 7 days
   - Auto Ban: Enabled

📈 Trust Level Actions:
   - mega-suspicious: ban
   - highly-suspicious: ban
   - suspicious: kick
   - newbie: log
```

## 🧪 Test It

1. Create a brand new Discord account (or use a friend's new alt)
2. Try to join your server
3. The bot should detect it and post an embed in your log channel

## 📊 Example Detection Embed

![Alt Detection Embed](https://via.placeholder.com/500x300/FF0000/FFFFFF?text=Alt+Detected)

## ⚙️ Customize Detection Settings

### Make it More Strict
```javascript
minAccountAge: 14,  // Require 2-week old accounts
banOnDetection: true  // Auto-ban
```

### Make it More Lenient
```javascript
minAccountAge: 3,  // Allow 3-day old accounts
banOnDetection: false  // Just kick, don't ban
```

### Whitelist Trusted Users
```javascript
whitelistedUsers: [
    '123456789012345678',  // Your ID
    '987654321098765432'   // Admin's ID
]
```

## 🔥 Use Advanced Version

For more features (severity scoring, database persistence, better detection):

```bash
# Use the advanced version
node index-advanced.js
```

Advanced features:
- Persistent database of banned alts
- Severity scoring (0-100)
- Avatar checking
- Mutual server analysis
- Better logging

## 📂 Files Explained

- `index.js` - Basic version (recommended to start)
- `index-advanced.js` - Enhanced version with more features
- `package.json` - Dependencies list
- `config.example.js` - Configuration template
- `logs/` - All detection logs stored here
- `data/` - Banned alts database (advanced version)

## 🐛 Troubleshooting

### Bot doesn't come online
- ✅ Check your token is correct
- ✅ Verify you enabled the required intents
- ✅ Make sure you have Node.js installed

### Bot doesn't detect alts
- ✅ Check Server Members Intent is enabled
- ✅ Verify bot has permission to see members
- ✅ Test with a genuinely new account (< 7 days old)

### Embeds not sending
- ✅ Verify logChannelId is correct
- ✅ Check bot has "Send Messages" + "Embed Links" permissions
- ✅ Make sure bot can see the channel

### Bot bans legitimate users
- ✅ Increase minAccountAge (try 3 instead of 7)
- ✅ Add their IDs to whitelistedUsers
- ✅ Use kick instead of ban (banOnDetection: false)

## 🆘 Need Help?

1. Check the main README.md for detailed docs
2. Review logs in `logs/` folder
3. Test with console output

## 🎯 Common Configurations

### For Large Servers (Strict)
```javascript
{
    minAccountAge: 30,        // 1 month old
    banOnDetection: true,
    checkAvatarHash: true
}
```

### For Medium Servers (Balanced)
```javascript
{
    minAccountAge: 7,         // 1 week old
    banOnDetection: true,
    checkAvatarHash: true
}
```

### For Small Servers (Lenient)
```javascript
{
    minAccountAge: 3,         // 3 days old
    banOnDetection: false,    // Just kick
    checkAvatarHash: false
}
```

---

**That's it! Your server is now protected against alt accounts. 🛡️**
