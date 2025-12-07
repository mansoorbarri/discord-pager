// commands/radar.js
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('radar')
  .setDescription('Provides instructions for the radar addon.');

export async function execute(interaction) {
  const message = `
To use the radar addon, please follow these steps:

1. Make sure you have Tampermonkey installed: <https://www.tampermonkey.net/>
2. Make sure you have installed the radar addon script: <https://xyzmani.com/radar>
3. After installing the script, go to GeoFS and ensure you have entered your departure, arrival, and callsign, then clicked "Save".
    `;
  await interaction.reply({ content: message });
}
