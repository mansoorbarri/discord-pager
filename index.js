import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import http from 'http';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();

// ---------- LOAD COMMAND FILES ----------
const commands = [];
const commandsPath = path.resolve('./commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const cmd = await import(`./commands/${file}`);
  client.commands.set(cmd.data.name, cmd);
  commands.push(cmd.data.toJSON());
}

// ---------- REGISTER SLASH COMMANDS ----------
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log('Registering commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log(`✅ Registered ${commands.length} commands!`);
  } catch (err) {
    console.error('❌ Command registration failed:', err);
  }
})();

// ---------- READY ----------
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ---------- INTERACTION HANDLER (put THIS part) ----------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const msg = '❌ Something went wrong running that command.';
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg);
      } else {
        // `flags: 1 << 6` = ephemeral = only user can see
        await interaction.reply({ content: msg, flags: 1 << 6 });
      }
    } catch (followupError) {
      console.error('Follow‑up error:', followupError.message);
    }
  }
});

// ---------- KEEP ALIVE FOR RENDER FREE TIER ----------
const PORT = process.env.PORT || 10000;
http.createServer((_, res) => res.end('Bot alive')).listen(PORT);

// ---------- LOGIN ----------
client.login(process.env.DISCORD_TOKEN);