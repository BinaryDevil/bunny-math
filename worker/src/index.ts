/**
 * Bunny Math leaderboard server: a Cloudflare Worker over a D1 database.
 * This file is the HTTP side (routing, auth, validation, CORS); db.ts holds the SQL.
 */
import { isValidName, NAME_ADJECTIVES, NAME_NOUNS, nameText, randomName, type PlayerName } from '../../src/lib/names';
import { LEVEL_TIER, maxRunCarrots } from '../../src/lib/carrots';
import type { LevelId } from '../../src/lib/types';
import * as db from './db';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_ORIGINS = 'https://binarydevil.github.io,http://localhost:5173,http://127.0.0.1:5173';
const NAME_TRIES = 10;
const MAX_CODE_LENGTH = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEVELS = new Set(Object.keys(LEVEL_TIER).map(Number));

type Options = { now?: number };

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
} satisfies ExportedHandler<Env>;

/** Handles one request. `now` can be set by tests to control the clock. */
export async function handle(request: Request, env: Env, opts: Options = {}): Promise<Response> {
  const response = await route(request, env, opts.now ?? Date.now()).catch((err) => {
    console.error(err);
    return json(500, { error: 'server_error' });
  });
  return withCors(request, env, response);
}

// ---- Routing ----

async function route(request: Request, env: Env, now: number): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method;

  if (method === 'OPTIONS') return new Response(null, { status: 204 });

  if (path === '/health') return only(method, ['GET'], () => json(200, { ok: true }));
  if (path === '/players') return only(method, ['POST'], () => register(request, env, now));
  if (path === '/runs') return only(method, ['POST'], () => postRun(request, env, now));
  if (path === '/leaderboard') return only(method, ['GET'], () => getLeaderboard(url, env));

  const rename = path.match(/^\/players\/([^/]+)\/name$/);
  if (rename) return only(method, ['PUT'], () => setName(request, env, decodeURIComponent(rename[1])));

  return json(404, { error: 'not_found' });
}

function only(method: string, allowed: string[], handler: () => Promise<Response> | Response) {
  if (allowed.includes(method) || (method === 'HEAD' && allowed.includes('GET'))) return handler();
  return json(405, { error: 'method_not_allowed' }, { Allow: [...allowed, 'OPTIONS'].join(', ') });
}

// ---- Handlers ----

/** POST /players: a new player with a random free name. */
async function register(request: Request, env: Env, now: number): Promise<Response> {
  const body = await readJson(request);
  if (body === BAD_JSON) return json(400, { error: 'bad_json' });

  const id = crypto.randomUUID();
  const secret = randomSecret();
  const secretHash = await sha256(secret);
  const made = (name: PlayerName) => json(201, { id, secret, name, display: nameText(name) });
  // Random names first: cheap, and almost always free while the board has room.
  for (let i = 0; i < NAME_TRIES; i++) {
    const name = randomName(randomFraction);
    if (await db.insertPlayer(env.DB, { id, secretHash, name, now })) return made(name);
  }
  // A crowded board: go through the adjectives (from a random one) for a noun nobody has with it,
  // so a new player gets a name as long as any pair is still free.
  const start = Math.floor(randomFraction() * NAME_ADJECTIVES.length);
  const emoji = randomName(randomFraction).emoji;
  for (let i = 0; i < NAME_ADJECTIVES.length; i++) {
    const adj = NAME_ADJECTIVES[(start + i) % NAME_ADJECTIVES.length];
    const taken = await db.takenNouns(env.DB, adj);
    const free = NAME_NOUNS.filter((n) => !taken.has(n));
    // Another player may grab the same pair at the same moment: then try this adjective's next free noun.
    const from = Math.floor(randomFraction() * free.length);
    for (let j = 0; j < Math.min(free.length, 3); j++) {
      const noun = free[(from + j) % free.length];
      const name = { emoji, adj, noun };
      if (await db.insertPlayer(env.DB, { id, secretHash, name, now })) return made(name);
    }
  }
  return json(503, { error: 'no_free_name' });
}

/** PUT /players/:id/name: pick a different name. */
async function setName(request: Request, env: Env, id: string): Promise<Response> {
  const body = await readJson(request);
  if (body === BAD_JSON) return json(400, { error: 'bad_json' });
  if (!(await authorized(request, env, id))) return json(401, { error: 'unauthorized' });

  const name = pickName(body);
  if (!name) return json(400, { error: 'invalid_name' });
  if (!(await db.renamePlayer(env.DB, id, name))) return json(409, { error: 'name_taken' });
  return json(200, { name, display: nameText(name) });
}

/** POST /runs: add a finished run's carrots to the player's total. */
async function postRun(request: Request, env: Env, now: number): Promise<Response> {
  const body = await readJson(request);
  if (body === BAD_JSON) return json(400, { error: 'bad_json' });
  const run = parseRun(body);
  if (!run) return json(400, { error: 'bad_run' });
  if (!(await authorized(request, env, run.playerId))) return json(401, { error: 'unauthorized' });

  // A repeat of a run we already have: count it once, answer as before.
  const owner = await db.runOwner(env.DB, run.runId);
  if (owner !== null && owner !== run.playerId) return json(409, { error: 'run_id_taken' });
  if (owner === null && !(await db.insertRun(env.DB, { ...run, now }))) {
    // Not stored: either the same run just arrived twice at once, or the player is over the limit.
    const raced = await db.runOwner(env.DB, run.runId);
    if (raced === null) return json(429, { error: 'too_many_runs' });
    if (raced !== run.playerId) return json(409, { error: 'run_id_taken' });
  }

  const mine = await db.standing(env.DB, run.playerId);
  if (!mine) return json(401, { error: 'unauthorized' });
  return json(200, { total: mine.total, rank: mine.rank });
}

/** GET /leaderboard?player=<id>: the top 10, plus where this player stands. */
async function getLeaderboard(url: URL, env: Env): Promise<Response> {
  const player = url.searchParams.get('player');
  const board = await db.leaderboard(env.DB, player && UUID.test(player) ? player.toLowerCase() : null);
  return json(200, board);
}

// ---- Validation ----

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function pickName(body: unknown): PlayerName | null {
  if (!isObject(body)) return null;
  const name = { emoji: body.emoji, adj: body.adj, noun: body.noun };
  // isValidName checks each word is exactly one from the lists (so also that each is a string).
  return isValidName(name as Partial<PlayerName>) ? (name as PlayerName) : null;
}

type Run = { runId: string; playerId: string; code: string; level: LevelId; carrots: number };

function parseRun(body: unknown): Run | null {
  if (!isObject(body)) return null;
  const { runId, playerId, code, level, carrots } = body;
  if (typeof runId !== 'string' || !UUID.test(runId)) return null;
  if (typeof playerId !== 'string' || playerId.length === 0 || playerId.length > 64) return null;
  if (typeof code !== 'string' || code.length === 0 || code.length > MAX_CODE_LENGTH) return null;
  if (typeof level !== 'number' || !LEVELS.has(level)) return null;
  if (!Number.isInteger(carrots) || (carrots as number) < 0 || (carrots as number) > maxRunCarrots(level as LevelId)) return null;
  return { runId: runId.toLowerCase(), playerId, code, level: level as LevelId, carrots: carrots as number };
}

// ---- Auth ----

/** True if the request's `Authorization: Bearer <secret>` belongs to player `id`. */
async function authorized(request: Request, env: Env, id: string): Promise<boolean> {
  const match = (request.headers.get('Authorization') ?? '').match(/^Bearer\s+(\S+)$/i);
  if (!match) return false;
  return db.checkSecret(env.DB, id, await sha256(match[1]));
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Like Math.random, but from the crypto source. */
function randomFraction(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

// ---- HTTP helpers ----

const BAD_JSON = Symbol('bad_json');

/** The request body as JSON. An empty body reads as `{}`. */
async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    return BAD_JSON;
  }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function withCors(request: Request, env: Env, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.append('Vary', 'Origin');
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS).split(',').map((o) => o.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      headers.set('Access-Control-Max-Age', '86400');
    }
  }
  return new Response(response.body, { status: response.status, headers });
}
