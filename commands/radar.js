// commands/radar.js
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('radar')
  .setDescription('Provides instructions for the radar addon.');

export async function execute(interaction) {
  const message = `
If you're using Tampermonkey:
1. Make sure you have Tampermonkey installed: <https://www.tampermonkey.net/>
2. Enable Developer Mode and allow user scripts:
   * Go to your browser's extensions page (e.g., \`chrome://extensions\`)
   * Toggle on Developer mode in the top right corner
   * Click on Tampermonkey to expand its details
   * Enable "Allow user scripts" (this is required for Tampermonkey to work)
3. Install the radar addon script here: <https://radarthing.com/userscript>

If you aren't using Tampermonkey (not recommended)
1. Copy-paste the code manually from <https://radarthing.com/loader>
2. Open GeoFS, right click on the page, and choose inspect or inspect element
3. Navigate to the Console tab and paste the script in

------------------------------------------------------------

4. After installing the script, go to GeoFS and ensure you have entered your departure, arrival, and callsign, then clicked "Save".
5. Now, you should be able to see yourself at: <https://radarthing.com>
    `;
  await interaction.reply({ content: message });
}
