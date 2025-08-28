// /commands/leaderboard.js
const Player = require('../models/player');
const { calculateScore } = require('../scoring');

module.exports = {
    name: 'leaderboard',
    description: 'Displays the top players by their highest score.',
    async execute(message, args) {
        const players = await Player.findAll();
        const highScores = new Map();

        // Calculate scores for all player profiles
        for (const player of players) {
            const score = await calculateScore(player.discordId);
            // Extract the base Discord ID (the part before the underscore)
            const baseDiscordId = player.discordId.split('_')[0];

            // If we've already seen this user, only keep the higher score
            if (highScores.has(baseDiscordId)) {
                if (score > highScores.get(baseDiscordId).score) {
                    highScores.set(baseDiscordId, { score });
                }
            } else {
                highScores.set(baseDiscordId, { score });
            }
        }

        // Convert the map to an array for sorting
        const scoresArray = Array.from(highScores.entries()).map(([discordId, data]) => ({
            discordId,
            score: data.score,
        }));

        // Sort by score in descending order
        scoresArray.sort((a, b) => b.score - a.score);

        // Take the top 10 players
        const topTen = scoresArray.slice(0, 10);

        // Fetch usernames and format the leaderboard string
        const leaderboardEntries = await Promise.all(
            topTen.map(async (entry, index) => {
                try {
                    // Fetch user with the valid base ID
                    const user = await message.client.users.fetch(entry.discordId);
                    return `${index + 1}. ${user.username} - ${entry.score}`;
                } catch (error) {
                    console.error(`Could not fetch user for ID ${entry.discordId}`);
                    return `${index + 1}. Unknown User - ${entry.score}`;
                }
            })
        );

        if (leaderboardEntries.length === 0) {
            return message.channel.send("The leaderboard is empty!");
        }

        message.channel.send(`**Leaderboard**\n\`\`\`${leaderboardEntries.join('\n')}\`\`\``);
    },
};
