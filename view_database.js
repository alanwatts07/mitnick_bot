// A standalone Node.js script to interactively view the bot's database.

const sqlite3 = require('sqlite3').verbose();
const inquirer = require('inquirer');
const chalk = require('chalk');

const dbPath = './database.sqlite';
let db;
let watchingInterval = null; // To keep track of the live watch timer

// --- Main Function ---
async function main() {
    console.log(chalk.bold.yellow('--- Mitnick Bot Interactive Database Viewer ---'));

    // Handle CTRL+C to exit gracefully
    process.on('SIGINT', () => {
        if (watchingInterval) {
            clearInterval(watchingInterval);
            watchingInterval = null;
            console.log(chalk.yellow('\n\nStopped watching. Returning to player list...'));
            refreshAndShowMenu();
        } else {
            console.log(chalk.yellow('\nExiting viewer.'));
            if (db) db.close();
            process.exit(0);
        }
    });

    try {
        db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
        console.log(chalk.green('Successfully connected to the database.\n'));
        refreshAndShowMenu();
    } catch (err) {
        console.error(chalk.red('Error connecting to the database:'), err.message);
    }
}

// --- Fetches a single player by ID and parses their data ---
function getPlayerById(discordId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM Players WHERE discordId = ?`;
        db.get(sql, [discordId], (err, row) => {
            if (err) return reject(err);
            if (row) {
                // Parse JSON fields which are stored as strings
                try {
                    if (row.chatHistory) row.chatHistory = JSON.parse(row.chatHistory);
                    if (row.levelScores) row.levelScores = JSON.parse(row.levelScores);
                } catch (e) {
                    console.error(chalk.red('Database corruption detected: Could not parse player data.'));
                }
            }
            resolve(row);
        });
    });
}


// --- Fetches all players from the DB and parses their data ---
function getAllPlayers() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM Players`;
        db.all(sql, [], (err, rows) => {
            if (err) return reject(err);
            // Parse JSON fields for each player
            rows.forEach(row => {
                 try {
                    if (row.chatHistory) row.chatHistory = JSON.parse(row.chatHistory);
                    if (row.levelScores) row.levelScores = JSON.parse(row.levelScores);
                } catch (e) {
                    console.error(chalk.red(`Database corruption detected for player ${row.discordId}.`));
                }
            });
            resolve(rows);
        });
    });
}

// --- Displays the main player selection menu ---
async function mainMenu(players) {
    const choices = players.map(player => ({
        name: `Player ID: ${player.discordId} (Level ${player.currentLevel})`,
        value: player.discordId,
    }));

    choices.push(new inquirer.Separator());
    choices.push({ name: 'Refresh Player List', value: 'refresh' });
    choices.push({ name: 'Exit', value: 'exit' });

    const { selectedPlayerId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedPlayerId',
            message: 'Select a player to watch their history:',
            choices: choices,
            pageSize: 15,
        },
    ]);

    if (selectedPlayerId === 'exit') {
        console.log(chalk.yellow('\nExiting viewer.'));
        db.close();
        process.exit(0);
    }

    if (selectedPlayerId === 'refresh') {
        refreshAndShowMenu();
        return;
    }

    const selectedPlayer = await getPlayerById(selectedPlayerId);
    watchPlayerHistory(selectedPlayer);
}

// --- Reloads data and shows the main menu ---
async function refreshAndShowMenu() {
    console.log(chalk.bold.blue('\nLoading player data from database...'));
    try {
        const players = await getAllPlayers();
        console.log(chalk.green('Data loaded.\n'));
        mainMenu(players);
    } catch (err) {
        console.error(chalk.red('Error reloading data:'), err.message);
        mainMenu([]); 
    }
}


// --- Displays history and begins watching for new messages ---
function watchPlayerHistory(player) {
    let lastHistoryState = player.chatHistory || {};

    // 1. Clear console and print the full history once
    console.clear();
    console.log(chalk.bold.cyan('=============================================='));
    console.log(chalk.bold.white('Watching History for Player:'), chalk.yellow(player.discordId));
    console.log(chalk.bold.white('Current Level:'), chalk.yellow(player.currentLevel));
    console.log(chalk.bold.cyan('==============================================\n'));
    
    const sortedLevels = Object.keys(lastHistoryState).sort((a, b) => parseInt(a) - parseInt(b));
    if (sortedLevels.length === 0) {
        console.log(chalk.grey('  (No chat history recorded yet)'));
    } else {
        sortedLevels.forEach(level => {
            console.log(chalk.bold.magenta(`--- Level ${level} ---`));
            lastHistoryState[level].forEach(msg => printMessage(msg));
            console.log('');
        });
    }

    // 2. Start polling for new messages
    console.log(chalk.bold.yellow('\n--- Now watching for new messages. Press CTRL+C to go back. ---\n'));

    watchingInterval = setInterval(async () => {
        const latestPlayer = await getPlayerById(player.discordId);
        const newHistoryState = latestPlayer.chatHistory || {};

        for (const level in newHistoryState) {
            const oldMessages = lastHistoryState[level] || [];
            const newMessages = newHistoryState[level];

            if (newMessages.length > oldMessages.length) {
                const newOnes = newMessages.slice(oldMessages.length);
                if (Object.keys(lastHistoryState).indexOf(level) === -1) {
                     console.log(chalk.bold.magenta(`--- Level ${level} ---`));
                }
                newOnes.forEach(msg => printMessage(msg));
                lastHistoryState[level] = newMessages; // Update state
            }
        }
    }, 2000); // Check for new messages every 2 seconds
}

function printMessage(msg) {
    if (msg.role === 'user') {
        console.log(chalk.green(`  > User:`), msg.content);
    } else if (msg.role === 'assistant') {
        console.log(chalk.blue(`  > Bot:`), msg.content);
    }
}

// --- Start the script ---
main();

