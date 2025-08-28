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
    // NEW FIELD: This will store the entire chat history for each level.
    // e.g., { "1": [{ role: "user", content: "..." }, { role: "assistant", content: "..." }] }
    chatHistory: {
        type: DataTypes.JSON,
        defaultValue: {},
    },
});

module.exports = Player;