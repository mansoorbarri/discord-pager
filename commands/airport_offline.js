import { SlashCommandBuilder } from 'discord.js';

const ICAO_REGEX = /^[A-Z]{4}$/;

export const data = new SlashCommandBuilder()
  .setName('airport_offline')
  .setDescription('Mark an airport as no longer having ATC online.')
  .addStringOption(option =>
    option
      .setName('icao')
      .setDescription('ICAO code of the airport (e.g. KJFK)')
      .setRequired(true)
  );

export async function execute(interaction) {
  const icao = interaction.options.getString('icao').toUpperCase();

  if (!ICAO_REGEX.test(icao)) {
    return interaction.reply({
      content: `❌ Invalid ICAO code: \`${icao}\`. Must be exactly 4 letters.`,
      flags: 1 << 6,
    });
  }

  const url = `${process.env.RADAR_SSE_URL}/api/airport-offline`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icao }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return interaction.reply({
        content: `❌ Failed to mark ${icao} offline: ${err.error || res.statusText}`,
        flags: 1 << 6,
      });
    }

    await interaction.reply(`✅ **${icao}** ATC is now marked as offline.`);
  } catch (err) {
    console.error('[airport_offline]', err);
    await interaction.reply({
      content: `❌ Could not reach radar server.`,
      flags: 1 << 6,
    });
  }
}
