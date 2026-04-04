import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server.js';
import { internal } from './_generated/api.js';

const http = httpRouter();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function assertAuthorized(request) {
  const secret = request.headers.get('x-convex-bot-secret');
  if (!secret || secret !== process.env.CONVEX_BOT_SHARED_SECRET) {
    throw new Error('Unauthorized bot request.');
  }
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function serializeError(error, status = 400) {
  return json(
    {
      ok: false,
      error: error instanceof Error ? error.message : 'Unexpected error.',
    },
    status
  );
}

http.route({
  path: '/bot/atc-schedules/create',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      assertAuthorized(request);
      const args = await parseJson(request);
      const result = await ctx.runMutation(internal.atcSchedules.create, args);
      return json({ ok: true, ...result });
    } catch (error) {
      return serializeError(error, 400);
    }
  }),
});

http.route({
  path: '/bot/atc-schedules/cancel',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      assertAuthorized(request);
      const args = await parseJson(request);
      const schedule = await ctx.runMutation(internal.atcSchedules.cancel, args);
      return json({ ok: true, schedule });
    } catch (error) {
      return serializeError(error, 400);
    }
  }),
});

http.route({
  path: '/bot/atc-schedules/assign',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      assertAuthorized(request);
      const args = await parseJson(request);
      const result = await ctx.runMutation(internal.atcSchedules.assignController, args);
      return json({ ok: true, ...result });
    } catch (error) {
      return serializeError(error, 400);
    }
  }),
});

http.route({
  path: '/bot/atc-schedules/unassign',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      assertAuthorized(request);
      const args = await parseJson(request);
      const result = await ctx.runMutation(internal.atcSchedules.unassignController, args);
      return json({ ok: true, ...result });
    } catch (error) {
      return serializeError(error, 400);
    }
  }),
});

http.route({
  path: '/bot/atc-schedules/prune',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      assertAuthorized(request);
      await parseJson(request);
      const removed = await ctx.runMutation(internal.atcSchedules.pruneExpired, {});
      return json({ ok: true, removed });
    } catch (error) {
      return serializeError(error, 400);
    }
  }),
});

http.route({
  path: '/bot/role-backups/set',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      assertAuthorized(request);
      const args = await parseJson(request);
      const roleBackup = await ctx.runMutation(internal.roleBackups.set, args);
      return json({ ok: true, roleBackup });
    } catch (error) {
      return serializeError(error, 400);
    }
  }),
});

http.route({
  path: '/bot/role-backups/delete',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      assertAuthorized(request);
      const args = await parseJson(request);
      const deleted = await ctx.runMutation(internal.roleBackups.remove, args);
      return json({ ok: true, deleted });
    } catch (error) {
      return serializeError(error, 400);
    }
  }),
});

export default http;
