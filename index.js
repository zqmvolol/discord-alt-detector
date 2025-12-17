const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, UserFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    token: 'YOUR_BOT_TOKEN_HERE',
    logChannelId: 'YOUR_LOG_CHANNEL_ID', // Channel for alt detection alerts
    
    // Advanced Alt Detector Weights
    detectorWeights: {
        ageWeight: 2,                    // Account age (higher = more important)
        statusWeight: 1,                 // User status (online, invisible, idle, dnd)
        activityWeight: 1,               // User activity (playing/listening...)
        usernameWordsWeight: 2,          // Suspicious words in username
        usernameSymbolsWeight: 1.5,      // Special characters in username
        displaynameWordsWeight: 1.5,     // Suspicious words in displayname
        displaynameCapsWeight: 0.5,      // Caps characters in displayname
        displaynameSymbolsWeight: 1,     // Special characters in displayname
        flagsWeight: 2,                  // Profile badges (hypesquad, active dev, etc.)
        boosterWeight: 2,                // Is server booster
        pfpWeight: 1.5,                  // Has non-default avatar
        bannerWeight: 1,                 // Has nitro banner
        customWeight: 1                  // Weight for custom function
    },
    
    // Trust Level Actions
    trustLevelActions: {
        'mega-suspicious': 'ban',        // Auto-ban
        'highly-suspicious': 'ban',      // Auto-ban
        'suspicious': 'kick',            // Auto-kick
        'newbie': 'log',                 // Just log
        'normal': 'none',
        'trusted': 'none',
        'highly-trusted': 'none'
    }
};

// Create client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildPresences  // Required for status/activity detection
    ]
});

// Logging setup
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

const logFilePath = path.join(logsDir, `alt-detections-${new Date().toISOString().split('T')[0]}.log`);

function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFilePath, logMessage);
    console.log(logMessage.trim());
}

// Store banned alt accounts
const bannedAlts = new Map(); // userId -> { reason, timestamp, mainAccount }

// ============================================
// BUILT-IN ADVANCED ALT DETECTOR
// ============================================

// Suspicious words to check in usernames and display names
const suspiciousWords = [
    'alt', 'backup', 'secondary', 'temp', 'test', 'fake', 'new', 'bot',
    'throwaway', 'spare', 'extra', 'second', 'third', 'another'
];

// Calculate account age score
function calculateAgeScore(member) {
    const accountAge = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    
    if (accountAge < 1) return 10;      // < 1 day: Very suspicious
    if (accountAge < 3) return 8;       // < 3 days: Highly suspicious
    if (accountAge < 7) return 6;       // < 1 week: Suspicious
    if (accountAge < 14) return 4;      // < 2 weeks: Somewhat suspicious
    if (accountAge < 30) return 2;      // < 1 month: Slightly suspicious
    if (accountAge < 90) return 0;      // < 3 months: Normal
    if (accountAge < 365) return -2;    // < 1 year: Trusted
    return -4;                          // 1+ year: Highly trusted
}

// Calculate status score
function calculateStatusScore(member) {
    const status = member.presence?.status;
    
    if (!status || status === 'offline') return 2;  // No presence or offline
    if (status === 'invisible') return 3;           // Invisible is suspicious
    if (status === 'idle') return 1;                // Idle is slightly suspicious
    if (status === 'dnd') return 0;                 // DND is normal
    if (status === 'online') return -1;             // Online is good
    return 0;
}

// Calculate activity score
function calculateActivityScore(member) {
    const activities = member.presence?.activities || [];
    
    if (activities.length === 0) return 2;          // No activity
    
    let score = 0;
    activities.forEach(activity => {
        if (activity.type === 0) score -= 1;        // Playing a game: -1
        if (activity.type === 2) score -= 1;        // Listening to music: -1
        if (activity.type === 3) score -= 1;        // Watching: -1
        if (activity.type === 5) score -= 1;        // Competing: -1
    });
    
    return Math.max(score, -3);                     // Cap at -3
}

// Calculate username score
function calculateUsernameScore(username) {
    let score = 0;
    const lowerUsername = username.toLowerCase();
    
    // Check for suspicious words
    for (const word of suspiciousWords) {
        if (lowerUsername.includes(word)) {
            score += 4;
            break;
        }
    }
    
    // Check for number patterns
    if (/\d{4,}/.test(username)) score += 3;        // 4+ consecutive numbers
    if (/^\w{1,3}\d+$/.test(username)) score += 4;  // Short name + numbers (e.g., "ab123")
    
    // Check for excessive symbols
    const symbolCount = (username.match(/[^a-zA-Z0-9]/g) || []).length;
    if (symbolCount > 3) score += 2;
    
    return score;
}

// Calculate display name score
function calculateDisplaynameScore(displayName, username) {
    let score = 0;
    const lowerDisplayname = displayName.toLowerCase();
    
    // Check for suspicious words
    for (const word of suspiciousWords) {
        if (lowerDisplayname.includes(word)) {
            score += 3;
            break;
        }
    }
    
    // Check caps percentage
    const capsCount = (displayName.match(/[A-Z]/g) || []).length;
    const totalLetters = (displayName.match(/[a-zA-Z]/g) || []).length;
    const capsPercent = totalLetters > 0 ? capsCount / totalLetters : 0;
    
    if (capsPercent > 0.7) score -= 2;              // Lots of caps is actually good (real names)
    if (capsPercent < 0.1 && totalLetters > 3) score += 1; // All lowercase is suspicious
    
    // Check for excessive symbols
    const symbolCount = (displayName.match(/[^a-zA-Z0-9\s]/g) || []).length;
    if (symbolCount > 4) score += 2;
    
    // Same as username (lazy)
    if (displayName === username) score += 1;
    
    return score;
}

// Calculate flags/badges score
function calculateFlagsScore(user) {
    const flags = user.flags?.toArray() || [];
    
    if (flags.length === 0) return 4;               // No badges: suspicious
    
    let score = 0;
    
    // Good badges (reduce suspicion)
    if (flags.includes(UserFlags.Staff)) score -= 10;
    if (flags.includes(UserFlags.Partner)) score -= 8;
    if (flags.includes(UserFlags.CertifiedModerator)) score -= 6;
    if (flags.includes(UserFlags.Hypesquad)) score -= 2;
    if (flags.includes(UserFlags.HypeSquadOnlineHouse1)) score -= 2;
    if (flags.includes(UserFlags.HypeSquadOnlineHouse2)) score -= 2;
    if (flags.includes(UserFlags.HypeSquadOnlineHouse3)) score -= 2;
    if (flags.includes(UserFlags.PremiumEarlySupporter)) score -= 3;
    if (flags.includes(UserFlags.BugHunterLevel1)) score -= 2;
    if (flags.includes(UserFlags.BugHunterLevel2)) score -= 4;
    if (flags.includes(UserFlags.ActiveDeveloper)) score -= 3;
    
    return Math.max(score, -10);                    // Cap at -10
}

// Calculate booster score
function calculateBoosterScore(member) {
    if (member.premiumSince) return -4;             // Server booster: very trusted
    return 2;                                        // Not a booster: slightly suspicious
}

// Calculate profile picture score
function calculatePfpScore(user) {
    if (!user.avatar) return 3;                     // Default avatar: suspicious
    if (user.avatar.startsWith('a_')) return -2;    // Animated avatar (Nitro): trusted
    return -1;                                       // Custom avatar: good
}

// Calculate banner score
function calculateBannerScore(user) {
    if (user.banner) return -2;                     // Has banner (Nitro): trusted
    return 1;                                        // No banner: slightly suspicious
}

// Custom scoring function
function calculateCustomScore(member) {
    let score = 0;
    
    // Check if previously banned
    if (bannedAlts.has(member.user.id)) {
        score += 10;
    }
    
    // Check mutual servers
    const mutualGuilds = client.guilds.cache.filter(g => 
        g.members.cache.has(member.user.id)
    ).size;
    
    if (mutualGuilds === 1) score += 2;             // Only in this server
    if (mutualGuilds > 5) score -= 2;               // In many servers: trusted
    if (mutualGuilds > 10) score -= 3;              // In lots of servers: very trusted
    
    return score;
}

// Main detection function
function checkMember(member) {
    const categories = {
        age: calculateAgeScore(member) * config.detectorWeights.ageWeight,
        status: calculateStatusScore(member) * config.detectorWeights.statusWeight,
        activity: calculateActivityScore(member) * config.detectorWeights.activityWeight,
        username: calculateUsernameScore(member.user.username) * config.detectorWeights.usernameWordsWeight,
        usernameSymbols: 0, // Included in username score
        displayname: calculateDisplaynameScore(member.displayName, member.user.username) * config.detectorWeights.displaynameWordsWeight,
        displaynameSymbols: 0, // Included in displayname score
        flags: calculateFlagsScore(member.user) * config.detectorWeights.flagsWeight,
        booster: calculateBoosterScore(member) * config.detectorWeights.boosterWeight,
        pfp: calculatePfpScore(member.user) * config.detectorWeights.pfpWeight,
        banner: calculateBannerScore(member.user) * config.detectorWeights.bannerWeight,
        custom: calculateCustomScore(member) * config.detectorWeights.customWeight
    };
    
    const total = Object.values(categories).reduce((sum, val) => sum + val, 0);
    
    return { categories, total };
}

// Get trust category from score
function getCategory(result) {
    const score = result.total;
    
    if (score >= 30) return 'mega-suspicious';
    if (score >= 20) return 'highly-suspicious';
    if (score >= 10) return 'suspicious';
    if (score >= 5) return 'newbie';
    if (score >= -5) return 'normal';
    if (score >= -15) return 'trusted';
    return 'highly-trusted';
}

// Get color and emoji for trust categories
function getCategoryColor(category) {
    const colors = {
        'highly-trusted': 0x00FF00,      // Green
        'trusted': 0x00AA00,             // Dark green
        'normal': 0x0099FF,              // Blue
        'newbie': 0xFFAA00,              // Orange
        'suspicious': 0xFF6600,          // Dark orange
        'highly-suspicious': 0xFF0000,   // Red
        'mega-suspicious': 0x8B0000      // Dark red
    };
    return colors[category] || 0xFF0000;
}

function getCategoryEmoji(category) {
    const emojis = {
        'highly-trusted': '✅',
        'trusted': '✅',
        'normal': '🔵',
        'newbie': '🟠',
        'suspicious': '⚠️',
        'highly-suspicious': '🔴',
        'mega-suspicious': '🚫'
    };
    return emojis[category] || '⚪';
}

function getCategoryDescription(category) {
    const descriptions = {
        'highly-trusted': 'Highly trusted account - Could apply for staff',
        'trusted': 'Trusted account - Very reliable',
        'normal': 'Normal account - Nothing suspicious',
        'newbie': 'New to Discord - Monitor carefully',
        'suspicious': 'Suspicious account - Possible alt',
        'highly-suspicious': 'Highly suspicious - Almost certainly an alt',
        'mega-suspicious': 'Meets all alt account criteria'
    };
    return descriptions[category] || 'Unknown trust level';
}


// Send alert embed with trust level
async function sendAlertEmbed(guild, member, reasons, action, category = null, detectionResult = null) {
    try {
        const logChannel = guild.channels.cache.get(config.logChannelId);
        if (!logChannel) {
            console.error('Log channel not found!');
            return;
        }

        const accountAge = ((new Date() - member.user.createdAt) / (1000 * 60 * 60 * 24)).toFixed(1);
        
        // Determine color and emoji
        const color = category ? getCategoryColor(category) : 0xFF0000;
        const emoji = category ? getCategoryEmoji(category) : '🚨';
        const description = category ? getCategoryDescription(category) : 'Alt account detected';
        
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${emoji} Alt Account Detection: ${category ? category.toUpperCase() : 'DETECTED'}`)
            .setDescription(`**${member.user.tag}** - ${description}`)
            .addFields(
                { name: '👤 User', value: `${member.user.tag} (${member.user.id})`, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '⏰ Account Age', value: `${accountAge} days`, inline: true }
            );
        
        // Add detection results if using advanced detector
        if (detectionResult && detectionResult.categories) {
            const categories = detectionResult.categories;
            
            let scoreBreakdown = '```\n';
            if (categories.age !== undefined) scoreBreakdown += `Age:         ${categories.age.toFixed(1)}\n`;
            if (categories.status !== undefined) scoreBreakdown += `Status:      ${categories.status.toFixed(1)}\n`;
            if (categories.username !== undefined) scoreBreakdown += `Username:    ${categories.username.toFixed(1)}\n`;
            if (categories.displayname !== undefined) scoreBreakdown += `Displayname: ${categories.displayname.toFixed(1)}\n`;
            if (categories.flags !== undefined) scoreBreakdown += `Badges:      ${categories.flags.toFixed(1)}\n`;
            if (categories.pfp !== undefined) scoreBreakdown += `Avatar:      ${categories.pfp.toFixed(1)}\n`;
            if (categories.banner !== undefined) scoreBreakdown += `Banner:      ${categories.banner.toFixed(1)}\n`;
            if (categories.booster !== undefined) scoreBreakdown += `Booster:     ${categories.booster.toFixed(1)}\n`;
            scoreBreakdown += `───────────────────\n`;
            scoreBreakdown += `TOTAL:       ${detectionResult.total.toFixed(1)}\n`;
            scoreBreakdown += '```';
            
            embed.addFields(
                { name: '📊 Trust Score Breakdown', value: scoreBreakdown, inline: false }
            );
        }
        
        // Add basic detection reasons
        if (reasons && reasons.length > 0) {
            embed.addFields(
                { name: '⚠️ Detection Reasons', value: reasons.join('\n'), inline: false }
            );
        }
        
        embed.addFields(
            { name: '🔨 Action Taken', value: action, inline: false }
        );
        
        // Add additional info
        const hasAvatar = member.user.avatar ? '✅ Custom' : '❌ Default';
        const mutualServers = client.guilds.cache.filter(g => g.members.cache.has(member.user.id)).size;
        
        embed.addFields(
            { name: '🖼️ Avatar', value: hasAvatar, inline: true },
            { name: '🌐 Mutual Servers', value: `${mutualServers}`, inline: true },
            { name: '🎯 Trust Level', value: category ? `\`${category}\`` : '`suspicious`', inline: true }
        );
        
        embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp()
            .setFooter({ text: 'Alt Account Protection System | Chicago Loop RP' });

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending alert embed:', error);
    }
}

// Handle member join
client.on('guildMemberAdd', async (member) => {
    try {
        logToFile(`New member joined: ${member.user.tag} (${member.user.id})`);

        // Check if already banned as alt
        if (bannedAlts.has(member.user.id)) {
            const banInfo = bannedAlts.get(member.user.id);
            logToFile(`Previously detected alt attempting to rejoin: ${member.user.tag}`);
            
            await member.ban({ reason: `Alt account - Previously detected: ${banInfo.reason}` });
            await sendAlertEmbed(
                member.guild,
                member,
                [`Previously detected alt account`, banInfo.reason],
                '🔨 Banned (Previously detected)',
                'mega-suspicious'
            );
            return;
        }

        // Run advanced detection
        logToFile(`Running advanced detection for: ${member.user.tag}`);
        
        const result = checkMember(member);
        const category = getCategory(result);
        
        logToFile(`Detection result: ${category} (score: ${result.total.toFixed(1)})`);
        
        // Get configured action for this trust level
        const action = config.trustLevelActions[category] || 'log';
        
        // Only take action if suspicious
        if (['mega-suspicious', 'highly-suspicious', 'suspicious', 'newbie'].includes(category)) {
            const reasons = [];
            
            // Build reasons based on scores
            if (result.categories.age > 5) reasons.push(`New account (${((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24)).toFixed(1)} days old)`);
            if (result.categories.username > 3) reasons.push(`Suspicious username pattern`);
            if (result.categories.displayname > 2) reasons.push(`Suspicious display name`);
            if (result.categories.pfp > 2) reasons.push(`Default avatar`);
            if (result.categories.flags > 3) reasons.push(`No profile badges`);
            if (result.categories.status > 2) reasons.push(`Suspicious status (${member.presence?.status || 'offline'})`);
            if (result.categories.booster > 1) reasons.push(`Not a server booster`);
            
            // Store in banned alts if highly suspicious
            if (['mega-suspicious', 'highly-suspicious'].includes(category)) {
                bannedAlts.set(member.user.id, {
                    reason: `Trust level: ${category} (score: ${result.total.toFixed(1)})`,
                    timestamp: new Date().toISOString(),
                    category: category,
                    score: result.total
                });
            }
            
            // Execute action
            let actionTaken = '';
            if (action === 'ban') {
                await member.ban({ 
                    reason: `Alt detected - Trust level: ${category} (score: ${result.total.toFixed(1)})`,
                    deleteMessageSeconds: 0
                });
                actionTaken = '🔨 Banned';
                logToFile(`Banned ${member.user.tag} - ${category}`);
            } else if (action === 'kick') {
                await member.kick(`Alt detected - Trust level: ${category}`);
                actionTaken = '👢 Kicked';
                logToFile(`Kicked ${member.user.tag} - ${category}`);
            } else {
                actionTaken = '📝 Logged (No action taken)';
                logToFile(`Logged ${member.user.tag} - ${category} - No action taken`);
            }
            
            // Send alert
            await sendAlertEmbed(
                member.guild,
                member,
                reasons,
                actionTaken,
                category,
                result
            );
        } else {
            // Trusted user
            logToFile(`Member passed checks: ${member.user.tag} - ${category} (score: ${result.total.toFixed(1)})`);
        }
    } catch (error) {
        console.error('Error processing member join:', error);
        logToFile(`Error processing ${member.user.tag}: ${error.message}`);
    }
});

// Bot ready event
client.on('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`📊 Monitoring ${client.guilds.cache.size} server(s)`);
    console.log(`⚙️ Configuration:`);
    console.log(`   - Detection Mode: ADVANCED (Built-in)`);
    console.log(`   - Log Channel ID: ${config.logChannelId}`);
    
    console.log(`\n📈 Trust Level Actions:`);
    Object.entries(config.trustLevelActions).forEach(([level, action]) => {
        if (action !== 'none') {
            console.log(`   - ${level}: ${action}`);
        }
    });
    
    logToFile(`Bot started and ready. Logged in as ${client.user.tag}`);
    logToFile(`Detection mode: ADVANCED (Built-in)`);
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

// Login
client.login(config.token);
