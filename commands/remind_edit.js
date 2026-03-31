import { SlashCommandBuilder } from 'discord.js';
import { createReminder, markReminderCancelled } from '../services/reminderApi.js';
import { registerReminder, unregisterReminder } from '../services/reminderWatcher.js';
import {
  buildReminderPayload,
  deliveryTargets,
  findMatchingReminder,
  getUserActiveReminders,
  normalize,
  resolveConnectedUser,
  validateReminderRequest,
} from '../services/reminderCommandUtils.js';

const minIntervalSeconds = 3;
const maxIntervalSeconds = 300;
const minDurationSeconds = 30;
const maxDurationSeconds = 3600;

export const data = new SlashCommandBuilder()
  .setName('remind_edit')
  .setDescription('Replace one of your active waypoint reminders with updated settings.')
  .addStringOption(option =>
    option
      .setName('current_callsign')
      .setDescription('Current reminder callsign')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('current_waypoint')
      .setDescription('Current reminder waypoint ident')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('callsign')
      .setDescription('Updated callsign')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('waypoint')
      .setDescription('Updated waypoint ident')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('interval')
      .setDescription(`Updated reminder interval in seconds (${minIntervalSeconds}-${maxIntervalSeconds})`)
      .setRequired(true)
      .setMinValue(minIntervalSeconds)
      .setMaxValue(maxIntervalSeconds)
  )
  .addIntegerOption(option =>
    option
      .setName('duration')
      .setDescription(`Updated reminder duration in seconds (${minDurationSeconds}-${maxDurationSeconds})`)
      .setRequired(true)
      .setMinValue(minDurationSeconds)
      .setMaxValue(maxDurationSeconds)
  )
  .addStringOption(option =>
    option
      .setName('delivery')
      .setDescription('Where the updated reminder should be sent')
      .setRequired(true)
      .addChoices(
        { name: 'Direct message', value: deliveryTargets.dm },
        { name: 'This server channel', value: deliveryTargets.server }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: 1 << 6 });

  const user = await resolveConnectedUser(interaction);
  if (!user) {
    return;
  }

  const currentCallsign = normalize(interaction.options.getString('current_callsign'));
  const currentWaypoint = normalize(interaction.options.getString('current_waypoint'));
  const callsign = normalize(interaction.options.getString('callsign'));
  const waypointIdent = normalize(interaction.options.getString('waypoint'));
  const intervalSeconds = interaction.options.getInteger('interval');
  const durationSeconds = interaction.options.getInteger('duration');
  const deliveryTarget = interaction.options.getString('delivery');

  const reminders = await getUserActiveReminders(user);
  const existingReminder = findMatchingReminder(reminders, currentCallsign, currentWaypoint);
  if (!existingReminder) {
    await interaction.editReply(
      `No active reminder was found for **${currentCallsign}** at **${currentWaypoint}**. Use \`/remind_list\` to see what is armed.`
    );
    return;
  }

  const validAircraft = await validateReminderRequest({
    interaction,
    user,
    callsign,
    waypointIdent,
    deliveryTarget,
  });
  if (!validAircraft) {
    return;
  }

  const payload = buildReminderPayload({
    interaction,
    user,
    callsign,
    waypointIdent,
    intervalSeconds,
    durationSeconds,
    deliveryTarget,
  });

  const createResponse = await createReminder(payload);

  await registerReminder({
    _id: createResponse.reminderId,
    ...payload,
    status: 'armed',
    createdAt: Date.now(),
  });

  await markReminderCancelled(existingReminder._id, Date.now());
  unregisterReminder(existingReminder._id);

  await interaction.editReply(
    `Updated your reminder from **${existingReminder.callsign}** at **${existingReminder.waypointIdent}** to **${callsign}** at **${waypointIdent}**.`
  );
}
