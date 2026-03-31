import { SlashCommandBuilder } from 'discord.js';
import {
  formatDeliveryTarget,
  getUserActiveReminders,
  resolveConnectedUser,
} from '../services/reminderCommandUtils.js';

function formatReminderLine(reminder) {
  const status = reminder.status || 'armed';
  const intervalSeconds = reminder.intervalSeconds ?? '?';
  const durationSeconds = reminder.durationSeconds ?? '?';

  return `• **${reminder.callsign}** at **${reminder.waypointIdent}** | status: **${status}** | every **${intervalSeconds}s** for **${durationSeconds}s** | delivery: **${formatDeliveryTarget(reminder)}**`;
}

export const data = new SlashCommandBuilder()
  .setName('remind_list')
  .setDescription('List your active waypoint reminders.');

export async function execute(interaction) {
  await interaction.deferReply({ flags: 1 << 6 });

  const user = await resolveConnectedUser(interaction);
  if (!user) {
    return;
  }

  const reminders = await getUserActiveReminders(user);
  if (!reminders.length) {
    await interaction.editReply('You do not have any active reminders right now.');
    return;
  }

  await interaction.editReply(
    ['Your active reminders:', ...reminders.map(formatReminderLine)].join('\n')
  );
}
