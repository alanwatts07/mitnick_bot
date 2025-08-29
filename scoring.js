// /scoring.js
const Player = require('./models/player');

async function calculateScore(discordId) {
    const player = await Player.findOne({ where: { discordId } });
    if (!player) {
        return 0;
    }

    // --- NEW, SIMPLIFIED LOGIC ---
    let totalScore = 0;
    const levelScores = player.levelScores || {};
    const penalties = player.penalties || {};

    // Add up all the saved scores from completed levels
    for (const level in levelScores) {
        totalScore += levelScores[level];
    }
    
    // Add up any penalties
    for (const level in penalties) {
        totalScore += penalties[level]; // Penalties should be negative numbers
    }

    return totalScore;
}

module.exports = { calculateScore };