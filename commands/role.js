import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Add or remove multiple roles from a user.')
  .addUserOption(option =>
    option.setName('user').setDescription('Target user').setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('action')
      .setDescription('Add or remove the roles')
      .setRequired(true)
      .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' })
  )
  .addStringOption(option =>
    option
      .setName('roles')
      .setDescription('Mention each role separated by spaces or commas')
      .setRequired(true)
  );

export async function execute(interaction) {
  const target = interaction.options.getMember('user');
  const action = interaction.options.getString('action');
  const rolesInput = interaction.options.getString('roles');

  if (!target)
    return interaction.reply({ content: '❌ Invalid user.', ephemeral: true });

  const roleIDs = [...rolesInput.matchAll(/<@&(\d+)>/g)].map(m => m[1]);
  const roleNames = rolesInput.split(',').map(r => r.trim());
  const roles = [];

  for (const id of roleIDs) {
    const role = interaction.guild.roles.cache.get(id);
    if (role) roles.push(role);
  }

  for (const name of roleNames) {
    const role = interaction.guild.roles.cache.find(
      r => r.name.toLowerCase() === name.toLowerCase()
    );
    if (role && !roles.some(r => r.id === role.id)) roles.push(role);
  }

  if (!roles.length)
    return interaction.reply({ content: '❌ No valid roles found.', ephemeral: true });

  try {
    if (action === 'add') {
      for (const role of roles) await target.roles.add(role);
      await interaction.reply(
        `✅ Added roles ${roles.map(r => `**${r.name}**`).join(', ')} to ${target.displayName}.`
      );
    } else if (action === 'remove') {
      for (const role of roles) await target.roles.remove(role);
      await interaction.reply(
        `🗑️ Removed roles ${roles.map(r => `**${r.name}**`).join(', ')} from ${target.displayName}.`
      );
    } else {
      await interaction.reply('❌ Unknown action.');
    }
  } catch (err) {
    console.error(err);
    await interaction.reply(
      '❌ I couldn’t modify those roles. Check permissions or position.'
    );
  }
}