/**
 * One Adventure run: 3 meadows of 5 questions, each ending in a showdown with Rascal.
 *
 * Plain data in, plain data out (no screens, no sounds), so it is easy to test. The screens
 * show a question, collect how it went (`Outcome`), and call `answer()` to get the next state.
 *
 * Everything random comes from the run's seed, split into separate streams for questions,
 * showdowns and rest stops. Two kids playing the same code who pick the same paths get exactly
 * the same questions, whatever treats they pick or use.
 */
import { CARROTS, LEVEL_TIER, MAX_HEARTS, MAX_RASCAL_HEARTS, MEADOWS, QUESTIONS_PER_MEADOW, START_HEARTS, worth } from './carrots';
import { generateQuiz, nextLevel } from './generator';
import { makeRng } from './rng';
import type { Kind, LevelId, Question, Skill } from './types';

export type Path = 'sunny' | 'tricky';
export type Treat = 'clover' | 'cake' | 'magnifier';
export const TREATS: readonly Treat[] = ['clover', 'cake', 'magnifier'];
export const BAG_SIZE = 3;

/** How a question went: right first time, right on the second try, right after "Show me how", or missed twice. */
export type Outcome = 'first' | 'second' | 'helped' | 'fail';

/**
 * Which features a run has. New players meet one new thing per run:
 * depth 0 is hearts, carrots and showdowns; 1 adds treats; 2 adds the choice of path;
 * 3 makes Rascal tougher. The depth travels in a share code, so siblings play the same game.
 */
export type Features = { treats: boolean; paths: boolean; rascalHearts: number };
export const featuresFor = (depth: number): Features => ({
  treats: depth >= 1,
  paths: depth >= 2,
  rascalHearts: Math.min(MAX_RASCAL_HEARTS, depth >= 3 ? 4 : 3),
});

/** A player's depth from their history: one new feature per run played, a tougher Rascal after 3 wins. */
export function depthFor(runsPlayed: number, wins: number): number {
  if (runsPlayed >= 3 && wins >= 3) return 3;
  return Math.min(2, runsPlayed);
}

type Item = { q: Question; comeback: boolean };

export type Stage =
  | { kind: 'meadow'; meadow: number; path: Path; items: Item[]; idx: number }
  | { kind: 'showdown'; meadow: number; path: Path; pool: Question[]; idx: number; rascal: number; rascalMax: number }
  /** A rest stop before `meadow` (the next one): pick one treat. */
  | { kind: 'rest'; meadow: number; offer: Treat[] }
  /** Choose the path for `meadow`. */
  | { kind: 'doors'; meadow: number }
  | { kind: 'won' }
  | { kind: 'lost' };

export type Run = {
  level: LevelId;
  seed: number;
  depth: number;
  features: Features;
  stage: Stage;
  hearts: number;
  carrots: number;
  streak: number;
  bestStreak: number;
  bag: Treat[];
  /** A clover is in play: the next miss costs no heart. */
  clover: boolean;
  /** Hearts lost in the current meadow (a meadow with none earns a bonus). */
  lostThisMeadow: number;
  meadowsCleared: number;
  showdownsWon: number;
  /** Skills of questions missed twice, for "Practice …" at the end. */
  missed: Skill[];
};

/* ---------- Seeds ---------- */

/** A seed for one part of the run, mixed from the run's seed and some numbers (like a hash). */
export function subSeed(seed: number, ...parts: number[]): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const p of parts) {
    h = Math.imul(h ^ (p + 0x7f4a7c15), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
  }
  return h >>> 0;
}
const STREAM = { meadow: 1, showdown: 2, rest: 3 } as const;
const pathNo = (p: Path) => (p === 'sunny' ? 0 : 1);

/* ---------- What each meadow asks ---------- */

export type Spec = { level: LevelId; hard: boolean };

/**
 * Meadow 1 is the chosen level; meadow 3 is a level up. The Tricky path is a step harder:
 * the toughest sums of a level ("hard picks"), or the next level. At the top level, where there
 * is no next level, hard picks stand in for it.
 */
export function meadowSpec(level: LevelId, meadow: number, path: Path): Spec {
  const up = nextLevel(level);
  const tricky = path === 'tricky';
  if (meadow === 0) return { level, hard: tricky };
  if (meadow === 1) return tricky ? (up ? { level: up, hard: false } : { level, hard: true }) : { level, hard: false };
  return up ? { level: up, hard: tricky } : { level, hard: true };
}

/** A showdown is one step above its meadow. */
export function showdownSpec(level: LevelId, meadow: number, path: Path): Spec {
  const m = meadowSpec(level, meadow, path);
  const up = nextLevel(m.level);
  return up ? { level: up, hard: m.hard } : { level: m.level, hard: true };
}

/** Showdowns skip picture stories: they're quick-fire. */
const SHOWDOWN_KINDS: Kind[] = ['type', 'choice', 'missing', 'compare'];
const SHOWDOWN_POOL = 12;

function meadowQuestions(run: Pick<Run, 'level' | 'seed'>, meadow: number, path: Path): Item[] {
  const spec = meadowSpec(run.level, meadow, path);
  const qs = generateQuiz({
    level: spec.level,
    count: QUESTIONS_PER_MEADOW,
    seed: subSeed(run.seed, STREAM.meadow, meadow, pathNo(path)),
    hard: spec.hard,
    easeIn: meadow === 0,
  });
  return qs.map((q) => ({ q: { ...q, id: `m${meadow}-${q.id}` }, comeback: false }));
}

function showdownQuestions(run: Pick<Run, 'level' | 'seed'>, meadow: number, path: Path, batch: number): Question[] {
  const spec = showdownSpec(run.level, meadow, path);
  const qs = generateQuiz({
    level: spec.level,
    count: SHOWDOWN_POOL,
    seed: subSeed(run.seed, STREAM.showdown, meadow, pathNo(path), batch),
    hard: spec.hard,
    kinds: SHOWDOWN_KINDS,
    easeIn: false,
  });
  return qs.map((q) => ({ ...q, id: `s${meadow}-${batch}-${q.id}` }));
}

function restOffer(run: Pick<Run, 'seed'>, meadow: number): Treat[] {
  return makeRng(subSeed(run.seed, STREAM.rest, meadow)).shuffle([...TREATS]);
}

/* ---------- Starting, and moving between stages ---------- */

export function startRun({ level, seed, depth }: { level: LevelId; seed: number; depth: number }): Run {
  const base = { level, seed };
  return {
    level,
    seed,
    depth,
    features: featuresFor(depth),
    stage: { kind: 'meadow', meadow: 0, path: 'sunny', items: meadowQuestions(base, 0, 'sunny'), idx: 0 },
    hearts: START_HEARTS,
    carrots: 0,
    streak: 0,
    bestStreak: 0,
    bag: [],
    clover: false,
    lostThisMeadow: 0,
    meadowsCleared: 0,
    showdownsWon: 0,
    missed: [],
  };
}

const enterMeadow = (run: Run, meadow: number, path: Path): Run => ({
  ...run,
  lostThisMeadow: 0,
  stage: { kind: 'meadow', meadow, path, items: meadowQuestions(run, meadow, path), idx: 0 },
});

/** After a showdown is won: a rest stop, then a choice of path, then the next meadow (each only once unlocked). */
function afterShowdown(run: Run, meadow: number): Run {
  const next = meadow + 1;
  if (next >= MEADOWS) return { ...run, stage: { kind: 'won' }, carrots: run.carrots + CARROTS.finish(baseWorth(run), run.hearts) };
  if (run.features.treats) return { ...run, stage: { kind: 'rest', meadow: next, offer: restOffer(run, next) } };
  return afterRest(run, next);
}

function afterRest(run: Run, meadow: number): Run {
  if (run.features.paths) return { ...run, stage: { kind: 'doors', meadow } };
  return enterMeadow(run, meadow, 'sunny');
}

/* ---------- Carrots ---------- */

const baseWorth = (run: Pick<Run, 'level'>) => worth(LEVEL_TIER[run.level]);
const questionWorth = (q: Question, level: LevelId) => worth(q.tier ?? LEVEL_TIER[level], q.hard);

/** What answering the current question this way would do. The screen shows it before moving on. */
export type Gain = {
  carrots: number;
  /** Of `carrots`, the extra for a streak of 3 or more. */
  streakBonus: number;
  heartLost: boolean;
  /** A clover saved a heart. */
  saved: boolean;
  /** A showdown hit on Rascal. */
  hit: boolean;
};

export type Current = { q: Question; comeback: boolean; showdown: boolean; key: string };

/** The question being asked now, if the run is on a meadow or in a showdown. */
export function current(run: Run): Current | null {
  const s = run.stage;
  if (s.kind === 'meadow') {
    const it = s.items[s.idx];
    return { q: it.q, comeback: it.comeback, showdown: false, key: `${it.q.id}${it.comeback ? '-again' : ''}` };
  }
  if (s.kind === 'showdown') {
    const q = s.pool[s.idx];
    return { q, comeback: false, showdown: true, key: `${q.id}-${s.idx}` };
  }
  return null;
}

export function preview(run: Run, outcome: Outcome): Gain {
  const cur = current(run);
  const none: Gain = { carrots: 0, streakBonus: 0, heartLost: false, saved: false, hit: false };
  if (!cur) return none;
  const w = questionWorth(cur.q, run.level);
  if (cur.comeback) return { ...none, carrots: outcome === 'fail' ? 0 : CARROTS.comeback(w) };
  if (outcome === 'fail') return { ...none, heartLost: !run.clover, saved: run.clover };
  const streakBonus = outcome === 'first' && run.streak + 1 >= 3 ? CARROTS.streak(w) : 0;
  const main = outcome === 'first' ? (cur.showdown ? CARROTS.showdownHit(w) : CARROTS.firstTry(w)) : CARROTS.secondTry(w);
  return { carrots: main + streakBonus, streakBonus, heartLost: false, saved: false, hit: cur.showdown };
}

/** Applies the answer to the current question and moves the run on. */
export function answer(run: Run, outcome: Outcome): Run {
  const cur = current(run);
  if (!cur) return run;
  const gain = preview(run, outcome);
  let r: Run = { ...run, carrots: run.carrots + gain.carrots };

  if (!cur.comeback) {
    const streak = outcome === 'first' ? run.streak + 1 : 0;
    r.streak = streak;
    r.bestStreak = Math.max(run.bestStreak, streak);
  }
  if (gain.saved) r.clover = false;
  if (gain.heartLost) {
    r.hearts = run.hearts - 1;
    r.lostThisMeadow = run.lostThisMeadow + 1;
  }
  if (outcome === 'fail' && !cur.comeback) r.missed = [...run.missed, cur.q.skill];
  if (r.hearts <= 0) return { ...r, hearts: 0, stage: { kind: 'lost' } };

  const s = run.stage;
  if (s.kind === 'meadow') {
    // A question missed twice comes back once at the end of the meadow.
    const items = outcome === 'fail' && !cur.comeback ? [...s.items, { q: cur.q, comeback: true }] : s.items;
    if (s.idx + 1 < items.length) return { ...r, stage: { ...s, items, idx: s.idx + 1 } };
    const rascal = r.features.rascalHearts;
    return { ...r, stage: { kind: 'showdown', meadow: s.meadow, path: s.path, pool: showdownQuestions(r, s.meadow, s.path, 0), idx: 0, rascal, rascalMax: rascal } };
  }
  if (s.kind === 'showdown') {
    const rascal = gain.hit ? s.rascal - 1 : s.rascal;
    if (rascal <= 0) {
      const perfect = r.lostThisMeadow === 0 ? perfectBonus(r, s.meadow, s.path) : 0;
      r = { ...r, carrots: r.carrots + perfect, meadowsCleared: r.meadowsCleared + 1, showdownsWon: r.showdownsWon + 1 };
      return afterShowdown(r, s.meadow);
    }
    let pool = s.pool;
    if (s.idx + 1 >= pool.length) pool = [...pool, ...showdownQuestions(r, s.meadow, s.path, Math.floor(pool.length / SHOWDOWN_POOL))];
    return { ...r, stage: { ...s, pool, idx: s.idx + 1, rascal } };
  }
  return r;
}

/** The bonus for a meadow with no hearts lost, for showing on screen. */
export function perfectBonus(run: Run, meadow: number, path: Path): number {
  const spec = meadowSpec(run.level, meadow, path);
  return CARROTS.perfectMeadow(worth(LEVEL_TIER[spec.level], spec.hard));
}

/* ---------- Treats and paths ---------- */

/** Take a treat from the rest stop (or none, when the bag is full), and move on. */
export function pickTreat(run: Run, treat: Treat | null): Run {
  if (run.stage.kind !== 'rest') return run;
  const bag = treat && run.bag.length < BAG_SIZE ? [...run.bag, treat] : run.bag;
  return afterRest({ ...run, bag }, run.stage.meadow);
}

export function choosePath(run: Run, path: Path): Run {
  if (run.stage.kind !== 'doors') return run;
  return enterMeadow(run, run.stage.meadow, path);
}

/** Whether a treat can be used right now. The magnifier needs answers to take away. */
export function canUse(run: Run, treat: Treat): boolean {
  if (!run.bag.includes(treat)) return false;
  const cur = current(run);
  if (!cur) return false;
  if (treat === 'cake') return run.hearts < MAX_HEARTS;
  if (treat === 'clover') return !run.clover;
  return cur.q.kind === 'choice' || cur.q.kind === 'compare';
}

/** Uses a treat. The magnifier's effect (hiding wrong answers) is drawn by the question screen. */
export function useTreat(run: Run, treat: Treat): Run {
  if (!canUse(run, treat)) return run;
  const i = run.bag.indexOf(treat);
  const bag = [...run.bag.slice(0, i), ...run.bag.slice(i + 1)];
  if (treat === 'cake') return { ...run, bag, hearts: run.hearts + 1 };
  if (treat === 'clover') return { ...run, bag, clover: true };
  return { ...run, bag };
}

/** Which meadow the run is on, 0–2, for the progress map. */
export function meadowOf(run: Run): number {
  const s = run.stage;
  if (s.kind === 'won') return MEADOWS;
  if (s.kind === 'lost') return run.meadowsCleared;
  return s.meadow;
}

export const isOver = (run: Run) => run.stage.kind === 'won' || run.stage.kind === 'lost';
