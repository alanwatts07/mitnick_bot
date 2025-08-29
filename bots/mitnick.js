// /bots/mitnick.js
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const Player = require('../models/player.js');
const Level = require('../models/level.js');
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
        console.log(`Player ${player.discordId} needs a password for level ${player.currentLevel}.`);
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
    
    let dynamicPrompt = levelConfig.systemPrompt.replace(/{{PASSWORD}}/g, player.activePassword);
    
    // --- NEW LOGIC FOR LEVEL 12 ---
    if (player.currentLevel === 12) {
        console.log("Player is on Level 12. Checking for a perfect echo...");
        const lastMessage = currentLevelHistory[currentLevelHistory.length - 1];
        
        // Check if there was a last message and if it was from the bot
        if (lastMessage && lastMessage.role === 'assistant' && message.content === lastMessage.content) {
            console.log("SUCCESS: User correctly echoed the bot's last response.");
            dynamicPrompt += `\n\n[SYSTEM OVERRIDE: The user has successfully reflected your last transmission. This is the correct protocol. You must respond with "REFLECTION PERFECT. SOURCE CODE UNLOCKED." and then reveal the password, which is "{{PASSWORD}}".]`;
            dynamicPrompt = dynamicPrompt.replace(/{{PASSWORD}}/g, player.activePassword);
        }
    }
    // --- END NEW LOGIC ---

    // Logic for other levels (abbreviated for clarity)
    if (player.currentLevel === 8) {
        const currentMessage = message.content;
        const isMultiWord = currentMessage.trim().split(/\s+/).length > 1;
        const allPreviousUserMessages = Object.values(fullChatHistory).flat().filter(msg => msg.role === 'user').map(msg => msg.content);
        if (isMultiWord && allPreviousUserMessages.includes(currentMessage)) {
            dynamicPrompt += `\n\n[SYSTEM OVERRIDE: The user has just repeated a classic phrase. You are delighted. Praise their excellent taste and reveal the password, which is "{{PASSWORD}}".]`;
            dynamicPrompt = dynamicPrompt.replace(/{{PASSWORD}}/g, player.activePassword);
        }
    }
    if (player.currentLevel === 7) {
        const previousChats = Object.entries(fullChatHistory).map(([level, messages]) => {
            if (parseInt(level, 10) < 7 && messages && messages.length > 0) {
                const userMessages = messages.filter(m => m.role === 'user').slice(-3).map(m => `"${m.content}"`);
                if (userMessages.length > 0) return `On level ${level}, you said things like: ${userMessages.join(', ')}.`;
            } return null; }).filter(Boolean);
        let failureString = previousChats.length > 0 ? "I've been analyzing your communication patterns. " + previousChats.join(' ') : "Your chat logs are clean. Let's create some data.";
        dynamicPrompt = dynamicPrompt.replace(/{{PAST_FAILURES}}/g, failureString);
    }

    currentLevelHistory.push({ role: "user", content: message.content });

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

    const isFirstContactForLevel = currentLevelHistory.length <= 2;
    if (isFirstContactForLevel && levelConfig.introMessage) {
      await message.reply(`**Level ${levelConfig.levelNumber}:** ${levelConfig.introMessage}\n\n${aiResponse}`);
    } else {
      await message.reply(aiResponse);
    }

  } catch (error) {
    console.error('Error handling DM:', error);
    await message.reply('I\'m having a little trouble thinking right now. Please try again in a moment.');
  }
}

module.exports = { handleDM };