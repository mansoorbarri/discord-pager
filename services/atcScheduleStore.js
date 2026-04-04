import crypto from 'crypto';
import { api } from '../convex/_generated/api.js';
import { getBotSecret, postConvexBotAction, subscribeBotQuery } from './convexBotRuntime.js';

const controllerLimit = 2;
const expirationWindowMs = 6 * 60 * 60 * 1000;
const pruneIntervalMs = 60 * 60 * 1000;
const initialSyncTimeoutMs = 15_000;

export const atcSchedules = new Map();

let unsubscribeFromSchedules = null;
let pruneIntervalId = null;
let initialSyncPromise = null;

function normalizeIcao(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeCallsign(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeDirection(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'arrival' || normalized === 'departure' ? normalized : 'unspecified';
}

function createId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeController(controller) {
  if (!isObject(controller)) return null;

  const userId = String(controller.userId || '').trim();
  const username = String(controller.username || '').trim();
  const assignedAt = Number(controller.assignedAt);

  if (!userId || !username || !Number.isFinite(assignedAt)) {
    return null;
  }

  return { userId, username, assignedAt };
}

function sanitizeSchedule(schedule) {
  if (!isObject(schedule)) return null;

  const id = String(schedule.id ?? schedule.requestId ?? '').trim().toUpperCase();
  const guildId = String(schedule.guildId || '').trim();
  const pilotId = String(schedule.pilotId || '').trim();
  const pilotName = String(schedule.pilotName || '').trim();
  const airport = normalizeIcao(schedule.airport);
  const direction = normalizeDirection(schedule.direction);
  const callsign = normalizeCallsign(schedule.callsign);
  const notes = String(schedule.notes || '').trim();
  const requestedTime = Number(schedule.requestedTime);
  const createdAt = Number(schedule.createdAt);
  const controllers = Array.isArray(schedule.controllers)
    ? schedule.controllers.map(sanitizeController).filter(Boolean).slice(0, controllerLimit)
    : [];

  if (
    !id ||
    !guildId ||
    !pilotId ||
    !pilotName ||
    !airport ||
    !callsign ||
    !Number.isFinite(requestedTime) ||
    !Number.isFinite(createdAt)
  ) {
    return null;
  }

  return {
    id,
    guildId,
    pilotId,
    pilotName,
    airport,
    direction,
    callsign,
    notes,
    requestedTime,
    createdAt,
    controllers,
  };
}

function isExpired(schedule, now = Date.now()) {
  return schedule.requestedTime + expirationWindowMs < now;
}

function isActive(schedule, now = Date.now()) {
  return schedule.requestedTime >= now;
}

function refreshCache(schedules) {
  atcSchedules.clear();

  for (const schedule of schedules) {
    const sanitized = sanitizeSchedule(schedule);
    if (sanitized && !isExpired(sanitized)) {
      atcSchedules.set(sanitized.id, sanitized);
    }
  }
}

async function pruneExpiredSchedules() {
  await postConvexBotAction('/bot/atc-schedules/prune', {});
}

function ensureClientClosed() {
  if (unsubscribeFromSchedules) {
    unsubscribeFromSchedules();
    unsubscribeFromSchedules = null;
  }

  if (pruneIntervalId) {
    clearInterval(pruneIntervalId);
    pruneIntervalId = null;
  }

  initialSyncPromise = null;
}

export async function loadAtcSchedules() {
  if (initialSyncPromise) {
    return initialSyncPromise;
  }

  ensureClientClosed();
  await pruneExpiredSchedules();

  initialSyncPromise = new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Timed out waiting for the initial Convex ATC schedule sync.'));
      }
    }, initialSyncTimeoutMs);

    unsubscribeFromSchedules = subscribeBotQuery(
      api.atcSchedules.watchBotSchedules,
      { botToken: getBotSecret() },
      schedules => {
        refreshCache(schedules);
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve();
        }
      },
      error => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          ensureClientClosed();
          reject(error);
          return;
        }

        console.error('[atc-schedule] Convex subscription error:', error);
      }
    );
  });

  pruneIntervalId = setInterval(() => {
    void pruneExpiredSchedules().catch(error => {
      console.error('[atc-schedule] periodic Convex prune failed:', error);
    });
  }, pruneIntervalMs);

  return initialSyncPromise;
}

async function createConvexSchedule(schedule, attempt = 0) {
  const payload = await postConvexBotAction('/bot/atc-schedules/create', schedule);
  if (payload.duplicate) {
    if (attempt >= 4) {
      throw new Error('Failed to allocate a unique ATC request ID.');
    }
    return createConvexSchedule({ ...schedule, requestId: createId() }, attempt + 1);
  }

  const normalized = sanitizeSchedule(payload.schedule);
  if (!normalized) {
    throw new Error('Convex returned an invalid schedule payload.');
  }

  atcSchedules.set(normalized.id, normalized);
  return normalized;
}

export async function createAtcSchedule({
  guildId,
  pilotId,
  pilotName,
  airport,
  direction,
  callsign,
  requestedTime,
  notes = '',
}) {
  return await createConvexSchedule({
    requestId: createId(),
    guildId: String(guildId),
    pilotId: String(pilotId),
    pilotName: String(pilotName).trim(),
    airport: normalizeIcao(airport),
    direction: normalizeDirection(direction),
    callsign: normalizeCallsign(callsign),
    requestedTime,
    notes: String(notes || '').trim(),
  });
}

export function listGuildSchedules(guildId, { includeMineForUserId = null, airport = null } = {}) {
  const now = Date.now();
  const requestedAirport = airport ? normalizeIcao(airport) : null;

  return Array.from(atcSchedules.values())
    .filter(schedule => schedule.guildId === String(guildId))
    .filter(schedule => isActive(schedule, now))
    .filter(schedule => !requestedAirport || schedule.airport === requestedAirport)
    .filter(schedule => !includeMineForUserId || schedule.pilotId === String(includeMineForUserId))
    .sort((a, b) => {
      if (a.controllers.length !== b.controllers.length) {
        return a.controllers.length - b.controllers.length;
      }
      if (a.requestedTime !== b.requestedTime) {
        return a.requestedTime - b.requestedTime;
      }
      return a.createdAt - b.createdAt;
    });
}

export function getAtcSchedule(id) {
  const schedule = atcSchedules.get(String(id || '').trim().toUpperCase());
  if (!schedule || !isActive(schedule)) {
    return null;
  }

  return schedule;
}

export async function cancelAtcSchedule(id) {
  const payload = await postConvexBotAction('/bot/atc-schedules/cancel', {
    requestId: String(id || '').trim().toUpperCase(),
  });

  const schedule = sanitizeSchedule(payload.schedule);
  if (schedule) {
    atcSchedules.delete(schedule.id);
  }
  return schedule;
}

export async function assignController(scheduleId, controller) {
  const payload = await postConvexBotAction('/bot/atc-schedules/assign', {
    requestId: String(scheduleId || '').trim().toUpperCase(),
    controller: {
      userId: String(controller.userId),
      username: String(controller.username).trim(),
      assignedAt: Date.now(),
    },
  });

  const schedule = sanitizeSchedule(payload.schedule);
  if (schedule && payload.error === null) {
    atcSchedules.set(schedule.id, schedule);
  }

  return {
    error: payload.error,
    schedule,
  };
}

export async function unassignController(scheduleId, controllerUserId) {
  const payload = await postConvexBotAction('/bot/atc-schedules/unassign', {
    requestId: String(scheduleId || '').trim().toUpperCase(),
    controllerUserId: String(controllerUserId),
  });

  const schedule = sanitizeSchedule(payload.schedule);
  if (schedule && payload.error === null) {
    atcSchedules.set(schedule.id, schedule);
  }

  return {
    error: payload.error,
    schedule,
  };
}

export function formatScheduleTimestamp(timestamp) {
  const seconds = Math.floor(timestamp / 1000);
  return `<t:${seconds}:F> (<t:${seconds}:R>)`;
}

export function getControllerLimit() {
  return controllerLimit;
}
