// /database.js
const { Sequelize } = require('sequelize');
const { database } = require('./config.json');

const sequelize = new Sequelize(database);

module.exports = sequelize;