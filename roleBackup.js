import { api } from './convex/_generated/api.js';
import { getBotSecret, postConvexBotAction, subscribeBotQuery } from './services/convexBotRuntime.js';

const initialSyncTimeoutMs = 15_000;

export const roleBackups = new Map();

let unsubscribeFromRoleBackups = null;
let initialSyncPromise = null;

function refreshCache(backups) {
  roleBackups.clear();

  for (const backup of Array.isArray(backups) ? backups : []) {
    const backupKey = String(backup?.backupKey || '').trim();
    const roleIds = Array.isArray(backup?.roleIds)
      ? backup.roleIds.map(roleId => String(roleId || '').trim()).filter(Boolean)
      : [];

    if (backupKey) {
      roleBackups.set(backupKey, roleIds);
    }
  }
}

function parseBackupKey(key) {
  const [guildId = '', userId = ''] = String(key || '').split('-');
  return {
    guildId: guildId.trim(),
    userId: userId.trim(),
  };
}

export async function loadRoleBackups() {
  if (initialSyncPromise) {
    return initialSyncPromise;
  }

  if (unsubscribeFromRoleBackups) {
    unsubscribeFromRoleBackups();
    unsubscribeFromRoleBackups = null;
  }

  initialSyncPromise = new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Timed out waiting for the initial Convex role backup sync.'));
      }
    }, initialSyncTimeoutMs);

    unsubscribeFromRoleBackups = subscribeBotQuery(
      api.roleBackups.watchBotRoleBackups,
      { botToken: getBotSecret() },
      backups => {
        refreshCache(backups);
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
          reject(error);
          return;
        }

        console.error('[role-backups] Convex subscription error:', error);
      }
    );
  });

  return initialSyncPromise;
}

export async function setRoleBackup(key, roleIds) {
  const backupKey = String(key || '').trim();
  const normalizedRoleIds = Array.isArray(roleIds)
    ? roleIds.map(roleId => String(roleId || '').trim()).filter(Boolean)
    : [];
  const { guildId, userId } = parseBackupKey(backupKey);

  await postConvexBotAction('/bot/role-backups/set', {
    backupKey,
    guildId,
    userId,
    roleIds: normalizedRoleIds,
  });

  roleBackups.set(backupKey, normalizedRoleIds);
}

export async function deleteRoleBackup(key) {
  const backupKey = String(key || '').trim();
  await postConvexBotAction('/bot/role-backups/delete', { backupKey });
  roleBackups.delete(backupKey);
}
