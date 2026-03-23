import { SlashCommandBuilder } from 'discord.js';
import { createReminder, lookupUserByDiscordUsername } from '../services/reminderApi.js';
import { getAircraftSnapshot, registerReminder } from '../services/reminderWatcher.js';

const minIntervalSeconds = 3;
const maxIntervalSeconds = 300;
const minDurationSeconds = 30;
const maxDurationSeconds = 3600;

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function parseFlightPlan(flightPlan) {
  if (!flightPlan) return [];

  try {
    const parsed = JSON.parse(flightPlan);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findAircraftForUser(googleId, callsign) {
  return getAircraftSnapshot().find(
    aircraft =>
      aircraft.googleId === googleId &&
      normalize(aircraft.callsign) === normalize(callsign)
  );
}

function hasWaypoint(aircraft, waypointIdent) {
  const ident = normalize(waypointIdent);
  return parseFlightPlan(aircraft.flightPlan).some(
    waypoint => normalize(waypoint?.ident) === ident
  );
}

export const data = new SlashCommandBuilder()
  .setName('remind')
  .setDescription('Ping yourself on Discord after reaching a flight plan waypoint.')
  .addStringOption(option =>
    option
      .setName('callsign')
      .setDescription('Your live flight callsign')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('waypoint')
      .setDescription('Waypoint ident to trigger the reminder at')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('interval')
      .setDescription(`Reminder interval in seconds (${minIntervalSeconds}-${maxIntervalSeconds})`)
      .setRequired(true)
      .setMinValue(minIntervalSeconds)
      .setMaxValue(maxIntervalSeconds)
  )
  .addIntegerOption(option =>
    option
      .setName('duration')
      .setDescription(`Reminder duration in seconds (${minDurationSeconds}-${maxDurationSeconds})`)
      .setRequired(true)
      .setMinValue(minDurationSeconds)
      .setMaxValue(maxDurationSeconds)
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: 1 << 6 });

  const callsign = normalize(interaction.options.getString('callsign'));
  const waypointIdent = normalize(interaction.options.getString('waypoint'));
  const intervalSeconds = interaction.options.getInteger('interval');
  const durationSeconds = interaction.options.getInteger('duration');

  const lookup = await lookupUserByDiscordUsername(interaction.user.username);

  if (!lookup.found || !lookup.user) {
    await interaction.editReply(
      'Your Discord account is not connected to RadarThing. Connect it at https://radarthing.com/dashboard and try again.'
    );
    return;
  }

  if (!lookup.user.googleId) {
    await interaction.editReply(
      'Your RadarThing account is missing a linked flight identity right now. Open https://radarthing.com and make sure your GeoFS identity is being tracked first.'
    );
    return;
  }

  const aircraft = findAircraftForUser(lookup.user.googleId, callsign);
  if (!aircraft) {
    await interaction.editReply(
      `No live flight was found for **${callsign}** on your connected RadarThing account. Make sure the callsign is yours and the flight is currently visible on the radar.`
    );
    return;
  }

  if (!hasWaypoint(aircraft, waypointIdent)) {
    await interaction.editReply(
      `Waypoint **${waypointIdent}** was not found in the current flight plan for **${callsign}**.`
    );
    return;
  }

  const createResponse = await createReminder({
    userId: lookup.user.id,
    googleId: lookup.user.googleId,
    discordUsername: lookup.user.discordUsername || interaction.user.username,
    discordUserId: interaction.user.id,
    callsign,
    waypointIdent,
    intervalSeconds,
    durationSeconds,
  });

  await registerReminder({
    _id: createResponse.reminderId,
    userId: lookup.user.id,
    googleId: lookup.user.googleId,
    discordUsername: lookup.user.discordUsername || interaction.user.username,
    discordUserId: interaction.user.id,
    callsign,
    waypointIdent,
    intervalSeconds,
    durationSeconds,
    status: 'armed',
    createdAt: Date.now(),
  });

  await interaction.editReply(
    `Reminder armed for **${callsign}** at **${waypointIdent}**. I will DM you every **${intervalSeconds}s** for **${durationSeconds}s** after that waypoint is reached.`
  );
}
