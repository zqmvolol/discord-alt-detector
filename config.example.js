module.exports = {
    // Your Discord Bot Token
    // Get from: https://discord.com/developers/applications
    token: 'YOUR_BOT_TOKEN_HERE',
    
    // Channel ID where alt detection alerts will be sent
    logChannelId: 'YOUR_LOG_CHANNEL_ID',
    
    // Minimum account age in days
    // Accounts younger than this will be flagged
    minAccountAge: 7,
    
    // Enable account age checking
    checkAccountAge: true,
    
    // Check new members joining the server
    checkNewMembers: true,
    
    // Automatically ban detected alts (false = kick only)
    banOnDetection: true,
    
    // Send notification when user is kicked/banned
    notifyOnKick: true,
    
    // Whitelist specific user IDs (they won't be checked)
    whitelistedUsers: [
        // 'USER_ID_HERE',
        // 'ANOTHER_USER_ID'
    ],
    
    // Additional suspicious username patterns (regex)
    customSuspiciousPatterns: [
        // /your-pattern-here/i
    ]
};
