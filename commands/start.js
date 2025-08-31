const Player = require('../models/player');
const { sendLevelIntro } = require('../bots/mitnick'); // Import the function

module.exports = {
    name: 'start',
    description: 'Starts the game, shows your dashboard, and sends you the first level.',
    async execute(message, args, client) { // Add client to the arguments
        const discordId = message.author.id;
        let player = await Player.findOne({ where: { discordId } });

        if (!player) {
            player = await Player.create({ discordId });
        }

        const dashboard = {
            color: 0x0099ff,
            title: 'Your Dashboard',
            description: `Welcome to the game! I've sent you Level ${player.currentLevel} in your DMs.`,
            fields: [
                { name: 'Current Level', value: player.currentLevel.toString(), inline: true },
                { name: 'Levels Completed', value: Object.keys(player.levelScores || {}).length.toString(), inline: true },
            ],
            footer: { text: 'Good luck!' }
        };

        await message.channel.send({ embeds: [dashboard] });

        // --- UPDATED LOGIC ---
        // Instead of sending instructions, we now automatically start the level.
        try {
            // Get or create a DM channel with the user.
            const dmChannel = await message.author.createDM();
            // Call the function to send the level intro to that DM channel.
            await sendLevelIntro(dmChannel, player, player.currentLevel);

        } catch (error) {
            console.error(`Could not send DM to ${message.author.tag}.`);
            await message.channel.send(`${message.author}, I couldn't start the level in your DMs. Please make sure you have DMs enabled from server members!`);
        }
    },
};
