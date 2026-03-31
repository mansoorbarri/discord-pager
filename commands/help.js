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
  '`/radar`',
  'Use: anyone',
  'Channel: any channel',
  'Purpose: shows radar addon setup instructions.',
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
