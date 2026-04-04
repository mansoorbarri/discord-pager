import { v } from 'convex/values';
import { query, internalQuery, internalMutation } from './_generated/server.js';

const ICAO_REGEX = /^[A-Z]{4}$/;
const CALLSIGN_REGEX = /^[A-Z0-9-]{2,12}$/;
const MAX_NOTES_LENGTH = 300;
const MAX_LOOKAHEAD_DAYS = 30;
const CONTROLLER_LIMIT = 2;
const EXPIRATION_WINDOW_MS = 6 * 60 * 60 * 1000;

const controllerValidator = v.object({
  userId: v.string(),
  username: v.string(),
  assignedAt: v.number(),
});

const scheduleValidator = v.object({
  _id: v.id('atcSchedules'),
  _creationTime: v.number(),
  requestId: v.string(),
  guildId: v.string(),
  pilotId: v.string(),
  pilotName: v.string(),
  airport: v.string(),
  direction: v.union(v.literal('arrival'), v.literal('departure')),
  callsign: v.string(),
  requestedTime: v.number(),
  notes: v.string(),
  createdAt: v.number(),
  controllers: v.array(controllerValidator),
});

function normalizeIcao(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeCallsign(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeDirection(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized !== 'arrival' && normalized !== 'departure') {
    throw new Error('Direction must be "arrival" or "departure".');
  }
  return normalized;
}

function normalizeName(value, fieldName) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

function normalizeNotes(value) {
  const normalized = String(value || '').trim();
  if (normalized.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`);
  }
  return normalized;
}

function assertFiniteTimestamp(value, fieldName) {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a valid timestamp.`);
  }
}

function assertValidCreateArgs(args, now = Date.now()) {
  if (!ICAO_REGEX.test(args.airport)) {
    throw new Error('Airport must be a valid 4-letter ICAO code.');
  }
  if (!CALLSIGN_REGEX.test(args.callsign)) {
    throw new Error('Callsign must be 2-12 letters, numbers, or hyphens.');
  }
  assertFiniteTimestamp(args.requestedTime, 'requestedTime');

  const latestAllowed = now + MAX_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;
  if (args.requestedTime < now) {
    throw new Error('Requested time must be in the future.');
  }
  if (args.requestedTime > latestAllowed) {
    throw new Error(`Requested time must be within ${MAX_LOOKAHEAD_DAYS} days.`);
  }
}

function assertValidController(controller) {
  normalizeName(controller.userId, 'controller userId');
  normalizeName(controller.username, 'controller username');
}

async function getScheduleDocByRequestId(ctx, requestId) {
  return await ctx.db
    .query('atcSchedules')
    .withIndex('by_requestId', q => q.eq('requestId', String(requestId || '').trim().toUpperCase()))
    .unique();
}

function toScheduleResponse(doc) {
  if (!doc) return null;

  return {
    requestId: doc.requestId,
    guildId: doc.guildId,
    pilotId: doc.pilotId,
    pilotName: doc.pilotName,
    airport: doc.airport,
    direction: doc.direction,
    callsign: doc.callsign,
    requestedTime: doc.requestedTime,
    notes: doc.notes,
    createdAt: doc.createdAt,
    controllers: doc.controllers,
  };
}

export const watchBotSchedules = query({
  args: {
    botToken: v.string(),
  },
  returns: v.array(scheduleValidator),
  handler: async (ctx, args) => {
    if (args.botToken !== process.env.CONVEX_BOT_SHARED_SECRET) {
      throw new Error('Unauthorized bot query.');
    }

    return await ctx.db
      .query('atcSchedules')
      .withIndex('by_requestedTime', q => q.gte('requestedTime', Date.now()))
      .collect();
  },
});

export const getByRequestId = internalQuery({
  args: {
    requestId: v.string(),
  },
  returns: v.union(scheduleValidator, v.null()),
  handler: async (ctx, args) => {
    return await getScheduleDocByRequestId(ctx, args.requestId);
  },
});

export const create = internalMutation({
  args: {
    requestId: v.string(),
    guildId: v.string(),
    pilotId: v.string(),
    pilotName: v.string(),
    airport: v.string(),
    direction: v.string(),
    callsign: v.string(),
    requestedTime: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    duplicate: v.boolean(),
    schedule: v.union(
      v.object({
        requestId: v.string(),
        guildId: v.string(),
        pilotId: v.string(),
        pilotName: v.string(),
        airport: v.string(),
        direction: v.union(v.literal('arrival'), v.literal('departure')),
        callsign: v.string(),
        requestedTime: v.number(),
        notes: v.string(),
        createdAt: v.number(),
        controllers: v.array(controllerValidator),
      }),
      v.null()
    ),
  }),
  handler: async (ctx, args) => {
    const requestId = normalizeName(args.requestId, 'requestId').toUpperCase();
    const airport = normalizeIcao(args.airport);
    const direction = normalizeDirection(args.direction);
    const callsign = normalizeCallsign(args.callsign);
    const pilotName = normalizeName(args.pilotName, 'pilotName');
    const notes = normalizeNotes(args.notes || '');

    assertValidCreateArgs({
      airport,
      callsign,
      requestedTime: args.requestedTime,
    });

    const existing = await getScheduleDocByRequestId(ctx, requestId);
    if (existing) {
      return { duplicate: true, schedule: null };
    }

    const createdAt = Date.now();
    const docId = await ctx.db.insert('atcSchedules', {
      requestId,
      guildId: normalizeName(args.guildId, 'guildId'),
      pilotId: normalizeName(args.pilotId, 'pilotId'),
      pilotName,
      airport,
      direction,
      callsign,
      requestedTime: args.requestedTime,
      notes,
      createdAt,
      controllers: [],
    });

    const schedule = await ctx.db.get(docId);
    return {
      duplicate: false,
      schedule: toScheduleResponse(schedule),
    };
  },
});

export const cancel = internalMutation({
  args: {
    requestId: v.string(),
  },
  returns: v.union(
    v.object({
      requestId: v.string(),
      guildId: v.string(),
      pilotId: v.string(),
      pilotName: v.string(),
      airport: v.string(),
      direction: v.union(v.literal('arrival'), v.literal('departure')),
      callsign: v.string(),
      requestedTime: v.number(),
      notes: v.string(),
      createdAt: v.number(),
      controllers: v.array(controllerValidator),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const schedule = await getScheduleDocByRequestId(ctx, args.requestId);
    if (!schedule) {
      return null;
    }

    await ctx.db.delete(schedule._id);
    return toScheduleResponse(schedule);
  },
});

export const assignController = internalMutation({
  args: {
    requestId: v.string(),
    controller: controllerValidator,
  },
  returns: v.object({
    error: v.union(v.literal('not_found'), v.literal('already_assigned'), v.literal('full'), v.null()),
    schedule: v.union(
      v.object({
        requestId: v.string(),
        guildId: v.string(),
        pilotId: v.string(),
        pilotName: v.string(),
        airport: v.string(),
        direction: v.union(v.literal('arrival'), v.literal('departure')),
        callsign: v.string(),
        requestedTime: v.number(),
        notes: v.string(),
        createdAt: v.number(),
        controllers: v.array(controllerValidator),
      }),
      v.null()
    ),
  }),
  handler: async (ctx, args) => {
    assertValidController(args.controller);

    const schedule = await getScheduleDocByRequestId(ctx, args.requestId);
    if (!schedule || schedule.requestedTime < Date.now()) {
      return { error: 'not_found', schedule: null };
    }

    if (schedule.controllers.some(entry => entry.userId === args.controller.userId)) {
      return { error: 'already_assigned', schedule: toScheduleResponse(schedule) };
    }

    if (schedule.controllers.length >= CONTROLLER_LIMIT) {
      return { error: 'full', schedule: toScheduleResponse(schedule) };
    }

    const controllers = schedule.controllers.concat({
      userId: args.controller.userId,
      username: args.controller.username,
      assignedAt: Date.now(),
    });

    await ctx.db.patch(schedule._id, { controllers });
    const updated = await ctx.db.get(schedule._id);
    return { error: null, schedule: toScheduleResponse(updated) };
  },
});

export const unassignController = internalMutation({
  args: {
    requestId: v.string(),
    controllerUserId: v.string(),
  },
  returns: v.object({
    error: v.union(v.literal('not_found'), v.literal('not_assigned'), v.null()),
    schedule: v.union(
      v.object({
        requestId: v.string(),
        guildId: v.string(),
        pilotId: v.string(),
        pilotName: v.string(),
        airport: v.string(),
        direction: v.union(v.literal('arrival'), v.literal('departure')),
        callsign: v.string(),
        requestedTime: v.number(),
        notes: v.string(),
        createdAt: v.number(),
        controllers: v.array(controllerValidator),
      }),
      v.null()
    ),
  }),
  handler: async (ctx, args) => {
    const schedule = await getScheduleDocByRequestId(ctx, args.requestId);
    if (!schedule || schedule.requestedTime < Date.now()) {
      return { error: 'not_found', schedule: null };
    }

    const controllers = schedule.controllers.filter(
      controller => controller.userId !== String(args.controllerUserId || '').trim()
    );

    if (controllers.length === schedule.controllers.length) {
      return { error: 'not_assigned', schedule: toScheduleResponse(schedule) };
    }

    await ctx.db.patch(schedule._id, { controllers });
    const updated = await ctx.db.get(schedule._id);
    return { error: null, schedule: toScheduleResponse(updated) };
  },
});

export const pruneExpired = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - EXPIRATION_WINDOW_MS;
    const expired = await ctx.db
      .query('atcSchedules')
      .withIndex('by_requestedTime', q => q.lt('requestedTime', cutoff))
      .collect();

    for (const schedule of expired) {
      await ctx.db.delete(schedule._id);
    }

    return expired.length;
  },
});
