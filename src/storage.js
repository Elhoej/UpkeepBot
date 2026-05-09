import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

const DB_PATH = process.env.UPKEEP_DB_PATH || './data/upkeep.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS upkeep (
    guild_id        TEXT    NOT NULL,
    name            TEXT    NOT NULL,
    channel_id      TEXT    NOT NULL,
    owner_id        TEXT    NOT NULL,
    last_paid_at    INTEGER NOT NULL,
    duration_days   INTEGER NOT NULL,
    alert_stage     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, name)
  );
`);

const cols = db.pragma('table_info(upkeep)').map((c) => c.name);
if (!cols.includes('alert_stage')) {
  db.exec('ALTER TABLE upkeep ADD COLUMN alert_stage INTEGER NOT NULL DEFAULT 0');
}

const upsertStmt = db.prepare(`
  INSERT INTO upkeep (guild_id, name, channel_id, owner_id, last_paid_at, duration_days, alert_stage)
  VALUES (@guildId, @name, @channelId, @ownerId, @now, @durationDays, 0)
  ON CONFLICT(guild_id, name) DO UPDATE SET
    channel_id    = excluded.channel_id,
    owner_id      = excluded.owner_id,
    last_paid_at  = excluded.last_paid_at,
    duration_days = excluded.duration_days,
    alert_stage   = 0
`);

const listAllStmt = db.prepare(`SELECT * FROM upkeep`);
const listByGuildStmt = db.prepare(`SELECT * FROM upkeep WHERE guild_id = ? ORDER BY (last_paid_at + duration_days * 86400000) ASC`);
const setAlertStageStmt = db.prepare(`UPDATE upkeep SET alert_stage = ? WHERE guild_id = ? AND name = ?`);
const deleteEntryStmt = db.prepare(`DELETE FROM upkeep WHERE guild_id = ? AND name = ?`);

export function upsertEntry({ guildId, name, channelId, ownerId, durationDays }) {
  upsertStmt.run({ guildId, name, channelId, ownerId, now: Date.now(), durationDays });
}

export function listAll() {
  return listAllStmt.all();
}

export function listByGuild(guildId) {
  return listByGuildStmt.all(guildId);
}

export function setAlertStage(guildId, name, stage) {
  setAlertStageStmt.run(stage, guildId, name);
}

export function deleteEntry(guildId, name) {
  deleteEntryStmt.run(guildId, name);
}
