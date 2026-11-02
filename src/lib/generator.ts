import { makeRng, type Rng } from './rng';
import type { Answer, CompareSign, Fact, Kind, LevelId, Question, Skill, Story } from './types';

export type Level = { id: LevelId; name: string; example: string; blurb: string };

export const LEVELS: readonly Level[] = [
  { id: 1, name: 'Warm-up', example: '7 + 8', blurb: 'Within 20' },
  { id: 2, name: 'Big + small', example: '34 + 5', blurb: 'No carrying' },
  { id: 3, name: 'Tricky ones', example: '38 + 7', blurb: 'Carry and borrow' },
  { id: 4, name: 'Double digits', example: '46 + 37', blurb: 'Two-digit numbers' },
];

export const SKILL_LABELS: Record<Skill, { icon: string; label: string }> = {
  add20: { icon: '➕', label: 'Adding to 20' },
  sub20: { icon: '➖', label: 'Taking away to 20' },
  add: { icon: '➕', label: 'Adding' },
  sub: { icon: '➖', label: 'Taking away' },
  carry: { icon: '🧱', label: 'Carrying a ten' },
  borrow: { icon: '🔨', label: 'Breaking a ten' },
};

const ones = (n: number) => n % 10;
const add = (a: number, b: number): Fact => ({ a, op: '+', b, c: a + b });
const sub = (a: number, b: number): Fact => ({ a, op: '-', b, c: a - b });

/** Does this sum need carrying (adding) or borrowing (taking away) in the ones column? */
export function regroups(f: Fact): boolean {
  return f.op === '+' ? ones(f.a) + ones(f.b) >= 10 : ones(f.a) < ones(f.b);
}

export function skillOf(f: Fact, level: LevelId): Skill {
  if (level === 1) return f.op === '+' ? 'add20' : 'sub20';
  if (regroups(f)) return f.op === '+' ? 'carry' : 'borrow';
  return f.op === '+' ? 'add' : 'sub';
}

/* ---------- One sum per level ---------- */

function level1(r: Rng, op: '+' | '-'): Fact {
  const style = r.pick(['cross', 'cross', 'small', 'teen'] as const);
  if (op === '+') {
    if (style === 'cross') {
      const a = r.int(3, 9);
      return add(a, r.int(11 - a, 9));
    }
    if (style === 'small') {
      const a = r.int(2, 7);
      return add(a, r.int(2, 10 - a));
    }
    const a = r.int(11, 16);
    return add(a, r.int(2, 9 - ones(a)));
  }
  if (style === 'cross') {
    const a = r.int(11, 17);
    return sub(a, r.int(ones(a) + 1, 9));
  }
  if (style === 'small') {
    const a = r.int(5, 10);
    return sub(a, r.int(2, a - 1));
  }
  const a = r.int(13, 19);
  return sub(a, r.int(2, ones(a)));
}

function level2(r: Rng, op: '+' | '-'): Fact {
  const tens = r.chance(0.25);
  if (op === '+') {
    if (tens) {
      const a = r.int(12, 68);
      return add(a, 10 * r.int(1, Math.floor((99 - a) / 10)));
    }
    let a = r.int(11, 87);
    if (ones(a) > 7) a -= 3;
    return add(a, r.int(2, Math.max(2, 9 - ones(a))));
  }
  if (tens) {
    const a = r.int(31, 99);
    return sub(a, 10 * r.int(1, Math.floor(a / 10) - 1));
  }
  let a = r.int(22, 99);
  if (ones(a) < 2) a += 3;
  return sub(a, r.int(2, ones(a)));
}

function level3(r: Rng, op: '+' | '-'): Fact {
  if (op === '+') {
    const a = 10 * r.int(1, 8) + r.int(2, 9);
    return add(a, r.int(Math.max(2, 10 - ones(a)), Math.min(9, 99 - a)));
  }
  const a = 10 * r.int(2, 9) + r.int(0, 7);
  return sub(a, r.int(Math.max(2, ones(a) + 1), 9));
}

function level4(r: Rng, op: '+' | '-'): Fact {
  const wantRegroup = r.chance(0.6);
  for (let i = 0; i < 100; i++) {
    let f: Fact;
    if (op === '+') {
      const a = r.int(12, 78);
      const b = r.int(11, 99 - a);
      f = add(a, b);
    } else {
      const a = r.int(31, 99);
      const b = r.int(11, a - 10);
      f = sub(a, b);
    }
    if (f.b >= 11 && regroups(f) === wantRegroup && ones(f.a) !== 0 && ones(f.b) !== 0) return f;
  }
  return op === '+' ? add(46, 37) : sub(81, 29);
}

const BY_LEVEL = { 1: level1, 2: level2, 3: level3, 4: level4 } as const;

export function makeFact(r: Rng, level: LevelId, op: '+' | '-' = r.chance(0.5) ? '+' : '-'): Fact {
  return BY_LEVEL[level](r, op);
}

/* ---------- Question formats ---------- */

const ADD_STORIES = [
  (a: number, b: number) => ({ emoji: '🐠', text: `${a} fish in the tank. ${b} more swim in.` }),
  (a: number, b: number) => ({ emoji: '🌸', text: `${a} flowers in the garden. ${b} more grow.` }),
  (a: number, b: number) => ({ emoji: '🍪', text: `${a} cookies in the jar. You bake ${b} more.` }),
  (a: number, b: number) => ({ emoji: '⭐', text: `You have ${a} stickers. You get ${b} more.` }),
  (a: number, b: number) => ({ emoji: '🐞', text: `${a} ladybugs on a leaf. ${b} more land.` }),
];
const SUB_STORIES = [
  (a: number, b: number) => ({ emoji: '🍓', text: `${a} strawberries in a bowl. You eat ${b}.` }),
  (a: number, b: number) => ({ emoji: '🎈', text: `${a} balloons at the party. ${b} go pop!` }),
  (a: number, b: number) => ({ emoji: '🐦', text: `${a} birds in a tree. ${b} fly away.` }),
  (a: number, b: number) => ({ emoji: '🧁', text: `${a} cupcakes on a plate. Friends eat ${b}.` }),
  (a: number, b: number) => ({ emoji: '🦋', text: `${a} butterflies in the garden. ${b} fly off.` }),
];

function makeStory(r: Rng, f: Fact): Story {
  return r.pick(f.op === '+' ? ADD_STORIES : SUB_STORIES)(f.a, f.b);
}

/** Wrong options built from common slips, so a guess is not obvious. */
export function makeChoices(r: Rng, f: Fact): number[] {
  const { a, b, c, op } = f;
  const slips: number[] = [];
  if (op === '+') {
    if (regroups(f)) slips.push(c - 10); // forgot to carry
    if (b < 10 && a >= 10) slips.push(a + 10 * b); // added to the tens instead of the ones
    slips.push(c + 10);
  } else {
    // took the smaller ones digit from the bigger one
    const swapped = (Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs(ones(a) - ones(b));
    if (regroups(f)) slips.push(swapped);
    slips.push(c + 10, c - 10, a + b);
  }
  slips.push(c + 1, c - 1, c + 2, c - 2);
  const out = new Set<number>([c]);
  for (const n of slips) {
    if (out.size >= 4) break;
    if (n > 0 && n <= 120 && n !== c) out.add(n);
  }
  while (out.size < 4) out.add(c + r.int(3, 9) * (r.chance(0.5) ? 1 : -1) || c + 11);
  return r.shuffle([...out].filter((n) => n > 0).slice(0, 4));
}

function makeCompareTarget(r: Rng, c: number): number {
  const deltas = c >= 20 ? [-10, -2, -1, 0, 0, 1, 2, 10] : [-3, -2, -1, 0, 0, 1, 2, 3];
  const than = c + r.pick(deltas);
  return than > 0 ? than : c + 1;
}

const KIND_WEIGHTS: [Kind, number][] = [
  ['type', 40],
  ['choice', 20],
  ['missing', 15],
  ['story', 15],
  ['compare', 10],
];

function pickKind(r: Rng): Kind {
  let roll = r.next() * 100;
  for (const [k, w] of KIND_WEIGHTS) {
    if ((roll -= w) < 0) return k;
  }
  return 'type';
}

export function makeQuestion(r: Rng, id: string, fact: Fact, skill: Skill, kind: Kind): Question {
  const base = { id, fact, skill };
  switch (kind) {
    case 'type':
      return { ...base, kind };
    case 'story':
      return { ...base, kind, story: makeStory(r, fact) };
    case 'choice':
      return { ...base, kind, choices: makeChoices(r, fact) };
    case 'missing':
      return { ...base, kind, hide: r.chance(0.7) ? 'b' : 'a' };
    case 'compare':
      return { ...base, kind, than: makeCompareTarget(r, fact.c) };
  }
}

export type QuizOptions = {
  level: LevelId;
  count: number;
  seed: number;
  /** Only make questions that practice these skills (for "Practice my mistakes"). */
  skills?: Skill[];
  /** Only these formats, e.g. for a printed worksheet. */
  kinds?: Kind[];
};

export function generateQuiz({ level, count, seed, skills, kinds }: QuizOptions): Question[] {
  const r = makeRng(seed);
  const seen = new Set<string>();
  const out: Question[] = [];
  // Alternate + and − so both get practice, in a shuffled order.
  const ops = r.shuffle(Array.from({ length: count }, (_, i) => (i % 2 ? '-' : '+') as '+' | '-'));

  for (let i = 0; i < count; i++) {
    let fact = makeFact(r, level, ops[i]);
    for (let tries = 0; tries < 200; tries++) {
      const key = `${fact.a}${fact.op}${fact.b}`;
      const skillOk = !skills?.length || skills.includes(skillOf(fact, level));
      if (!seen.has(key) && skillOk) break;
      fact = makeFact(r, level, skills?.length ? undefined : ops[i]);
    }
    seen.add(`${fact.a}${fact.op}${fact.b}`);
    // Ease in: the first two questions are always plain sums.
    let kind = i < 2 ? 'type' : pickKind(r);
    if (kinds && !kinds.includes(kind)) kind = r.pick(kinds);
    out.push(makeQuestion(r, `q${i + 1}`, fact, skillOf(fact, level), kind));
  }
  return out;
}

/* ---------- Answers ---------- */

export function compareSign(x: number, y: number): CompareSign {
  return x < y ? '<' : x > y ? '>' : '=';
}

export function correctAnswer(q: Question): Answer {
  switch (q.kind) {
    case 'missing':
      return q.hide === 'a' ? q.fact.a : q.fact.b;
    case 'compare':
      return compareSign(q.fact.c, q.than);
    default:
      return q.fact.c;
  }
}

export const opSymbol = (op: '+' | '-') => (op === '+' ? '+' : '−');
