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
        .setDescription('Mention each role separated by spaces')
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
    const rolesInput = interaction.options.getString('roles');

    if (!target) return interaction.reply('❌ Invalid user.');

    // Parse role mentions or names
    const roleIDs = [...rolesInput.matchAll(/<@&(\d+)>/g)].map(m => m[1]);
    const roleNames = rolesInput.split(',').map(r => r.trim());

    // Resolve roles
    const roles = [];
    for (const id of roleIDs) {
      const role = interaction.guild.roles.cache.get(id);
      if (role) roles.push(role);
    }

    // Also support names if user typed them
    for (const name of roleNames) {
      const role = interaction.guild.roles.cache.find(
        r => r.name.toLowerCase() === name.toLowerCase()
      );
      if (role && !roles.some(r => r.id === role.id)) roles.push(role);
    }

    if (!roles.length)
      return interaction.reply('❌ Could not find any valid roles.');

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
        '❌ I couldn’t modify one or more roles. Check my permissions or hierarchy.'
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

import http from "http";
const PORT = process.env.PORT || 10000;
http.createServer((_, res) => res.end("Bot is running")).listen(PORT);