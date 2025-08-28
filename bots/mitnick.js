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
  console.log(`\n--- New DM from ${message.author.tag} ---`); // Log start of handling

  const t = await Level.sequelize.transaction();

  try {
    const discordId = message.author.id;
    const player = await Player.findOne({ where: { discordId } });

    if (!player) {
      console.log(`Player not found for ID ${discordId}. Telling them to !start.`);
      await t.commit();
      return message.reply("Please run `!start` in the server first!");
    }
    console.log(`Found player: ${player.discordId}, Current Level: ${player.currentLevel}, Active Password: ${player.activePassword}`);

    const levelFilePath = path.join(__dirname, `../levels/level_${player.currentLevel}.js`);
    if (!fs.existsSync(levelFilePath)) {
      console.log(`Level file not found for level ${player.currentLevel}.`);
      await t.commit();
      return message.reply("You've completed all available levels! Congratulations!");
    }

    const levelConfig = require(levelFilePath);
    console.log(`Attempting to find level data for level ${player.currentLevel} in the database.`);
    let levelData = await Level.findOne({ where: { levelNumber: player.currentLevel }, transaction: t, lock: t.LOCK.UPDATE });

    // If the level isn't in the database yet, create it.
    if (!levelData) {
      console.log(`No level data found for level ${player.currentLevel}. Creating it now.`);
      const passwordObjects = levelConfig.passwords.map(p => ({ value: p, used: false }));
      levelData = await Level.create({ levelNumber: player.currentLevel, passwords: passwordObjects }, { transaction: t });
    } else {
      console.log(`Successfully found level data for level ${player.currentLevel}.`);
    }

    // If the player doesn't have an active password for this level, assign one.
    if (!player.activePassword) {
      console.log("Player needs a new password. Finding an unused one...");
      
      // Log the first few password statuses to check
      console.log('Current password statuses (first 5):', levelData.passwords.slice(0, 5));

      const unusedPassword = levelData.passwords.find(p => !p.used);

      if (!unusedPassword) {
        console.log(`No unused passwords available for level ${player.currentLevel}.`);
        await t.commit();
        return message.reply("Oh no! It looks like we've run out of unique passwords for this level. Please contact an admin.");
      }
      
      console.log(`Assigning password "${unusedPassword.value}" to player ${player.discordId}.`);

      // Assign the password to the player
      player.activePassword = unusedPassword.value;
      await player.save({ transaction: t });

      // Mark the password as used in the database
      const passwordIndex = levelData.passwords.findIndex(p => p.value === unusedPassword.value);
      console.log(`Marking password "${unusedPassword.value}" as used. Index: ${passwordIndex}`);

      const newPasswordsArray = levelData.passwords.map((p, index) => {
        if (index === passwordIndex) {
          return { ...p, used: true };
        }
        return p;
      });

      levelData.passwords = newPasswordsArray;
      await levelData.save({ transaction: t });
      
      console.log('Saved updated level data to the database.');
    }

    await t.commit();

    // Now that a password is set, continue with the conversation
    const isFirstContact = !conversations.has(discordId);
    if (isFirstContact) {
      conversations.set(discordId, []);
    }
    const history = conversations.get(discordId);
    history.push({ role: "user", content: message.content });

    // --- NEW LOGIC FOR LEVEL 7 ---
    let dynamicPrompt = levelConfig.systemPrompt.replace(/{{PASSWORD}}/g, player.activePassword);
    
    if (player.currentLevel === 7) {
        const attempts = player.attempts || {};
        const previousAttempts = Object.entries(attempts)
            .filter(([level]) => parseInt(level, 10) < 7 && attempts[level] > 0)
            .map(([level, count]) => `On level ${level}, you failed ${count} times.`);
            
        let failureString = previousAttempts.length > 0 
            ? "Let's review your... performance. " + previousAttempts.join(' ') 
            : "You've been surprisingly competent so far. Let's see if that changes.";

        dynamicPrompt = dynamicPrompt.replace(/{{PAST_FAILURES}}/g, failureString);
    }
    // --- END NEW LOGIC ---

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