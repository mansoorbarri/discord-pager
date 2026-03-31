export const PILOT_ROLE_ID = '1377626281897754687';
export const ATC_ROLE_ID = '1377626143838048426';
export const SCHEDULE_CHANNEL_ID = '1377624195944550470';
export const ADMIN_ROLE_ID = '1377624537386188883';
export const REMINDER_CHANNEL_ID = '1378978564367581195';

export function isInScheduleChannel(interaction) {
  return interaction.channelId === SCHEDULE_CHANNEL_ID;
}

export function scheduleChannelMention() {
  return `<#${SCHEDULE_CHANNEL_ID}>`;
}

export function reminderChannelMention() {
  return `<#${REMINDER_CHANNEL_ID}>`;
}
