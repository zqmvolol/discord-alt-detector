const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    token: 'YOUR_BOT_TOKEN_HERE',
    logChannelId: 'YOUR_LOG_CHANNEL_ID',
    minAccountAge: 7, // Days
    checkAccountAge: true,
    checkNewMembers: true,
    banOnDetection: true,
    notifyOnKick: true,
    whitelistedUsers: [],
    maxWarnings: 2, // Max warnings before action
    checkAvatarHash: true, // Check for default avatars
    checkNitro: false, // Suspicious if new account has Nitro
    saveToDatabase: true // Persist banned alts to file
};

// Create client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildPresences
    ]
});

// Setup directories
const logsDir = path.join(__dirname, 'logs');
const dataDir = path.join(__dirname, 'data');

[logsDir, dataDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

const logFilePath = path.join(logsDir, `alt-detections-${new Date().toISOString().split('T')[0]}.log`);
const bannedAltsFile = path.join(dataDir, 'banned-alts.json');

// Logging function
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFilePath, logMessage);
    console.log(logMessage.trim());
}

// Load/Save banned alts database
function loadBannedAlts() {
    try {
        if (fs.existsSync(bannedAltsFile)) {
            const data = fs.readFileSync(bannedAltsFile, 'utf8');
            return new Map(JSON.parse(data));
        }
    } catch (error) {
        console.error('Error loading banned alts database:', error);
    }
    return new Map();
}

function saveBannedAlts() {
    try {
        const data = JSON.stringify([...bannedAlts.entries()], null, 2);
        fs.writeFileSync(bannedAltsFile, data);
    } catch (error) {
        console.error('Error saving banned alts database:', error);
    }
}

const bannedAlts = loadBannedAlts();
const memberWarnings = new Map(); // Track warnings

// Enhanced account suspicion check
function isAccountSuspicious(member) {
    const accountCreationDate = member.user.createdAt;
    const now = new Date();
    const accountAge = (now - accountCreationDate) / (1000 * 60 * 60 * 24);

    const checks = {
        isSuspicious: false,
        reasons: [],
        severity: 0 // 0-100 score
    };

    // Whitelisted users bypass all checks
    if (config.whitelistedUsers.includes(member.user.id)) {
        return checks;
    }

    // Check 1: Account Age (HIGH PRIORITY)
    if (config.checkAccountAge && accountAge < config.minAccountAge) {
        checks.isSuspicious = true;
        checks.reasons.push(`Account age: ${accountAge.toFixed(1)} days (minimum: ${config.minAccountAge} days)`);
        checks.severity += 40;
    }

    // Check 2: Username patterns
    const suspiciousPatterns = [
        { pattern: /alt$/i, weight: 30, desc: 'Username ends with "alt"' },
        { pattern: /\d{4,}$/, weight: 25, desc: 'Username ends with 4+ numbers' },
        { pattern: /^[a-z]{1,3}\d{4,}$/i, weight: 30, desc: 'Short name + many numbers' },
        { pattern: /backup/i, weight: 25, desc: 'Contains "backup"' },
        { pattern: /secondary/i, weight: 25, desc: 'Contains "secondary"' },
        { pattern: /temp/i, weight: 20, desc: 'Contains "temp"' },
        { pattern: /test/i, weight: 15, desc: 'Contains "test"' },
        { pattern: /^[a-z]{1,2}$/i, weight: 10, desc: 'Very short username' }
    ];

    for (const { pattern, weight, desc } of suspiciousPatterns) {
        if (pattern.test(member.user.username)) {
            checks.isSuspicious = true;
            checks.reasons.push(`Suspicious pattern: ${desc}`);
            checks.severity += weight;
            break; // Only count one username pattern
        }
    }

    // Check 3: Default avatar (no profile picture)
    if (config.checkAvatarHash && !member.user.avatar) {
        checks.reasons.push('Using default Discord avatar');
        checks.severity += 15;
        if (accountAge < 1) { // New account with default avatar is more suspicious
            checks.isSuspicious = true;
            checks.severity += 10;
        }
    }

    // Check 4: No mutual servers (very new to Discord)
    if (accountAge < 1 && client.guilds.cache.filter(g => g.members.cache.has(member.user.id)).size === 1) {
        checks.reasons.push('No other mutual servers');
        checks.severity += 10;
    }

    // Check 5: Custom patterns
    if (config.customSuspiciousPatterns) {
        for (const pattern of config.customSuspiciousPatterns) {
            if (pattern.test(member.user.username)) {
                checks.isSuspicious = true;
                checks.reasons.push(`Custom pattern match: ${member.user.username}`);
                checks.severity += 20;
                break;
            }
        }
    }

    // If severity is high, mark as suspicious
    if (checks.severity >= 50) {
        checks.isSuspicious = true;
    }

    return checks;
}

// Send detailed alert embed
async function sendAlertEmbed(guild, member, reasons, action, severity = 0) {
    try {
        const logChannel = guild.channels.cache.get(config.logChannelId);
        if (!logChannel) {
            console.error('Log channel not found!');
            return;
        }

        const accountAge = ((new Date() - member.user.createdAt) / (1000 * 60 * 60 * 24)).toFixed(1);
        
        // Color based on severity
        let color = 0xFFAA00; // Orange for warnings
        if (action.includes('Banned')) color = 0xFF0000; // Red for bans
        if (severity > 75) color = 0x8B0000; // Dark red for high severity

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('🚨 Alt Account Detection')
            .setDescription(`**${member.user.tag}** failed to join the server`)
            .addFields(
                { name: '👤 User', value: `${member.user.tag}\n\`${member.user.id}\``, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '⏰ Account Age', value: `${accountAge} days`, inline: true },
                { name: '🎯 Severity Score', value: `${severity}/100${severity > 75 ? ' 🔴' : severity > 50 ? ' 🟠' : ' 🟡'}`, inline: true },
                { name: '👥 Mutual Servers', value: `${client.guilds.cache.filter(g => g.members.cache.has(member.user.id)).size}`, inline: true },
                { name: '🖼️ Avatar', value: member.user.avatar ? '✅ Custom' : '❌ Default', inline: true },
                { name: '⚠️ Detection Reasons', value: reasons.join('\n') || 'None', inline: false },
                { name: '🔨 Action Taken', value: action, inline: false }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 128 }))
            .setTimestamp()
            .setFooter({ text: `Alt Protection System | Chicago Loop RP` });

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending alert embed:', error);
        logToFile(`Error sending embed: ${error.message}`);
    }
}

// Handle member join
client.on('guildMemberAdd', async (member) => {
    try {
        logToFile(`New member joined: ${member.user.tag} (${member.user.id})`);

        // Check if already in banned database
        if (bannedAlts.has(member.user.id)) {
            const banInfo = bannedAlts.get(member.user.id);
            logToFile(`Previously detected alt attempting to rejoin: ${member.user.tag}`);
            
            await member.ban({ reason: `Alt account - Previously detected on ${banInfo.timestamp}` });
            
            await sendAlertEmbed(
                member.guild,
                member,
                [`Previously detected alt account`, `Original detection: ${banInfo.reason}`],
                '🔨 Banned (Database match)',
                100
            );
            return;
        }

        // Run comprehensive checks
        const suspicionCheck = isAccountSuspicious(member);

        if (suspicionCheck.isSuspicious) {
            logToFile(`Suspicious account detected: ${member.user.tag} - Severity: ${suspicionCheck.severity} - Reasons: ${suspicionCheck.reasons.join(', ')}`);

            // Record in database
            const banRecord = {
                userId: member.user.id,
                username: member.user.tag,
                reason: suspicionCheck.reasons.join(', '),
                severity: suspicionCheck.severity,
                timestamp: new Date().toISOString(),
                guildId: member.guild.id
            };

            bannedAlts.set(member.user.id, banRecord);
            if (config.saveToDatabase) {
                saveBannedAlts();
            }

            // Take action based on configuration
            let action = '';
            if (config.banOnDetection) {
                await member.ban({ 
                    reason: `Alt detected (severity: ${suspicionCheck.severity}): ${suspicionCheck.reasons.join(', ')}`,
                    deleteMessageSeconds: 0
                });
                action = '🔨 Banned';
                logToFile(`Banned alt account: ${member.user.tag}`);
            } else {
                await member.kick(`Alt detected: ${suspicionCheck.reasons.join(', ')}`);
                action = '👢 Kicked';
                logToFile(`Kicked alt account: ${member.user.tag}`);
            }

            // Send alert
            if (config.notifyOnKick) {
                await sendAlertEmbed(
                    member.guild,
                    member,
                    suspicionCheck.reasons,
                    action,
                    suspicionCheck.severity
                );
            }
        } else {
            logToFile(`Member passed all checks: ${member.user.tag} (${member.user.id})`);
        }
    } catch (error) {
        console.error('Error processing member join:', error);
        logToFile(`Error processing ${member.user.tag}: ${error.message}`);
    }
});

// Bot ready
client.on('ready', () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║     Alt Account Detector Bot - ONLINE         ║
╚═══════════════════════════════════════════════╝
    `);
    console.log(`✅ Logged in as: ${client.user.tag}`);
    console.log(`📊 Monitoring: ${client.guilds.cache.size} server(s)`);
    console.log(`👥 Total members: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`);
    console.log(`🗄️  Banned alts in database: ${bannedAlts.size}`);
    console.log(`\n⚙️  Configuration:`);
    console.log(`   ├─ Min Account Age: ${config.minAccountAge} days`);
    console.log(`   ├─ Auto Ban: ${config.banOnDetection ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   ├─ Database Persistence: ${config.saveToDatabase ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   ├─ Avatar Check: ${config.checkAvatarHash ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   └─ Log Channel: ${config.logChannelId}\n`);
    
    logToFile(`Bot started successfully. Logged in as ${client.user.tag}`);
    logToFile(`Loaded ${bannedAlts.size} banned alts from database`);
});

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
    logToFile(`Client error: ${error.message}`);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    logToFile(`Unhandled rejection: ${error.message}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Bot shutting down...');
    if (config.saveToDatabase) {
        saveBannedAlts();
        console.log('💾 Database saved');
    }
    client.destroy();
    process.exit(0);
});

// Login
console.log('🔄 Starting bot...');
client.login(config.token).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});
