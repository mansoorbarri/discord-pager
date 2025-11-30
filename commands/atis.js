import { SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('atis')
  .setDescription('Get the current ATIS information for an airport.')
  .addStringOption(option =>
    option
      .setName('icao')
      .setDescription('The ICAO code of the airport (e.g. KLAX, EGLL)')
      .setRequired(true)
  );

export async function execute(interaction) {
  const icao = interaction.options.getString('icao').toUpperCase();

  await interaction.deferReply();

  try {
    const response = await fetch(`https://avwx.rest/api/atis/${icao}?format=json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data || !data.speech) {
      return interaction.editReply(`❌ No ATIS found for ${icao}.`);
    }

    const reply = [
      `**${data.station} ATIS**`,
      `> ${data.raw ?? 'No text ATIS available'}`,
      '',
      `**Information:** ${data.information ?? 'Unknown'}`,
      `**Speech:**`,
      `> ${data.speech}`,
    ].join('\n');

    await interaction.editReply(reply);
  } catch (err) {
    console.error(err);
    await interaction.editReply(`❌ Error fetching ATIS for ${icao}. Check the code or try again.`);
  }
}