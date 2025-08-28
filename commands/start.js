const Player = require('../models/player');

module.exports = {
    name: 'start',
    description: 'Starts the game, shows your dashboard, and sends you instructions.',
    async execute(message, args) {
        const discordId = message.author.id;
        let player = await Player.findOne({ where: { discordId } });

        // Create a new player if one doesn't exist
        if (!player) {
            player = await Player.create({ discordId });
        }

        // Create and send the dashboard embed to the channel
        const dashboard = {
            color: 0x0099ff,
            title: 'Your Dashboard',
            description: `Welcome to the game! I've sent you a DM with instructions on how to play.`,
            fields: [
                { name: 'Current Level', value: player.currentLevel.toString(), inline: true },
                { name: 'Attempts on this Level', value: (player.attempts[player.currentLevel] || 0).toString(), inline: true },
            ],
            footer: { text: 'Good luck!' }
        };

        await message.channel.send({ embeds: [dashboard] });

        // Define the instructions to be sent in a DM
        const instructions = `
Hello! Welcome to the social engineering challenge. Here’s how to play:

**Step 1: Talk to the AI**
To start a level, just send me a message right here in this DM. You'll be talking to an AI character. Your goal is to trick them into giving you the secret password.

**Step 2: Submit the Password**
Once you think you have the password, go back to the server and use the submit command in any channel, like this:
\`!submit <the_password>\`

Good luck!
        `;

        // Try to send the instructions to the user's DMs
        try {
            await message.author.send(instructions);
        } catch (error) {
            console.error(`Could not send DM to ${message.author.tag}.`);
            // If DMs are blocked, send a message in the channel instead
            await message.channel.send(`${message.author}, I couldn't send you a DM. Please make sure you have DMs enabled from server members to receive instructions!`);
        }
    },
};