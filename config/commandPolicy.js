export const PILOT_ROLE_ID = '1377626281897754687';
export const ATC_ROLE_ID = '1377626143838048426';
export const SCHEDULE_CHANNEL_ID = '1488483267978989759';
export const ADMIN_ROLE_ID = '1377624537386188883';
export const REMINDER_CHANNEL_ID = '1378978564367581195';
export const LIVE_FLIGHTS_CHANNEL_ID = process.env.LIVE_FLIGHTS_CHANNEL_ID || '';
export const LIVE_FLIGHTS_CHANNEL_NAME = 'live-flights';

export function isInScheduleChannel(interaction) {
  return interaction.channelId === SCHEDULE_CHANNEL_ID;
}

export function scheduleChannelMention() {
  return `<#${SCHEDULE_CHANNEL_ID}>`;
}

export function reminderChannelMention() {
  return `<#${REMINDER_CHANNEL_ID}>`;
}

export function liveFlightsChannelMention() {
  return LIVE_FLIGHTS_CHANNEL_ID
    ? `<#${LIVE_FLIGHTS_CHANNEL_ID}>`
    : `#${LIVE_FLIGHTS_CHANNEL_NAME}`;
}

export function findLiveFlightsChannel(guild) {
  if (!guild?.channels?.cache) {
    return null;
  }

  if (LIVE_FLIGHTS_CHANNEL_ID) {
    const channel = guild.channels.cache.get(LIVE_FLIGHTS_CHANNEL_ID);
    if (channel?.isTextBased?.() && typeof channel.send === 'function') {
      return channel;
    }
  }

  return (
    guild.channels.cache.find(
      channel =>
        channel?.name === LIVE_FLIGHTS_CHANNEL_NAME &&
        channel?.isTextBased?.() &&
        typeof channel.send === 'function'
    ) || null
  );
}
