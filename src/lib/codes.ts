/**
 * Share codes: 5 emoji that rebuild the exact same quiz or adventure on any device.
 * No server is involved: the code carries the settings and the seed, and the seeded
 * generator does the rest. 🍓🦄🌙🐱🌸 is easy to read out to a sibling.
 *
 * 5 emoji from a list of 64 hold 30 bits:
 *   version (3) · adventure (1) · level (4) · quiz length or adventure depth (2) · seed (20)
 * Bump CODE_VERSION when the generator changes so old codes would give different questions,
 * so an old code is turned away instead of quietly making a different quiz.
 */
import { LENGTHS } from './storage';
import type { LevelId } from './types';

export const CODE_VERSION = 1;

/** One code point each (no variation selectors or joiners), so every phone shows and splits them the same way. */
export const CODE_EMOJI = [
  '🍓', '🦄', '🌙', '🐱', '🌸', '🐰', '🦊', '🐼', '🐸', '🐢', '🐝', '🐧', '🐨', '🦁', '🐯', '🐙',
  '🦋', '🐳', '🐞', '🌻', '🍉', '🍩', '🚀', '🍕', '🍪', '🧁', '🍭', '🍒', '🍋', '🍌', '🍇', '🍑',
  '🥕', '🌽', '🍄', '🌵', '🌴', '🍀', '🌈', '🎈', '🎁', '🎀', '🎨', '🎸', '🎲', '🧩', '⚽', '🏀',
  '🎯', '🐶', '🐷', '🐮', '🐵', '🐔', '🦉', '🦖', '🐬', '🦀', '🐌', '🌍', '🌟', '🔔', '🧸', '🍦',
] as const;

const LEVEL_IDS: LevelId[] = [1, 2, 3, 4, 5, 6, 11, 12, 13, 14];
export const SEED_BITS = 20;
export const MAX_DEPTH = 3;

export type ShareCode =
  | { adventure: false; level: LevelId; length: number; seed: number }
  /** depth: how many Adventure features are on (see run.ts), so siblings sharing a code play the same game. */
  | { adventure: true; level: LevelId; depth: number; seed: number };

/** A seed small enough to fit in a code. */
export const shareSeed = () => Math.floor(Math.random() * 2 ** SEED_BITS);

export function encodeCode(c: ShareCode): string {
  const lvl = LEVEL_IDS.indexOf(c.level);
  const extra = c.adventure ? Math.min(MAX_DEPTH, Math.max(0, c.depth)) : Math.max(0, LENGTHS.indexOf(c.length));
  // 30 bits fit comfortably below 2^31, so plain arithmetic is exact.
  let n = CODE_VERSION;
  n = n * 2 + (c.adventure ? 1 : 0);
  n = n * 16 + Math.max(0, lvl);
  n = n * 4 + extra;
  n = n * 2 ** SEED_BITS + (c.seed % 2 ** SEED_BITS);
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    out.unshift(CODE_EMOJI[n % 64]);
    n = Math.floor(n / 64);
  }
  return out.join('');
}

/** The settings in a code, or null if it isn't one of ours (or comes from an older version). */
export function decodeCode(text: string): ShareCode | null {
  // Ignore spaces and the invisible variation selector some keyboards add after an emoji.
  const chars = Array.from(text.replace(/[\s︎️]/g, ''));
  if (chars.length !== 5) return null;
  let n = 0;
  for (const ch of chars) {
    const d = (CODE_EMOJI as readonly string[]).indexOf(ch);
    if (d < 0) return null;
    n = n * 64 + d;
  }
  const seed = n % 2 ** SEED_BITS;
  n = Math.floor(n / 2 ** SEED_BITS);
  const extra = n % 4;
  n = Math.floor(n / 4);
  const level = LEVEL_IDS[n % 16];
  n = Math.floor(n / 16);
  const adventure = n % 2 === 1;
  const version = Math.floor(n / 2);
  if (version !== CODE_VERSION || level === undefined) return null;
  if (adventure) return { adventure, level, depth: extra, seed };
  const length = LENGTHS[extra];
  return length === undefined ? null : { adventure, level, length, seed };
}

/** A link that opens the app with this code ready to play. */
export function codeLink(code: string, base = location.href): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('code', code);
  return url.toString();
}

/** The code in the page's address, if there is a valid one. */
export function codeFromUrl(search = location.search): { text: string; code: ShareCode } | null {
  const text = new URLSearchParams(search).get('code');
  const code = text ? decodeCode(text) : null;
  return text && code ? { text, code } : null;
}
