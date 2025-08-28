// /scoring.js
const Player = require('./models/player');

async function calculateScore(discordId) {
    const player = await Player.findOne({ where: { discordId } });
    if (!player) {
        return 0;
    }

    let score = 0;
    for (let i = 1; i < player.currentLevel; i++) {
        const attempts = player.attempts[i] || 1;
        score += Math.max(0, 100 - attempts);
    }
    return score;
}

module.exports = { calculateScore };