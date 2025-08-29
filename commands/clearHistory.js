// /commands/clear_history.js
const Player = require('../models/player');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'clearhistory',
    description: 'Clears your own chat history, or allows an admin to select a user to clear.',
    async execute(message, args) {
        // --- CONFIGURATION ---
        // Add the Discord IDs of authorized admins here.
        const authorizedUsers = ['1385885636556492932']; 
        const isAdmin = authorizedUsers.includes(message.author.id);

        if (isAdmin) {
            // --- ADMIN LOGIC ---
            handleAdmin(message);
        } else {
            // --- REGULAR USER LOGIC ---
            handleUser(message);
        }
    },
};

async function handleAdmin(message) {
    try {
        const players = await Player.findAll();
        if (!players || players.length === 0) {
            return message.reply('There are no players in the database.');
        }

        // Create dropdown menu options from the list of players
        const options = await Promise.all(
            players.map(async (player) => {
                let user;
                try {
                    user = await message.client.users.fetch(player.discordId);
                } catch {
                    // If the user can't be fetched (e.g., they left the server), use a default name
                    user = { username: `Unknown User (${player.discordId})` };
                }
                return {
                    label: user.username,
                    description: `ID: ${player.discordId}`,
                    value: player.discordId,
                };
            })
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('clear-history-select')
            .setPlaceholder('Select a player to clear history...')
            .addOptions(options.slice(0, 25)); // Discord dropdowns can only have 25 options at a time

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const adminMessage = await message.reply({
            content: 'Please select a user whose chat history you want to permanently delete:',
            components: [row],
        });

        // Create a collector to listen for the admin's selection
        const collector = adminMessage.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000, // 60 seconds
        });

        collector.on('collect', async (interaction) => {
            // Ensure the person interacting is the admin who ran the command
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: 'This menu is not for you.', ephemeral: true });
            }

            const targetUserId = interaction.values[0];
            await Player.update({ chatHistory: {} }, { where: { discordId: targetUserId } });
            
            await interaction.update({ content: `Successfully cleared chat history for user with ID \`${targetUserId}\`.`, components: [] });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                adminMessage.edit({ content: 'Selection timed out.', components: [] });
            }
        });

    } catch (error) {
        console.error('Admin clear history error:', error);
        message.reply('An error occurred while fetching players.');
    }
}

async function handleUser(message) {
    try {
        const player = await Player.findOne({ where: { discordId: message.author.id } });

        if (!player || !player.chatHistory || Object.keys(player.chatHistory).length === 0) {
            return message.reply("You don't have any chat history to clear.");
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm-clear')
            .setLabel('Yes, clear my history')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmButton);

        const userMessage = await message.reply({
            content: 'Are you sure you want to permanently delete your entire chat history? This cannot be undone.',
            components: [row],
        });

        const collector = userMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000, // 30 seconds
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: 'This button is not for you.', ephemeral: true });
            }

            await Player.update({ chatHistory: {} }, { where: { discordId: message.author.id } });
            
            await interaction.update({ content: 'Your chat history has been successfully cleared.', components: [] });
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                userMessage.edit({ content: 'Confirmation timed out.', components: [] });
            }
        });

    } catch (error) {
        console.error('User clear history error:', error);
        message.reply('An error occurred while trying to clear your history.');
    }
}