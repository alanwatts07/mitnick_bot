// /commands/select.js
const Player = require('../models/player');
const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { sendLevelIntro } = require('../bots/mitnick'); // Import the new function

module.exports = {
    name: 'select',
    description: 'Displays a menu to select a specific level to play.',
    async execute(message, args) {
        const discordId = message.author.id;
        const player = await Player.findOne({ where: { discordId } });
        if (!player) {
            return message.reply('You need to start the game first! Use `!start`.');
        }

        const levelsPath = path.join(__dirname, '../levels');
        const levelFiles = fs.readdirSync(levelsPath).filter(file => file.startsWith('level_') && file.endsWith('.js'));

        if (levelFiles.length === 0) {
            return message.reply("No levels are available right now. Please contact an admin.");
        }

        const options = levelFiles.map(file => {
            const level = require(path.join(levelsPath, file));
            const description = level.introMessage ? level.introMessage.substring(0, 100) : 'No description available.';
            return {
                label: `Level ${level.levelNumber}`,
                description: description,
                value: level.levelNumber.toString(),
            };
        }).sort((a, b) => parseInt(a.label.split(' ')[1]) - parseInt(b.label.split(' ')[1]));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('level-select-menu')
            .setPlaceholder('Choose a level to jump to...')
            .addOptions(options.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const selectMessage = await message.reply({
            content: 'Please select a level you would like to start:',
            components: [row],
        });

        const collector = selectMessage.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000,
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: 'This menu is not for you.', ephemeral: true });
            }

            const selectedLevel = parseInt(interaction.values[0], 10);

            await player.update({
                currentLevel: selectedLevel,
                activePassword: null
            });
            
            await interaction.update({ content: `You have selected Level ${selectedLevel}. I've sent the intro to your DMs!`, components: [] });

            // Automatically start the selected level
            await sendLevelIntro(interaction.user, selectedLevel);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                selectMessage.edit({ content: 'Level selection timed out.', components: [] });
            }
        });
    },
};
