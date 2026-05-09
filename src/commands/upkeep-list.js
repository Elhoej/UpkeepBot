import { SlashCommandBuilder } from 'discord.js';
import { listByGuild } from '../storage.js';
import { formatName } from '../format.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName('upkeep-list')
  .setDescription('List all tracked upkeep entries.')
  .setDMPermission(false);

export async function execute(interaction) {
  const entries = listByGuild(interaction.guildId);

  if (entries.length === 0) {
    await interaction.reply({
      content: 'No upkeeps are being tracked in this server. Use `/upkeep <name> <days>` to add one.',
      allowedMentions: { parse: [] },
    });
    return;
  }

  const now = Date.now();
  const lines = entries.map((e) => {
    const expiresAt = e.last_paid_at + e.duration_days * DAY_MS;
    const expiresUnix = Math.floor(expiresAt / 1000);
    const verb = expiresAt > now ? 'expires' : 'expired';
    return `• **${formatName(e.name)}** — ${verb} <t:${expiresUnix}:R> · ${e.duration_days}d cycle · paid by <@${e.owner_id}>`;
  });

  await interaction.reply({
    content: `📜 Upkeep tracked (${entries.length}):\n${lines.join('\n')}`,
    allowedMentions: { parse: [] },
  });
}
