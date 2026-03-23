import { EventSource } from 'eventsource';
import {
  listActiveReminders,
  markReminderCompleted,
  markReminderFailed,
  markReminderSent,
  markReminderTriggered,
} from './reminderApi.js';

const refreshIntervalMs = 15000;
const reconcileIntervalMs = 1000;

const activeReminders = new Map();
const reminderTimers = new Map();
const aircraftByKey = new Map();

let discordClient = null;
let eventSource = null;
let refreshTimer = null;
let reconcileTimer = null;

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function parseFlightPlan(flightPlan) {
  if (!flightPlan) return [];

  try {
    const parsed = JSON.parse(flightPlan);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function reminderState(reminder) {
  return {
    reminder,
    seenTargetAsNext: reminder.status === 'active',
    lastObservedNextWaypoint: null,
  };
}

function aircraftMatchesReminder(aircraft, reminder) {
  return (
    aircraft &&
    aircraft.googleId === reminder.googleId &&
    normalize(aircraft.callsign) === normalize(reminder.callsign)
  );
}

function findAircraftForReminder(reminder) {
  for (const aircraft of aircraftByKey.values()) {
    if (aircraftMatchesReminder(aircraft, reminder)) {
      return aircraft;
    }
  }

  return null;
}

function reminderHasWaypoint(reminder, aircraft) {
  const ident = normalize(reminder.waypointIdent);
  return parseFlightPlan(aircraft.flightPlan).some(
    waypoint => normalize(waypoint?.ident) === ident
  );
}

async function sendReminderPing(reminder) {
  const user = await discordClient.users.fetch(reminder.discordUserId);
  const message = `Waypoint reminder for **${reminder.callsign}**: you asked to be pinged after **${reminder.waypointIdent}**.`;
  await user.send(message);
}

async function stopReminder(reminderId, finalizer) {
  const timer = reminderTimers.get(reminderId);
  if (timer) {
    clearInterval(timer);
    reminderTimers.delete(reminderId);
  }

  const state = activeReminders.get(reminderId);
  if (!state) return;

  activeReminders.delete(reminderId);
  await finalizer(state.reminder);
}

async function startReminderLoop(reminder, sendImmediately = true) {
  if (sendImmediately) {
    const now = Date.now();

    try {
      await sendReminderPing(reminder);
      await markReminderSent(reminder._id, now);
    } catch (error) {
      console.error('[reminder] initial ping failed:', error);
      await stopReminder(reminder._id, async current =>
        markReminderFailed(current._id, Date.now(), 'Initial Discord DM failed')
      );
      return;
    }
  }

  const timer = setInterval(async () => {
    const state = activeReminders.get(reminder._id);
    if (!state) return;

    const currentReminder = state.reminder;
    const expiresAt = currentReminder.expiresAt || 0;

    if (Date.now() >= expiresAt) {
      await stopReminder(currentReminder._id, async current =>
        markReminderCompleted(current._id, Date.now())
      );
      return;
    }

    try {
      await sendReminderPing(currentReminder);
      await markReminderSent(currentReminder._id, Date.now());
    } catch (error) {
      console.error('[reminder] recurring ping failed:', error);
      await stopReminder(currentReminder._id, async current =>
        markReminderFailed(current._id, Date.now(), 'Recurring Discord DM failed')
      );
    }
  }, reminder.intervalSeconds * 1000);

  reminderTimers.set(reminder._id, timer);
}

async function handleTriggeredReminder(reminderId) {
  const state = activeReminders.get(reminderId);
  if (!state || state.reminder.status !== 'armed') return;

  const triggeredAt = Date.now();
  const response = await markReminderTriggered(reminderId, triggeredAt);
  if (!response?.reminder) return;

  state.reminder = response.reminder;
  activeReminders.set(reminderId, state);

  await startReminderLoop(response.reminder, true);
}

async function reconcileReminder(reminderId) {
  const state = activeReminders.get(reminderId);
  if (!state) return;

  const { reminder } = state;

  if (reminder.status === 'active') {
    const expiresAt = reminder.expiresAt || 0;
    if (expiresAt && Date.now() >= expiresAt) {
      await stopReminder(reminder._id, async current =>
        markReminderCompleted(current._id, Date.now())
      );
    }
    return;
  }

  const aircraft = findAircraftForReminder(reminder);
  if (!aircraft) return;

  if (!reminderHasWaypoint(reminder, aircraft)) {
    await stopReminder(reminder._id, async current =>
      markReminderFailed(current._id, Date.now(), 'Waypoint no longer exists in flight plan')
    );
    return;
  }

  const targetIdent = normalize(reminder.waypointIdent);
  const currentNext = normalize(aircraft.nextWaypoint);

  if (currentNext === targetIdent) {
    state.seenTargetAsNext = true;
  } else if (
    state.seenTargetAsNext &&
    state.lastObservedNextWaypoint === targetIdent &&
    currentNext !== targetIdent
  ) {
    await handleTriggeredReminder(reminder._id);
    return;
  }

  state.lastObservedNextWaypoint = currentNext;
}

async function reconcileAllReminders() {
  const ids = Array.from(activeReminders.keys());
  for (const reminderId of ids) {
    try {
      await reconcileReminder(reminderId);
    } catch (error) {
      console.error('[reminder] reconcile failed:', error);
    }
  }
}

function upsertAircraft(aircraft) {
  const key = aircraft.callsign || aircraft.id;
  if (!key) return;
  aircraftByKey.set(key, aircraft);
}

function removeAircraftById(id) {
  for (const [key, aircraft] of aircraftByKey.entries()) {
    if (aircraft.id === id || key === id) {
      aircraftByKey.delete(key);
      break;
    }
  }
}

async function refreshRemindersFromApi() {
  const data = await listActiveReminders();
  const nextIds = new Set();

  for (const reminder of data.reminders || []) {
    nextIds.add(reminder._id);
    const existing = activeReminders.get(reminder._id);
    if (existing) {
      existing.reminder = reminder;
    } else {
      activeReminders.set(reminder._id, reminderState(reminder));
      if (reminder.status === 'active' && !reminderTimers.has(reminder._id)) {
        await startReminderLoop(reminder, false);
      }
    }
  }

  for (const reminderId of Array.from(activeReminders.keys())) {
    if (!nextIds.has(reminderId)) {
      const timer = reminderTimers.get(reminderId);
      if (timer) {
        clearInterval(timer);
        reminderTimers.delete(reminderId);
      }
      activeReminders.delete(reminderId);
    }
  }
}

function connectToStream() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(`${process.env.RADAR_SSE_URL}/api/stream`);

  eventSource.onmessage = event => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'full') {
        aircraftByKey.clear();
      }

      for (const aircraft of data.aircraft || []) {
        upsertAircraft(aircraft);
      }

      for (const removedId of data.removed || []) {
        removeAircraftById(removedId);
      }
    } catch (error) {
      console.error('[reminder] failed to parse SSE message:', error);
    }
  };

  eventSource.onerror = error => {
    console.error('[reminder] SSE error:', error);
    setTimeout(connectToStream, 3000);
  };
}

export async function registerReminder(reminder) {
  const existing = activeReminders.get(reminder._id);
  if (existing) {
    existing.reminder = reminder;
    return;
  }

  activeReminders.set(reminder._id, reminderState(reminder));
}

export async function startReminderWatcher(client) {
  if (discordClient) return;

  discordClient = client;
  try {
    await refreshRemindersFromApi();
  } catch (error) {
    console.error('[reminder] initial reminder sync failed:', error);
  }

  connectToStream();

  refreshTimer = setInterval(() => {
    void refreshRemindersFromApi().catch((error) => {
      console.error('[reminder] periodic reminder sync failed:', error);
    });
  }, refreshIntervalMs);

  reconcileTimer = setInterval(() => {
    void reconcileAllReminders().catch((error) => {
      console.error('[reminder] reconcile loop failed:', error);
    });
  }, reconcileIntervalMs);
}

export function stopReminderWatcher() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }

  for (const timer of reminderTimers.values()) {
    clearInterval(timer);
  }

  reminderTimers.clear();
  activeReminders.clear();
  aircraftByKey.clear();
  discordClient = null;
}

export function getAircraftSnapshot() {
  return Array.from(aircraftByKey.values());
}
