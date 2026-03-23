import fs from 'fs/promises';
import path from 'path';

const dataDir = path.resolve('./data');
const backupFilePath = path.join(dataDir, 'roleBackups.json');

// In-memory cache backed by disk so role restoration survives bot restarts.
export const roleBackups = new Map();

async function persistRoleBackups() {
  await fs.mkdir(dataDir, { recursive: true });
  const tempFilePath = `${backupFilePath}.tmp`;
  const serialized = JSON.stringify(Object.fromEntries(roleBackups), null, 2);
  await fs.writeFile(tempFilePath, serialized, 'utf8');
  await fs.rename(tempFilePath, backupFilePath);
}

export async function loadRoleBackups() {
  try {
    const raw = await fs.readFile(backupFilePath, 'utf8');
    const parsed = JSON.parse(raw);

    roleBackups.clear();
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        roleBackups.set(key, value);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function setRoleBackup(key, roleIds) {
  roleBackups.set(key, roleIds);
  await persistRoleBackups();
}

export async function deleteRoleBackup(key) {
  roleBackups.delete(key);
  await persistRoleBackups();
}
