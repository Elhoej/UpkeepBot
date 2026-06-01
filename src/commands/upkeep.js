import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { upsertEntry, listByGuild } from '../storage.js';
import { formatName } from '../format.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName('upkeep')
  .setDescription('Track when a house or stronghold upkeep was paid and alert before it expires.')
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt
      .setName('name')
      .setDescription('The house/stronghold name.')
      .setRequired(true)
      .setAutocomplete(true)
      .setMaxLength(100),
  )
  .addIntegerOption((opt) =>
    opt
      .setName('days')
      .setDescription('How many days the upkeep lasts.')
      .setRequired(true)
      .setMinValue(1),
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
  const days = interaction.options.getInteger('days', true);

  if (!name) {
    await interaction.reply({ content: 'Name cannot be empty.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!Number.isInteger(days) || days < 1) {
    await interaction.reply({ content: 'Days must be a positive integer.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Confirm the bot can actually post alerts in this channel. Slash commands
  // are deliverable via the interaction webhook without channel perms, so we
  // have to check explicitly — otherwise the scheduler silently DM-falls-back
  // (or fails entirely) when the first alert fires days later.
  const me = await interaction.guild.members.fetchMe();
  const perms = interaction.channel?.permissionsFor(me);
  const needed = interaction.channel?.isThread?.()
    ? ['ViewChannel', 'SendMessagesInThreads']
    : ['ViewChannel', 'SendMessages'];
  if (!perms?.has(needed)) {
    await interaction.reply({
      content:
        `I can't post alerts in this channel — I'm missing **${needed.join('** and **')}**. ` +
        `Grant me access here (or run \`/upkeep\` from a channel where I can post) before tracking upkeep.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  upsertEntry({
    guildId: interaction.guildId,
    name,
    channelId: interaction.channelId,
    ownerId: interaction.user.id,
    durationDays: days,
  });

  const expiresUnix = Math.floor((Date.now() + days * DAY_MS) / 1000);
  await interaction.reply({
    content:
      `💰 <@${interaction.user.id}> just paid **${formatName(name)}** upkeep for ${days} day${days === 1 ? '' : 's'}. ` +
      `Expires <t:${expiresUnix}:R> (<t:${expiresUnix}:F>).`,
    allowedMentions: { parse: [] },
  });
}
