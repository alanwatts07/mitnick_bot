// /events/ready.js
const { Events } = require('discord.js');

module.exports = {
    // --- THIS IS THE FIX ---
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
    },
};