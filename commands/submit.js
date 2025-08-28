// /commands/submit.js
const Player = require('../models/player');
const { assignRole } = require('../bots/sysadmin');
const mitnickBot = require('../bots/mitnick');

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

        const attempts = player.attempts;
        attempts[player.currentLevel] = (attempts[player.currentLevel] || 0) + 1;

        if (player.activePassword.toLowerCase() === passwordGuess.toLowerCase()) {
            const newLevel = player.currentLevel + 1;
            
            await player.update({ 
                currentLevel: newLevel,
                activePassword: null,
                attempts: { ...attempts }
            });

            // *** CHANGE: We no longer delete the conversation history from memory upon level completion. ***
            // const conversations = mitnickBot.conversations;
            // if (conversations && conversations.has(discordId)) {
            //     conversations.delete(discordId);
            // }

            message.reply(`Correct! You have advanced to Level ${newLevel}.`);

            if (message.member) {
                assignRole(message.member, newLevel - 1);
            }

        } else {
            const failedSubmissions = player.failedSubmissions || {};
            if (!failedSubmissions[player.currentLevel]) {
                failedSubmissions[player.currentLevel] = [];
            }
            failedSubmissions[player.currentLevel].push(passwordGuess);

            await player.update({ 
                attempts: { ...attempts },
                failedSubmissions: { ...failedSubmissions }
            });

            message.reply('Incorrect password. Keep trying!');
        }
    },
};