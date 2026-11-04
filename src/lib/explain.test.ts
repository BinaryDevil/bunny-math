import { describe, expect, it } from 'vitest';
import { correctAnswer, generateQuiz, LEVELS } from './generator';
import { explain, factSteps, type Group, type Scene } from './explain';
import type { Fact } from './types';

const value = (s: Scene) => {
  if (s.type !== 'blocks') return NaN;
  const live = <T extends { state?: string }>(xs: T[] = []) => xs.filter((x) => x.state !== 'gone').length;
  return s.parts.filter((p): p is Group => p !== '+').reduce((n, g) => n + live(g.flats) * 100 + live(g.rods) * 10 + live(g.cubes), 0);
};
const captions = (f: Fact, style: 'blocks' | 'column' = 'blocks') => factSteps(f, style).map((s) => s.caption);

/** Reads a row of the column method back as a number. */
const rowValue = (s: Scene, row: number) => (s.type === 'column' ? Number(s.rows[row].cells.map((c) => c?.t ?? '').join('')) : NaN);

describe('blocks', () => {
  it('38 + 7 carries a ten', () => {
    expect(captions({ a: 38, op: '+', b: 7, c: 45 })).toEqual([
      'Make *38* and *7* with blocks.',
      'Put the ones together: *8 + 7 = 15*',
      'Circle *10 ones*…',
      '…they turn into *1 ten*!',
      '4 tens and 5 ones = *45*',
    ]);
  });

  it('52 − 8 breaks a ten', () => {
    expect(captions({ a: 52, op: '-', b: 8, c: 44 })).toEqual([
      'Start with *52*.',
      'Take away 8 ones? There are only *2*!',
      'Break *1 ten* into *10 ones*!',
      'Take away *8 ones*.',
      "4 tens and 4 ones left. That's *44*!",
    ]);
  });

  it('503 − 167 breaks a hundred, then a ten', () => {
    expect(captions({ a: 503, op: '-', b: 167, c: 336 })).toEqual([
      'Start with *503*.',
      'Take away 7 ones? There are only *3*, and no tens!',
      'Break *1 hundred* into *10 tens*!',
      'Now take *1 ten*…',
      'Break *1 ten* into *10 ones*!',
      'Take away *7 ones*.',
      'Take away *6 tens*.',
      'Take away *1 hundred*.',
      "3 hundreds, 3 tens and 6 ones left. That's *336*!",
    ]);
  });

  it('3 × 4 is 3 hops of 4', () => {
    const steps = factSteps({ a: 3, op: '×', b: 4, c: 12 });
    expect(steps.map((s) => s.caption)).toEqual(['*3 × 4* means *3 hops* of *4*.', 'Count by 4s: 4, 8, *12*', '3 × 4 = *12*']);
    expect(steps.map((s) => s.scene.type === 'hops' && [s.scene.step, s.scene.hops, s.scene.max])).toEqual([[4, 0, 12], [4, 3, 12], [4, 3, 12]]);
  });

  it('24 ÷ 6 counts hops of 6 to 24', () => {
    const steps = factSteps({ a: 24, op: '÷', b: 6, c: 4 });
    expect(steps.map((s) => s.caption)).toEqual([
      '*24 ÷ 6*: how many *hops of 6* get to 24?',
      'Count by 6s: 6, 12, 18, *24*',
      "That's *4 hops*. 24 ÷ 6 = *4*",
    ]);
    expect(steps.every((s) => s.scene.type === 'hops' && s.scene.goal && s.scene.count)).toBe(true);
  });

  it('6 × 14 splits the box into 10 and 4', () => {
    expect(captions({ a: 6, op: '×', b: 14, c: 84 })).toEqual([
      '6 × 14: a box of *6 rows* of *14*.',
      'Split *14* into tens and ones.',
      '6 × 10 = *60*',
      '6 × 4 = *24*',
      '60 + 24 = *84*',
    ]);
  });

  it('6 × 30 is one box of tens', () => {
    expect(captions({ a: 6, op: '×', b: 30, c: 180 })).toEqual(['6 × 30: a box of *6 rows* of *30*.', '6 lots of *3 tens* is *18 tens*.', "That's *180*!"]);
  });

  it('84 ÷ 6 finds how long each row is', () => {
    const steps = factSteps({ a: 84, op: '÷', b: 6, c: 14 });
    expect(steps.map((s) => s.caption)).toEqual([
      '*84* squares in *6 rows*. How long is each row?',
      'Put *10* in each row: 6 × 10 = 60.',
      '84 − 60 = *24* left over.',
      '24 ÷ 6 = *4* more in each row.',
      'Each row is 10 + 4 = *14*.',
    ]);
    expect(steps.map((s) => s.scene.type === 'box' && !!s.scene.ask)).toEqual([true, true, true, false, false]);
  });

  it('80 ÷ 4 has nothing left over after the tens', () => {
    expect(captions({ a: 80, op: '÷', b: 4, c: 20 })).toEqual([
      '*80* squares in *4 rows*. How long is each row?',
      'Put *20* in each row: 4 × 20 = 80.',
      'Nothing left over. Each row is *20*!',
    ]);
  });
});

describe('column method', () => {
  it('38 + 7 writes 5 and carries 1', () => {
    expect(captions({ a: 38, op: '+', b: 7, c: 45 }, 'column')).toEqual([
      'Stack them up: *ones under ones*.',
      'Ones: *8 + 7 = 15*. Write 5, carry 1.',
      'Tens: *3 + 1 = 4*. Write 4.',
      '*38 + 7 = 45*',
    ]);
  });

  it('503 − 167 puts borrow dots on the 0 and the 5', () => {
    const steps = factSteps({ a: 503, op: '-', b: 167, c: 336 }, 'column');
    expect(steps.map((s) => s.caption)).toEqual([
      'Stack them up: *ones under ones*.',
      'Ones: 3 − 7? Too small! Borrow 1 from next door: *13 − 7 = 6*',
      'Tens: too small again! Borrow 1: *10 − 1 − 6 = 3*',
      'Hundreds: the dot means 1 less. *5 − 1 − 1 = 3*',
      '*503 − 167 = 336*',
    ]);
    const last = steps.at(-1)!.scene;
    expect(last.type === 'column' && last.rows[0].cells.map((c) => !!c?.dot)).toEqual([true, true, false]);
  });

  it('503 − 498 = 5 has no zeros in front', () => {
    const last = factSteps({ a: 503, op: '-', b: 498, c: 5 }, 'column').at(-1)!.scene;
    expect(last.type === 'column' && last.rows[2].cells.map((c) => c?.t ?? '')).toEqual(['', '', '5']);
  });

  it('23 × 4 carries 1 into the tens', () => {
    expect(captions({ a: 23, op: '×', b: 4, c: 92 }, 'column')).toEqual([
      'Stack them up: *ones under ones*.',
      'Ones: *3 × 4 = 12*. Write 2, carry 1.',
      'Tens: *2 × 4 + 1 = 9*. Write 9.',
      '*23 × 4 = 92*',
    ]);
  });

  it('72 ÷ 4 divides, takes away and brings down', () => {
    expect(captions({ a: 72, op: '÷', b: 4, c: 18 }, 'column')).toEqual([
      'How many *4s* in *72*? Start on the left.',
      '7 ÷ 4: *4 × 1 = 4*. Write 1 on top.',
      '7 − 4 = 3. Bring down the 2: *32*.',
      '32 ÷ 4: *4 × 8 = 32*. Write 8 on top.',
      '32 − 32 = *0*. Nothing left over!',
      '*72 ÷ 4 = 18*',
    ]);
  });
});

describe('every question, both styles', () => {
  const quizzes = LEVELS.flatMap((l) => Array.from({ length: 40 }, (_, seed) => generateQuiz({ level: l.id, count: 15, seed: seed + 1 }))).flat();

  it('ends on the answer', () => {
    for (const q of quizzes) {
      const want = q.kind === 'missing' ? correctAnswer(q) : q.fact.c;
      for (const style of ['blocks', 'column'] as const) {
        const steps = explain(q, style);
        const last = steps.filter((s) => 'result' in s.scene && s.scene.result !== undefined).at(-1)!;
        expect(last, `${q.fact.a}${q.fact.op}${q.fact.b} ${style}`).toBeTruthy();
        expect((last.scene as { result: number }).result).toBe(want);
      }
    }
  });

  // Checks every box of every step of 6,000 questions. One expect() per box made it take 8s on
  // Cloudflare's build machine (past Vitest's 5s limit), so problems are collected and checked once.
  it('column method writes one digit per box and the answer on the right row', () => {
    const problems: string[] = [];
    for (const q of quizzes) {
      const sum = `${q.fact.a} ${q.fact.op} ${q.fact.b}`;
      const steps = explain(q, 'column');
      for (const s of steps) {
        if (s.scene.type !== 'column') continue;
        for (const row of s.scene.rows) {
          if (row.cells.length !== s.scene.width) problems.push(`${sum}: row of ${row.cells.length} boxes, want ${s.scene.width}`);
          for (const c of row.cells) if (c && !/^\d$/.test(c.t)) problems.push(`${sum}: box holds "${c.t}"`);
        }
      }
      const final = steps.filter((s) => s.scene.type === 'column').at(-1)!.scene;
      const want = q.kind === 'missing' ? correctAnswer(q) : q.fact.c;
      const answerRow = final.type === 'column' && final.division ? 0 : final.type === 'column' ? final.rows.length - 1 : -1;
      const got = rowValue(final, answerRow);
      if (got !== want) problems.push(`${sum}: answer row reads ${got}, want ${want}`);
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('times and divide pictures add up', () => {
    const problems: string[] = [];
    for (const q of quizzes) {
      const f = q.kind === 'missing' ? null : q.fact;
      const sum = `${q.fact.a} ${q.fact.op} ${q.fact.b}`;
      for (const s of explain(q, 'blocks')) {
        const sc = s.scene;
        if (sc.type === 'hops') {
          // The bunny never hops past the end of the line, and lands on it at the end.
          if (sc.hops * sc.step > sc.max) problems.push(`${sum}: hops past the end`);
          if (sc.result !== undefined && sc.hops * sc.step !== sc.max) problems.push(`${sum}: last hop misses the end`);
          if (sc.hops > 10) problems.push(`${sum}: ${sc.hops} hops`);
        }
        if (sc.type === 'box') {
          // The box holds the whole sum (rows × width), and what's written inside adds up to it.
          const area = sc.rows * (sc.tens + sc.ones);
          if (f && area !== (f.op === '×' ? f.c : f.a)) problems.push(`${sum}: box holds ${area}`);
          if (sc.tens % 10 || sc.ones > 9) problems.push(`${sum}: box split ${sc.tens} + ${sc.ones}`);
          if (sc.rows > 9) problems.push(`${sum}: box has ${sc.rows} rows`);
          const inside = (sc.inside?.tens ?? 0) + (sc.inside?.ones ?? 0);
          if (sc.fill?.tens && sc.inside?.tens !== sc.rows * sc.tens) problems.push(`${sum}: tens part says ${sc.inside?.tens}`);
          if (sc.fill?.ones && inside !== area) problems.push(`${sum}: box says ${inside}, holds ${area}`);
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('adding and taking away keeps the right amount of blocks', () => {
    for (const q of quizzes) {
      if (q.fact.op !== '+' && q.fact.op !== '-') continue;
      for (const s of explain(q, 'blocks')) {
        if (s.scene.type !== 'blocks') continue;
        const g = s.scene.parts.filter((p): p is Group => p !== '+');
        expect(g.every((x) => x.cubes.length <= 19 && x.rods.length <= 19)).toBe(true);
        // The middle steps of a sum show the same total throughout (before anything is taken away).
        if (!s.scene.parts.includes('+') && !g.some((x) => [...(x.flats ?? []), ...x.rods, ...x.cubes].some((p) => p.state === 'gone'))) {
          // A missing-number question is turned around first, so any of its three numbers can show up.
          const ok = q.kind === 'missing' ? [q.fact.a, q.fact.b, q.fact.c] : [q.fact.a, q.fact.c];
          expect(ok).toContain(value(s.scene));
        }
      }
    }
  });
});
