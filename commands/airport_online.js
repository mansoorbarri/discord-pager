import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

const ICAO_REGEX = /^[A-Z]{4}$/;
const REQUIRED_ROLE_ID = '1377626143838048426';

const POSITION_LABELS = {
  control: 'Control (Approach/Departure)',
  tower: 'Tower',
  ground: 'Ground',
  delivery: 'Delivery (Clearance)',
};

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
  if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
    return interaction.reply({
      content: `You need the <@&${REQUIRED_ROLE_ID}> role to use this command.`,
      flags: 1 << 6,
    });
  }

  const icao = interaction.options.getString('icao').toUpperCase();

  if (!ICAO_REGEX.test(icao)) {
    return interaction.reply({
      content: `Invalid ICAO code: \`${icao}\`. Must be exactly 4 letters.`,
      flags: 1 << 6,
    });
  }

  const url = `${process.env.RADAR_SSE_URL}/api/airport-online`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        icao,
        user: interaction.user.displayName,
        discordUserId: interaction.user.id,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success && !data.needsSelection) {
      return interaction.reply({
        content: `**${icao}** is now marked as ATC online! You are covering **${POSITION_LABELS[data.position] || data.position}**.`,
        flags: 1 << 6,
      });
    }

    if (data.needsSelection) {
      // Show current controllers and ask for position selection
      const currentInfo = data.existingControllers
        .map(c => `  - **${POSITION_LABELS[c.position] || c.position}**: ${c.user}`)
        .join('\n');

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`atc_position:${icao}`)
        .setPlaceholder('Select your ATC position')
        .addOptions(
          data.availablePositions.map(pos => ({
            label: POSITION_LABELS[pos] || pos,
            value: pos,
            description: `Staff ${pos} at ${icao}`,
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return interaction.reply({
        content: `**${icao}** already has active ATC:\n${currentInfo}\n\nSelect which position you'd like to staff:`,
        components: [row],
        flags: 1 << 6,
      });
    }

    // Error from server
    return interaction.reply({
      content: `Failed to mark ${icao} online: ${data.error || res.statusText}`,
      flags: 1 << 6,
    });
  } catch (err) {
    console.error('[airport_online]', err);
    await interaction.reply({
      content: `Could not reach radar server.`,
      flags: 1 << 6,
    });
  }
}

// Handle the position select menu interaction
export async function handlePositionSelect(interaction) {
  const [, icao] = interaction.customId.split(':');

  const position = interaction.values[0];
  const url = `${process.env.RADAR_SSE_URL}/api/airport-online`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        icao,
        user: interaction.user.displayName,
        discordUserId: interaction.user.id,
        position,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      return interaction.update({
        content: `**${icao}** — You are now staffing **${POSITION_LABELS[position] || position}**!`,
        components: [],
      });
    }

    return interaction.update({
      content: `Failed to assign ${position} at ${icao}: ${data.error || res.statusText}`,
      components: [],
    });
  } catch (err) {
    console.error('[atc_position_select]', err);
    return interaction.update({
      content: `Could not reach radar server.`,
      components: [],
    });
  }
}
