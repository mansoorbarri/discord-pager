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
    const response = await fetch(`https://avwx.rest/api/atis/${icao}?format=json`, {
      headers: { Authorization: `Bearer ${process.env.AVWX_TOKEN}` },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data || (!data.speech && !data.raw)) {
      return interaction.editReply(`❌ No ATIS found for ${icao}.`);
    }

    const reply = [
      `**${data.station} ATIS**`,
      data.information ? `Information ${data.information}` : '',
      '',
      data.raw ? `> ${data.raw}` : '',
      '',
      data.speech ? `**Speech:**\n> ${data.speech}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await interaction.editReply(reply);
  } catch (err) {
    console.error(err);
    await interaction.editReply(`❌ Error fetching ATIS for ${icao}. Check the code or try again.`);
  }
}