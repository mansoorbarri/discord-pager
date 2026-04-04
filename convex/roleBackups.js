import { v } from 'convex/values';
import { query, internalMutation } from './_generated/server.js';

const roleBackupValidator = v.object({
  _id: v.id('roleBackups'),
  _creationTime: v.number(),
  backupKey: v.string(),
  guildId: v.string(),
  userId: v.string(),
  roleIds: v.array(v.string()),
  updatedAt: v.number(),
});

function normalizeName(value, fieldName) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

function normalizeRoleIds(roleIds) {
  if (!Array.isArray(roleIds)) {
    throw new Error('roleIds must be an array.');
  }

  return roleIds
    .map(roleId => String(roleId || '').trim())
    .filter(Boolean);
}

async function getRoleBackupDocByKey(ctx, backupKey) {
  return await ctx.db
    .query('roleBackups')
    .withIndex('by_backupKey', q => q.eq('backupKey', String(backupKey || '').trim()))
    .unique();
}

function toRoleBackupResponse(doc) {
  if (!doc) return null;

  return {
    backupKey: doc.backupKey,
    guildId: doc.guildId,
    userId: doc.userId,
    roleIds: doc.roleIds,
    updatedAt: doc.updatedAt,
  };
}

export const watchBotRoleBackups = query({
  args: {
    botToken: v.string(),
  },
  returns: v.array(roleBackupValidator),
  handler: async (ctx, args) => {
    if (args.botToken !== process.env.CONVEX_BOT_SHARED_SECRET) {
      throw new Error('Unauthorized bot query.');
    }

    return await ctx.db.query('roleBackups').collect();
  },
});

export const set = internalMutation({
  args: {
    backupKey: v.string(),
    guildId: v.string(),
    userId: v.string(),
    roleIds: v.array(v.string()),
  },
  returns: v.object({
    backupKey: v.string(),
    guildId: v.string(),
    userId: v.string(),
    roleIds: v.array(v.string()),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const backupKey = normalizeName(args.backupKey, 'backupKey');
    const guildId = normalizeName(args.guildId, 'guildId');
    const userId = normalizeName(args.userId, 'userId');
    const roleIds = normalizeRoleIds(args.roleIds);
    const updatedAt = Date.now();

    const existing = await getRoleBackupDocByKey(ctx, backupKey);
    if (existing) {
      await ctx.db.patch(existing._id, { guildId, userId, roleIds, updatedAt });
      const updated = await ctx.db.get(existing._id);
      return toRoleBackupResponse(updated);
    }

    const docId = await ctx.db.insert('roleBackups', {
      backupKey,
      guildId,
      userId,
      roleIds,
      updatedAt,
    });
    const created = await ctx.db.get(docId);
    return toRoleBackupResponse(created);
  },
});

export const remove = internalMutation({
  args: {
    backupKey: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await getRoleBackupDocByKey(ctx, args.backupKey);
    if (!existing) {
      return false;
    }

    await ctx.db.delete(existing._id);
    return true;
  },
});
