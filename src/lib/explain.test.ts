import { describe, expect, it } from 'vitest';
import { correctAnswer, generateQuiz } from './generator';
import { explain, factSteps, type Group, type Scene } from './explain';

const value = (s: Scene) => {
  if (s.type !== 'blocks') return NaN;
  return s.parts
    .filter((p): p is Group => p !== '+')
    .reduce((n, g) => n + g.rods.filter((r) => r.state !== 'gone').length * 10 + g.cubes.filter((c) => c.state !== 'gone').length, 0);
};

describe('explanations', () => {
  it('38 + 7 carries a ten', () => {
    const steps = factSteps({ a: 38, op: '+', b: 7, c: 45 });
    expect(steps.map((s) => s.caption)).toEqual([
      'Make *38* and *7* with blocks.',
      'Put the ones together: *8 + 7 = 15*',
      'Circle *10 ones*…',
      '…they turn into *1 ten*!',
      '4 tens and 5 ones = *45*',
    ]);
  });

  it('52 − 8 breaks a ten', () => {
    const steps = factSteps({ a: 52, op: '-', b: 8, c: 44 });
    expect(steps.map((s) => s.caption)).toEqual([
      'Start with *52*.',
      'Take away 8 ones? There are only *2*!',
      'Break *1 ten* into *10 ones*!',
      'Take away *8 ones*.',
      "4 tens and 4 ones left. That's *44*!",
    ]);
  });

  it('every step keeps the right amount, and ends on the answer', () => {
    for (let seed = 1; seed < 80; seed++) {
      for (const level of [1, 2, 3, 4] as const) {
        for (const q of generateQuiz({ level, count: 15, seed })) {
          const steps = explain(q);
          const last = steps.filter((s) => s.scene.type === 'blocks').at(-1)!;
          expect(last.scene.type === 'blocks' && last.scene.result).toBe(q.kind === 'missing' ? correctAnswer(q) : q.fact.c);
          for (const s of steps) {
            if (s.scene.type !== 'blocks') continue;
            const g = s.scene.parts.filter((p): p is Group => p !== '+');
            expect(g.every((x) => x.cubes.length <= 19)).toBe(true);
            // The middle steps of a sum show the same total throughout (before anything is taken away).
            if (!s.scene.parts.includes('+') && !g.some((x) => [...x.rods, ...x.cubes].some((p) => p.state === 'gone'))) {
              // A missing-number question is turned around first, so any of its three numbers can show up.
              const ok = q.kind === 'missing' ? [q.fact.a, q.fact.b, q.fact.c] : [q.fact.a, q.fact.c];
              expect(ok).toContain(value(s.scene));
            }
          }
        }
      }
    }
  });
});
