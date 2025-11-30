import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('questioning')
  .setDescription(
    'Removes all current roles from a user and assigns only the "Questioning" role.'
  )
  .addUserOption(option =>
    option.setName('user').setDescription('Target user').setRequired(true)
  );

export async function execute(interaction) {
  const target = interaction.options.getMember('user');
  if (!target) return interaction.reply('User not found.');

  const rolesToRemove = target.roles.cache.filter(r => r.name !== '@everyone');
  const questioningRole = interaction.guild.roles.cache.find(
    r => r.name.toLowerCase() === 'questioning'
  );

  if (!questioningRole)
    return interaction.reply('❌ "Questioning" role doesn’t exist in this server.');

  const oldRoles = rolesToRemove.map(r => r.name);

  try {
    for (const role of rolesToRemove.values()) {
      await target.roles.remove(role);
    }

    await target.roles.add(questioningRole);

    await interaction.reply({
      content: `✅ Set ${target.displayName} to **Questioning**.\nRemoved: ${
        oldRoles.length ? oldRoles.join(', ') : '(none)'
      }`,
    });
  } catch (err) {
    console.error(err);
    await interaction.reply(
      '❌ Couldn’t modify roles. Check permissions or hierarchy.'
    );
  }
}