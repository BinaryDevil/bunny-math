// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OLD = { id: 'old-id', secret: 'old-secret', name: { emoji: '🐰', adj: 'Bouncy', noun: 'Otter' } };
const NEW = { id: 'new-id', secret: 'new-secret', name: { emoji: '🦊', adj: 'Zippy', noun: 'Pancake' } };

type Sent = { method: string; path: string; auth: string | null };

/** A fake server that only knows NEW (the old database is gone). */
function fakeServer() {
  const sent: Sent[] = [];
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname;
    const auth = (init.headers as Record<string, string>).Authorization ?? null;
    sent.push({ method: init.method ?? 'GET', path, auth });
    if (path === '/players') return reply(201, NEW);
    if (auth !== `Bearer ${NEW.secret}`) return reply(401, { error: 'unauthorized' });
    if (path === '/runs') return reply(200, { total: 12, rank: 3 });
    return reply(200, { name: NEW.name });
  });
  return sent;
}

async function load() {
  vi.resetModules();
  vi.stubEnv('VITE_LEADERBOARD_URL', 'https://lb.test');
  return import('./leaderboard');
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('bunny-math:player', JSON.stringify(OLD));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('a server that never answers', () => {
  it('gives up after the time limit and keeps the queued runs', async () => {
    vi.useFakeTimers();
    try {
      // Like a blocked network: the request hangs until it is cancelled.
      vi.stubGlobal('fetch', (_url: string, init: RequestInit = {}) => new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
      localStorage.setItem('bunny-math:runs', JSON.stringify([{ runId: 'r1', code: 'C', level: 1, carrots: 12 }]));
      const lb = await load();

      const board = lb.fetchBoard();
      const sent = lb.flush();
      await vi.advanceTimersByTimeAsync(lb.TIMEOUT_MS);
      expect(await board).toBeNull();
      expect(await sent).toBeNull();
      expect(JSON.parse(localStorage.getItem('bunny-math:runs')!)).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a saved player the server no longer knows', () => {
  it('keeps the queued runs and sends them as a new player', async () => {
    const sent = fakeServer();
    localStorage.setItem('bunny-math:runs', JSON.stringify([{ runId: 'r1', code: 'C', level: 1, carrots: 12 }]));
    const lb = await load();

    expect(await lb.flush()).toEqual({ total: 12, rank: 3, was: undefined });
    expect(lb.savedPlayer()?.id).toBe(NEW.id);
    expect(JSON.parse(localStorage.getItem('bunny-math:runs')!)).toEqual([]);
    expect(sent.map((s) => s.path)).toEqual(['/runs', '/players', '/runs']);
  });

  it('renames the new player instead of reporting offline', async () => {
    fakeServer();
    const lb = await load();
    expect(await lb.rename(NEW.name)).toBe('ok');
    expect(lb.savedPlayer()?.id).toBe(NEW.id);
  });

  it('keeps the runs when even a new player is turned away', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      new Response(JSON.stringify(new URL(url).pathname === '/players' ? NEW : { error: 'unauthorized' }), {
        status: new URL(url).pathname === '/players' ? 201 : 401,
      }),
    );
    localStorage.setItem('bunny-math:runs', JSON.stringify([{ runId: 'r1', code: 'C', level: 1, carrots: 12 }]));
    const lb = await load();
    expect(await lb.flush()).toBeNull();
    expect(JSON.parse(localStorage.getItem('bunny-math:runs')!)).toHaveLength(1);
  });
});
