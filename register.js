import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import * as upkeep from './src/commands/upkeep.js';
import * as upkeepList from './src/commands/upkeep-list.js';

const { DISCORD_TOKEN, APP_ID } = process.env;

if (!DISCORD_TOKEN || !APP_ID) {
  console.error('Missing required env vars: DISCORD_TOKEN and APP_ID must both be set.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

try {
  const body = [upkeep.data.toJSON(), upkeepList.data.toJSON()];
  const result = await rest.put(Routes.applicationCommands(APP_ID), { body });
  console.log(`Registered ${result.length} command(s):`, result.map((c) => c.name).join(', '));
} catch (err) {
  console.error('Failed to register commands:', err);
  process.exit(1);
}
