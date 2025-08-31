// /commands/submit.js
const Player = require('../models/player');
const { assignRole, checkCompletionRole } = require('../bots/sysadmin');
const { sendLevelIntro } = require('../bots/mitnick');

module.exports = {
    name: 'submit',
    description: 'Submits the password you social engineered.',
    async execute(message, args, client) {
        const discordId = message.author.id;
        const passwordGuess = args.join(' ');

        if (!passwordGuess) {
            return message.reply('Please provide a password to submit. Usage: `!submit <password>`');
        }

        const player = await Player.findOne({ where: { discordId } });
        if (!player) {
            return message.reply('You need to start the game first! Use `!start`.');
        }

        if (!player.activePassword) {
            return message.reply("Your level isn't properly started. Try using `!start` or `!select`.");
        }

        if (player.activePassword.toLowerCase() === passwordGuess.toLowerCase()) {
            const levelJustCompleted = player.currentLevel;
            const chatHistory = player.chatHistory || {};
            const levelHistory = chatHistory[levelJustCompleted] || [];
            const userMessagesSent = levelHistory.filter(msg => msg.role === 'user').length;
            
            const levelScore = Math.max(0, 103 - userMessagesSent);

            const existingScores = player.levelScores || {};
            const updatedScores = { ...existingScores, [levelJustCompleted]: levelScore };
            const completedCount = Object.keys(updatedScores).length;

            const newLevel = levelJustCompleted + 1;
            
            await player.update({ 
                currentLevel: newLevel,
                activePassword: null,
                levelScores: updatedScores
            });
            
            await message.reply(`Correct! You completed Level ${levelJustCompleted} with a score of ${levelScore}.`);

            // Handle role assignments only if in a server
            if (message.guild && message.member) {
                assignRole(message.member, levelJustCompleted);
                await checkCompletionRole(message.member, completedCount);
            }

            // --- AUTO-START NEXT LEVEL ---
            try {
                // The message channel is the DM channel, which we pass directly.
                await sendLevelIntro(message.channel, player, newLevel);
            } catch (error) {
                console.error(`[Submit] Failed to auto-start next level for ${discordId}:`, error.message);
                await message.channel.send("I tried to start the next level for you, but encountered an error. Please use `!start` in the server to continue.");
            }

        } else {
            const failedSubmissions = player.failedSubmissions || {};
            if (!failedSubmissions[player.currentLevel]) {
                failedSubmissions[player.currentLevel] = [];
            }
            failedSubmissions[player.currentLevel].push(passwordGuess);

            await player.update({ failedSubmissions });

            message.reply('Incorrect password. Keep trying!');
        }
    },
};
