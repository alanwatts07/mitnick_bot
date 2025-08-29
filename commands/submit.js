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

        // --- Start of New Scoring Logic ---
        if (player.activePassword.toLowerCase() === passwordGuess.toLowerCase()) {
            
            const levelJustCompleted = player.currentLevel;
            const chatHistory = player.chatHistory || {};
            const levelHistory = chatHistory[levelJustCompleted] || [];
            const userMessagesSent = levelHistory.filter(msg => msg.role === 'user').length;
            
            // Calculate the score: 100 points minus 1 for each message sent.
            const levelScore = Math.max(0, 101 - userMessagesSent);

            // Get the existing scores, add the new one, and prepare for update.
            const existingScores = player.levelScores || {};
            const updatedScores = { ...existingScores, [levelJustCompleted]: levelScore };

            const newLevel = levelJustCompleted + 1;
            
            await player.update({ 
                currentLevel: newLevel,
                activePassword: null,
                levelScores: updatedScores // Save the updated scores object
            });
            
            message.reply(`Correct! You completed Level ${levelJustCompleted} with a score of ${levelScore}. You have advanced to Level ${newLevel}.`);

            if (message.member) {
                assignRole(message.member, levelJustCompleted);
            }
        // --- End of New Scoring Logic ---

        } else {
            // This part is for incorrect guesses, it remains the same.
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