import { SlashCommandBuilder } from 'discord.js';
import {
  assignController,
  cancelAtcSchedule,
  createAtcSchedule,
  formatScheduleTimestamp,
  getAtcSchedule,
  getControllerLimit,
  listGuildSchedules,
  unassignController,
} from '../services/atcScheduleStore.js';

const PILOT_ROLE_ID = '1377626281897754687';
const ATC_ROLE_ID = '1377626143838048426';
const ICAO_REGEX = /^[A-Z]{4}$/;
const CALLSIGN_REGEX = /^[A-Z0-9-]{2,12}$/;
const MAX_NOTES_LENGTH = 300;
const MAX_LOOKAHEAD_DAYS = 30;

function hasPilotRole(interaction) {
  return interaction.member.roles.cache.has(PILOT_ROLE_ID);
}

function hasAtcRole(interaction) {
  return interaction.member.roles.cache.has(ATC_ROLE_ID);
}

function normalizeIcao(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeCallsign(value) {
  return String(value || '').trim().toUpperCase();
}

function parseRequestedTime(raw) {
  const input = String(raw || '').trim();
  if (!input) {
    return { error: 'Provide a time in `YYYY-MM-DD HH:MM` format, or a Discord timestamp like `<t:1767225600:F>`.' };
  }

  const discordMatch = input.match(/^<t:(\d{9,}):[a-zA-Z]>$/);
  if (discordMatch) {
    const timestamp = Number(discordMatch[1]) * 1000;
    return Number.isFinite(timestamp) ? { timestamp } : { error: 'Invalid Discord timestamp.' };
  }

  const unixMatch = input.match(/^\d{10}$/);
  if (unixMatch) {
    return { timestamp: Number(input) * 1000 };
  }

  const normalized = input.replace('T', ' ');
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/
  );

  if (!match) {
    return { error: 'Use `YYYY-MM-DD HH:MM` in UTC, for example `2026-04-02 19:30`.' };
  }

  const [, yearText, monthText, dayText, hourText = '00', minuteText = '00'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  const timestamp = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(timestamp);

  if (
    !Number.isFinite(timestamp) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  ) {
    return { error: 'That date/time is not valid.' };
  }

  return { timestamp };
}

function describeControllers(schedule) {
  if (!schedule.controllers.length) {
    return 'No controllers assigned yet.';
  }

  return schedule.controllers
    .map((controller, index) => `${index + 1}. <@${controller.userId}>`)
    .join('\n');
}

function formatScheduleLine(schedule) {
  const controllerSummary = schedule.controllers.length
    ? schedule.controllers.map(controller => `<@${controller.userId}>`).join(', ')
    : 'none yet';
  const notesSuffix = schedule.notes ? ` | notes: ${schedule.notes}` : '';

  return `**${schedule.id}** | ${schedule.callsign} | ${schedule.airport} | ${formatScheduleTimestamp(schedule.requestedTime)} | pilot: <@${schedule.pilotId}> | controllers (${schedule.controllers.length}/${getControllerLimit()}): ${controllerSummary}${notesSuffix}`;
}

async function handleCreate(interaction) {
  if (!hasPilotRole(interaction)) {
    return interaction.reply({
      content: `You need the <@&${PILOT_ROLE_ID}> role to create an ATC request.`,
      flags: 1 << 6,
    });
  }

  const airport = normalizeIcao(interaction.options.getString('airport'));
  const callsign = normalizeCallsign(interaction.options.getString('callsign'));
  const notes = String(interaction.options.getString('notes') || '').trim();
  const rawTime = interaction.options.getString('time');

  if (!ICAO_REGEX.test(airport)) {
    return interaction.reply({
      content: `Invalid ICAO code: \`${airport}\`. Use exactly 4 letters.`,
      flags: 1 << 6,
    });
  }

  if (!CALLSIGN_REGEX.test(callsign)) {
    return interaction.reply({
      content: `Invalid callsign: \`${callsign}\`. Use 2-12 letters, numbers, or hyphens.`,
      flags: 1 << 6,
    });
  }

  if (notes.length > MAX_NOTES_LENGTH) {
    return interaction.reply({
      content: `Notes are too long. Keep them under ${MAX_NOTES_LENGTH} characters.`,
      flags: 1 << 6,
    });
  }

  const parsedTime = parseRequestedTime(rawTime);
  if (parsedTime.error) {
    return interaction.reply({
      content: parsedTime.error,
      flags: 1 << 6,
    });
  }

  const now = Date.now();
  const latestAllowed = now + MAX_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;

  if (parsedTime.timestamp < now) {
    return interaction.reply({
      content: 'The requested time must be in the future.',
      flags: 1 << 6,
    });
  }

  if (parsedTime.timestamp > latestAllowed) {
    return interaction.reply({
      content: `Requests can only be scheduled up to ${MAX_LOOKAHEAD_DAYS} days ahead.`,
      flags: 1 << 6,
    });
  }

  const schedule = await createAtcSchedule({
    guildId: interaction.guildId,
    pilotId: interaction.user.id,
    pilotName: interaction.member.displayName || interaction.user.username,
    airport,
    callsign,
    requestedTime: parsedTime.timestamp,
    notes,
  });

  await interaction.reply({
    content: `ATC request created.\nID: **${schedule.id}**\nFlight: **${schedule.callsign}** into **${schedule.airport}**\nTime: ${formatScheduleTimestamp(schedule.requestedTime)}\nControllers: 0/${getControllerLimit()}\nATC members can now claim this with \`/atc_schedule assign request_id:${schedule.id}\`.`,
    flags: 1 << 6,
  });
}

async function handleList(interaction) {
  if (!hasPilotRole(interaction) && !hasAtcRole(interaction)) {
    return interaction.reply({
      content: `You need either the <@&${PILOT_ROLE_ID}> or <@&${ATC_ROLE_ID}> role to view ATC schedules.`,
      flags: 1 << 6,
    });
  }

  const airport = interaction.options.getString('airport');
  const mine = interaction.options.getBoolean('mine') ?? false;

  const schedules = listGuildSchedules(interaction.guildId, {
    airport,
    includeMineForUserId: mine ? interaction.user.id : null,
  });

  if (!schedules.length) {
    return interaction.reply({
      content: mine ? 'You do not have any active ATC requests.' : 'There are no active ATC requests right now.',
      flags: 1 << 6,
    });
  }

  const lines = schedules.slice(0, 20).map(formatScheduleLine);
  const hiddenCount = schedules.length - lines.length;

  await interaction.reply({
    content: [
      `Active ATC requests${airport ? ` for **${normalizeIcao(airport)}**` : ''}:`,
      ...lines,
      hiddenCount > 0 ? `...and ${hiddenCount} more request(s). Narrow the list with \`airport\` or \`mine:true\`.` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    flags: 1 << 6,
  });
}

async function handleAssign(interaction) {
  if (!hasAtcRole(interaction)) {
    return interaction.reply({
      content: `You need the <@&${ATC_ROLE_ID}> role to assign yourself to a flight.`,
      flags: 1 << 6,
    });
  }

  const requestId = interaction.options.getString('request_id');
  const result = await assignController(requestId, {
    userId: interaction.user.id,
    username: interaction.member.displayName || interaction.user.username,
  });

  if (result.error === 'not_found') {
    return interaction.reply({
      content: `No active ATC request was found for ID \`${String(requestId).toUpperCase()}\`.`,
      flags: 1 << 6,
    });
  }

  if (result.error === 'already_assigned') {
    return interaction.reply({
      content: `You are already assigned to **${result.schedule.callsign}** at **${result.schedule.airport}**.`,
      flags: 1 << 6,
    });
  }

  if (result.error === 'full') {
    return interaction.reply({
      content: `That request already has ${getControllerLimit()} controllers assigned.`,
      flags: 1 << 6,
    });
  }

  const { schedule } = result;
  await interaction.reply({
    content: `You are now assigned to **${schedule.callsign}** at **${schedule.airport}**.\nTime: ${formatScheduleTimestamp(schedule.requestedTime)}\nControllers:\n${describeControllers(schedule)}`,
    flags: 1 << 6,
  });
}

async function handleUnassign(interaction) {
  if (!hasAtcRole(interaction)) {
    return interaction.reply({
      content: `You need the <@&${ATC_ROLE_ID}> role to remove yourself from a flight.`,
      flags: 1 << 6,
    });
  }

  const requestId = interaction.options.getString('request_id');
  const result = await unassignController(requestId, interaction.user.id);

  if (result.error === 'not_found') {
    return interaction.reply({
      content: `No active ATC request was found for ID \`${String(requestId).toUpperCase()}\`.`,
      flags: 1 << 6,
    });
  }

  if (result.error === 'not_assigned') {
    return interaction.reply({
      content: 'You are not assigned to that request.',
      flags: 1 << 6,
    });
  }

  await interaction.reply({
    content: `You were removed from **${result.schedule.callsign}** at **${result.schedule.airport}**.`,
    flags: 1 << 6,
  });
}

async function handleCancel(interaction) {
  const requestId = interaction.options.getString('request_id');
  const schedule = getAtcSchedule(requestId);

  if (!schedule) {
    return interaction.reply({
      content: `No active ATC request was found for ID \`${String(requestId).toUpperCase()}\`.`,
      flags: 1 << 6,
    });
  }

  const ownsRequest = schedule.pilotId === interaction.user.id;
  if (!ownsRequest && !hasAtcRole(interaction)) {
    return interaction.reply({
      content: 'Only the pilot who created the request or an ATC member can cancel it.',
      flags: 1 << 6,
    });
  }

  await cancelAtcSchedule(requestId);

  await interaction.reply({
    content: `Cancelled request **${schedule.id}** for **${schedule.callsign}** at **${schedule.airport}**.`,
    flags: 1 << 6,
  });
}

export const data = new SlashCommandBuilder()
  .setName('atc_schedule')
  .setDescription('Create and manage scheduled ATC requests.')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a future ATC request for a flight.')
      .addStringOption(option =>
        option
          .setName('airport')
          .setDescription('Arrival or departure airport ICAO (e.g. KJFK)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('callsign')
          .setDescription('Flight callsign (e.g. DAL123)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('time')
          .setDescription('UTC time as YYYY-MM-DD HH:MM, or a Discord timestamp')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('notes')
          .setDescription('Optional route, runway, or event notes')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List active ATC requests.')
      .addStringOption(option =>
        option
          .setName('airport')
          .setDescription('Filter by ICAO airport')
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option
          .setName('mine')
          .setDescription('Show only the requests you created')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('assign')
      .setDescription('Assign yourself as a controller for a request.')
      .addStringOption(option =>
        option
          .setName('request_id')
          .setDescription('The request ID shown in /atc_schedule list')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unassign')
      .setDescription('Remove yourself from a controller assignment.')
      .addStringOption(option =>
        option
          .setName('request_id')
          .setDescription('The request ID shown in /atc_schedule list')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('cancel')
      .setDescription('Cancel an ATC request.')
      .addStringOption(option =>
        option
          .setName('request_id')
          .setDescription('The request ID shown in /atc_schedule list')
          .setRequired(true)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'create') {
    return handleCreate(interaction);
  }

  if (subcommand === 'list') {
    return handleList(interaction);
  }

  if (subcommand === 'assign') {
    return handleAssign(interaction);
  }

  if (subcommand === 'unassign') {
    return handleUnassign(interaction);
  }

  if (subcommand === 'cancel') {
    return handleCancel(interaction);
  }

  return interaction.reply({
    content: 'Unknown subcommand.',
    flags: 1 << 6,
  });
}
