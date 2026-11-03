import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { leaderboard } from '../src/db';
import { resetDb } from './helpers';

const N = 3000;

/** A D1 stand-in that adds up the rows each query reads (what D1 bills for). */
function counting(db: D1Database) {
  let rows = 0;
  const wrap = (st: D1PreparedStatement) => ({
    bind: (...a: unknown[]) => wrap(st.bind(...a)),
    first: async () => {
      const r = await st.all();
      rows += r.meta.rows_read ?? 0;
      return r.results[0] ?? null;
    },
    all: async () => {
      const r = await st.all();
      rows += r.meta.rows_read ?? 0;
      return r;
    },
    run: async () => {
      const r = await st.run();
      rows += r.meta.rows_read ?? 0;
      return r;
    },
  });
  const proxy = { prepare: (sql: string) => wrap(db.prepare(sql)) } as unknown as D1Database;
  return { db: proxy, rows: () => rows, reset: () => (rows = 0) };
}

/** Every player's rank the slow, obviously right way. Everyone on 0 shares the last rank. */
async function expectedRanks(): Promise<Map<string, number>> {
  const { results } = await env.DB.prepare(
    `SELECT id, total, ROW_NUMBER() OVER (ORDER BY total DESC, updated_at ASC, rowid ASC) AS r FROM players`,
  ).all<{ id: string; total: number; r: number }>();
  const positive = results.filter((x) => x.total > 0).length;
  return new Map(results.map((x) => [x.id, x.total > 0 ? x.r : positive + 1]));
}

describe('ranks on a big board', () => {
  beforeAll(async () => {
    await resetDb();
    // Lots of ties, players on 0, totals right on band edges (1000, 100000), and big totals.
    await env.DB.prepare(
      `WITH RECURSIVE x(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM x WHERE i < ?1)
       INSERT INTO players (id, secret_hash, emoji, adj, noun, total, created_at, updated_at)
       SELECT 'p' || i, 'h', '🐰', 'a' || i, 'n' || i,
              CASE WHEN i % 7 = 0 THEN 0
                   WHEN i % 11 = 0 THEN 1000
                   WHEN i % 13 = 0 THEN 100000
                   WHEN i % 17 = 0 THEN 999
                   ELSE (i * 7919) % 250000 END,
              i, i % 5
         FROM x`,
    )
      .bind(N)
      .run();
    // Runs move some players across band edges (the update trigger), including off 0.
    await env.DB.prepare(`UPDATE players SET total = total + 1, updated_at = 9 WHERE rowid % 19 = 0`).run();
    await env.DB.prepare(`UPDATE players SET total = total + 2500 WHERE rowid % 23 = 0`).run();
  });

  it('keeps the band counts equal to a recount', async () => {
    const recount = await env.DB.prepare(
      `SELECT 0 AS level, total / 10 AS band, COUNT(*) AS n FROM players WHERE total > 0 GROUP BY 2
       UNION ALL SELECT 1, total / 1000, COUNT(*) FROM players WHERE total > 0 GROUP BY 2
       UNION ALL SELECT 2, total / 100000, COUNT(*) FROM players WHERE total > 0 GROUP BY 2
       ORDER BY 1, 2`,
    ).all();
    const kept = await env.DB.prepare('SELECT level, band, n FROM rank_bands WHERE n > 0 ORDER BY 1, 2').all();
    expect(kept.results).toEqual(recount.results);
  });

  it('gives every player the same rank and neighbours as counting the slow way', async () => {
    const want = await expectedRanks();
    const order = (
      await env.DB.prepare('SELECT id, total FROM players WHERE total > 0 ORDER BY total DESC, updated_at ASC, rowid ASC').all<{ id: string; total: number }>()
    ).results;
    for (let i = 0; i < N; i += 7) {
      const id = `p${i + 1}`;
      const board = await leaderboard(env.DB, id);
      expect(board.me?.rank, id).toBe(want.get(id));
      const pos = order.findIndex((x) => x.id === id);
      if (pos >= 0) {
        expect(board.near.map((e) => e.total), id).toEqual(order.slice(Math.max(0, pos - 1), pos + 2).map((x) => x.total));
      }
    }
  });

  it('reads only a few hundred rows per leaderboard view, wherever you are on it', async () => {
    const c = counting(env.DB);
    const want = await expectedRanks();
    const byRank = [...want].filter(([, r]) => r <= N).sort((a, b) => a[1] - b[1]);
    const worst = { rows: 0, who: '' };
    for (const [id] of [byRank[0], byRank[Math.floor(byRank.length / 2)], byRank[byRank.length - 1], ['p7']]) {
      c.reset();
      await leaderboard(c.db, id as string);
      if (c.rows() > worst.rows) Object.assign(worst, { rows: c.rows(), who: id });
    }
    // Counting everyone above the last player would read thousands of rows.
    expect(worst.rows, `worst: ${worst.who}`).toBeLessThan(500);
  });
});
