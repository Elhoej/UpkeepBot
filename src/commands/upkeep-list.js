import { SlashCommandBuilder } from 'discord.js';
import { listByGuild } from '../storage.js';
import { formatName } from '../format.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHUNK_LIMIT = 3900; // safe under the 4096-char embed description cap

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

  // Greedily pack lines into chunks that fit inside one embed description.
  const chunks = [];
  let current = [];
  let currentLen = 0;
  for (const line of lines) {
    if (currentLen + line.length + 1 > CHUNK_LIMIT && current.length) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(line);
    currentLen += line.length + 1;
  }
  if (current.length) chunks.push(current);

  const total = chunks.length;
  const buildEmbed = (chunk, i) => ({
    title: total === 1
      ? `📜 Upkeep tracked (${entries.length})`
      : `📜 Upkeep tracked (${entries.length}) — Page ${i + 1}/${total}`,
    description: chunk.join('\n'),
  });

  await interaction.reply({
    embeds: [buildEmbed(chunks[0], 0)],
    allowedMentions: { parse: [] },
  });
  for (let i = 1; i < total; i++) {
    await interaction.followUp({
      embeds: [buildEmbed(chunks[i], i)],
      allowedMentions: { parse: [] },
    });
  }
}
