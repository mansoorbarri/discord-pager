import dotenv from 'dotenv';
import { Client, GatewayIntentBits, REST, Routes, Collection, Partials } from 'discord.js';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { cancelReminderFromReaction, startReminderWatcher } from './services/reminderWatcher.js';
import { loadRoleBackups } from './roleBackup.js';
import { loadAtcSchedules } from './services/atcScheduleStore.js';

dotenv.config({ path: '.env.local', override: false });
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.commands = new Collection();

await loadRoleBackups();
await loadAtcSchedules();

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
client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  void startReminderWatcher(client);
});

// ---------- INTERACTION HANDLER ----------
client.on('interactionCreate', async interaction => {
  // Handle select menu interactions (e.g., ATC position selection)
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('atc_position:')) {
      try {
        const airportOnline = client.commands.get('airport_online');
        if (airportOnline?.handlePositionSelect) {
          await airportOnline.handlePositionSelect(interaction);
        }
      } catch (error) {
        console.error('Select menu error:', error);
        try {
          await interaction.update({ content: 'Something went wrong.', components: [] });
        } catch {}
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const msg = 'Something went wrong running that command.';
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ content: msg, flags: 1 << 6 });
      }
    } catch (followupError) {
      console.error('Follow-up error:', followupError.message);
    }
  }
});

// ---------- ROLE-MENTION GUARD ----------
const PROTECTED_ROLE_ID = '1377626281897754687';
const ALLOWED_ROLE_ID = '1377626143838048426';

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.mentions.roles.has(PROTECTED_ROLE_ID)) return;
  if (message.member?.roles.cache.has(ALLOWED_ROLE_ID)) return;

  try {
    await message.delete();
    const warning = await message.channel.send(
      `${message.author}, you don't have permission to ping <@&${PROTECTED_ROLE_ID}>.`
    );
    setTimeout(() => warning.delete().catch(() => {}), 5000);
  } catch (err) {
    console.error('Role-mention guard error:', err.message);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) {
      await reaction.fetch();
    }

    if (reaction.message.partial) {
      await reaction.message.fetch();
    }

    await cancelReminderFromReaction(reaction.message.id, user.id);
  } catch (error) {
    console.error('[reminder] reaction cancel failed:', error);
  }
});

// ---------- KEEP ALIVE FOR RENDER FREE TIER ----------
const PORT = process.env.PORT || 10000;
http.createServer((_, res) => res.end('Bot alive')).listen(PORT);

// ---------- LOGIN ----------
client.login(process.env.DISCORD_TOKEN);
