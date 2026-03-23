const BOT_API_URL = `${(process.env.RADARTHING_API_BASE_URL || 'https://radarthing.com').replace(/\/$/, '')}/api/bot/reminders`;

async function post(action, payload = {}) {
  const response = await fetch(BOT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': process.env.BOT_API_SECRET || '',
    },
    body: JSON.stringify({
      action,
      ...payload,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Reminder API request failed with ${response.status}`);
  }

  return data;
}

export function lookupUserByDiscordUsername(discordUsername) {
  return post('lookupUser', { discordUsername });
}

export function createReminder(payload) {
  return post('createReminder', payload);
}

export function listActiveReminders() {
  return post('listActive');
}

export function markReminderTriggered(id, triggeredAt) {
  return post('markTriggered', { id, triggeredAt });
}

export function markReminderSent(id, sentAt) {
  return post('markSent', { id, sentAt });
}

export function markReminderCompleted(id, completedAt) {
  return post('markCompleted', { id, completedAt });
}

export function markReminderCancelled(id, completedAt) {
  return post('markCancelled', { id, completedAt });
}

export function markReminderFailed(id, completedAt, failureReason) {
  return post('markFailed', { id, completedAt, failureReason });
}
