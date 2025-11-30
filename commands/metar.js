import { SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('metar')
  .setDescription('Get current METAR (weather data) for an airport.')
  .addStringOption(opt =>
    opt.setName('icao').setDescription('ICAO code (e.g. KJFK, OPKC)').setRequired(true)
  );

export async function execute(interaction) {
  const icao = interaction.options.getString('icao').toUpperCase();
  await interaction.deferReply();

  const headers = process.env.AVWX_TOKEN
    ? { Authorization: `Bearer ${process.env.AVWX_TOKEN}` }
    : {};

  try {
    let response = await fetch(`https://avwx.rest/api/metar/${icao}?format=json`, { headers });

    // If AVWX returns 404 or unauth, fall back to aviationweather.gov text feed
    if (response.status === 404 || response.status === 401) {
      const alt = await fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`);
      if (!alt.ok) throw new Error(`Alt HTTP ${alt.status}`);
      const txt = (await alt.text()).trim();
      if (!txt) throw new Error('No data');
      return await interaction.editReply(`**${icao} METAR**\n> ${txt}`);
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.raw) throw new Error('No METAR data');

    const msg = [
      `**${data.station} METAR**`,
      `> ${data.raw}`,
      '',
      `**Flight Rules:** ${data.flight_rules}`,
      `**Temp:** ${data.temperature?.value ?? 'N/A'}°C`,
      `**Wind:** ${data.wind_direction?.repr ?? 'Var'} @ ${data.wind_speed?.repr ?? 0} kt`,
      `**Visibility:** ${data.visibility?.repr ?? 'N/A'} sm`,
      `**Time:** ${data.time?.dt ?? 'unknown'} UTC`,
    ].join('\n');

    await interaction.editReply(msg);
  } catch (err) {
    console.error(err);
    await interaction.editReply(`❌ Error fetching METAR for **${icao}**.`);
  }
}