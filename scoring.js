// /scoring.js
const Player = require('./models/player');

async function calculateScore(discordId) {
    const player = await Player.findOne({ where: { discordId } });
    if (!player) {
        return 0;
    }

    let score = 0;
    const penalties = player.penalties || {};
    const chatHistory = player.chatHistory || {};

    // --- UPDATED LOGIC ---
    // Instead of looping to the highest level, we loop through all levels that have a chat history.
    // This means the player gets points for every level they have actually played.
    for (const levelNumber in chatHistory) {
        const levelHistory = chatHistory[levelNumber] || [];
        
        // Ensure the level has been played (history is not empty)
        if (levelHistory.length > 0) {
            const userMessagesSent = levelHistory.filter(msg => msg.role === 'user').length;
            let levelScore = Math.max(0, 101 - userMessagesSent);
            
            // Apply any penalties for that specific level
            const penalty = penalties[levelNumber] || 0;
            levelScore += penalty;
            
            score += levelScore;
        }
    }
    return score;
}

module.exports = { calculateScore };