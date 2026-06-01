import { deleteEntry, listAll, setAlertStage } from './storage.js';
import { formatName } from './format.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const REMOVAL_GRACE_MS = 5 * DAY_MS;

const STAGE_NONE = 0;
const STAGE_5D = 1;
const STAGE_2D = 2;
const STAGE_1D = 3;
const STAGE_EXPIRED = 4;

async function sendAlert(client, entry, content) {
  const channel = await client.channels.fetch(entry.channel_id);
  if (!channel?.isTextBased()) {
    throw new Error(`channel ${entry.channel_id} is not a text channel`);
  }
  await channel.send({ content, allowedMentions: { users: [entry.owner_id] } });
}

// Try the bound channel first; if that fails, fall back to DMing the owner.
// Returns true if either delivery succeeded.
async function deliverAlert(client, entry, content) {
  try {
    await sendAlert(client, entry, content);
    return true;
  } catch (channelErr) {
    try {
      const user = await client.users.fetch(entry.owner_id);
      await user.send({ content, allowedMentions: { users: [entry.owner_id] } });
      console.warn(
        `[scheduler] channel send failed for ${entry.guild_id}/${entry.name} (${channelErr.message}); delivered via DM instead.`,
      );
      return true;
    } catch (dmErr) {
      console.warn(
        `[scheduler] failed to deliver alert for ${entry.guild_id}/${entry.name}: channel=${channelErr.message}; dm=${dmErr.message}`,
      );
      return false;
    }
  }
}

function alertContent(stage, ownerId, displayName, expiresUnix) {
  switch (stage) {
    case STAGE_5D:
      return `🔔 Upkeep for **${displayName}** expires <t:${expiresUnix}:R> (5 days left). 🔔`;
    case STAGE_2D:
      return `⚠️ Upkeep for **${displayName}** expires <t:${expiresUnix}:R> (2 days left). ⚠️`;
    case STAGE_1D:
      return `🚨 Upkeep for **${displayName}** expires <t:${expiresUnix}:R> (1 day left). 🚨`;
    case STAGE_EXPIRED:
      return `❗ **EXPIRED**: upkeep for **${displayName}** has expired. ❗`;
    default:
      return null;
  }
}

async function checkOnce(client) {
  const entries = listAll();
  const now = Date.now();

  for (const entry of entries) {
    const expiresAt = entry.last_paid_at + entry.duration_days * DAY_MS;
    const expiresUnix = Math.floor(expiresAt / 1000);
    const display = formatName(entry.name);

    if (now >= expiresAt + REMOVAL_GRACE_MS) {
      await deliverAlert(
        client,
        entry,
        `🗑️ <@${entry.owner_id}> Upkeep for **${display}** has been expired for over 5 days and has been removed from tracking.`,
      );
      // Always delete — the grace window is over regardless of notification success.
      deleteEntry(entry.guild_id, entry.name);
      continue;
    }

    const msLeft = expiresAt - now;
    let targetStage = STAGE_NONE;
    if (msLeft <= 5 * DAY_MS) targetStage = STAGE_5D;
    if (msLeft <= 2 * DAY_MS) targetStage = STAGE_2D;
    if (msLeft <= 1 * DAY_MS) targetStage = STAGE_1D;
    if (msLeft <= 0) targetStage = STAGE_EXPIRED;

    if (targetStage > entry.alert_stage) {
      const delivered = await deliverAlert(
        client,
        entry,
        alertContent(targetStage, entry.owner_id, display, expiresUnix),
      );
      // Only advance the stage on successful delivery — otherwise we'd silently
      // swallow this alert and never retry on the next tick.
      if (delivered) {
        setAlertStage(entry.guild_id, entry.name, targetStage);
      }
    }
  }
}

export function startScheduler(client) {
  const run = () => {
    checkOnce(client).catch((err) => console.error('[scheduler] check failed:', err));
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS);
}
