import { SlashCommandBuilder } from 'discord.js';
import { findLiveFlightsChannel, liveFlightsChannelMention } from '../config/commandPolicy.js';

const MAX_TEXT_LENGTH = 100;
const MAX_ROUTE_LENGTH = 200;
const CALLSIGN_REGEX = /^[A-Z0-9-]{2,12}$/;
const FLIGHT_NUMBER_REGEX = /^[A-Z0-9-]{2,16}$/;
const TIME_REGEX = /^(\d{2}):(\d{2})$/;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeCode(value) {
  return normalizeText(value).toUpperCase();
}

function validateLength(label, value, maxLength) {
  if (!value) {
    return `${label} is required.`;
  }

  if (value.length > maxLength) {
    return `${label} must be ${maxLength} characters or fewer.`;
  }

  return null;
}

function parseUtcTime(raw) {
  const input = normalizeText(raw);
  const match = input.match(TIME_REGEX);

  if (!match) {
    return { error: 'Use `departure_time` in UTC as `HH:MM`, for example `19:30`.' };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour > 23 || minute > 59) {
    return { error: 'That UTC departure time is not valid.' };
  }

  const now = new Date();
  const timestampSeconds = Math.floor(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      minute,
      0,
      0
    ) / 1000
  );

  return {
    raw: input,
    discordTimestamp: `<t:${timestampSeconds}:t>`,
  };
}

function parseBlockTime(raw) {
  const input = normalizeText(raw);
  const match = input.match(TIME_REGEX);

  if (!match) {
    return { error: 'Use `block_time` as `HH:MM`, for example `02:15`.' };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour > 23 || minute > 59) {
    return { error: 'That block time is not valid.' };
  }

  return { raw: input };
}

function buildFlightPost(details, userId) {
  const radarUrl = `https://radarthing.com/radar?callsign=${encodeURIComponent(details.callsign)}&follow=true`;

  return [
    `**Live Flight**`,
    `Posted by <@${userId}>`,
    `Departure: **${details.departure}**`,
    `Arrival: **${details.arrival}**`,
    `Route: ${details.route}`,
    `Airline: ${details.airline}`,
    `Aircraft: ${details.aircraft}`,
    `Flight Number: **${details.flightNumber}**`,
    `Callsign: **${details.callsign}**`,
    `Block Time: ${details.blockTime}`,
    `Departure Time (UTC): ${details.departureTime.discordTimestamp}`,
    `RadarThing: <${radarUrl}>`,
  ].join('\n');
}

export const data = new SlashCommandBuilder()
  .setName('live_flight')
  .setDescription('Post a same-day live flight into the live-flights channel.')
  .addStringOption(option =>
    option
      .setName('departure')
      .setDescription('Departure airport or location')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('arrival')
      .setDescription('Arrival airport or location')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('route')
      .setDescription('Filed route')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('airline')
      .setDescription('Airline name')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('aircraft')
      .setDescription('Aircraft type')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('flight_number')
      .setDescription('Flight number, for example DAL123')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('callsign')
      .setDescription('RadarThing callsign, for example DAL123')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('block_time')
      .setDescription('Block time, for example 02:15')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('departure_time')
      .setDescription('Departure time in UTC as HH:MM')
      .setRequired(true)
  );

export async function execute(interaction) {
  const departure = normalizeCode(interaction.options.getString('departure'));
  const arrival = normalizeCode(interaction.options.getString('arrival'));
  const route = normalizeCode(interaction.options.getString('route'));
  const airline = normalizeText(interaction.options.getString('airline'));
  const aircraft = normalizeCode(interaction.options.getString('aircraft'));
  const flightNumber = normalizeCode(interaction.options.getString('flight_number'));
  const callsign = normalizeCode(interaction.options.getString('callsign'));
  const blockTime = parseBlockTime(interaction.options.getString('block_time'));
  const departureTime = parseUtcTime(interaction.options.getString('departure_time'));

  const departureError = validateLength('Departure', departure, MAX_TEXT_LENGTH);
  if (departureError) {
    return interaction.reply({ content: departureError, flags: 1 << 6 });
  }

  const arrivalError = validateLength('Arrival', arrival, MAX_TEXT_LENGTH);
  if (arrivalError) {
    return interaction.reply({ content: arrivalError, flags: 1 << 6 });
  }

  const routeError = validateLength('Route', route, MAX_ROUTE_LENGTH);
  if (routeError) {
    return interaction.reply({ content: routeError, flags: 1 << 6 });
  }

  const airlineError = validateLength('Airline', airline, MAX_TEXT_LENGTH);
  if (airlineError) {
    return interaction.reply({ content: airlineError, flags: 1 << 6 });
  }

  const aircraftError = validateLength('Aircraft', aircraft, MAX_TEXT_LENGTH);
  if (aircraftError) {
    return interaction.reply({ content: aircraftError, flags: 1 << 6 });
  }

  if (!FLIGHT_NUMBER_REGEX.test(flightNumber)) {
    return interaction.reply({
      content: 'Use a valid `flight_number` with 2-16 letters, numbers, or hyphens.',
      flags: 1 << 6,
    });
  }

  if (!CALLSIGN_REGEX.test(callsign)) {
    return interaction.reply({
      content: 'Use a valid `callsign` with 2-12 letters, numbers, or hyphens.',
      flags: 1 << 6,
    });
  }

  if (blockTime.error) {
    return interaction.reply({
      content: blockTime.error,
      flags: 1 << 6,
    });
  }

  if (departureTime.error) {
    return interaction.reply({
      content: departureTime.error,
      flags: 1 << 6,
    });
  }

  const liveFlightsChannel = findLiveFlightsChannel(interaction.guild);

  if (!liveFlightsChannel) {
    return interaction.reply({
      content: `I couldn't find the live flights channel. Set \`LIVE_FLIGHTS_CHANNEL_ID\` or create ${liveFlightsChannelMention()}.`,
      flags: 1 << 6,
    });
  }

  await liveFlightsChannel.send({
    content: buildFlightPost(
      {
        departure,
        arrival,
        route,
        airline,
        aircraft,
        flightNumber,
        callsign,
        blockTime: blockTime.raw,
        departureTime,
      },
      interaction.user.id
    ),
  });

  await interaction.reply({
    content: `Your flight was posted in <#${liveFlightsChannel.id}>.`,
    flags: 1 << 6,
  });
}
