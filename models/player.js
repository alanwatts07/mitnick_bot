// /models/player.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Player = sequelize.define('Player', {
    discordId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
    },
    currentLevel: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
    },
    activePassword: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    attempts: {
        type: DataTypes.JSON,
        defaultValue: {},
    },
    failedSubmissions: {
        type: DataTypes.JSON,
        defaultValue: {},
    },
    chatHistory: {
        type: DataTypes.JSON,
        defaultValue: {},
    },
    // --- NEW FIELD ---
    // Stores the score for each completed level.
    // e.g., { "1": 95, "2": 88 }
    levelScores: {
        type: DataTypes.JSON,
        defaultValue: {},
    }
});

module.exports = Player;