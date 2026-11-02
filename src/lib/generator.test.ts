import { describe, expect, it } from 'vitest';
import { correctAnswer, generateQuiz, makeChoices, makeFact, regroups } from './generator';
import { makeRng } from './rng';
import type { LevelId } from './types';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);

function facts(level: LevelId) {
  return SEEDS.flatMap((seed) => {
    const r = makeRng(seed);
    return [makeFact(r, level, '+'), makeFact(r, level, '-')];
  });
}

describe('sums stay at the right difficulty', () => {
  it('all levels: no negatives, no +0/−0, no answers over 99, sums add up', () => {
    for (const level of [1, 2, 3, 4] as const) {
      for (const f of facts(level)) {
        expect(f.c).toBe(f.op === '+' ? f.a + f.b : f.a - f.b);
        expect(f.c).toBeGreaterThanOrEqual(1);
        expect(f.c).toBeLessThanOrEqual(99);
        expect(f.b).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('level 1 stays within 20', () => {
    for (const f of facts(1)) {
      expect(Math.max(f.a, f.b, f.c)).toBeLessThanOrEqual(20);
    }
  });

  it('level 2 never needs carrying or borrowing', () => {
    for (const f of facts(2)) {
      expect(regroups(f)).toBe(false);
      expect(f.a).toBeGreaterThanOrEqual(10);
    }
  });

  it('level 3 is 2-digit ± 1-digit and always needs carrying or borrowing', () => {
    for (const f of facts(3)) {
      expect(regroups(f)).toBe(true);
      expect(f.a).toBeGreaterThanOrEqual(10);
      expect(f.b).toBeLessThan(10);
    }
  });

  it('level 4 is 2-digit ± 2-digit with a mix of carrying and not', () => {
    const all = facts(4);
    for (const f of all) {
      expect(f.a).toBeGreaterThanOrEqual(10);
      expect(f.b).toBeGreaterThanOrEqual(11);
    }
    const share = all.filter(regroups).length / all.length;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.8);
  });
});

describe('quizzes', () => {
  it('have the asked length, no repeated sums, and start with plain sums', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      for (const level of [1, 2, 3, 4] as const) {
        const quiz = generateQuiz({ level, count: 20, seed });
        expect(quiz).toHaveLength(20);
        const keys = quiz.map((q) => `${q.fact.a}${q.fact.op}${q.fact.b}`);
        expect(new Set(keys).size).toBe(20);
        expect(quiz[0].kind).toBe('type');
        expect(quiz[1].kind).toBe('type');
      }
    }
  });

  it('mix adding and taking away about evenly', () => {
    const quiz = generateQuiz({ level: 3, count: 16, seed: 42 });
    expect(quiz.filter((q) => q.fact.op === '+')).toHaveLength(8);
  });

  it('are the same for the same seed', () => {
    expect(generateQuiz({ level: 4, count: 15, seed: 5 })).toEqual(generateQuiz({ level: 4, count: 15, seed: 5 }));
  });

  it('can focus on chosen skills', () => {
    const quiz = generateQuiz({ level: 4, count: 10, seed: 9, skills: ['borrow'] });
    expect(quiz.every((q) => q.skill === 'borrow')).toBe(true);
  });

  it('use every question format', () => {
    const kinds = new Set(SEEDS.slice(0, 20).flatMap((seed) => generateQuiz({ level: 2, count: 15, seed }).map((q) => q.kind)));
    expect([...kinds].sort()).toEqual(['choice', 'compare', 'missing', 'story', 'type']);
  });

  it('can be limited to some formats', () => {
    const quiz = generateQuiz({ level: 2, count: 20, seed: 3, kinds: ['type', 'missing'] });
    expect(quiz.every((q) => q.kind === 'type' || q.kind === 'missing')).toBe(true);
  });
});

describe('answers', () => {
  it('multiple choice has 4 different positive options including the answer', () => {
    for (const level of [1, 2, 3, 4] as const) {
      SEEDS.forEach((seed, i) => {
        const r = makeRng(seed);
        const f = makeFact(r, level, i % 2 ? '+' : '-');
        const choices = makeChoices(r, f);
        expect(choices).toHaveLength(4);
        expect(new Set(choices).size).toBe(4);
        expect(choices).toContain(f.c);
        expect(choices.every((n) => n > 0)).toBe(true);
      });
    }
  });

  it('missing-number and compare questions have the right answer', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      for (const q of generateQuiz({ level: 3, count: 20, seed })) {
        const ans = correctAnswer(q);
        if (q.kind === 'missing') expect(ans).toBe(q.hide === 'a' ? q.fact.a : q.fact.b);
        else if (q.kind === 'compare') {
          expect(q.than).toBeGreaterThan(0);
          expect(ans).toBe(q.fact.c < q.than ? '<' : q.fact.c > q.than ? '>' : '=');
        } else expect(ans).toBe(q.fact.c);
      }
    }
  });
});
