// /commands/submit.js
const Player = require('../models/player');
const { assignRole } = require('../bots/sysadmin');
const mitnickBot = require('../bots/mitnick');

module.exports = {
    name: 'submit',
    description: 'Submits the password you social engineered.',
    async execute(message, args) {
        const discordId = message.author.id;
        const passwordGuess = args[0];

        if (!passwordGuess) {
            return message.reply('Please provide a password to submit. Usage: `!submit <password>`');
        }

        const player = await Player.findOne({ where: { discordId } });
        if (!player) {
            return message.reply('You need to start the game first! Use `!start`.');
        }

        // Check if the player has been assigned a password for this level
        if (!player.activePassword) {
            return message.reply("You haven't started this level yet! Send me a DM to begin.");
        }

        // Track the attempt
        const attempts = player.attempts;
        attempts[player.currentLevel] = (attempts[player.currentLevel] || 0) + 1;
        await player.update({ attempts: { ...attempts } });

        // Check if the guess is correct
        if (player.activePassword.toLowerCase() === passwordGuess.toLowerCase()) {
            const newLevel = player.currentLevel + 1;
            
            // Level up the player and clear their active password for the next level
            await player.update({ 
                currentLevel: newLevel,
                activePassword: null 
            });

            // Clear the conversation history
            const conversations = mitnickBot.conversations;
            if (conversations && conversations.has(discordId)) {
                conversations.delete(discordId);
            }

            message.reply(`Correct! You have advanced to Level ${newLevel}.`);

            if (message.member) {
                assignRole(message.member, newLevel - 1);
            }

        } else {
            message.reply('Incorrect password. Keep trying!');
        }
    },
};