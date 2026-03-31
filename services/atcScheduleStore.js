import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const dataDir = path.resolve('./data');
const scheduleFilePath = path.join(dataDir, 'atcSchedules.json');
const controllerLimit = 2;
const expirationWindowMs = 6 * 60 * 60 * 1000;

export const atcSchedules = new Map();

function normalizeIcao(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeCallsign(value) {
  return String(value || '').trim().toUpperCase();
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

  const id = String(schedule.id || '').trim().toUpperCase();
  const guildId = String(schedule.guildId || '').trim();
  const pilotId = String(schedule.pilotId || '').trim();
  const pilotName = String(schedule.pilotName || '').trim();
  const airport = normalizeIcao(schedule.airport);
  const callsign = normalizeCallsign(schedule.callsign);
  const notes = String(schedule.notes || '').trim();
  const requestedTime = Number(schedule.requestedTime);
  const createdAt = Number(schedule.createdAt);
  const status = schedule.status === 'cancelled' ? 'cancelled' : 'open';
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
    callsign,
    notes,
    requestedTime,
    createdAt,
    status,
    controllers,
  };
}

function serializeSchedules() {
  return JSON.stringify(Array.from(atcSchedules.values()), null, 2);
}

async function persistSchedules() {
  await fs.mkdir(dataDir, { recursive: true });
  const tempFilePath = `${scheduleFilePath}.tmp`;
  await fs.writeFile(tempFilePath, serializeSchedules(), 'utf8');
  await fs.rename(tempFilePath, scheduleFilePath);
}

function isExpired(schedule, now = Date.now()) {
  return schedule.requestedTime + expirationWindowMs < now || schedule.status === 'cancelled';
}

function cleanupExpiredSchedules(now = Date.now()) {
  let removed = false;

  for (const [id, schedule] of atcSchedules.entries()) {
    if (isExpired(schedule, now)) {
      atcSchedules.delete(id);
      removed = true;
    }
  }

  return removed;
}

export async function loadAtcSchedules() {
  try {
    const raw = await fs.readFile(scheduleFilePath, 'utf8');
    const parsed = JSON.parse(raw);

    atcSchedules.clear();
    for (const schedule of Array.isArray(parsed) ? parsed : []) {
      const sanitized = sanitizeSchedule(schedule);
      if (sanitized) {
        atcSchedules.set(sanitized.id, sanitized);
      }
    }

    if (cleanupExpiredSchedules()) {
      await persistSchedules();
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function createAtcSchedule({
  guildId,
  pilotId,
  pilotName,
  airport,
  callsign,
  requestedTime,
  notes = '',
}) {
  const now = Date.now();
  const schedule = {
    id: createId(),
    guildId: String(guildId),
    pilotId: String(pilotId),
    pilotName: String(pilotName).trim(),
    airport: normalizeIcao(airport),
    callsign: normalizeCallsign(callsign),
    requestedTime,
    notes: String(notes || '').trim(),
    createdAt: now,
    status: 'open',
    controllers: [],
  };

  atcSchedules.set(schedule.id, schedule);
  await persistSchedules();
  return schedule;
}

export function listGuildSchedules(guildId, { includeMineForUserId = null, airport = null } = {}) {
  const now = Date.now();
  const requestedAirport = airport ? normalizeIcao(airport) : null;

  return Array.from(atcSchedules.values())
    .filter(schedule => schedule.guildId === String(guildId))
    .filter(schedule => !isExpired(schedule, now))
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
  if (!schedule || isExpired(schedule)) {
    return null;
  }

  return schedule;
}

export async function cancelAtcSchedule(id) {
  const scheduleId = String(id || '').trim().toUpperCase();
  const schedule = atcSchedules.get(scheduleId);
  if (!schedule) return null;

  atcSchedules.delete(scheduleId);
  await persistSchedules();
  return schedule;
}

export async function assignController(scheduleId, controller) {
  const schedule = getAtcSchedule(scheduleId);
  if (!schedule) {
    return { error: 'not_found' };
  }

  if (schedule.controllers.some(entry => entry.userId === controller.userId)) {
    return { error: 'already_assigned', schedule };
  }

  if (schedule.controllers.length >= controllerLimit) {
    return { error: 'full', schedule };
  }

  schedule.controllers.push({
    userId: String(controller.userId),
    username: String(controller.username).trim(),
    assignedAt: Date.now(),
  });

  await persistSchedules();
  return { schedule };
}

export async function unassignController(scheduleId, controllerUserId) {
  const schedule = getAtcSchedule(scheduleId);
  if (!schedule) {
    return { error: 'not_found' };
  }

  const nextControllers = schedule.controllers.filter(
    controller => controller.userId !== String(controllerUserId)
  );

  if (nextControllers.length === schedule.controllers.length) {
    return { error: 'not_assigned', schedule };
  }

  schedule.controllers = nextControllers;
  await persistSchedules();
  return { schedule };
}

export function formatScheduleTimestamp(timestamp) {
  const seconds = Math.floor(timestamp / 1000);
  return `<t:${seconds}:F> (<t:${seconds}:R>)`;
}

export function getControllerLimit() {
  return controllerLimit;
}
