import { SlashCommandBuilder } from 'discord.js';
import { ATC_ROLE_ID, PILOT_ROLE_ID, SCHEDULE_CHANNEL_ID } from '../config/commandPolicy.js';

const helpSections = [
  [
    '**Pager Bot Commands: Scheduling**',
    '',
    '`/atc_schedule create airport:<ICAO> callsign:<CALLSIGN> time:<YYYY-MM-DD HH:MM UTC> [notes]`',
    `Use: pilots only (<@&${PILOT_ROLE_ID}>)`,
    `Channel: <#${SCHEDULE_CHANNEL_ID}> only`,
    'Purpose: create a scheduled ATC request so controllers can claim it ahead of time.',
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
    '**Persistence**',
    'ATC schedules are stored in `data/atcSchedules.json` and reloaded when the bot starts.',
  ],
  [
    '**Pager Bot Commands: General**',
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
    '`/remind callsign:<CALLSIGN> waypoint:<FIX> interval:<SECONDS> duration:<SECONDS>`',
    'Use: any connected RadarThing user',
    'Channel: any channel',
    'Purpose: DM yourself waypoint reminders.',
    '',
    '`/radar`',
    'Use: anyone',
    'Channel: any channel',
    'Purpose: shows radar addon setup instructions.',
    '',
    '`/help`',
    'Use: anyone',
    'Channel: any channel',
    'Purpose: shows user-facing command help.',
  ],
];

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List bot commands, who can use them, and where to use them.');

export async function execute(interaction) {
  await interaction.reply({
    content: helpSections[0].join('\n'),
    flags: 1 << 6,
  });

  for (const section of helpSections.slice(1)) {
    await interaction.followUp({
      content: section.join('\n'),
      flags: 1 << 6,
    });
  }
}
