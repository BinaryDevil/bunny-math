/**
 * Talks to the leaderboard server (worker/). Turned off when VITE_LEADERBOARD_URL isn't set,
 * so the app works the same without it: the leaderboard just doesn't show.
 *
 * The player is made on the server the first time it's needed. Its id and secret stay on this
 * device. Finished runs wait in a queue until the server has them, so a run played offline
 * still counts once the device is back online. Every run has its own id, so sending it twice
 * counts once.
 */
import { isValidName, type PlayerName } from './names';
import type { LevelId } from './types';

const BASE = (import.meta.env.VITE_LEADERBOARD_URL as string | undefined)?.replace(/\/+$/, '') || '';
export const leaderboardOn = () => !!BASE;

const PLAYER_KEY = 'bunny-math:player';
const QUEUE_KEY = 'bunny-math:runs';

export type Player = { id: string; secret: string; name: PlayerName; lastRank?: number };
export type Entry = { rank: number; display: string; total: number };
export type Board = { top: Entry[]; me: Entry | null; near: Entry[] };
type QueuedRun = { runId: string; code: string; level: LevelId; carrots: number };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // Storage blocked: the leaderboard still works for this visit.
  }
}

export function savedPlayer(): Player | null {
  const p = read<Player>(PLAYER_KEY);
  return p && typeof p.id === 'string' && typeof p.secret === 'string' && isValidName(p.name) ? p : null;
}

/**
 * The server doesn't know this player (say, its database was replaced): drop it, so the next
 * call makes a new one. Only if it's still the saved one, in case another tab already replaced it.
 */
function forget(player: Player) {
  if (savedPlayer()?.id !== player.id) return;
  try {
    localStorage.removeItem(PLAYER_KEY);
  } catch {
    // Storage blocked: nothing saved to drop.
  }
}

/** Gives up on the server after this long, so a blocked network can't leave "Loading…" up for minutes. */
export const TIMEOUT_MS = 8000;

async function call<T>(path: string, init: RequestInit & { secret?: string } = {}): Promise<{ status: number; body: T | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.secret) headers.Authorization = `Bearer ${init.secret}`;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, { ...init, headers, signal: abort.signal });
    let body: T | null = null;
    try {
      body = (await res.json()) as T;
    } catch {
      // Not JSON: leave it empty.
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

let registering: Promise<Player | null> | null = null;

/** This device's player, made on the server if there isn't one yet. Null when offline or off. */
export function ensurePlayer(): Promise<Player | null> {
  const p = savedPlayer();
  if (p) return Promise.resolve(p);
  if (!leaderboardOn()) return Promise.resolve(null);
  registering ??= call<{ id: string; secret: string; name: PlayerName }>('/players', { method: 'POST', body: '{}' })
    .then(({ status, body }) => {
      if (status !== 201 || !body) return null;
      const made: Player = { id: body.id, secret: body.secret, name: body.name };
      write(PLAYER_KEY, made);
      return made;
    })
    .catch(() => null)
    .finally(() => (registering = null));
  return registering;
}

const newRunId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });

export type Posted = { total: number; rank: number; was?: number };

/**
 * Adds a finished run to the queue and sends everything waiting. Answers with the newest
 * total and rank (and the rank before, for "You moved up!"), or null if nothing got through.
 */
export async function submitRun(run: { code: string; level: LevelId; carrots: number }): Promise<Posted | null> {
  if (!leaderboardOn()) return null;
  if (run.carrots > 0) write(QUEUE_KEY, [...queued(), { ...run, runId: newRunId() }]);
  return flush();
}

const queued = () => (read<QueuedRun[]>(QUEUE_KEY) ?? []).filter((r) => r && typeof r.runId === 'string').slice(-40);

/** Sends waiting runs. Safe to call any time (for example when the app opens). */
export async function flush(retried = false): Promise<Posted | null> {
  // Nothing waiting: don't make a player just for opening the app.
  if (!leaderboardOn() || !queued().length) return null;
  const player = await ensurePlayer();
  if (!player) return null;
  let last: Posted | null = null;
  for (const run of queued()) {
    try {
      const { status, body } = await call<{ total: number; rank: number }>('/runs', {
        method: 'POST',
        secret: player.secret,
        body: JSON.stringify({ ...run, playerId: player.id }),
      });
      // The server doesn't know this player: keep the runs, and send them as a new player (once).
      if (status === 401) {
        forget(player);
        return retried ? null : flush(true);
      }
      // Sent, or turned away for good (a bad or repeated run): either way it leaves the queue.
      if (status === 200 && body) last = body;
      if (status === 429 || status >= 500) break;
      write(QUEUE_KEY, queued().filter((r) => r.runId !== run.runId));
    } catch {
      break; // Offline: try again next time.
    }
  }
  if (!last) return null;
  const was = player.lastRank;
  write(PLAYER_KEY, { ...player, lastRank: last.rank });
  return { ...last, was };
}

export async function fetchBoard(): Promise<Board | null> {
  if (!leaderboardOn()) return null;
  const p = savedPlayer();
  try {
    const { status, body } = await call<Board>(`/leaderboard${p ? `?player=${encodeURIComponent(p.id)}` : ''}`);
    return status === 200 ? body : null;
  } catch {
    return null;
  }
}

export type RenameResult = 'ok' | 'taken' | 'offline';

/** Changes the player's name. Names are unique by their two words, so the server may say it's taken. */
export async function rename(name: PlayerName, retried = false): Promise<RenameResult> {
  const player = await ensurePlayer();
  if (!player) return 'offline';
  try {
    const { status } = await call(`/players/${encodeURIComponent(player.id)}/name`, { method: 'PUT', secret: player.secret, body: JSON.stringify(name) });
    // The server doesn't know this player: make a new one and name that instead (once).
    if (status === 401) {
      forget(player);
      return retried ? 'offline' : rename(name, true);
    }
    if (status === 409) return 'taken';
    if (status !== 200) return 'offline';
    write(PLAYER_KEY, { ...player, name });
    return 'ok';
  } catch {
    return 'offline';
  }
}
