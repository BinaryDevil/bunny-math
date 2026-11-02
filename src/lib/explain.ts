import { compareSign, opSymbol } from './generator';
import type { Fact, Question } from './types';

/**
 * Builds the "Show me how" steps for a question, using base-ten blocks:
 * a rod is 10, a cube is 1. Each step is one picture and one short line.
 *
 * Captions use *stars* around the words to highlight.
 */

export type Color = 'a' | 'b' | 'new';
export type Piece = { color: Color; state?: 'gone' | 'mark' };
export type Group = { rods: Piece[]; cubes: Piece[] };
export type Scene =
  | { type: 'blocks'; parts: (Group | '+')[]; result?: number }
  | { type: 'text'; lines: string[] };
export type Step = { scene: Scene; caption: string };

const tens = (n: number) => Math.floor(n / 10);
const ones = (n: number) => n % 10;
const many = (n: number, piece: Piece): Piece[] => Array.from({ length: n }, () => ({ ...piece }));
const group = (n: number, color: Color): Group => ({ rods: many(tens(n), { color }), cubes: many(ones(n), { color }) });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const tensAndOnes = (n: number) =>
  tens(n) === 0 ? plural(ones(n), 'one') : ones(n) === 0 ? plural(tens(n), 'ten') : `${plural(tens(n), 'ten')} and ${plural(ones(n), 'one')}`;

function addSteps({ a, b, c }: Fact): Step[] {
  const steps: Step[] = [
    { scene: { type: 'blocks', parts: [group(a, 'a'), '+', group(b, 'b')] }, caption: `Make *${a}* and *${b}* with blocks.` },
  ];
  const rods = [...many(tens(a), { color: 'a' }), ...many(tens(b), { color: 'b' })];
  const cubes = [...many(ones(a), { color: 'a' }), ...many(ones(b), { color: 'b' })];
  const onesSum = ones(a) + ones(b);

  steps.push({
    scene: { type: 'blocks', parts: [{ rods, cubes }] },
    caption: tens(a) + tens(b) === 0 ? `Put them together: *${onesSum}* ones.` : `Put the ones together: *${ones(a)} + ${ones(b)} = ${onesSum}*`,
  });

  if (onesSum >= 10) {
    steps.push({
      scene: { type: 'blocks', parts: [{ rods, cubes: cubes.map((p, i) => (i < 10 ? { ...p, state: 'mark' } : p)) }] },
      caption: `Circle *10 ones*…`,
    });
    steps.push({
      scene: { type: 'blocks', parts: [{ rods: [...rods, { color: 'new' }], cubes: cubes.slice(10) }] },
      caption: `…they turn into *1 ten*!`,
    });
  }
  if (tens(b) > 0) {
    const carried = onesSum >= 10 ? ' + 1' : '';
    steps.push({
      scene: { type: 'blocks', parts: [{ rods: [...rods, ...(carried ? [{ color: 'new' as const }] : [])], cubes: cubes.slice(onesSum >= 10 ? 10 : 0) }] },
      caption: `Now the tens: *${tens(a)} + ${tens(b)}${carried} = ${tens(c)}*`,
    });
  }
  steps.push({
    scene: { type: 'blocks', parts: [group(c, 'a')], result: c },
    caption: c >= 10 ? `${tensAndOnes(c)} = *${c}*` : `Count them: *${c}*!`,
  });
  return steps;
}

function subSteps({ a, b, c }: Fact): Step[] {
  const steps: Step[] = [{ scene: { type: 'blocks', parts: [group(a, 'a')] }, caption: `Start with *${a}*.` }];
  let rods = many(tens(a), { color: 'a' });
  let cubes = many(ones(a), { color: 'a' });

  if (ones(a) < ones(b)) {
    steps.push({
      scene: { type: 'blocks', parts: [{ rods: rods.map((p, i) => (i === rods.length - 1 ? { ...p, state: 'mark' } : p)), cubes }] },
      caption: `Take away ${ones(b)} ones? There are only *${ones(a)}*!`,
    });
    rods = rods.slice(1);
    cubes = [...cubes, ...many(10, { color: 'new' })];
    steps.push({ scene: { type: 'blocks', parts: [{ rods, cubes }] }, caption: `Break *1 ten* into *10 ones*!` });
  }
  if (ones(b) > 0) {
    cubes = cubes.map((p, i) => (i >= cubes.length - ones(b) ? { ...p, state: 'gone' } : p));
    steps.push({ scene: { type: 'blocks', parts: [{ rods, cubes }] }, caption: `Take away *${plural(ones(b), 'one')}*.` });
  }
  if (tens(b) > 0) {
    rods = rods.map((p, i) => (i >= rods.length - tens(b) ? { ...p, state: 'gone' } : p));
    steps.push({ scene: { type: 'blocks', parts: [{ rods, cubes }] }, caption: `Take away *${plural(tens(b), 'ten')}*.` });
  }
  steps.push({
    scene: { type: 'blocks', parts: [group(c, 'a')], result: c },
    caption: c >= 10 ? `${tensAndOnes(c)} left. That's *${c}*!` : `*${c}* left!`,
  });
  return steps;
}

export function factSteps(f: Fact): Step[] {
  return f.op === '+' ? addSteps(f) : subSteps(f);
}

/** Missing number: turn the sum around so it becomes a normal sum. */
function inverse(q: Extract<Question, { kind: 'missing' }>): Fact {
  const { a, op, b, c } = q.fact;
  if (op === '+') return q.hide === 'b' ? { a: c, op: '-', b: a, c: b } : { a: c, op: '-', b, c: a };
  return q.hide === 'b' ? { a, op: '-', b: c, c: b } : { a: c, op: '+', b, c: a };
}

export function questionText(q: Question): string {
  const { a, op, b, c } = q.fact;
  const s = opSymbol(op);
  if (q.kind === 'missing') return q.hide === 'a' ? `? ${s} ${b} = ${c}` : `${a} ${s} ? = ${c}`;
  return `${a} ${s} ${b}`;
}

export function explain(q: Question): Step[] {
  if (q.kind === 'missing') {
    const f = inverse(q);
    const steps = factSteps(f);
    const last = steps[steps.length - 1];
    return [
      {
        scene: { type: 'text', lines: [questionText(q), `${f.a} ${opSymbol(f.op)} ${f.b} = ?`] },
        caption: `Missing number? *Turn it around!*`,
      },
      ...steps.slice(0, -1),
      { ...last, caption: `The missing number is *${f.c}*!` },
    ];
  }
  const steps = factSteps(q.fact);
  if (q.kind === 'compare') {
    const sign = compareSign(q.fact.c, q.than);
    const words = { '<': 'smaller than', '>': 'bigger than', '=': 'the same as' }[sign];
    steps.push({
      scene: { type: 'text', lines: [`${q.fact.c} ${sign} ${q.than}`] },
      caption: `*${q.fact.c}* is ${words} *${q.than}*.`,
    });
  }
  return steps;
}
