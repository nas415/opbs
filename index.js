import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits } from 'discord.js';

// Minimal index.js: one Discord client, single Express health server.

const PORT = Number(process.env.PORT || 3000);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('error', (err) => console.error('Client error:', err));

if (!process.env.TOKEN) {
  console.error('TOKEN is missing in environment');
  process.exit(1);
}

// Call login exactly once.
client.login(process.env.TOKEN).catch(err => {
  console.error('Failed to login:', err);
  process.exit(1);
});

// Simple Express health server so Render sees an open HTTP port.
const app = express();

app.get(['/', '/health', '/_health'], (req, res) => res.status(200).send('OK'));

app.listen(PORT, () => {
  console.log(`Health server listening on port ${PORT}`);
});
