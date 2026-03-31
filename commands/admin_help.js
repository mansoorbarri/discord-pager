import { SlashCommandBuilder } from 'discord.js';
import { ADMIN_ROLE_ID, ATC_ROLE_ID, SCHEDULE_CHANNEL_ID } from '../config/commandPolicy.js';

const adminHelpSections = [
  [
    '**Pager Bot Admin Commands**',
    '',
    '`/role user:<USER> action:<add|remove> roles:<ROLES>`',
    `Use: admins only (<@&${ADMIN_ROLE_ID}>)`,
    'Channel: any channel',
    'Purpose: add or remove one or more roles from a member.',
    '',
    '`/questioning user:<USER>`',
    `Use: admins only (<@&${ADMIN_ROLE_ID}>)`,
    'Channel: any channel',
    'Purpose: remove all current roles and assign only Questioning.',
    '',
    '`/unquestioning user:<USER>`',
    `Use: admins only (<@&${ADMIN_ROLE_ID}>)`,
    'Channel: any channel',
    'Purpose: remove Questioning and restore the previously backed-up roles.',
    '',
    '`/airport_offline icao:<ICAO>`',
    `Use: ATC only (<@&${ATC_ROLE_ID}>), with admin override support for <@&${ADMIN_ROLE_ID}>`,
    'Channel: any channel unless restricted later',
    'Purpose: admins can remove all controllers from an airport when needed.',
    '',
    '`/atc_schedule admin_assign request_id:<ID> controller:<USER>`',
    `Use: admins only (<@&${ADMIN_ROLE_ID}>)`,
    `Channel: <#${SCHEDULE_CHANNEL_ID}> only`,
    'Purpose: assign any ATC member to a scheduled request.',
    '',
    '`/atc_schedule admin_unassign request_id:<ID> controller:<USER>`',
    `Use: admins only (<@&${ADMIN_ROLE_ID}>)`,
    `Channel: <#${SCHEDULE_CHANNEL_ID}> only`,
    'Purpose: remove any assigned controller from a scheduled request.',
    '',
    '`/atc_help`',
    'Use: anyone',
    'Channel: any channel',
    'Purpose: shows the non-admin ATC scheduling and controller commands.',
    '',
    '`/admin_help`',
    `Use: admins only (<@&${ADMIN_ROLE_ID}>)`,
    'Channel: any channel',
    'Purpose: shows this admin-only help.',
  ],
];

export const data = new SlashCommandBuilder()
  .setName('admin_help')
  .setDescription('List admin-only commands and moderation tools.');

export async function execute(interaction) {
  if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
    return interaction.reply({
      content: `You need the <@&${ADMIN_ROLE_ID}> role to use this command.`,
      flags: 1 << 6,
    });
  }

  await interaction.reply({
    content: adminHelpSections[0].join('\n'),
    flags: 1 << 6,
  });
}
