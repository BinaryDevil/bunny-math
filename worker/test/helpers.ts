import { env } from 'cloudflare:workers';
import { handle } from '../src/index';
import type { PlayerName } from '../../src/lib/names';

export const ORIGIN = 'https://binarydevil.github.io';

type CallOptions = { body?: unknown; rawBody?: string; secret?: string; origin?: string; now?: number; headers?: Record<string, string> };

export async function call(method: string, path: string, opts: CallOptions = {}) {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined || opts.rawBody !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.secret) headers.Authorization = `Bearer ${opts.secret}`;
  if (opts.origin) headers.Origin = opts.origin;
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  const res = await handle(new Request(`https://leaderboard.test${path}`, { method, headers, body }), env, { now: opts.now });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? (JSON.parse(text) as any) : null };
}

export type Player = { id: string; secret: string; name: PlayerName; display: string };

export async function register(now?: number): Promise<Player> {
  const res = await call('POST', '/players', { body: {}, now });
  if (res.status !== 201) throw new Error(`register failed: ${res.status}`);
  return res.json;
}

let runCounter = 0;
const newRunId = () => crypto.randomUUID();

export function postRun(
  p: Player,
  carrots: number,
  opts: { now?: number; runId?: string; level?: number; code?: string } = {},
) {
  runCounter++;
  return call('POST', '/runs', {
    secret: p.secret,
    now: opts.now,
    body: {
      runId: opts.runId ?? newRunId(),
      playerId: p.id,
      code: opts.code ?? `CODE${runCounter}`,
      level: opts.level ?? 1,
      carrots,
    },
  });
}

/** Renames a player through the API, failing the test if it doesn't work. */
export async function rename(p: Player, name: PlayerName) {
  const res = await call('PUT', `/players/${p.id}/name`, { secret: p.secret, body: name });
  if (res.status !== 200) throw new Error(`rename failed: ${res.status}`);
}

export async function resetDb() {
  await env.DB.batch([env.DB.prepare('DELETE FROM runs'), env.DB.prepare('DELETE FROM players')]);
}
