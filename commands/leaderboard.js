// /commands/leaderboard.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const Player = require('../models/player');
const { calculateScore } = require('../scoring');

module.exports = {
    name: 'leaderboard',
    description: 'Displays an interactive leaderboard of top players.',
    async execute(message, args) {
        const allProfiles = await Player.findAll();
        const playerScores = new Map();

        for (const profile of allProfiles) {
            const score = await calculateScore(profile.discordId);
            const baseId = profile.discordId.split('_')[0];

            if (!playerScores.has(baseId) || score > playerScores.get(baseId).score) {
                playerScores.set(baseId, { score, player: profile });
            }
        }

        const sortedScores = Array.from(playerScores.values()).sort((a, b) => b.score - a.score);
        const topTen = sortedScores.slice(0, 10);

        if (topTen.length === 0) {
            return message.channel.send("The leaderboard is currently empty!");
        }

        // --- Create the Main Leaderboard Embed ---
        const leaderboardEntries = await Promise.all(
            topTen.map(async (entry, index) => {
                const rank = index + 1;
                let displayName = `Unknown User`;
                const baseId = entry.player.discordId.split('_')[0];
                try {
                    const member = await message.guild.members.fetch(baseId);
                    displayName = member.displayName;
                } catch {
                    displayName = `Unknown (${baseId.substring(0, 6)}...)`;
                }
                return `**${rank}.** ${displayName} - **Score:** ${entry.score}`;
            })
        );

        const leaderboardEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🏆 Mitnick Bot Leaderboard')
            .setDescription(leaderboardEntries.join('\n'))
            .setFooter({ text: 'Select a player from the menu below for detailed stats.' });

        // --- Create the Interactive Dropdown Menu ---
        const selectOptions = topTen.map((entry, index) => {
            const baseId = entry.player.discordId.split('_')[0];
            return {
                label: `${index + 1}. ${leaderboardEntries[index].split(' - ')[0].replace(/\*\*/g, '')}`, // Get name from pre-formatted string
                description: `View detailed stats for this user.`,
                value: baseId,
            };
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('leaderboard-stat-select')
            .setPlaceholder('View a player\'s detailed report...')
            .addOptions(selectOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const leaderboardMessage = await message.channel.send({ embeds: [leaderboardEmbed], components: [row] });

        // --- Create a Collector to Handle Selections ---
        const collector = leaderboardMessage.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 120000, // Menu stays active for 2 minutes
        });

        collector.on('collect', async (interaction) => {
            const targetUserId = interaction.values[0];
            const playerData = playerScores.get(targetUserId);

            if (!playerData) {
                return interaction.reply({ content: 'Could not find data for this player.', ephemeral: true });
            }

            const { player } = playerData;
            const chatHistory = player.chatHistory || {};
            const penalties = player.penalties || {};
            
            // --- THIS IS THE FIX ---
            // We now get the count of completed levels directly from the levelScores object.
            const levelScores = player.levelScores || {};
            const levelsCompleted = Object.keys(levelScores).length;
            
            let totalUserMessages = 0;
            for (const level in chatHistory) {
                totalUserMessages += chatHistory[level].filter(msg => msg.role === 'user').length;
            }

            let member;
            try {
                member = await message.guild.members.fetch(targetUserId);
            } catch {
                // User might not be in the server, so we can't show an avatar
            }

            const statEmbed = new EmbedBuilder()
                .setColor(0x00ff99)
                .setTitle(`Stat Report for ${member ? member.displayName : `User ${targetUserId}`}`)
                .setThumbnail(member ? member.user.displayAvatarURL() : null)
                .addFields(
                    { name: 'Total Score', value: `\`${playerData.score}\``, inline: true },
                    { name: 'Current Level', value: `\`${player.currentLevel}\``, inline: true },
                    // --- UPDATED FIELD NAME AND VALUE ---
                    { name: 'Levels Completed', value: `\`${levelsCompleted}\``, inline: true },
                    { name: 'Total Messages Sent', value: `\`${totalUserMessages}\` (Primary score penalty)`, inline: false },
                    { name: 'Penalties Incurred', value: `\`${Object.keys(penalties).length > 0 ? JSON.stringify(penalties) : 'None'}\``, inline: false }
                )
                .setTimestamp();
            
            // Send the detailed stats as a private (ephemeral) message
            await interaction.reply({ embeds: [statEmbed], ephemeral: true });
        });

        collector.on('end', () => {
            leaderboardMessage.edit({ components: [] }); // Remove the menu after it expires
        });
    },
};
