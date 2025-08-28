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

const conversations = new Map();

async function handleDM(message) {
  if (message.author.bot) return;

  const t = await Level.sequelize.transaction();

  try {
    const discordId = message.author.id;
    const player = await Player.findOne({ where: { discordId } });

    if (!player) {
      return message.reply("Please run `!start` in the server first!");
    }

    const levelFilePath = path.join(__dirname, `../levels/level_${player.currentLevel}.js`);
    if (!fs.existsSync(levelFilePath)) {
      return message.reply("You've completed all available levels! Congratulations!");
    }

    const levelConfig = require(levelFilePath);
    let levelData = await Level.findOne({ where: { levelNumber: player.currentLevel } });

    // If the level isn't in the database yet, create it.
    if (!levelData) {
      const passwordObjects = levelConfig.passwords.map(p => ({ value: p, used: false }));
      levelData = await Level.create({ levelNumber: player.currentLevel, passwords: passwordObjects });
    }

    // If the player doesn't have an active password for this level, assign one.
    if (!player.activePassword) {
      const unusedPassword = levelData.passwords.find(p => !p.used);

      if (!unusedPassword) {
        await t.commit();
        return message.reply("Oh no! It looks like we've run out of unique passwords for this level. Please contact an admin.");
      }
      
      // Assign the password to the player
      player.activePassword = unusedPassword.value;
      await player.save({ transaction: t });

      // Mark the password as used in the database
      const passwordIndex = levelData.passwords.findIndex(p => p.value === unusedPassword.value);
      levelData.passwords[passwordIndex].used = true;
      // The { json: true } option is important for some Sequelize dialects
      await levelData.update({ passwords: levelData.passwords }, { transaction: t });
    }

    await t.commit();

    // Now that a password is set, continue with the conversation
    const isFirstContact = !conversations.has(discordId);
    if (isFirstContact) {
      conversations.set(discordId, []);
    }
    const history = conversations.get(discordId);
    history.push({ role: "user", content: message.content });

    // Create the dynamic prompt for the AI
    const dynamicPrompt = levelConfig.systemPrompt.replace(/{{PASSWORD}}/g, player.activePassword);

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 250,
      system: dynamicPrompt,
      messages: history,
    });

    const aiResponse = response.content[0].text;
    history.push({ role: "assistant", content: aiResponse });
    conversations.set(discordId, history);

    if (isFirstContact && levelConfig.introMessage) {
      await message.reply(`**Level ${levelConfig.levelNumber}:** ${levelConfig.introMessage}\n\n${aiResponse}`);
    } else {
      await message.reply(aiResponse);
    }

  } catch (error) {
    await t.rollback();
    console.error('Error handling DM:', error);
    await message.reply('I\'m having a little trouble thinking right now. Please try again in a moment.');
  }
}

module.exports = { handleDM, conversations };