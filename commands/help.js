import { SlashCommandBuilder } from 'discord.js';
import { ATC_ROLE_ID } from '../config/commandPolicy.js';

const helpLines = [
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
  '`/remind callsign:<CALLSIGN> waypoint:<FIX> interval:<SECONDS> duration:<SECONDS> delivery:<dm|server>`',
  'Use: any connected RadarThing user',
  'Channel: any channel',
  'Purpose: send waypoint reminders either by DM or in the channel where you armed them.',
  '',
  '`/remind_list`',
  'Use: any connected RadarThing user',
  'Channel: any channel',
  'Purpose: show your currently active waypoint reminders.',
  '',
  '`/remind_cancel callsign:<CALLSIGN> waypoint:<FIX>`',
  'Use: any connected RadarThing user',
  'Channel: any channel',
  'Purpose: cancel one of your active waypoint reminders.',
  '',
  '`/remind_edit current_callsign:<CALLSIGN> current_waypoint:<FIX> callsign:<CALLSIGN> waypoint:<FIX> interval:<SECONDS> duration:<SECONDS> delivery:<dm|server>`',
  'Use: any connected RadarThing user',
  'Channel: any channel',
  'Purpose: replace an active waypoint reminder with updated settings.',
  '',
  '`/radar`',
  'Use: anyone',
  'Channel: any channel',
  'Purpose: shows radar addon setup instructions.',
  '',
  '`/live_flight departure:<ICAO> arrival:<ICAO> route:<ROUTE> airline:<NAME> aircraft:<TYPE> flight_number:<NUMBER> callsign:<CALLSIGN> block_time:<HH:MM> departure_time:<HH:MM>`',
  'Use: anyone posting a same-day flight',
  'Channel: any channel',
  'Purpose: posts a public live flight entry into `#live-flights` while keeping validation and success replies user-only.',
  '',
  '`/atc_help`',
  'Use: anyone',
  'Channel: any channel',
  'Purpose: shows all ATC scheduling and controller coordination commands.',
  '',
  '`/help`',
  'Use: anyone',
  'Channel: any channel',
  'Purpose: shows general bot commands.',
];

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List general bot commands.');

export async function execute(interaction) {
  await interaction.reply({
    content: helpLines.join('\n'),
    flags: 1 << 6,
  });
}
