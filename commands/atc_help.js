import { SlashCommandBuilder } from 'discord.js';
import {
  ATC_ROLE_ID,
  PILOT_ROLE_ID,
  SCHEDULE_CHANNEL_ID,
} from '../config/commandPolicy.js';

const atcHelpSections = [
  [
    '**Pager Bot Commands: ATC**',
    '',
    '`/atc_schedule create airport:<ICAO> direction:<arrival|departure> callsign:<CALLSIGN> time:<HHMM Z> route:<ROUTE> [notes]`',
    `Use: pilots only (<@&${PILOT_ROLE_ID}>)`,
    `Channel: <#${SCHEDULE_CHANNEL_ID}> only`,
    'Purpose: create a same-day ATC request in Zulu time, ping the ATC role, and let controllers claim it ahead of time.',
    '',
    '`/atc_schedule list [airport] [mine]`',
    `Use: pilots or ATC (<@&${PILOT_ROLE_ID}> or <@&${ATC_ROLE_ID}>)`,
    `Channel: <#${SCHEDULE_CHANNEL_ID}> only`,
    'Purpose: show active scheduled ATC requests. This is public in the channel.',
    '',
    '`/atc_schedule assign request_id:<ID>`',
    `Use: ATC only (<@&${ATC_ROLE_ID}>)`,
    `Channel: <#${SCHEDULE_CHANNEL_ID}> only`,
    'Purpose: assign yourself as one of up to 2 controllers for a request.',
    '',
    '`/atc_schedule unassign request_id:<ID>`',
    `Use: ATC only (<@&${ATC_ROLE_ID}>)`,
    `Channel: <#${SCHEDULE_CHANNEL_ID}> only`,
    'Purpose: remove yourself from a scheduled request.',
    '',
    '`/atc_schedule cancel request_id:<ID>`',
    `Use: the pilot who created the request, or ATC (<@&${ATC_ROLE_ID}>)`,
    `Channel: <#${SCHEDULE_CHANNEL_ID}> only`,
    'Purpose: cancel a scheduled request.',
    '',
    '`/airport_online icao:<ICAO>`',
    `Use: ATC only (<@&${ATC_ROLE_ID}>)`,
    'Channel: any channel unless you want this restricted later',
    'Purpose: mark an airport as being staffed live right now.',
    '',
    '`/airport_offline icao:<ICAO>`',
    `Use: ATC only (<@&${ATC_ROLE_ID}>)`,
    'Channel: any channel unless you want this restricted later',
    'Purpose: remove yourself from live airport staffing.',
    '',
    '**Persistence**',
    'ATC schedules are stored in Convex and synced into the bot on startup.',
  ],
];

export const data = new SlashCommandBuilder()
  .setName('atc_help')
  .setDescription('List ATC-related commands and scheduling workflow.');

export async function execute(interaction) {
  await interaction.reply({
    content: atcHelpSections[0].join('\n'),
    flags: 1 << 6,
  });
}
