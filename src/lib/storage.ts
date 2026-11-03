import { isLang, type Lang } from '../i18n';
import { LEVELS } from './generator';
import type { LevelId, Mode } from './types';

/** How many questions a quiz can have. */
export const LENGTHS = [10, 15, 20];

/** How "Show me how" explains a sum: base-ten blocks, or the column method (竖式). */
export type ExplainStyle = 'blocks' | 'column';

/** Everything the app remembers on this device. No accounts, nothing leaves the browser. */
export type Saved = {
  /** Unset until the child picks a mode for the first time. */
  mode?: Mode;
  /** The level picked in each mode. */
  levelFor: Record<Mode, LevelId>;
  explain: ExplainStyle;
  /** The language the child picked. Unset means: follow the browser's language. */
  lang?: Lang;
  length: number;
  sound: boolean;
  stickers: string[];
  /** Best star count per level. */
  best: Partial<Record<LevelId, number>>;
};

const KEY = 'bunny-math:v1';
const DEFAULTS: Saved = { levelFor: { plus: 1, all: 11 }, explain: 'blocks', length: 15, sound: true, stickers: [], best: {} };

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return clean(JSON.parse(raw));
  } catch {
    return fresh();
  }
}

const fresh = (): Saved => ({ ...DEFAULTS, levelFor: { ...DEFAULTS.levelFor }, stickers: [], best: {} });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isLevelIn = (mode: Mode, v: unknown): v is LevelId => LEVELS.some((l) => l.mode === mode && l.id === v);

/**
 * Turns whatever was in storage into a valid save. Anything missing, from an older version, or
 * damaged falls back to the default for that field, so a bad save can never stop the app opening.
 */
export function clean(data: unknown): Saved {
  const out = fresh();
  if (!isObj(data)) return out;
  if (data.mode === 'plus' || data.mode === 'all') out.mode = data.mode;
  const levelFor = isObj(data.levelFor) ? data.levelFor : {};
  // Saves from before modes existed kept a single add/take-away level.
  const plus = data.levelFor === undefined ? data.level : levelFor.plus;
  if (isLevelIn('plus', plus)) out.levelFor.plus = plus;
  if (isLevelIn('all', levelFor.all)) out.levelFor.all = levelFor.all;
  if (data.explain === 'blocks' || data.explain === 'column') out.explain = data.explain;
  // A language that is no longer offered falls back to the browser's language.
  if (isLang(data.lang)) out.lang = data.lang;
  if (typeof data.length === 'number' && LENGTHS.includes(data.length)) out.length = data.length;
  if (typeof data.sound === 'boolean') out.sound = data.sound;
  // Known stickers only, each once, in the order they were collected.
  if (Array.isArray(data.stickers)) out.stickers = [...new Set(data.stickers)].filter((x): x is string => (STICKERS as readonly unknown[]).includes(x));
  if (isObj(data.best)) {
    for (const l of LEVELS) {
      const n = data.best[l.id];
      if (typeof n === 'number' && n >= 0 && n <= 3) out.best[l.id] = Math.floor(n);
    }
  }
  return out;
}

export function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or storage blocked: the app still works, it just forgets.
  }
}

export const STICKERS = [
  '🍓', '🦄', '🌈', '🐱', '🌸', '🧁', '🎀', '🐰', '🍉', '🦋', '🐢', '🌙',
  '🍭', '🐼', '🍒', '🌻', '🐬', '🦊', '🍪', '🎈', '🐧', '🌷', '🐝', '🍩',
] as const;
