import { SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('atis')
  .setDescription('Get current ATIS (if available) for an airport.')
  .addStringOption(opt =>
    opt.setName('icao').setDescription('ICAO code (e.g. KLAX, EGLL)').setRequired(true)
  );

export async function execute(interaction) {
  const icao = interaction.options.getString('icao').toUpperCase();
  await interaction.deferReply();

  const headers = process.env.AVWX_TOKEN
    ? { Authorization: `Bearer ${process.env.AVWX_TOKEN}` }
    : {};

  try {
    const res = await fetch(`https://avwx.rest/api/atis/${icao}?format=json`, { headers });
    if (res.status === 404) {
      return await interaction.editReply(`❌ ATIS unavailable for **${icao}**.`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const lines = [
      `**${data.station ?? icao} ATIS**`,
      data.information ? `Information ${data.information}` : '',
      data.raw ? `> ${data.raw}` : '',
      data.speech ? `**Speech:**\n> ${data.speech}` : '',
    ].filter(Boolean);

    await interaction.editReply(lines.join('\n'));
  } catch (err) {
    console.error(err);
    await interaction.editReply(`❌ Could not get ATIS for **${icao}**.`);
  }
}