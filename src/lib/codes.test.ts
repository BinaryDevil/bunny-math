import { describe, expect, it } from 'vitest';
import { CODE_EMOJI, codeFromUrl, codeLink, decodeCode, encodeCode, SEED_BITS, type ShareCode } from './codes';
import { generateQuiz } from './generator';
import { LENGTHS } from './storage';

describe('share codes', () => {
  it('uses 64 different single-character emoji', () => {
    expect(new Set(CODE_EMOJI).size).toBe(64);
    for (const e of CODE_EMOJI) expect(Array.from(e)).toHaveLength(1);
  });

  const cases: ShareCode[] = [
    { adventure: false, level: 1, length: 10, seed: 0 },
    { adventure: false, level: 14, length: 20, seed: 2 ** SEED_BITS - 1 },
    { adventure: true, level: 6, depth: 3, seed: 123456 },
    { adventure: true, level: 11, depth: 0, seed: 42 },
  ];
  it.each(cases)('round-trips %o', (c) => {
    const text = encodeCode(c);
    expect(Array.from(text)).toHaveLength(5);
    expect(decodeCode(text)).toEqual(c);
  });

  it('round-trips every level and quiz length', () => {
    for (const level of [1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 21, 22] as const) {
      for (const length of LENGTHS) {
        const c: ShareCode = { adventure: false, level, length, seed: 777 };
        expect(decodeCode(encodeCode(c))).toEqual(c);
      }
    }
  });

  it('keeps the codes made before levels 21–22 existed', () => {
    // Made by the app before the new levels went on the end of the level list.
    expect(encodeCode(cases[0])).toBe('🐸🍓🍓🍓🍓');
    expect(encodeCode(cases[1])).toBe('🐝🍒🍦🍦🍦');
    expect(encodeCode(cases[2])).toBe('🦁🍋🍇🐢🍓');
  });

  it('has no Adventure codes for levels 21–22, which have no Adventure', () => {
    for (const level of [21, 22] as const) expect(decodeCode(encodeCode({ adventure: true, level, depth: 0, seed: 9 }))).toBeNull();
  });

  it('ignores spaces and emoji variation selectors', () => {
    const text = encodeCode(cases[2]);
    const spaced = Array.from(text).join(' ️');
    expect(decodeCode(spaced)).toEqual(cases[2]);
  });

  it('turns away things that are not codes', () => {
    expect(decodeCode('')).toBeNull();
    expect(decodeCode('hello')).toBeNull();
    expect(decodeCode('🍓🍓🍓🍓')).toBeNull();
    expect(decodeCode('🍓🍓🍓🍓😀')).toBeNull();
    // Version 0 (all zero bits) is not a version we make.
    expect(decodeCode('🍓🍓🍓🍓🍓')).toBeNull();
  });

  it('goes in and out of a link', () => {
    const text = encodeCode(cases[0]);
    const link = codeLink(text, 'https://example.com/bunny-math/?seed=4#x');
    expect(link.startsWith('https://example.com/bunny-math/?code=')).toBe(true);
    expect(codeFromUrl(new URL(link).search)).toEqual({ text, code: cases[0] });
    expect(codeFromUrl('?code=nope')).toBeNull();
  });
});

/**
 * A shared code must give the same questions on every device and every version of the app.
 * If this fails, the generator changed: bump CODE_VERSION in codes.ts (old codes are then
 * turned away instead of making different questions) and update the expected sums here.
 */
describe('codes always make the same questions', () => {
  const sums = (level: 1 | 6 | 11 | 14, seed: number) =>
    generateQuiz({ level, count: 6, seed }).map((q) => `${q.fact.a}${q.fact.op}${q.fact.b}=${q.fact.c}`);

  it('level 1, seed 1234', () => {
    expect(sums(1, 1234)).toMatchSnapshot();
  });
  it('level 6, seed 99', () => {
    expect(sums(6, 99)).toMatchSnapshot();
  });
  it('level 11, seed 5', () => {
    expect(sums(11, 5)).toMatchSnapshot();
  });
  it('level 14, seed 777', () => {
    expect(sums(14, 777)).toMatchSnapshot();
  });
});
