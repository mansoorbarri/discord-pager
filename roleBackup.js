// In-memory storage for role backups (keyed by `guildId-userId`)
// Note: This resets if the bot restarts
export const roleBackups = new Map();
