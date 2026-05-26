import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import * as upkeep from './commands/upkeep.js';
import * as upkeepList from './commands/upkeep-list.js';
import * as upkeepRemove from './commands/upkeep-remove.js';
import { startScheduler } from './scheduler.js';

if (!process.env.DISCORD_TOKEN || !process.env.APP_ID) {
  console.error('Missing required env vars: DISCORD_TOKEN and APP_ID must both be set.');
  process.exit(1);
}

const commands = new Map([upkeep, upkeepList, upkeepRemove].map((cmd) => [cmd.data.name, cmd]));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  startScheduler(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd?.autocomplete) return;
    try {
      await cmd.autocomplete(interaction);
    } catch (err) {
      console.error(`${interaction.commandName} autocomplete failed:`, err);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`${interaction.commandName} command failed:`, err);
    const reply = { content: 'Something went wrong handling that command.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
