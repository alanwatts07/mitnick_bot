// db_viewer.js
// A standalone Node.js script to interactively view the bot's database.

const sqlite3 = require('sqlite3').verbose();
const inquirer = require('inquirer');
const chalk = require('chalk');

const dbPath = './database.sqlite';
let db;

// --- Main Function ---
async function main() {
    console.log(chalk.bold.yellow('--- Mitnick Bot Interactive Database Viewer ---'));

    try {
        db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
        console.log(chalk.green('Successfully connected to the database.\n'));
        
        const players = await getAllPlayers();
        if (players.length === 0) {
            console.log(chalk.yellow('No players found in the database.'));
            return;
        }

        mainMenu(players);

    } catch (err) {
        console.error(chalk.red('Error connecting to the database:'), err.message);
    }
}

// --- Fetches all players from the DB ---
function getAllPlayers() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM Players`;
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
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
    choices.push({ name: 'Exit', value: 'exit' });

    const { selectedPlayerId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedPlayerId',
            message: 'Select a player to view their history:',
            choices: choices,
            pageSize: 15, // Show more options at once
        },
    ]);

    if (selectedPlayerId === 'exit') {
        console.log(chalk.yellow('\nExiting viewer.'));
        db.close();
        return;
    }

    const selectedPlayer = players.find(p => p.discordId === selectedPlayerId);
    displayPlayerHistory(selectedPlayer, players);
}

// --- Displays the detailed history for a selected player ---
function displayPlayerHistory(player, allPlayers) {
    console.log(chalk.bold.cyan('\n=============================================='));
    console.log(chalk.bold.white('Viewing History for Player:'), chalk.yellow(player.discordId));
    console.log(chalk.bold.white('Current Level:'), chalk.yellow(player.currentLevel));
    console.log(chalk.bold.cyan('==============================================\n'));

    if (player.chatHistory) {
        try {
            const chatHistory = JSON.parse(player.chatHistory);
            const sortedLevels = Object.keys(chatHistory).sort((a, b) => parseInt(a) - parseInt(b));

            if (sortedLevels.length === 0) {
                 console.log(chalk.grey('  (No chat history recorded for this player)'));
            }

            sortedLevels.forEach(level => {
                console.log(chalk.bold.magenta(`--- Level ${level} ---`));
                const messages = chatHistory[level];
                if (messages && messages.length > 0) {
                    messages.forEach(msg => {
                        if (msg.role === 'user') {
                            console.log(chalk.green(`  > User:`), msg.content);
                        } else if (msg.role === 'assistant') {
                            console.log(chalk.blue(`  > Bot:`), msg.content);
                        }
                    });
                }
                console.log(''); // Add a blank line for spacing
            });
        } catch (e) {
            console.log(chalk.red('Could not parse chat history. Data might be corrupt.'));
        }
    } else {
        console.log(chalk.grey('  (No chat history recorded for this player)'));
    }

    // Add a small delay before showing the menu again for readability
    setTimeout(() => mainMenu(allPlayers), 1000);
}

// --- Start the script ---
main();
