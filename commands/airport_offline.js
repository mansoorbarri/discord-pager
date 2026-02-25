import { SlashCommandBuilder } from 'discord.js';

const ICAO_REGEX = /^[A-Z]{4}$/;
const ALLOWED_CHANNEL_ID = '1378978564367581195';
const REQUIRED_ROLE_ID = '1377626143838048426';
const ADMIN_ROLE_ID = '1377624537386188883';

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
  if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({
      content: `❌ This command can only be used in <#${ALLOWED_CHANNEL_ID}>.`,
      flags: 1 << 6,
    });
  }

  if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
    return interaction.reply({
      content: `❌ You need the <@&${REQUIRED_ROLE_ID}> role to use this command.`,
      flags: 1 << 6,
    });
  }

  const icao = interaction.options.getString('icao').toUpperCase();

  if (!ICAO_REGEX.test(icao)) {
    return interaction.reply({
      content: `❌ Invalid ICAO code: \`${icao}\`. Must be exactly 4 letters.`,
      flags: 1 << 6,
    });
  }

  const isAdmin = interaction.member.roles.cache.has(ADMIN_ROLE_ID);
  const url = `${process.env.RADAR_SSE_URL}/api/airport-offline`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        icao,
        discordUserId: interaction.user.id,
        isAdmin,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return interaction.reply({
        content: `❌ Failed to mark ${icao} offline: ${err.error || res.statusText}`,
        flags: 1 << 6,
      });
    }

    await interaction.reply({
      content: `✅ **${icao}** ATC is now marked as offline.`,
      flags: 1 << 6,
    });
  } catch (err) {
    console.error('[airport_offline]', err);
    await interaction.reply({
      content: `❌ Could not reach radar server.`,
      flags: 1 << 6,
    });
  }
}
