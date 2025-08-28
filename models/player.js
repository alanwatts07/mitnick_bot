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
    // This new field will store the unique password assigned to the player for their current level.
    activePassword: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    attempts: {
        type: DataTypes.JSON,
        defaultValue: {},
    },
});

module.exports = Player;