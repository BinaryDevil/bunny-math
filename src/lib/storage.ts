import type { LevelId, Mode } from './types';

/** How "Show me how" explains a sum: base-ten blocks, or the column method (竖式). */
export type ExplainStyle = 'blocks' | 'column';

/** Everything the app remembers on this device. No accounts, nothing leaves the browser. */
export type Saved = {
  /** Unset until the child picks a mode for the first time. */
  mode?: Mode;
  /** The level picked in each mode. */
  levelFor: Record<Mode, LevelId>;
  explain: ExplainStyle;
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
    if (!raw) return { ...DEFAULTS };
    const { level, ...rest } = JSON.parse(raw);
    const saved: Saved = { ...DEFAULTS, ...rest };
    // Saves from before modes existed kept a single add/take-away level.
    if (typeof level === 'number' && !rest.levelFor) saved.levelFor = { ...DEFAULTS.levelFor, plus: level as LevelId };
    return saved;
  } catch {
    return { ...DEFAULTS };
  }
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
