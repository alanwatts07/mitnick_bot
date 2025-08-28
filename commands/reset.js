// /commands/reset.js
const { Op } = require('sequelize');
const Player = require('../models/player');
const sequelize = require('../database'); // Import the sequelize instance for transactions

module.exports = {
    name: 'reset',
    description: 'Archives your current game and starts a new one.',
    async execute(message, args) {
        const baseDiscordId = message.author.id;
        const t = await sequelize.transaction(); // Start a transaction

        try {
            // Find the player's current, active profile (the one without a suffix)
            const currentPlayer = await Player.findOne({ where: { discordId: baseDiscordId }, transaction: t });

            if (!currentPlayer) {
                await t.rollback();
                return message.reply("You don't have a game in progress to reset. Use `!start` to begin!");
            }

            // Find all archived profiles to determine the next suffix
            const allPlayers = await Player.findAll({
                where: {
                    discordId: {
                        [Op.startsWith]: `${baseDiscordId}_`
                    }
                },
                lock: t.LOCK.UPDATE, // Lock rows to prevent race conditions
                transaction: t
            });

            let maxSuffix = 0;
            allPlayers.forEach(player => {
                const parts = player.discordId.split('_');
                const suffix = parseInt(parts[1], 10);
                if (!isNaN(suffix) && suffix > maxSuffix) {
                    maxSuffix = suffix;
                }
            });

            const newSuffix = maxSuffix + 1;
            const newArchivedId = `${baseDiscordId}_${newSuffix}`;

            // Create a new record for the archive with the current player's data
            await Player.create({
                discordId: newArchivedId,
                currentLevel: currentPlayer.currentLevel,
                activePassword: currentPlayer.activePassword,
                attempts: currentPlayer.attempts,
            }, { transaction: t });

            // Delete the original player record
            await currentPlayer.destroy({ transaction: t });

            // Create a new, fresh player profile with the original discordId
            await Player.create({ discordId: baseDiscordId }, { transaction: t });

            // If we get here, all DB operations were successful
            await t.commit();

            message.reply(`Your previous progress has been archived as \`${newArchivedId}\`. You are now starting a fresh game. Good luck!`);

        } catch (error) {
            // If any operation fails, roll back the transaction
            await t.rollback();
            console.error(error);
            message.reply('Something went wrong trying to reset your game. Please try again.');
        }
    },
};