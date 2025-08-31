// /events/messageCreate.js
const { prefix } = require('../config.json');
const { handleDM, sendLevelIntro } = require('../bots/mitnick'); // Ensure sendLevelIntro is imported if needed elsewhere

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;

        // --- NEW LOGIC: Check for commands universally ---
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = client.commands.get(commandName);

            if (!command) return;

            try {
                // Pass client to the command in case it's needed (like for sending DMs)
                await command.execute(message, args, client);
            } catch (error) {
                console.error(error);
                message.reply('There was an error trying to execute that command!');
            }
        } 
        // If it's not a command AND it's a DM, handle it with the AI
        else if (message.channel.type === 1) { // 1 is the enum for DMChannel
            await handleDM(message, client);
        }
    },
};
