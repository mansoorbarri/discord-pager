import { SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('metar')
  .setDescription('Get current METAR (weather data) for an airport.')
  .addStringOption(option =>
    option
      .setName('icao')
      .setDescription('The ICAO code of the airport (e.g. KJFK, EGLL)')
      .setRequired(true)
  );

export async function execute(interaction) {
  const icao = interaction.options.getString('icao').toUpperCase();

  await interaction.deferReply(); // gives us a moment to fetch

  try {
    const response = await fetch(`https://avwx.rest/api/metar/${icao}?format=json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (!data || !data.raw) {
      return interaction.editReply(`❌ No METAR found for ${icao}.`);
    }

    const reply = [
      `**${data.station} METAR**`,
      `> ${data.raw}`,
      '',
      `**Flight Rules:** ${data.flight_rules}`,
      `**Temperature:** ${data.temperature?.value ?? 'N/A'}°C`,
      `**Wind:** ${data.wind_direction?.repr ?? 'Variable'}° @ ${data.wind_speed?.repr ?? '0'} kt`,
      `**Visibility:** ${data.visibility?.repr ?? 'N/A'} sm`,
      `**Time:** ${data.time?.dt ?? 'unknown'} UTC`
    ].join('\n');

    await interaction.editReply(reply);
  } catch (err) {
    console.error(err);
    await interaction.editReply(`❌ Error fetching METAR for ${icao}. Check the code or try again.`);
  }
}