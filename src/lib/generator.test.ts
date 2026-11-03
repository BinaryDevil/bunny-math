import { describe, expect, it } from 'vitest';
import { correctAnswer, generateQuiz, LEVELS, makeChoices, makeFact, nextLevel, regroupCount, regroups } from './generator';
import { makeRng } from './rng';
import type { LevelId, Op } from './types';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);

const ALL_LEVELS = LEVELS.map((l) => l.id);

function facts(level: LevelId, ops: Op[] = ['+', '-']) {
  return SEEDS.flatMap((seed) => {
    const r = makeRng(seed);
    return ops.map((op) => makeFact(r, level, op));
  });
}

describe('sums stay at the right difficulty', () => {
  it('level 6 answers are always three-digit numbers, even when borrowing across a zero', () => {
    for (const f of facts(6)) {
      expect(f.c).toBeGreaterThanOrEqual(100);
      expect(f.c).toBeLessThanOrEqual(999);
    }
  });

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

describe('bigger numbers, times and divide', () => {
  it('every level: whole, positive answers below 1000 that add up', () => {
    for (const level of ALL_LEVELS) {
      for (const f of facts(level, ['+', '-', '×', '÷'])) {
        const want = { '+': f.a + f.b, '-': f.a - f.b, '×': f.a * f.b, '÷': f.a / f.b }[f.op];
        expect(f.c).toBe(want);
        expect(Number.isInteger(f.c)).toBe(true);
        expect(f.c).toBeGreaterThanOrEqual(1);
        expect(f.c).toBeLessThanOrEqual(999);
        expect(f.b).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('add & take-away levels never times or divide', () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      for (const f of facts(level, ['×', '÷'])) expect(['+', '-']).toContain(f.op);
    }
  });

  it('level 5 is 3-digit with at most one carry or borrow', () => {
    for (const f of facts(5)) {
      expect(f.a).toBeGreaterThanOrEqual(100);
      expect(regroupCount(f)).toBeLessThanOrEqual(1);
    }
  });

  it('level 6 is 3-digit with two or more carries or borrows, sometimes across a zero', () => {
    const all = facts(6);
    for (const f of all) {
      expect(f.a).toBeGreaterThanOrEqual(100);
      expect(regroupCount(f)).toBeGreaterThanOrEqual(2);
    }
    expect(all.some((f) => f.op === '-' && Math.floor(f.a / 10) % 10 === 0)).toBe(true);
  });

  it('first tables use 2, 5 and 10; all tables stay within 10 × 10', () => {
    for (const f of facts(11, ['×', '÷'])) {
      if (f.op === '×') expect([f.a, f.b].some((n) => [2, 5, 10].includes(n))).toBe(true);
      else expect([2, 5, 10]).toContain(f.b);
    }
    for (const f of facts(13, ['×', '÷'])) {
      const [x, y] = f.op === '×' ? [f.a, f.b] : [f.b, f.c];
      expect(Math.max(x, y)).toBeLessThanOrEqual(10);
      expect(Math.min(x, y)).toBeGreaterThanOrEqual(2);
    }
  });

  it('big times is two-digit by one-digit', () => {
    for (const f of facts(14, ['×', '÷'])) {
      if (f.op === '×') expect([Math.max(f.a, f.b) >= 10, Math.min(f.a, f.b) < 10]).toEqual([true, true]);
      else {
        expect(f.a).toBeLessThan(100);
        expect(f.b).toBeLessThan(10);
        expect(f.c).toBeGreaterThanOrEqual(11);
      }
    }
  });

  it('"all four" quizzes are two thirds times and divide', () => {
    const quiz = generateQuiz({ level: 12, count: 18, seed: 4 });
    expect(quiz.filter((q) => q.fact.op === '×' || q.fact.op === '÷')).toHaveLength(12);
    expect(new Set(quiz.map((q) => q.fact.op)).size).toBe(4);
  });

  it('the next level stays in the same mode', () => {
    expect(nextLevel(4)).toBe(5);
    expect(nextLevel(6)).toBe(null);
    expect(nextLevel(13)).toBe(14);
    expect(nextLevel(14)).toBe(null);
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
    for (const level of ALL_LEVELS) {
      SEEDS.forEach((seed, i) => {
        const r = makeRng(seed);
        const f = makeFact(r, level, (['+', '-', '×', '÷'] as const)[i % 4]);
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
