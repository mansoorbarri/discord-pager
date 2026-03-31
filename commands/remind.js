import { SlashCommandBuilder } from 'discord.js';
import { reminderChannelMention } from '../config/commandPolicy.js';
import { createReminder } from '../services/reminderApi.js';
import { registerReminder } from '../services/reminderWatcher.js';
import {
  buildReminderPayload,
  deliveryTargets,
  normalize,
  resolveConnectedUser,
  validateReminderRequest,
} from '../services/reminderCommandUtils.js';

const minIntervalSeconds = 3;
const maxIntervalSeconds = 300;
const minDurationSeconds = 30;
const maxDurationSeconds = 3600;

export const data = new SlashCommandBuilder()
  .setName('remind')
  .setDescription('Ping yourself on Discord after reaching a flight plan waypoint.')
  .addStringOption(option =>
    option
      .setName('callsign')
      .setDescription('Your live flight number (for example AFR650)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('waypoint')
      .setDescription('Waypoint ident to trigger the reminder at')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('interval')
      .setDescription(`Reminder interval in seconds (${minIntervalSeconds}-${maxIntervalSeconds})`)
      .setRequired(true)
      .setMinValue(minIntervalSeconds)
      .setMaxValue(maxIntervalSeconds)
  )
  .addIntegerOption(option =>
    option
      .setName('duration')
      .setDescription(`Reminder duration in seconds (${minDurationSeconds}-${maxDurationSeconds})`)
      .setRequired(true)
      .setMinValue(minDurationSeconds)
      .setMaxValue(maxDurationSeconds)
  )
  .addStringOption(option =>
    option
      .setName('delivery')
      .setDescription('Where the reminder should be sent')
      .setRequired(true)
      .addChoices(
        { name: 'Direct message', value: deliveryTargets.dm },
        { name: 'This server channel', value: deliveryTargets.server }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: 1 << 6 });

  const callsign = normalize(interaction.options.getString('callsign'));
  const waypointIdent = normalize(interaction.options.getString('waypoint'));
  const intervalSeconds = interaction.options.getInteger('interval');
  const durationSeconds = interaction.options.getInteger('duration');
  const deliveryTarget = interaction.options.getString('delivery');
  const user = await resolveConnectedUser(interaction);

  if (!user) {
    return;
  }

  const isValid = await validateReminderRequest({
    interaction,
    user,
    callsign,
    waypointIdent,
    deliveryTarget,
  });
  if (!isValid) {
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

  await interaction.editReply(
    deliveryTarget === deliveryTargets.server
      ? `Reminder armed for **${callsign}** at **${waypointIdent}**. I will ping you in ${reminderChannelMention()} every **${intervalSeconds}s** for **${durationSeconds}s** after that waypoint is reached.`
      : `Reminder armed for **${callsign}** at **${waypointIdent}**. I will DM you every **${intervalSeconds}s** for **${durationSeconds}s** after that waypoint is reached.`
  );
}
