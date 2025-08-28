// /models/level.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Level = sequelize.define('Level', {
    levelNumber: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
    },
    // This will now store an array of objects, like: [{ value: 'bork', used: false }]
    passwords: {
        type: DataTypes.JSON,
        allowNull: false,
    },
});

module.exports = Level;
