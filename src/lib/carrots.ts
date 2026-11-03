/**
 * How many carrots things are worth in Adventure. Shared with the leaderboard server (worker/),
 * which uses maxRunCarrots to turn away impossible scores.
 *
 * Every question has a difficulty tier, 1 (7 + 8) to 6 (503 − 167). A right answer is worth
 * tier + 1 carrots, so harder sums pay more and picking an easy level to farm carrots doesn't pay.
 * Bonuses are counted in "answers' worth", so they grow with the level too.
 */
import type { LevelId } from './types';

export type Tier = 1 | 2 | 3 | 4 | 5 | 6;

/** The tier of a level's main questions. Pairs across the two modes are a first guess. */
export const LEVEL_TIER: Record<LevelId, Tier> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 11: 1, 12: 2, 13: 4, 14: 5 };

/** What one right answer is worth. Tricky-path "hard picks" count as half a tier up. */
export const worth = (tier: number, hard = false) => tier + 1 + (hard ? 0.5 : 0);

export const CARROTS = {
  firstTry: (w: number) => Math.round(w),
  /** Right on the second try, or after "Show me how": less, but never nothing. */
  secondTry: (w: number) => Math.max(1, Math.floor(w / 2)),
  /** A missed question answered right when it comes back at the end of the meadow. */
  comeback: (w: number) => Math.max(1, Math.floor(w / 2)),
  showdownHit: (w: number) => Math.round(w * 1.5),
  /** Extra for each right answer once you have 3 or more in a row. */
  streak: (w: number) => Math.max(1, Math.round(w / 2)),
  perfectMeadow: (w: number) => Math.round(w * 2.5),
  finish: (w: number, heartsLeft: number) => Math.round(w * 5 + w * 2.5 * heartsLeft),
};

/** The badge on a level card: what a right answer at that level is worth. */
export const levelRate = (level: LevelId) => CARROTS.firstTry(worth(LEVEL_TIER[level]));

/* The shape of a run, kept here so the server's limit matches the game. */
export const MEADOWS = 3;
export const QUESTIONS_PER_MEADOW = 5;
export const START_HEARTS = 3;
export const MAX_HEARTS = 5;
export const MAX_RASCAL_HEARTS = 5;

/**
 * The most carrots one run at this level could possibly earn: every answer right first time,
 * at the hardest tier the run can reach (meadow 3 and showdowns go up to three tiers higher),
 * on the Tricky path, with a full streak, full hearts and Rascal at full strength.
 * Real runs come in well under this; anything above it was not earned by playing.
 */
export function maxRunCarrots(level: LevelId): number {
  const w = worth(Math.min(6, LEVEL_TIER[level] + 3), true);
  const meadowAnswers = MEADOWS * QUESTIONS_PER_MEADOW * (CARROTS.firstTry(w) + CARROTS.streak(w));
  const hits = MEADOWS * MAX_RASCAL_HEARTS * (CARROTS.showdownHit(w) + CARROTS.streak(w));
  const bonuses = MEADOWS * CARROTS.perfectMeadow(w) + CARROTS.finish(w, MAX_HEARTS);
  return meadowAnswers + hits + bonuses;
}
