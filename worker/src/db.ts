/**
 * Everything that touches D1. The router in index.ts validates input first; these functions
 * trust what they're given.
 */
import { nameText, type PlayerName } from '../../src/lib/names';

export const RUNS_PER_DAY = 40;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type Entry = { rank: number; display: string; total: number };
export type Standing = { total: number; rank: number };

type PlayerRow = { emoji: string; adj: string; noun: string; total: number };
type RankRow = { total: number; updated_at: number; rowid: number };

/** Leaderboard order. `rowid` (registration order) settles ties at the same millisecond. */
const ORDER = 'total DESC, updated_at ASC, rowid ASC';

const toEntry = (row: PlayerRow, rank: number): Entry => ({ rank, display: nameText(row), total: row.total });

/** Adds a player. Returns false if someone already has this adj + noun (the unique index decides). */
export async function insertPlayer(
  db: D1Database,
  p: { id: string; secretHash: string; name: PlayerName; now: number },
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO players (id, secret_hash, emoji, adj, noun, total, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6)
       ON CONFLICT (adj, noun) DO NOTHING`,
    )
    .bind(p.id, p.secretHash, p.name.emoji, p.name.adj, p.name.noun, p.now)
    .run();
  return res.meta.changes === 1;
}

/** True if a player with this id has this secret hash. */
export async function checkSecret(db: D1Database, id: string, secretHash: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS ok FROM players WHERE id = ?1 AND secret_hash = ?2')
    .bind(id, secretHash)
    .first<{ ok: number }>();
  return row !== null;
}

/** Renames a player. Returns false if another player has this adj + noun. */
export async function renamePlayer(db: D1Database, id: string, name: PlayerName): Promise<boolean> {
  // OR IGNORE: a clash with the unique index skips the update instead of throwing.
  // Renaming to your own current words isn't a clash, so it still counts as a change.
  const res = await db
    .prepare('UPDATE OR IGNORE players SET emoji = ?2, adj = ?3, noun = ?4 WHERE id = ?1')
    .bind(id, name.emoji, name.adj, name.noun)
    .run();
  return res.meta.changes === 1;
}

/** Who sent this run, or null if no run has this id. */
export async function runOwner(db: D1Database, runId: string): Promise<string | null> {
  const row = await db.prepare('SELECT player_id FROM runs WHERE run_id = ?1').bind(runId).first<{ player_id: string }>();
  return row?.player_id ?? null;
}

/**
 * Stores a run, unless its id is already stored or the player has hit the daily limit.
 * The limit check and insert are one statement, so two runs at once can't both slip past it.
 * A trigger adds the carrots to the player's total (see migrations/0001_init.sql).
 * Returns true if the run was stored.
 */
export async function insertRun(
  db: D1Database,
  r: { runId: string; playerId: string; code: string; level: number; carrots: number; now: number },
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO runs (run_id, player_id, code, level, carrots, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE (SELECT COUNT(*) FROM runs WHERE player_id = ?2 AND created_at > ?7) < ?8`,
    )
    .bind(r.runId, r.playerId, r.code, r.level, r.carrots, r.now, r.now - DAY_MS, RUNS_PER_DAY)
    .run();
  return res.meta.changes === 1;
}

async function rankOf(db: D1Database, row: RankRow): Promise<number> {
  const ahead = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM players
        WHERE total > ?1
           OR (total = ?1 AND (updated_at < ?2 OR (updated_at = ?2 AND rowid < ?3)))`,
    )
    .bind(row.total, row.updated_at, row.rowid)
    .first<{ n: number }>();
  return (ahead?.n ?? 0) + 1;
}

/** A player's total and rank, or null if there's no such player. */
export async function standing(db: D1Database, id: string): Promise<(Standing & { row: PlayerRow }) | null> {
  const row = await db
    .prepare('SELECT rowid, emoji, adj, noun, total, updated_at FROM players WHERE id = ?1')
    .bind(id)
    .first<PlayerRow & RankRow>();
  if (!row) return null;
  return { total: row.total, rank: await rankOf(db, row), row };
}

/** `count` leaderboard entries starting at rank `from` (1-based). */
async function slice(db: D1Database, from: number, count: number): Promise<Entry[]> {
  const { results } = await db
    .prepare(`SELECT emoji, adj, noun, total FROM players ORDER BY ${ORDER} LIMIT ?1 OFFSET ?2`)
    .bind(count, from - 1)
    .all<PlayerRow>();
  return results.map((row, i) => toEntry(row, from + i));
}

export async function leaderboard(
  db: D1Database,
  playerId: string | null,
): Promise<{ top: Entry[]; me: Entry | null; near: Entry[] }> {
  const top = await slice(db, 1, 10);
  const mine = playerId ? await standing(db, playerId) : null;
  if (!mine) return { top, me: null, near: [] };
  const from = Math.max(1, mine.rank - 1);
  const near = await slice(db, from, mine.rank - from + 2);
  return { top, me: toEntry(mine.row, mine.rank), near };
}
