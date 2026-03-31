import { SlashCommandBuilder } from 'discord.js';
import { markReminderCancelled } from '../services/reminderApi.js';
import { unregisterReminder } from '../services/reminderWatcher.js';
import {
  findMatchingReminder,
  getUserActiveReminders,
  normalize,
  resolveConnectedUser,
} from '../services/reminderCommandUtils.js';

export const data = new SlashCommandBuilder()
  .setName('remind_cancel')
  .setDescription('Cancel one of your active waypoint reminders.')
  .addStringOption(option =>
    option
      .setName('callsign')
      .setDescription('Reminder callsign')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('waypoint')
      .setDescription('Reminder waypoint ident')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: 1 << 6 });

  const user = await resolveConnectedUser(interaction);
  if (!user) {
    return;
  }

  const callsign = normalize(interaction.options.getString('callsign'));
  const waypointIdent = normalize(interaction.options.getString('waypoint'));
  const reminders = await getUserActiveReminders(user);
  const reminder = findMatchingReminder(reminders, callsign, waypointIdent);

  if (!reminder) {
    await interaction.editReply(
      `No active reminder was found for **${callsign}** at **${waypointIdent}**. Use \`/remind_list\` to see what is armed.`
    );
    return;
  }

  await markReminderCancelled(reminder._id, Date.now());
  unregisterReminder(reminder._id);

  await interaction.editReply(
    `Cancelled the reminder for **${reminder.callsign}** at **${reminder.waypointIdent}**.`
  );
}
