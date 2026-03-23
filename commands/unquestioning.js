import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { deleteRoleBackup, roleBackups } from '../roleBackup.js';

export const data = new SlashCommandBuilder()
  .setName('unquestioning')
  .setDescription(
    'Removes the "Questioning" role and restores the user\'s previous roles.'
  )
  .addUserOption(option =>
    option.setName('user').setDescription('Target user').setRequired(true)
  );

export async function execute(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true,
    });
  }

  const target = interaction.options.getMember('user');
  if (!target) return interaction.reply('User not found.');

  const questioningRole = interaction.guild.roles.cache.find(
    r => r.name.toLowerCase() === 'questioning'
  );

  if (!questioningRole)
    return interaction.reply('❌ "Questioning" role doesn\'t exist in this server.');

  if (!target.roles.cache.has(questioningRole.id)) {
    return interaction.reply(`❌ ${target.displayName} doesn't have the Questioning role.`);
  }

  const backupKey = `${interaction.guild.id}-${target.id}`;
  const savedRoleIds = roleBackups.get(backupKey);

  if (!savedRoleIds || savedRoleIds.length === 0) {
    return interaction.reply(
      `❌ No saved roles found for ${target.displayName}. They may not have been set via /questioning, or the backup record is missing.`
    );
  }

  try {
    // Remove the Questioning role
    await target.roles.remove(questioningRole);

    // Restore old roles
    const restoredRoles = [];
    for (const roleId of savedRoleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        await target.roles.add(role);
        restoredRoles.push(role.name);
      }
    }

    // Clear the backup
    await deleteRoleBackup(backupKey);

    await interaction.reply({
      content: `✅ Removed **Questioning** from ${target.displayName}.\nRestored: ${
        restoredRoles.length ? restoredRoles.join(', ') : '(none)'
      }`,
    });
  } catch (err) {
    console.error(err);
    await interaction.reply(
      '❌ Couldn\'t modify roles. Check permissions or hierarchy.'
    );
  }
}
