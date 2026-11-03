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

/** The nouns already taken with this adjective. Reads only those rows (the players_name index). */
export async function takenNouns(db: D1Database, adj: string): Promise<Set<string>> {
  const { results } = await db.prepare('SELECT noun FROM players WHERE adj = ?1').bind(adj).all<{ noun: string }>();
  return new Set(results.map((r) => r.noun));
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

/**
 * A player's rank: 1 + everyone ahead of them. Rather than counting every player above (D1
 * bills each row read, so that grew with the board), it adds up the score-band counts kept in
 * rank_bands (see migrations/0002_rank_bands.sql), then counts only the few players sharing the
 * player's own 10-carrot band. At most ~200 band rows plus that band's players are read.
 * Everyone on 0 carrots shares the rank after the last player with carrots.
 */
async function rankOf(db: D1Database, row: RankRow): Promise<number> {
  const t = row.total;
  if (t <= 0) {
    const all = await db.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM rank_bands WHERE level = 2').bind().first<{ n: number }>();
    return (all?.n ?? 0) + 1;
  }
  const b0 = Math.floor(t / 10);
  const b1 = Math.floor(t / 1000);
  const b2 = Math.floor(t / 100000);
  const ahead = await db
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(n), 0) FROM rank_bands WHERE level = 2 AND band > ?1)
       + (SELECT COALESCE(SUM(n), 0) FROM rank_bands WHERE level = 1 AND band > ?2 AND band < (?1 + 1) * 100)
       + (SELECT COALESCE(SUM(n), 0) FROM rank_bands WHERE level = 0 AND band > ?3 AND band < (?2 + 1) * 100)
       + (SELECT COUNT(*) FROM players
           WHERE total >= ?4 AND total < (?3 + 1) * 10
             AND (total > ?4 OR (updated_at < ?5 OR (updated_at = ?5 AND rowid < ?6)))) AS n`,
    )
    .bind(b2, b1, b0, t, row.updated_at, row.rowid)
    .first<{ n: number }>();
  return (ahead?.n ?? 0) + 1;
}

/** A player's total and rank, or null if there's no such player. */
export async function standing(db: D1Database, id: string): Promise<(Standing & { row: PlayerRow & RankRow }) | null> {
  const row = await db
    .prepare('SELECT rowid, emoji, adj, noun, total, updated_at FROM players WHERE id = ?1')
    .bind(id)
    .first<PlayerRow & RankRow>();
  if (!row) return null;
  return { total: row.total, rank: await rankOf(db, row), row };
}

/** The top `count` leaderboard entries. Reads only those rows (the players_rank index is in this order). */
async function top(db: D1Database, count: number): Promise<Entry[]> {
  const { results } = await db
    .prepare(`SELECT emoji, adj, noun, total FROM players ORDER BY ${ORDER} LIMIT ?1`)
    .bind(count)
    .all<PlayerRow>();
  return results.map((row, i) => toEntry(row, i + 1));
}

const COLS = 'emoji, adj, noun, total';

/** The player just ahead of this one: first a tie that got there earlier, else the lowest higher total. */
async function justAhead(db: D1Database, me: RankRow): Promise<PlayerRow | null> {
  if (me.total > 0) {
    const tie = await db
      .prepare(
        `SELECT ${COLS} FROM players WHERE total = ?1 AND (updated_at < ?2 OR (updated_at = ?2 AND rowid < ?3))
          ORDER BY updated_at DESC, rowid DESC LIMIT 1`,
      )
      .bind(me.total, me.updated_at, me.rowid)
      .first<PlayerRow>();
    if (tie) return tie;
  }
  return db
    .prepare(`SELECT ${COLS} FROM players WHERE total > ?1 ORDER BY total ASC, updated_at DESC, rowid DESC LIMIT 1`)
    .bind(me.total)
    .first<PlayerRow>();
}

/** The player just behind this one. Nobody is behind a player on 0: they all share the last rank. */
async function justBehind(db: D1Database, me: RankRow): Promise<PlayerRow | null> {
  if (me.total <= 0) return null;
  const tie = await db
    .prepare(
      `SELECT ${COLS} FROM players WHERE total = ?1 AND (updated_at > ?2 OR (updated_at = ?2 AND rowid > ?3))
        ORDER BY updated_at ASC, rowid ASC LIMIT 1`,
    )
    .bind(me.total, me.updated_at, me.rowid)
    .first<PlayerRow>();
  if (tie) return tie;
  return db
    .prepare(`SELECT ${COLS} FROM players WHERE total < ?1 AND total > 0 ORDER BY ${ORDER} LIMIT 1`)
    .bind(me.total)
    .first<PlayerRow>();
}

/** The top 10, plus the player and their neighbours on either side. */
export async function leaderboard(
  db: D1Database,
  playerId: string | null,
): Promise<{ top: Entry[]; me: Entry | null; near: Entry[] }> {
  const best = await top(db, 10);
  const mine = playerId ? await standing(db, playerId) : null;
  if (!mine) return { top: best, me: null, near: [] };
  const [ahead, behind] = await Promise.all([justAhead(db, mine.row), justBehind(db, mine.row)]);
  const me = toEntry(mine.row, mine.rank);
  const near = [...(ahead ? [toEntry(ahead, mine.rank - 1)] : []), me, ...(behind ? [toEntry(behind, mine.rank + 1)] : [])];
  return { top: best, me, near };
}
