import { listActiveReminders, lookupUserByDiscordUsername } from './reminderApi.js';
import { getAircraftSnapshot } from './reminderWatcher.js';

export const deliveryTargets = {
  dm: 'dm',
  server: 'server',
};

export function normalize(value) {
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

export function findAircraftForUser(googleId, callsign) {
  return getAircraftSnapshot().find(
    aircraft =>
      aircraft.googleId === googleId &&
      (normalize(aircraft.flightNo) === normalize(callsign) ||
        normalize(aircraft.callsign) === normalize(callsign))
  );
}

export function hasWaypoint(aircraft, waypointIdent) {
  const ident = normalize(waypointIdent);
  return parseFlightPlan(aircraft.flightPlan).some(
    waypoint => normalize(waypoint?.ident) === ident
  );
}

export function reminderBelongsToUser(reminder, user) {
  return (
    reminder?.userId === user.id ||
    reminder?.discordUserId === user.discordUserId ||
    reminder?.discordUserId === user.fallbackDiscordUserId ||
    reminder?.discordUsername === user.discordUsername
  );
}

export async function resolveConnectedUser(interaction) {
  const lookup = await lookupUserByDiscordUsername(interaction.user.username);

  if (!lookup.found || !lookup.user) {
    await interaction.editReply(
      'Your Discord account is not connected to RadarThing. Connect it at https://radarthing.com/dashboard and try again.'
    );
    return null;
  }

  if (!lookup.user.googleId) {
    await interaction.editReply(
      'Your RadarThing account is missing a linked flight identity right now. Open https://radarthing.com and make sure your GeoFS identity is being tracked first.'
    );
    return null;
  }

  return {
    ...lookup.user,
    discordUserId: lookup.user.discordUserId || interaction.user.id,
    discordUsername: lookup.user.discordUsername || interaction.user.username,
    fallbackDiscordUserId: interaction.user.id,
  };
}

export async function validateReminderRequest({
  interaction,
  user,
  callsign,
  waypointIdent,
  deliveryTarget,
}) {
  if (deliveryTarget === deliveryTargets.server && !interaction.inGuild()) {
    await interaction.editReply(
      'Server reminders can only be armed from a server channel. Use the command in the channel you want to be pinged in, or choose direct message delivery.'
    );
    return null;
  }

  const aircraft = findAircraftForUser(user.googleId, callsign);
  if (!aircraft) {
    await interaction.editReply(
      `No live flight was found for **${callsign}** on your connected RadarThing account. Make sure the callsign is yours and the flight is currently visible on the radar.`
    );
    return null;
  }

  if (!hasWaypoint(aircraft, waypointIdent)) {
    await interaction.editReply(
      `Waypoint **${waypointIdent}** was not found in the current flight plan for **${callsign}**.`
    );
    return null;
  }

  return aircraft;
}

export function buildReminderPayload({
  interaction,
  user,
  callsign,
  waypointIdent,
  intervalSeconds,
  durationSeconds,
  deliveryTarget,
}) {
  return {
    userId: user.id,
    googleId: user.googleId,
    discordUsername: user.discordUsername,
    discordUserId: user.discordUserId,
    deliveryTarget,
    channelId: deliveryTarget === deliveryTargets.server ? interaction.channelId : null,
    guildId: deliveryTarget === deliveryTargets.server ? interaction.guildId : null,
    callsign,
    waypointIdent,
    intervalSeconds,
    durationSeconds,
  };
}

export async function getUserActiveReminders(user) {
  const data = await listActiveReminders();
  const reminders = Array.isArray(data?.reminders) ? data.reminders : [];

  return reminders
    .filter(reminder => reminderBelongsToUser(reminder, user))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function formatDeliveryTarget(reminder) {
  return reminder.deliveryTarget === deliveryTargets.server ? 'server' : 'DM';
}

export function findMatchingReminder(reminders, callsign, waypointIdent) {
  const normalizedCallsign = normalize(callsign);
  const normalizedWaypoint = normalize(waypointIdent);

  return reminders.find(
    reminder =>
      normalize(reminder.callsign) === normalizedCallsign &&
      normalize(reminder.waypointIdent) === normalizedWaypoint
  );
}
