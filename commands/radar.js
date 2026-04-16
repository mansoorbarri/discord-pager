// commands/radar.js
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('radar')
  .setDescription('Provides instructions for the radar addon.');

export async function execute(interaction) {
  const message = `
To use the radar addon, please follow these steps:

1. Make sure you have Tampermonkey installed: <https://www.tampermonkey.net/>
2. Enable Developer Mode and allow user scripts:
   - Go to your browser's extensions page (e.g., \`chrome://extensions\`)
   - Toggle on **Developer mode** in the top right corner
   - Click on Tampermonkey to expand its details
   - Enable **"Allow user scripts"** (this is required for Tampermonkey to work)
3. If you're using Tampermonkey, install the radar addon script here: <https://radarthing.com/userscript>
4. You can also copy-paste the code manually from <https://radarthing.com/loader>, but that is still not recommended.
5. After installing the script, go to GeoFS and ensure you have entered your departure, arrival, and callsign, then clicked "Save".
6. Now, you should be able to see yourself at: https://radarthing.com
    `;
  await interaction.reply({ content: message });
}
