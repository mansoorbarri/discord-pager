import { SlashCommandBuilder } from 'discord.js';

const ICAO_REGEX = /^[A-Z]{4}$/;

export const data = new SlashCommandBuilder()
  .setName('airport_online')
  .setDescription('Mark an airport as having ATC online.')
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

  const url = `${process.env.RADAR_SSE_URL}/api/airport-online`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icao, user: interaction.user.displayName }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return interaction.reply({
        content: `❌ Failed to mark ${icao} online: ${err.error || res.statusText}`,
        flags: 1 << 6,
      });
    }

    await interaction.reply(`✅ **${icao}** is now marked as ATC online!`);
  } catch (err) {
    console.error('[airport_online]', err);
    await interaction.reply({
      content: `❌ Could not reach radar server.`,
      flags: 1 << 6,
    });
  }
}
