import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { listByGuild, deleteEntry } from '../storage.js';
import { formatName } from '../format.js';

export const data = new SlashCommandBuilder()
  .setName('upkeep-remove')
  .setDescription('Remove a tracked upkeep entry.')
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt
      .setName('name')
      .setDescription('The upkeep entry to remove.')
      .setRequired(true)
      .setAutocomplete(true)
      .setMaxLength(100),
  );

export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const entries = listByGuild(interaction.guildId);

  const matches = entries
    .filter((e) => e.name.includes(focused))
    .slice(0, 25)
    .map((e) => ({ name: formatName(e.name), value: e.name }));

  await interaction.respond(matches);
}

export async function execute(interaction) {
  const name = interaction.options.getString('name', true).trim().toLowerCase();

  const entries = listByGuild(interaction.guildId);
  const existing = entries.find((e) => e.name === name);

  if (!existing) {
    await interaction.reply({
      content: `No upkeep entry named **${formatName(name)}** found in this server.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  deleteEntry(interaction.guildId, name);

  await interaction.reply({
    content: `🗑️ Removed upkeep entry **${formatName(name)}**.`,
    allowedMentions: { parse: [] },
  });
}
