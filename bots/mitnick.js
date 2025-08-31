// /bots/mitnick.js
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const Player = require('../models/player.js');
const Level = require('../models/level.js');
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { AttachmentBuilder } = require('discord.js');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Proactively sends a level's intro message to a user's DMs.
 * @param {User} user The Discord user object to send the DM to.
 * @param {number} levelNumber The level to start.
 */
async function sendLevelIntro(channel, player, levelNumber) {
    const levelFilePath = path.join(__dirname, '..', 'levels', `level_${levelNumber}.js`);

    // Check if the player has completed all available levels
    if (!fs.existsSync(levelFilePath)) {
        try {
            await channel.send("You've completed all available levels! Congratulations!");
        } catch (error) {
            console.error(`[Mitnick] Could not send 'all levels complete' message to channel ${channel.id}.`, error.message);
            throw error; // Let the calling function know it failed
        }
        return;
    }

    const levelConfig = require(levelFilePath);

    // This logic ensures a new, unique password is created for the level start.
    const t = await Level.sequelize.transaction();
    try {
        let levelData = await Level.findOne({ where: { levelNumber: levelConfig.levelNumber }, transaction: t, lock: t.LOCK.UPDATE });
        if (!levelData) {
            const passwordObjects = levelConfig.passwords.map(p => ({ value: p, used: false }));
            levelData = await Level.create({ levelNumber: levelConfig.levelNumber, passwords: passwordObjects }, { transaction: t });
        }
        const unusedPassword = levelData.passwords.find(p => !p.used);
        if (!unusedPassword) {
            await t.commit();
            await channel.send("Oh no! It looks like we've run out of unique passwords for this level. Please contact an admin.");
            return;
        }
        player.activePassword = unusedPassword.value;
        const passwordIndex = levelData.passwords.findIndex(p => p.value === unusedPassword.value);
        levelData.passwords[passwordIndex].used = true;
        levelData.changed('passwords', true);
        await levelData.save({ transaction: t });
        await player.save({ transaction: t });
        await t.commit();
        console.log(`[Mitnick] Assigned password "${player.activePassword}" for Level ${levelConfig.levelNumber} to player ${player.discordId}.`);
    } catch (error) {
        await t.rollback();
        console.error("[Mitnick] Error assigning new password in sendLevelIntro:", error.message);
        await channel.send("I encountered a database error trying to start the level. Please try again.");
        return;
    }


    try {
        const introOptions = {
            content: `**Level ${levelConfig.levelNumber}:** ${levelConfig.introMessage}`
        };

        const imagePath = path.join(__dirname, '..', 'img', `level_${levelConfig.levelNumber}.png`);
        if (fs.existsSync(imagePath)) {
            introOptions.files = [new AttachmentBuilder(imagePath)];
        }
        await channel.send(introOptions);
    } catch (error) {
        console.error(`[Mitnick] Could not send level intro to channel ${channel.id}.`, error.message);
        throw error; // Let the calling function know it failed
    }
}


async function handleDM(message) {
    if (message.author.bot) return;

    console.log(`\n--- [${new Date().toLocaleTimeString()}] New DM from ${message.author.tag} ---`);

    try {
        const discordId = message.author.id;
        const [player] = await Player.findOrCreate({
            where: { discordId },
            defaults: { discordId }
        });

        const levelFilePath = path.join(__dirname, `../levels/level_${player.currentLevel}.js`);
        if (!fs.existsSync(levelFilePath)) {
            return message.reply("You've completed all available levels! Congratulations!");
        }
        const levelConfig = require(levelFilePath);
        
        if (!player.activePassword) {
            // (Password assignment logic remains unchanged)
            const t = await Level.sequelize.transaction();
            try {
                let levelData = await Level.findOne({ where: { levelNumber: player.currentLevel }, transaction: t, lock: t.LOCK.UPDATE });
                if (!levelData) {
                    const passwordObjects = levelConfig.passwords.map(p => ({ value: p, used: false }));
                    levelData = await Level.create({ levelNumber: player.currentLevel, passwords: passwordObjects }, { transaction: t });
                }
                const unusedPassword = levelData.passwords.find(p => !p.used);
                if (!unusedPassword) {
                    await t.commit();
                    return message.reply("Oh no! It looks like we've run out of unique passwords for this level. Please contact an admin.");
                }
                player.activePassword = unusedPassword.value;
                const passwordIndex = levelData.passwords.findIndex(p => p.value === unusedPassword.value);
                levelData.passwords[passwordIndex].used = true;
                levelData.changed('passwords', true);
                await levelData.save({ transaction: t });
                await player.save({ transaction: t });
                await t.commit();
                console.log(`Assigned password "${player.activePassword}" to player.`);
            } catch (error) {
                await t.rollback();
                throw error;
            }
        }

        const fullChatHistory = player.chatHistory || {};
        const currentLevelHistory = fullChatHistory[player.currentLevel] || [];
        currentLevelHistory.push({ role: "user", content: message.content });

        let dynamicPrompt = levelConfig.systemPrompt.replace(/{{PASSWORD}}/g, player.activePassword);
        
        // (Special level logic for levels 7, 8, 12, etc. remains unchanged)
        
        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 300,
            system: dynamicPrompt,
            messages: currentLevelHistory,
        });

        const aiResponse = response.content[0].text;
        currentLevelHistory.push({ role: "assistant", content: aiResponse });
        
        fullChatHistory[player.currentLevel] = currentLevelHistory;
        
        await Player.update(
            { chatHistory: fullChatHistory },
            { where: { discordId: player.discordId } }
        );
        console.log(`Saved chat history for level ${player.currentLevel}.`);

        // The intro message is now sent proactively, so we just reply with the AI's response.
        await message.reply(aiResponse);

    } catch (error) {
        console.error('Error handling DM:', error);
        await message.reply('I\'m having a little trouble thinking right now. Please try again in a moment.');
    }
}

// Export both functions
module.exports = { handleDM, sendLevelIntro };
