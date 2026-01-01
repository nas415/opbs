import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { connectDB } from './config/database.js';

// Robust dynamic import for discord.js: some hosts/installers can leave
// different package layouts. Try the package root first, then fall back
// to the built `dist` entrypoint if present.
async function loadDiscord() {
  try {
    return await import('discord.js');
  } catch (e1) {
    try {
      return await import('discord.js/dist/index.js');
    } catch (e2) {
      console.error('Failed to import discord.js: ', e1 && e1.message ? e1.message : e1, e2 && e2.message ? e2.message : e2);
      return null;
    }
  }
}

const discord = await loadDiscord();
if (!discord) {
  console.error('discord.js could not be loaded. Ensure it is installed correctly.');
  process.exit(1);
}
const { Client, GatewayIntentBits, Collection } = discord;

// HTTP server removed — this runtime no longer starts an embedded web server.

const DISABLE_GATEWAY = !!(process.env.DISABLE_GATEWAY || process.env.INTERACTIONS_ONLY);

if (!DISABLE_GATEWAY) {
  // Connect to DB early so command handlers can access models
  if (process.env.MONGO_URI) {
    try {
      await connectDB();
    } catch (e) {
      console.error('Failed to connect to MongoDB:', e && e.message ? e.message : e);
    }
  }

  // Build intents. MessageContent is required for prefix message commands.
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ];

  const client = new Client({ intents });

  client.commands = new Collection();

  console.log('Configured gateway intents:', intents.map(i => i && i.toString ? i.toString() : i));
  if (!intents.includes(GatewayIntentBits.MessageContent)) {
    console.warn('⚠️ Message Content intent is NOT included in the client setup. Message-based commands will NOT work unless this intent is enabled and also allowed in the Bot settings in the Discord Developer Portal.');
  } else {
    console.log('✅ Message Content intent is included in the client configuration. Make sure it is also enabled in the Discord Developer Portal.');
  }

  // dynamically load commands
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    try {
      const imported = await import(`./commands/${file}`);
      const command = imported.default || imported;
      let cmdName;
      try {
        cmdName = (command.data && command.data.name) || (command.data && command.data.toJSON && command.data.toJSON().name) || file.replace(/\.js$/, "");
      } catch (e) {
        cmdName = file.replace(/\.js$/, "");
      }
      client.commands.set(String(cmdName).toLowerCase(), command);
      if (command.aliases && Array.isArray(command.aliases)) {
        for (const a of command.aliases) client.commands.set(String(a).toLowerCase(), command);
      }
    } catch (e) {
      console.error('Failed loading command', file, e && e.message ? e.message : e);
    }
  }

  console.log(`Loaded ${client.commands.size} command entries (including aliases).`);

  // simple message-based prefix handling: prefix is "op" (case-insensitive)
  const Progress = (await import('./models/Progress.js')).default;
  client.on('messageCreate', async (message) => {
    try {
      if (!message.content) return;
      if (message.author?.bot) return;

      const parts = message.content.trim().split(/\s+/);
      if (parts.length < 2) return;
      if (parts[0].toLowerCase() !== 'op') return;

      const commandName = parts[1].toLowerCase();
      const command = client.commands.get(commandName);
      if (!command) return;

      try {
        if (commandName !== 'start') {
          const acct = await Progress.findOne({ userId: String(message.author.id) });
          if (!acct) return await message.channel.send("You don't have an account! Start your journey with the command `op start` or `/start`.");
        }
      } catch (e) {
        console.error('Account check failed:', e && e.message ? e.message : e);
      }

      await command.execute(message, client);
    } catch (err) {
      console.error('Error handling message command:', err);
    }
  });

  // dynamically load events
  const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    try {
      const event = await import(`./events/${file}`);
      if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
      else client.on(event.name, (...args) => event.execute(...args, client));
    } catch (e) {
      console.error('Failed loading event', file, e && e.message ? e.message : e);
    }
  }

  // Optional: auto-register slash commands if explicitly enabled
  if (process.env.REGISTER_COMMANDS_ON_START === 'true') {
    (async () => {
      try {
        console.log('REGISTER_COMMANDS_ON_START is true: importing deploy-commands.js to register slash commands...');
        await import('./deploy-commands.js');
        console.log('Slash command registration attempt finished.');
      } catch (err) {
        console.error('Error while auto-registering commands:', err && err.message ? err.message : err);
      }
    })();
  }

  if (!process.env.TOKEN) {
    console.error('❌ TOKEN is missing');
    process.exit(1);
  }

  client.on('error', err => console.error('Client error:', err));
  client.on('shardError', err => console.error('Shard error:', err));

  (async () => {
    try {
      console.log('🚀 Calling client.login() now…');
      await client.login(process.env.TOKEN);
      console.log(`✅ Logged in as ${client.user.tag}`);
    } catch (err) {
      console.error('❌ client.login() failed:', err);
    }
  })();

} else {
  console.log('DISABLE_GATEWAY is set — running in interactions-only (webhook) mode');
}

// Express-based HTTP server and Discord interactions webhook removed.
// If you need webhook handling later, restore the Express code and routes.
