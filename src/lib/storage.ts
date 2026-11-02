import type { LevelId } from './types';

/** Everything the app remembers on this device. No accounts, nothing leaves the browser. */
export type Saved = {
  level: LevelId;
  length: number;
  sound: boolean;
  stickers: string[];
  /** Best star count per level. */
  best: Partial<Record<LevelId, number>>;
};

const KEY = 'bunny-math:v1';
const DEFAULTS: Saved = { level: 1, length: 15, sound: true, stickers: [], best: {} };

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
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
