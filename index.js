import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// --- Define our slash commands ---
const commands = [
  // First command: /role
  new SlashCommandBuilder()
    .setName('role')
    .setDescription('Assign or remove a role from a user.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('add or remove')
        .setRequired(true)
        .addChoices(
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' }
        )
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('The role to assign or remove')
        .setRequired(true)
    ),

  // Second command: /questioning
  new SlashCommandBuilder()
    .setName('questioning')
    .setDescription(
      'Removes all current roles from a user and assigns only the "Questioning" role.'
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to assign the role to')
        .setRequired(true)
    ),
].map(cmd => cmd.toJSON());

// --- Register both commands globally ---
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log('Registering commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log('✅ Commands registered!');
  } catch (err) {
    console.error(err);
  }
})();

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  // ------------------------------------------------------------------
  // Handle /role command
  // ------------------------------------------------------------------
  if (interaction.commandName === 'role') {
    const target = interaction.options.getMember('user');
    const action = interaction.options.getString('action');
    const role = interaction.options.getRole('role');

    if (!target || !role)
      return interaction.reply('Invalid user or role.');

    try {
      if (action === 'add') {
        await target.roles.add(role);
        await interaction.reply(
          `✅ Added role **${role.name}** to ${target.displayName}.`
        );
      } else if (action === 'remove') {
        await target.roles.remove(role);
        await interaction.reply(
          `🗑️ Removed role **${role.name}** from ${target.displayName}.`
        );
      } else {
        await interaction.reply('❌ Unknown action.');
      }
    } catch (err) {
      console.error(err);
      await interaction.reply(
        '❌ I couldn’t modify that role. Please check my permissions.'
      );
    }
    return;
  }

  // ------------------------------------------------------------------
  // Handle /questioning command
  // ------------------------------------------------------------------
  if (interaction.commandName === 'questioning') {
    const target = interaction.options.getMember('user');
    if (!target) return interaction.reply('User not found.');

    // Get all roles except @everyone
    const rolesToRemove = target.roles.cache.filter(r => r.name !== '@everyone');

    // Get or find the "Questioning" role
    const questioningRole = interaction.guild.roles.cache.find(
      r => r.name.toLowerCase() === 'questioning'
    );

    if (!questioningRole)
      return interaction.reply('❌ No role named "Questioning" exists.');

    const oldRoles = rolesToRemove.map(r => r.name);

    try {
      // Remove all previous roles except @everyone
      for (const role of rolesToRemove.values()) {
        await target.roles.remove(role);
      }

      // Add only the Questioning role
      await target.roles.add(questioningRole);

      await interaction.reply({
        content: `✅ Set ${target.displayName} to **Questioning**.\nRemoved roles: ${
          oldRoles.length ? oldRoles.join(', ') : '(none)'
        }`,
      });
    } catch (err) {
      console.error(err);
      await interaction.reply(
        '❌ I couldn’t update roles. Check my permissions or role hierarchy.'
      );
    }

    return;
  }
});

client.login(process.env.DISCORD_TOKEN);