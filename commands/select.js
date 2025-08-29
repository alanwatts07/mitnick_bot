// /commands/select.js
const Player = require('../models/player');
const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const mitnickBot = require('../bots/mitnick'); // Required to clear conversation cache

module.exports = {
    name: 'select',
    description: 'Displays a menu to select a specific level to play.',
    async execute(message, args) {
        const discordId = message.author.id;

        // Find the player in the database
        const player = await Player.findOne({ where: { discordId } });
        if (!player) {
            return message.reply('You need to start the game first! Use `!start`.');
        }

        // Get all available level files from the /levels directory
        const levelsPath = path.join(__dirname, '../levels');
        const levelFiles = fs.readdirSync(levelsPath).filter(file => file.startsWith('level_') && file.endsWith('.js'));

        if (levelFiles.length === 0) {
            return message.reply("No levels are available right now. Please contact an admin.");
        }

        // Create the options for the dropdown menu
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
            .addOptions(options.slice(0, 25)); // A menu can have a max of 25 options

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const selectMessage = await message.reply({
            content: 'Please select a level you would like to start:',
            components: [row],
        });

        // Create a collector to listen for the user's selection
        const collector = selectMessage.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000, // The menu will be active for 60 seconds
        });

        collector.on('collect', async (interaction) => {
            // Make sure the person who used the menu is the one who ran the command
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: 'This menu is not for you.', ephemeral: true });
            }

            const selectedLevel = parseInt(interaction.values[0], 10);

            // Update the player's current level in the database
            await player.update({
                currentLevel: selectedLevel,
                activePassword: null // Reset password to get a new one for the level
            });

            // Clear any active conversation from memory for a clean start
            if (mitnickBot.conversations && mitnickBot.conversations.has(discordId)) {
                mitnickBot.conversations.delete(discordId);
            }

            // Update the original message to show the selection was successful
            await interaction.update({ content: `You have selected Level ${selectedLevel}. Send me a DM to begin!`, components: [] });
        });

        // Handle the case where the user doesn't select anything in time
        collector.on('end', collected => {
            if (collected.size === 0) {
                selectMessage.edit({ content: 'Level selection timed out.', components: [] });
            }
        });
    },
};