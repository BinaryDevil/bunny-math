import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { NAME_ADJECTIVES, NAME_NOUNS, nameText } from '../../src/lib/names';
import { maxRunCarrots } from '../../src/lib/carrots';
import { call, ORIGIN, postRun, register, rename, resetDb, type Player } from './helpers';

beforeEach(resetDb);

const DAY = 24 * 60 * 60 * 1000;

describe('POST /players', () => {
  it('registers a player with an id, a secret and a valid name', async () => {
    const res = await call('POST', '/players', { body: {} });
    expect(res.status).toBe(201);
    const { id, secret, name, display } = res.json;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes, base64url
    expect(NAME_ADJECTIVES).toContain(name.adj);
    expect(NAME_NOUNS).toContain(name.noun);
    expect(display).toBe(nameText(name));
  });

  it('accepts an empty body too', async () => {
    expect((await call('POST', '/players')).status).toBe(201);
  });

  it('stores only a hash of the secret', async () => {
    const p = await register();
    const row = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(p.id).first<Record<string, unknown>>();
    expect(Object.values(row!)).not.toContain(p.secret);
    expect(row!.secret_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives every player a different adj + noun', async () => {
    const players = await Promise.all(Array.from({ length: 40 }, () => register()));
    const keys = new Set(players.map((p) => `${p.name.adj} ${p.name.noun}`));
    expect(keys.size).toBe(40);
    expect(new Set(players.map((p) => p.id)).size).toBe(40);
  });

  it('enforces unique names in the database itself', async () => {
    const p = await register();
    const insert = env.DB.prepare(
      `INSERT INTO players (id, secret_hash, emoji, adj, noun, created_at, updated_at) VALUES ('x', 'h', '🐸', ?, ?, 0, 0)`,
    ).bind(p.name.adj, p.name.noun);
    await expect(insert.run()).rejects.toThrow(/UNIQUE/);
  });

  it('finds the last free name on a full board', async () => {
    // Take every adj + noun pair but one.
    const lastAdj = NAME_ADJECTIVES[37];
    const lastNoun = NAME_NOUNS[61];
    let i = 0;
    await env.DB.batch(
      NAME_ADJECTIVES.map((adj) =>
        env.DB.prepare(
          `INSERT INTO players (id, secret_hash, emoji, adj, noun, created_at, updated_at) VALUES ${NAME_NOUNS.filter(
            (noun) => adj !== lastAdj || noun !== lastNoun,
          )
            .map((noun) => `('id${i++}', 'h', '🐰', '${adj}', '${noun}', 0, 0)`)
            .join(',')}`,
        ),
      ),
    );
    const res = await call('POST', '/players', { body: {} });
    expect(res.status).toBe(201);
    expect(res.json.name).toMatchObject({ adj: lastAdj, noun: lastNoun });
  });

  it('answers 503 when no free name turns up', async () => {
    // Take every adj + noun pair, one statement per adjective.
    let i = 0;
    await env.DB.batch(
      NAME_ADJECTIVES.map((adj) =>
        env.DB.prepare(
          `INSERT INTO players (id, secret_hash, emoji, adj, noun, created_at, updated_at) VALUES ${NAME_NOUNS.map(
            (noun) => `('id${i++}', 'h', '🐰', '${adj}', '${noun}', 0, 0)`,
          ).join(',')}`,
        ),
      ),
    );
    const res = await call('POST', '/players', { body: {} });
    expect(res.status).toBe(503);
    expect(res.json).toEqual({ error: 'no_free_name' });
  });
});

describe('PUT /players/:id/name', () => {
  const name = { emoji: '🦦', adj: 'Bouncy', noun: 'Otter' };

  it('renames a player', async () => {
    const p = await register();
    const res = await call('PUT', `/players/${p.id}/name`, { secret: p.secret, body: name });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ name, display: '🦦 Bouncy Otter' });
    const board = await call('GET', `/leaderboard?player=${p.id}`);
    expect(board.json.me.display).toBe('🦦 Bouncy Otter');
  });

  it('allows setting your own name again, even with a new emoji', async () => {
    const p = await register();
    await rename(p, name);
    expect((await call('PUT', `/players/${p.id}/name`, { secret: p.secret, body: name })).status).toBe(200);
    const res = await call('PUT', `/players/${p.id}/name`, { secret: p.secret, body: { ...name, emoji: '🚀' } });
    expect(res.status).toBe(200);
    expect(res.json.display).toBe('🚀 Bouncy Otter');
  });

  it('answers 409 when someone else has those two words, whatever the emoji', async () => {
    const a = await register();
    const b = await register();
    await rename(a, name);
    const res = await call('PUT', `/players/${b.id}/name`, { secret: b.secret, body: { ...name, emoji: '🐸' } });
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: 'name_taken' });
  });

  it('is case-sensitive and only takes words from the lists', async () => {
    const p = await register();
    for (const bad of [
      { ...name, adj: 'bouncy' },
      { ...name, noun: 'Poop' },
      { ...name, emoji: '💩' },
      { adj: 'Bouncy', noun: 'Otter' },
      { ...name, adj: ' Bouncy' },
      { ...name, adj: 5 },
      [],
    ]) {
      const res = await call('PUT', `/players/${p.id}/name`, { secret: p.secret, body: bad });
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(res.json).toEqual({ error: 'invalid_name' });
    }
  });

  it('answers 401 for a missing or wrong secret, or an unknown id', async () => {
    const a = await register();
    const b = await register();
    const cases = [
      { id: a.id, secret: undefined },
      { id: a.id, secret: 'nope' },
      { id: a.id, secret: b.secret },
      { id: crypto.randomUUID(), secret: a.secret },
    ];
    for (const c of cases) {
      const res = await call('PUT', `/players/${c.id}/name`, { secret: c.secret, body: name });
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'unauthorized' });
    }
    const raw = await call('PUT', `/players/${a.id}/name`, { headers: { Authorization: a.secret }, body: name });
    expect(raw.status).toBe(401);
  });
});

describe('POST /runs', () => {
  let p: Player;
  beforeEach(async () => {
    p = await register();
  });

  it('adds carrots to the total and returns total and rank', async () => {
    expect((await postRun(p, 30)).json).toEqual({ total: 30, rank: 1 });
    expect((await postRun(p, 12)).json).toEqual({ total: 42, rank: 1 });
  });

  it('accepts every valid level up to its maximum', async () => {
    let total = 0;
    for (const level of [1, 2, 3, 4, 5, 6, 11, 12, 13, 14] as const) {
      total += maxRunCarrots(level);
      const res = await postRun(p, maxRunCarrots(level), { level });
      expect(res.status).toBe(200);
      expect(res.json.total).toBe(total);
    }
  });

  it('turns away bad runs', async () => {
    const good = { runId: crypto.randomUUID(), playerId: p.id, code: 'ABC123', level: 3, carrots: 10 };
    const bad = [
      { ...good, carrots: maxRunCarrots(3) + 1 },
      { ...good, carrots: -1 },
      { ...good, carrots: 2.5 },
      { ...good, carrots: '10' },
      { ...good, level: 7 },
      { ...good, level: '3' },
      { ...good, level: undefined },
      { ...good, runId: 'not-a-uuid' },
      { ...good, runId: undefined },
      { ...good, code: 'X'.repeat(33) },
      { ...good, code: '' },
      { ...good, code: 42 },
      { ...good, playerId: undefined },
      [],
    ];
    for (const body of bad) {
      const res = await call('POST', '/runs', { secret: p.secret, body });
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.json).toEqual({ error: 'bad_run' });
    }
    expect((await call('POST', '/runs', { secret: p.secret, body: { ...good, code: 'X'.repeat(32) } })).status).toBe(200);
  });

  it('stores the share code', async () => {
    const runId = crypto.randomUUID();
    await postRun(p, 5, { runId, code: 'L3-ABCD' });
    const row = await env.DB.prepare('SELECT * FROM runs WHERE run_id = ?').bind(runId).first();
    expect(row).toMatchObject({ player_id: p.id, code: 'L3-ABCD', level: 1, carrots: 5 });
  });

  it('counts a repeated runId once and answers the same', async () => {
    const runId = crypto.randomUUID();
    const first = await postRun(p, 20, { runId });
    const again = await postRun(p, 20, { runId });
    const upper = await postRun(p, 20, { runId: runId.toUpperCase() });
    expect(first.json).toEqual({ total: 20, rank: 1 });
    expect(again.status).toBe(200);
    expect(again.json).toEqual(first.json);
    expect(upper.json).toEqual(first.json);
    const { n } = (await env.DB.prepare('SELECT COUNT(*) AS n FROM runs').first<{ n: number }>())!;
    expect(n).toBe(1);
  });

  it('counts a runId once even when both copies arrive at the same time', async () => {
    const runId = crypto.randomUUID();
    const results = await Promise.all([postRun(p, 20, { runId }), postRun(p, 20, { runId }), postRun(p, 20, { runId })]);
    for (const r of results) expect(r.status).toBe(200);
    expect((await call('GET', `/leaderboard?player=${p.id}`)).json.me.total).toBe(20);
  });

  it("won't let a runId be reused by another player", async () => {
    const other = await register();
    const runId = crypto.randomUUID();
    await postRun(p, 20, { runId });
    const res = await postRun(other, 20, { runId });
    expect(res.status).toBe(409);
    expect((await call('GET', `/leaderboard?player=${other.id}`)).json.me.total).toBe(0);
  });

  it('answers 401 for a missing or wrong secret, or an unknown player', async () => {
    const other = await register();
    const body = { runId: crypto.randomUUID(), playerId: p.id, code: 'A', level: 1, carrots: 5 };
    for (const [secret, playerId] of [
      [undefined, p.id],
      ['wrong', p.id],
      [other.secret, p.id],
      [p.secret, crypto.randomUUID()],
    ]) {
      const res = await call('POST', '/runs', { secret, body: { ...body, playerId } });
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'unauthorized' });
    }
    expect((await call('GET', `/leaderboard?player=${p.id}`)).json.me.total).toBe(0);
  });

  it('allows 40 runs in a rolling 24 hours', async () => {
    const t0 = 1_800_000_000_000;
    const firstRunId = crypto.randomUUID();
    await postRun(p, 1, { runId: firstRunId, now: t0 });
    for (let i = 1; i < 40; i++) expect((await postRun(p, 1, { now: t0 + i * 60_000 })).status).toBe(200);

    const over = await postRun(p, 1, { now: t0 + 60 * 60_000 });
    expect(over.status).toBe(429);
    expect(over.json).toEqual({ error: 'too_many_runs' });

    // A repeat of a run already counted is still fine at the limit.
    expect((await postRun(p, 1, { runId: firstRunId, now: t0 + 60 * 60_000 })).json).toEqual({ total: 40, rank: 1 });

    // 24 hours after the first run, it drops out of the window and one more fits.
    expect((await postRun(p, 1, { now: t0 + DAY })).status).toBe(200);
    expect((await postRun(p, 1, { now: t0 + DAY })).status).toBe(429);

    // Another player has their own limit.
    const other = await register(t0);
    expect((await postRun(other, 1, { now: t0 + 60 * 60_000 })).status).toBe(200);
  });
});

describe('GET /leaderboard', () => {
  /** Registers players and gives them carrots at the given times. */
  async function setUp(spec: { carrots: number; at: number }[]) {
    const players: Player[] = [];
    for (const s of spec) {
      const p = await register(0);
      if (s.carrots > 0) await postRun(p, s.carrots, { now: s.at });
      players.push(p);
    }
    return players;
  }

  it('ranks by total, ties going to whoever got there first', async () => {
    const [a, b, c, d] = await setUp([
      { carrots: 50, at: 2000 },
      { carrots: 50, at: 1000 },
      { carrots: 80, at: 3000 },
      { carrots: 0, at: 0 },
    ]);
    const { json } = await call('GET', '/leaderboard');
    expect(json.top).toEqual([
      { rank: 1, display: c.display, total: 80 },
      { rank: 2, display: b.display, total: 50 },
      { rank: 3, display: a.display, total: 50 },
      { rank: 4, display: d.display, total: 0 },
    ]);
    expect(json.me).toBeNull();
    expect(json.near).toEqual([]);

    // a pulls ahead; the rank comes back from POST /runs too.
    expect((await postRun(a, 1, { now: 4000 })).json).toEqual({ total: 51, rank: 2 });
  });

  it("doesn't let a 0-carrot run move you ahead in a tie", async () => {
    const [a, b] = await setUp([
      { carrots: 50, at: 1000 },
      { carrots: 50, at: 2000 },
    ]);
    expect((await postRun(a, 0, { now: 5000 })).json).toEqual({ total: 50, rank: 1 });
    expect((await postRun(b, 0, { now: 5000 })).json).toEqual({ total: 50, rank: 2 });
  });

  it('shows the top 10 only', async () => {
    await setUp(Array.from({ length: 12 }, (_, i) => ({ carrots: 100 - i, at: 1000 })));
    const { json } = await call('GET', '/leaderboard');
    expect(json.top).toHaveLength(10);
    expect(json.top.map((e: { rank: number }) => e.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(json.top[9].total).toBe(91);
  });

  it('gives me and my neighbours', async () => {
    const players = await setUp(Array.from({ length: 13 }, (_, i) => ({ carrots: 130 - i * 10, at: 1000 })));
    const entry = (i: number) => ({ rank: i + 1, display: players[i].display, total: 130 - i * 10 });

    const mid = await call('GET', `/leaderboard?player=${players[11].id}`);
    expect(mid.json.me).toEqual(entry(11));
    expect(mid.json.near).toEqual([entry(10), entry(11), entry(12)]);

    const first = await call('GET', `/leaderboard?player=${players[0].id}`);
    expect(first.json.near).toEqual([entry(0), entry(1)]);

    const last = await call('GET', `/leaderboard?player=${players[12].id}`);
    expect(last.json.near).toEqual([entry(11), entry(12)]);
  });

  it('includes a lone player with 0 carrots', async () => {
    const [p] = await setUp([{ carrots: 0, at: 0 }]);
    const { json } = await call('GET', `/leaderboard?player=${p.id}`);
    expect(json.me).toEqual({ rank: 1, display: p.display, total: 0 });
    expect(json.near).toEqual([json.me]);
  });

  it('gives me = null for an unknown player', async () => {
    await setUp([{ carrots: 5, at: 1 }]);
    for (const q of [crypto.randomUUID(), 'junk', '']) {
      const { json } = await call('GET', `/leaderboard?player=${q}`);
      expect(json.me).toBeNull();
      expect(json.near).toEqual([]);
      expect(json.top).toHaveLength(1);
    }
  });

  it('never includes ids or secrets', async () => {
    const [p] = await setUp([{ carrots: 5, at: 1 }]);
    const res = await call('GET', `/leaderboard?player=${p.id}`);
    const text = JSON.stringify(res.json);
    expect(text).not.toContain(p.id);
    expect(text).not.toContain(p.secret);
    expect(Object.keys(res.json.me).sort()).toEqual(['display', 'rank', 'total']);
  });
});

describe('CORS', () => {
  it('echoes an allowed origin', async () => {
    for (const origin of [ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173']) {
      const res = await call('GET', '/health', { origin });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(res.headers.get('Vary')).toContain('Origin');
    }
  });

  it('adds no allow-origin for other sites', async () => {
    const res = await call('GET', '/health', { origin: 'https://evil.example' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers preflights', async () => {
    const res = await call('OPTIONS', '/runs', {
      origin: ORIGIN,
      headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, authorization' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
  });

  it('adds CORS headers to errors too', async () => {
    const res = await call('POST', '/runs', { origin: ORIGIN, body: {} });
    expect(res.status).toBe(400);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('reads the allowed list from ALLOWED_ORIGINS', async () => {
    const { handle } = await import('../src/index');
    const custom = { ...env, ALLOWED_ORIGINS: 'https://bunny.example, https://other.example' };
    const res = await handle(new Request('https://x/health', { headers: { Origin: 'https://other.example' } }), custom);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://other.example');
    const gh = await handle(new Request('https://x/health', { headers: { Origin: ORIGIN } }), custom);
    expect(gh.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('everything else', () => {
  it('GET /health', async () => {
    const res = await call('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  it('404 for unknown routes', async () => {
    for (const path of ['/', '/nope', '/players/abc', '/players/abc/name/x']) {
      const res = await call('GET', path);
      expect(res.status).toBe(404);
      expect(res.json).toEqual({ error: 'not_found' });
    }
  });

  it('405 for the wrong method', async () => {
    for (const [method, path] of [
      ['GET', '/players'],
      ['GET', '/runs'],
      ['POST', '/leaderboard'],
      ['DELETE', '/health'],
      ['POST', `/players/${crypto.randomUUID()}/name`],
    ]) {
      const res = await call(method, path);
      expect(res.status, `${method} ${path}`).toBe(405);
      expect(res.headers.get('Allow')).toBeTruthy();
    }
  });

  it('400 for bad JSON', async () => {
    const p = await register();
    for (const [method, path] of [
      ['POST', '/players'],
      ['POST', '/runs'],
      ['PUT', `/players/${p.id}/name`],
    ]) {
      const res = await call(method, path, { rawBody: '{nope', secret: p.secret });
      expect(res.status).toBe(400);
      expect(res.json).toEqual({ error: 'bad_json' });
    }
  });

  it('works end to end through the deployed fetch handler', async () => {
    const res = await exports.default.fetch('https://leaderboard.test/players', { method: 'POST', body: '{}' });
    expect(res.status).toBe(201);
    const p = (await res.json()) as Player;
    const run = await exports.default.fetch('https://leaderboard.test/runs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: crypto.randomUUID(), playerId: p.id, code: 'X', level: 2, carrots: 9 }),
    });
    expect(await run.json()).toEqual({ total: 9, rank: 1 });
  });
});
