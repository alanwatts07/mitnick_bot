// /commands/submit.js
const Player = require('../models/player');
const { assignRole } = require('../bots/sysadmin');

module.exports = {
    name: 'submit',
    description: 'Submits the password you social engineered.',
    async execute(message, args) {
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
            return message.reply("You haven't started this level yet! Send me a DM to begin.");
        }

        if (player.activePassword.toLowerCase() === passwordGuess.toLowerCase()) {
            
            const levelJustCompleted = player.currentLevel;
            const chatHistory = player.chatHistory || {};
            const levelHistory = chatHistory[levelJustCompleted] || [];
            const userMessagesSent = levelHistory.filter(msg => msg.role === 'user').length;
            
            // --- THIS IS THE FIX ---
            // Calculate the score: 100 points + 2 bonus points, minus 1 for each message.
            const levelScore = Math.max(0, 103 - userMessagesSent);

            const existingScores = player.levelScores || {};
            const updatedScores = { ...existingScores, [levelJustCompleted]: levelScore };

            const newLevel = levelJustCompleted + 1;
            
            await player.update({ 
                currentLevel: newLevel,
                activePassword: null,
                levelScores: updatedScores
            });
            
            message.reply(`Correct! You completed Level ${levelJustCompleted} with a score of ${levelScore}. You have advanced to Level ${newLevel}.`);

            if (message.member) {
                assignRole(message.member, levelJustCompleted);
            }

        } else {
            const failedSubmissions = player.failedSubmissions || {};
            if (!failedSubmissions[player.currentLevel]) {
                failedSubmissions[player.currentLevel] = [];
            }
            failedSubmissions[player.currentLevel].push(passwordGuess);

            await player.update({ 
                failedSubmissions: { ...failedSubmissions }
            });

            message.reply('Incorrect password. Keep trying!');
        }
    },
};
