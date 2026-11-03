// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { clean, load, MAX_CODES, recordRun } from './storage';

const KEY = 'bunny-math:v1';
const DEFAULT_LEVELS = { plus: 1, all: 11 };

beforeEach(() => localStorage.clear());

describe('loading a save', () => {
  it('starts fresh with nothing saved, or with something that is not JSON', () => {
    expect(load().levelFor).toEqual(DEFAULT_LEVELS);
    localStorage.setItem(KEY, '{oops');
    expect(load().levelFor).toEqual(DEFAULT_LEVELS);
  });

  it('keeps a good save as it is', () => {
    const good = { mode: 'all', levelFor: { plus: 4, all: 13 }, explain: 'column', lang: 'fr', length: 20, sound: false, stickers: ['🦄', '🍓'], best: { 4: 3, 13: 1 }, adventure: true,
      adv: { runsPlayed: 4, wins: 2, bestMeadow: 3, jar: 90, totalEarned: 120, bestByCode: { '🍓🦄🌙🐱🌸': 60 }, seen: ['treats'] } };
    localStorage.setItem(KEY, JSON.stringify(good));
    expect(load()).toEqual(good);
  });

  it('moves the single level from saves made before modes existed', () => {
    expect(clean({ level: 3 }).levelFor).toEqual({ plus: 3, all: 11 });
  });

  it.each([
    ['levels that do not exist', { levelFor: { plus: 7, all: 2 } }],
    ['a level from the other mode', { levelFor: { plus: 12, all: 5 } }],
    ['levelFor set to null', { levelFor: null }],
    ['an old level that is not a level', { level: 'three' }],
  ])('falls back to the first levels for %s', (_, data) => {
    expect(clean(data).levelFor).toEqual(DEFAULT_LEVELS);
  });

  it('never crashes or keeps junk from a damaged save', () => {
    for (const data of [null, 42, 'hi', [], { stickers: 'abc', best: [3], length: '15', sound: 'yes', mode: 'times', explain: 1, lang: 'xx' }]) {
      const s = clean(data);
      expect(s).toMatchObject({ levelFor: DEFAULT_LEVELS, explain: 'blocks', length: 15, sound: true, stickers: [], best: {} });
      expect(s.mode).toBeUndefined();
      expect(s.lang).toBeUndefined();
    }
  });

  it('keeps only real stickers, each once, and only sensible star counts', () => {
    const s = clean({ stickers: ['🦄', 'nope', '🦄', 5, '🍓'], best: { 1: 2, 2: 9, 3: -1, 4: 'x', 99: 3 } });
    expect(s.stickers).toEqual(['🦄', '🍓']);
    expect(s.best).toEqual({ 1: 2 });
  });

  it('does not share default objects between fresh saves', () => {
    const a = load();
    a.stickers.push('🦄');
    a.levelFor.plus = 5;
    expect(load().stickers).toEqual([]);
    expect(load().levelFor.plus).toBe(1);
  });
});

describe('adventure stats', () => {
  it('start at zero, and old saves get them too', () => {
    const s = clean({ mode: 'plus' });
    expect(s.adventure).toBe(false);
    expect(s.adv).toEqual({ runsPlayed: 0, wins: 0, bestMeadow: 0, jar: 0, totalEarned: 0, bestByCode: {}, seen: [] });
  });

  it('drop junk and impossible numbers', () => {
    const s = clean({ adventure: 'yes', adv: { runsPlayed: -2, wins: 9, bestMeadow: 7, jar: 500, totalEarned: 100, bestByCode: { a: 'x', b: 3 }, seen: [1, 'paths', 'paths'] } });
    expect(s.adventure).toBe(false);
    expect(s.adv).toEqual({ runsPlayed: 0, wins: 0, bestMeadow: 3, jar: 100, totalEarned: 100, bestByCode: { b: 3 }, seen: ['paths'] });
  });

  it('adds up runs, keeps the best per code, and remembers only the latest codes', () => {
    let adv = clean({}).adv;
    adv = recordRun(adv, { code: 'A', carrots: 40, won: false, meadowsCleared: 1 });
    adv = recordRun(adv, { code: 'A', carrots: 30, won: true, meadowsCleared: 3 });
    expect(adv).toMatchObject({ runsPlayed: 2, wins: 1, bestMeadow: 3, jar: 70, totalEarned: 70, bestByCode: { A: 40 } });
    for (let i = 0; i < MAX_CODES + 5; i++) adv = recordRun(adv, { code: `c${i}`, carrots: 1, won: false, meadowsCleared: 0 });
    expect(Object.keys(adv.bestByCode)).toHaveLength(MAX_CODES);
    expect(adv.bestByCode.A).toBeUndefined();
  });
});
