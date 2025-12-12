import { SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('atis')
  .setDescription('Get current ATIS information for an airport.')
  .addStringOption(opt =>
    opt.setName('icao').setDescription('Airport ICAO code (e.g. KLAX, EGLL)').setRequired(true)
  );

export async function execute(interaction) {
  const icao = interaction.options.getString('icao').toUpperCase();
  await interaction.deferReply();

  const headers = process.env.AVWX_TOKEN
    ? { Authorization: `Bearer ${process.env.AVWX_TOKEN}` }
    : {};

  try {
    // Try AVWX first
    let res = await fetch(`https://avwx.rest/api/atis/${icao}?format=json`, { headers });

    if (res.status === 404 || res.status === 401) {
      // Fallback to METAR if ATIS not available
      const alt = await fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`);
      const text = (await alt.text()).trim();
      if (text) {
        return await interaction.editReply(
          `❌ No ATIS for **${icao}** — showing METAR instead:\n> ${text}`
        );
      } else {
        return await interaction.editReply(`❌ No ATIS or METAR available for **${icao}**.`);
      }
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const reply = [
      `**${data.station ?? icao} ATIS**`,
      data.information ? `Information ${data.information}` : '',
      data.raw ? `> ${data.raw}` : '',
      data.speech ? `**Speech:**\n> ${data.speech}` : '',
    ].filter(Boolean);

    await interaction.editReply(reply.join('\n'));
  } catch (err) {
    console.error(err);
    await interaction.editReply(`❌ Error fetching ATIS for **${icao}**.`);
  }
}