// /events/messageCreate.js (Updated)
const { prefix } = require('../config.json');
const { handleDM } = require('../bots/mitnick');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // If the message is a DM and not from a bot, handle it with the Mitnick bot
        if (message.channel.type === 1 && !message.author.bot) { // 1 is the type for DMChannel
            await handleDM(message);
            return;
        }

        // Handle server commands
        if (!message.content.startsWith(prefix) || message.author.bot || !message.guild) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);

        if (!command) return;

        try {
            await command.execute(message, args);
        } catch (error) {
            console.error(error);
            message.reply('There was an error trying to execute that command!');
        }
    },
};