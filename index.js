import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import http from 'http';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();

// Dynamically load commands from ./commands folder
const commands = [];
const commandsPath = path.resolve('./commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

// Register all commands globally
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log('Registering commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log(`✅ Registered ${commands.length} commands!`);
  } catch (err) {
    console.error('❌ Command registration failed:', err);
  }
})();

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: '❌ There was an error executing that command.',
      ephemeral: true,
    });
  }
});

// Keep service alive for Render free tier
const PORT = process.env.PORT || 10000;
http.createServer((_, res) => res.end('Bot alive')).listen(PORT);

client.login(process.env.DISCORD_TOKEN);