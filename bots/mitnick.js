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
async function sendLevelIntro(user, levelNumber) {
    const levelFilePath = path.join(__dirname, `../levels/level_${levelNumber}.js`);
    // Check if the next level exists
    if (!fs.existsSync(levelFilePath)) {
        try {
            await user.send("Congratulations! It seems you've completed all available levels!");
        } catch (error) {
            console.error(`Could not send 'all levels complete' DM to user ${user.id}.`);
        }
        return;
    }

    const levelConfig = require(levelFilePath);
    if (!levelConfig.introMessage) {
        return; // No intro message for this level
    }

    // Prepare the message content and check for an image
    const messageOptions = {
        content: `**Level ${levelConfig.levelNumber}:** ${levelConfig.introMessage}\n\n*You can now begin interacting with the AI by sending your first message below.*`
    };

    const imagePath = path.join(__dirname, '..', 'img', `level_${levelNumber}.png`);
    if (fs.existsSync(imagePath)) {
        messageOptions.files = [new AttachmentBuilder(imagePath)];
    }

    try {
        await user.send(messageOptions);
    } catch (error) {
        console.error(`Could not send level intro DM to user ${user.id}.`);
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
