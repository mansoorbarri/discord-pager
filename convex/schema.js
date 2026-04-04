import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const controllerValidator = v.object({
  userId: v.string(),
  username: v.string(),
  assignedAt: v.number(),
});

export default defineSchema({
  atcSchedules: defineTable({
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
  })
    .index('by_requestId', ['requestId'])
    .index('by_requestedTime', ['requestedTime'])
    .index('by_guild_requestedTime', ['guildId', 'requestedTime'])
    .index('by_guild_airport_requestedTime', ['guildId', 'airport', 'requestedTime'])
    .index('by_guild_pilot_requestedTime', ['guildId', 'pilotId', 'requestedTime']),
  roleBackups: defineTable({
    backupKey: v.string(),
    guildId: v.string(),
    userId: v.string(),
    roleIds: v.array(v.string()),
    updatedAt: v.number(),
  })
    .index('by_backupKey', ['backupKey'])
    .index('by_guildId', ['guildId']),
});
