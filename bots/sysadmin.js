// /bots/sysadmin.js
// This file defines functions that the Sysadmin bot can execute.
// The main logic is triggered by commands.

// A map of levels to the role IDs that should be awarded.
// You need to get the Role ID from your Discord Server (Right-click role -> Copy ID)
const roleRewards = {
    // Example: 5: 'ROLE_ID_FOR_LEVEL_5',
    //         10: 'ROLE_ID_FOR_LEVEL_10'
};

/**
 * Checks if a player has earned a new role and assigns it.
 * @param {GuildMember} member The Discord guild member object.
 * @param {number} newLevel The new level the player has reached.
 */
async function assignRole(member, newLevel) {
    const roleId = roleRewards[newLevel];
    if (!roleId) {
        // No role reward for this level
        return;
    }

    try {
        const role = await member.guild.roles.fetch(roleId);
        if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
            console.log(`Assigned role ${role.name} to ${member.user.username}`);
            // Optionally, send the user a DM that they've earned a new role
            member.send(`Congratulations! You've earned the **${role.name}** role in the server!`).catch(console.error);
        }
    } catch (error) {
        console.error(`Could not assign role with ID ${roleId}:`, error);
    }
}

module.exports = { assignRole };