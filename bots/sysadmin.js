// /bots/sysadmin.js

// --- CONFIGURATION ---
// Add the Role ID for your "Mitnick" role here.
const MITNICK_ROLE_ID = '1411334989575884902';
// Set the number of completed levels required to earn the Mitnick role.
const LEVELS_REQUIRED_FOR_MITNICK = 15;
// --- END CONFIGURATION ---

const roleRewards = {
    // Example: 5: 'ROLE_ID_FOR_LEVEL_5',
    //         10: 'ROLE_ID_FOR_LEVEL_10'
};

async function assignRole(member, newLevel) {
    const roleId = roleRewards[newLevel];
    if (!roleId) {
        return;
    }
    try {
        const role = await member.guild.roles.fetch(roleId);
        if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
            console.log(`Assigned role ${role.name} to ${member.user.username}`);
            member.send(`Congratulations! You've earned the **${role.name}** role in the server!`).catch(console.error);
        }
    } catch (error) {
        console.error(`Could not assign role with ID ${roleId}:`, error);
    }
}

/**
 * Checks if a player has earned a new role based on total levels completed.
 * @param {GuildMember} member The Discord guild member object.
 * @param {number} completedCount The number of levels the player has completed.
 */
async function checkCompletionRole(member, completedCount) {
    // --- NEW LOGS ---
    console.log('[Sysadmin] Running checkCompletionRole...');
    console.log(`[Sysadmin] Player: ${member.user.username}, Levels Completed: ${completedCount}, Levels Required: ${LEVELS_REQUIRED_FOR_MITNICK}`);
    // --- END NEW LOGS ---

    // Check if the player has completed the required number of levels or more.
    if (completedCount >= LEVELS_REQUIRED_FOR_MITNICK) {
        // --- NEW LOG ---
        console.log(`[Sysadmin] Player qualifies for the role. Checking Role ID...`);
        // --- END NEW LOG ---

        if (!MITNICK_ROLE_ID || MITNICK_ROLE_ID === 'YOUR_MITNICK_ROLE_ID') {
            console.log("[Sysadmin] Mitnick role not assigned: Please replace 'YOUR_MITNICK_ROLE_ID' in sysadmin.js");
            return;
        }
        try {
            const role = await member.guild.roles.fetch(MITNICK_ROLE_ID);
            // Assign the role if the player doesn't already have it.
            if (role && !member.roles.cache.has(role.id)) {
                // --- NEW LOG ---
                console.log(`[Sysadmin] Role "${role.name}" found. Player does not have it. Assigning...`);
                // --- END NEW LOG ---
                await member.roles.add(role);
                console.log(`[Sysadmin] SUCCESS: Awarded completion role ${role.name} to ${member.user.username}`);
                member.send(`**Major Achievement!** For completing ${completedCount} levels, you have earned the prestigious **${role.name}** role!`).catch(console.error);
            } else if (role) {
                // --- NEW LOG ---
                console.log(`[Sysadmin] Player already has the role "${role.name}". No action needed.`);
                // --- END NEW LOG ---
            }
        } catch (error) {
            console.error(`[Sysadmin] ERROR: Could not assign completion role with ID ${MITNICK_ROLE_ID}:`, error);
        }
    } else {
        // --- NEW LOG ---
        console.log('[Sysadmin] Player does not have enough completed levels. No action needed.');
        // --- END NEW LOG ---
    }
}

module.exports = { assignRole, checkCompletionRole };

