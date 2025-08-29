// /commands/info.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'info',
    description: 'Displays a detailed explanation of how to play the game.',
    async execute(message, args) {
        const infoEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🤖 Welcome to the Mitnick Bot Challenge!')
            .setDescription('This is a social engineering game where your goal is to creatively trick, persuade, or manipulate AI characters into revealing a secret password.')
            .addFields(
                { 
                    name: '📜 How to Play', 
                    value: `1. Use the \`!select\` command in the server to bring up the level selection menu.\n2. After choosing a level, use the \`!start\` command in the server to begin the encounter.\n3. The bot will DM you to start the role-play. **All gameplay happens in your DMs.**\n4. Your goal is to get the AI character to reveal its password.\n5. Once you have the password, return to the server and use \`!submit <password>\` in any **server channel**. It will not work in DMs.` 
                },
                { 
                    name: '⭐ The Golden Rule: Stay in Character!', 
                    value: "The most important rule is to **stay in the roleplay**. The AI you are talking to believes it is a real character. If you mention 'the game' or 'the AI' and make it stop role-playing, you have been 'caught'. This is a failure and may result in a score penalty."
                },
                {
                    name: '⚠️ Troubleshooting',
                    value: "If the bot ever breaks character, gets stuck, or stops responding correctly, use the `!clearhistory` command. This will refresh your current session with the AI and should fix the issue."
                },
                {
                    name: '⌨️ Core Commands (Server Only)',
                    value: `\`!select\` - Brings up the level selection menu.\n\`!start\` - Begins your selected level.\n\`!submit <password>\` - Submits your password guess.\n\`!leaderboard\` - Displays the server leaderboard.\n\`!reset\` - Resets your game progress.\n\`!clearhistory\` - Refreshes your current AI session.\n\`!info\` - Shows this help message.`
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Good luck, social engineer!' });

        message.channel.send({ embeds: [infoEmbed] });
    },
};
