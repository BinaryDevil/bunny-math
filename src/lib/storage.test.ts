// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { clean, load } from './storage';

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
    const good = { mode: 'all', levelFor: { plus: 4, all: 13 }, explain: 'column', lang: 'fr', length: 20, sound: false, stickers: ['🦄', '🍓'], best: { 4: 3, 13: 1 } };
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
