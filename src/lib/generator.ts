import { makeRng, type Rng } from './rng';
import type { Answer, CompareSign, Fact, Kind, LevelId, Mode, Op, Question, Skill, Story } from './types';

export type Level = { id: LevelId; mode: Mode; name: string; example: string; blurb: string };

export const MODES: Record<Mode, { name: string; signs: string; blurb: string }> = {
  plus: { name: 'Add & take away', signs: '+ −', blurb: 'Adding and taking away, up to 3 digits' },
  all: { name: 'All four', signs: '+ − × ÷', blurb: 'Times tables and dividing too' },
};

export const LEVELS: readonly Level[] = [
  { id: 1, mode: 'plus', name: 'Warm-up', example: '7 + 8', blurb: 'Within 20' },
  { id: 2, mode: 'plus', name: 'Big + small', example: '34 + 5', blurb: 'No carrying' },
  { id: 3, mode: 'plus', name: 'Tricky ones', example: '38 + 7', blurb: 'Carry and borrow' },
  { id: 4, mode: 'plus', name: 'Double digits', example: '46 + 37', blurb: 'Two-digit numbers' },
  { id: 5, mode: 'plus', name: 'Hundreds', example: '325 + 148', blurb: 'Three-digit numbers' },
  { id: 6, mode: 'plus', name: 'Super sums', example: '503 − 167', blurb: 'Lots of carrying' },
  { id: 11, mode: 'all', name: 'First tables', example: '5 × 3', blurb: 'Tables of 2, 5 and 10' },
  { id: 12, mode: 'all', name: 'More tables', example: '4 × 6', blurb: 'Tables up to 5' },
  { id: 13, mode: 'all', name: 'All tables', example: '7 × 8', blurb: 'Tables up to 10' },
  { id: 14, mode: 'all', name: 'Big times', example: '23 × 4', blurb: 'Two-digit times and divide' },
];

export const levelOf = (id: LevelId) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
export const levelsFor = (mode: Mode) => LEVELS.filter((l) => l.mode === mode);
export function nextLevel(id: LevelId): LevelId | null {
  const list = levelsFor(levelOf(id).mode);
  const i = list.findIndex((l) => l.id === id);
  return list[i + 1]?.id ?? null;
}

/** In "all four", two thirds of the questions are times or divide. */
const OPS: Record<Mode, Op[]> = { plus: ['+', '-'], all: ['×', '÷', '+', '×', '÷', '-'] };
export const opsFor = (level: LevelId) => OPS[levelOf(level).mode];

export const SKILL_LABELS: Record<Skill, { icon: string; label: string }> = {
  add20: { icon: '➕', label: 'Adding to 20' },
  sub20: { icon: '➖', label: 'Taking away to 20' },
  add: { icon: '➕', label: 'Adding' },
  sub: { icon: '➖', label: 'Taking away' },
  carry: { icon: '🧱', label: 'Carrying a ten' },
  borrow: { icon: '🔨', label: 'Breaking a ten' },
  times: { icon: '✖️', label: 'Times' },
  divide: { icon: '➗', label: 'Dividing' },
};

/** The digit in a place: 0 = ones, 1 = tens, 2 = hundreds. */
export const digit = (n: number, place: number) => Math.floor(n / 10 ** place) % 10;
const ones = (n: number) => n % 10;
const add = (a: number, b: number): Fact => ({ a, op: '+', b, c: a + b });
const sub = (a: number, b: number): Fact => ({ a, op: '-', b, c: a - b });
const mul = (a: number, b: number): Fact => ({ a, op: '×', b, c: a * b });
const div = (a: number, b: number): Fact => ({ a, op: '÷', b, c: a / b });

/** How many columns need carrying (adding) or borrowing (taking away). */
export function regroupCount({ a, op, b }: Fact): number {
  let n = 0;
  let extra = 0;
  for (let p = 0; p < 3; p++) {
    if (op === '+') extra = digit(a, p) + digit(b, p) + extra >= 10 ? 1 : 0;
    else if (op === '-') extra = digit(a, p) - extra < digit(b, p) ? 1 : 0;
    else return 0;
    n += extra;
  }
  return n;
}

export const regroups = (f: Fact) => regroupCount(f) > 0;

export function skillOf(f: Fact, level: LevelId): Skill {
  if (f.op === '×') return 'times';
  if (f.op === '÷') return 'divide';
  if (level === 1 || level === 11) return f.op === '+' ? 'add20' : 'sub20';
  if (regroups(f)) return f.op === '+' ? 'carry' : 'borrow';
  return f.op === '+' ? 'add' : 'sub';
}

/* ---------- One sum per level ---------- */

type PM = '+' | '-';

function level1(r: Rng, op: PM): Fact {
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

function level2(r: Rng, op: PM): Fact {
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

function level3(r: Rng, op: PM): Fact {
  if (op === '+') {
    const a = 10 * r.int(1, 8) + r.int(2, 9);
    return add(a, r.int(Math.max(2, 10 - ones(a)), Math.min(9, 99 - a)));
  }
  const a = 10 * r.int(2, 9) + r.int(0, 7);
  return sub(a, r.int(Math.max(2, ones(a) + 1), 9));
}

function level4(r: Rng, op: PM): Fact {
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

/** 3-digit numbers with at most one carry or borrow. */
function level5(r: Rng, op: PM): Fact {
  const want = r.chance(0.65) ? 1 : 0;
  for (let i = 0; i < 200; i++) {
    let f: Fact;
    if (op === '+') {
      const a = r.int(101, 799);
      f = add(a, r.chance(0.3) ? r.int(11, 99) : r.int(101, 999 - a));
    } else {
      const a = r.int(201, 999);
      f = sub(a, r.chance(0.3) ? r.int(11, 99) : r.int(101, a - 100));
    }
    if (regroupCount(f) === want) return f;
  }
  return op === '+' ? add(325, 148) : sub(462, 135);
}

/** 3-digit numbers that carry or borrow twice, including borrowing across a zero (503 − 167). */
function level6(r: Rng, op: PM): Fact {
  for (let i = 0; i < 200; i++) {
    if (op === '-' && r.chance(0.35)) {
      const o = r.int(0, 7);
      const a = 100 * r.int(2, 9) + o;
      const b = 100 * r.int(1, Math.floor(a / 100) - 1) + 10 * r.int(1, 9) + r.int(o + 1, 9);
      return sub(a, b);
    }
    const a = r.int(op === '+' ? 101 : 301, op === '+' ? 799 : 999);
    const f = op === '+' ? add(a, r.int(101, 999 - a)) : sub(a, r.int(101, a - 100));
    if (regroupCount(f) >= 2) return f;
  }
  return op === '+' ? add(368, 275) : sub(503, 167);
}

/** A times-table fact, or the divide fact that goes with it (12 ÷ 3 = 4). */
function tableFact(r: Rng, op: '×' | '÷', tables: number[]): Fact {
  let t = r.pick(tables);
  let n = r.int(2, 10);
  if (t === 10 && n === 10) n = r.int(2, 9);
  if (op === '÷') return div(t * n, t);
  if (r.chance(0.5)) [t, n] = [n, t];
  return mul(t, n);
}

/** Two-digit times one-digit (23 × 4), and two-digit divided by one-digit (72 ÷ 4). */
function bigTimes(r: Rng, op: '×' | '÷'): Fact {
  if (op === '×') {
    const f = mul(r.int(12, 49), r.int(2, 6));
    return r.chance(0.2) ? mul(f.b, f.a) : f;
  }
  const d = r.int(2, 6);
  return div(d * r.int(11, Math.floor(99 / d)), d);
}

type Gen = (r: Rng, op: Op) => Fact;
const mixed =
  (pm: (r: Rng, op: PM) => Fact, md: (r: Rng, op: '×' | '÷') => Fact): Gen =>
  (r, op) =>
    op === '+' || op === '-' ? pm(r, op) : md(r, op);
const plusOnly =
  (pm: (r: Rng, op: PM) => Fact): Gen =>
  (r, op) =>
    pm(r, op === '-' || op === '÷' ? '-' : '+');

const BY_LEVEL: Record<LevelId, Gen> = {
  1: plusOnly(level1),
  2: plusOnly(level2),
  3: plusOnly(level3),
  4: plusOnly(level4),
  5: plusOnly(level5),
  6: plusOnly(level6),
  11: mixed(level1, (r, op) => tableFact(r, op, [2, 5, 10])),
  12: mixed(level3, (r, op) => tableFact(r, op, [2, 3, 4, 5, 10])),
  13: mixed(level4, (r, op) => tableFact(r, op, [2, 3, 4, 5, 6, 7, 8, 9, 10])),
  14: mixed(level5, bigTimes),
};

export function makeFact(r: Rng, level: LevelId, op: Op = r.pick(opsFor(level))): Fact {
  return BY_LEVEL[level](r, op);
}

/* ---------- Question formats ---------- */

type StoryFn = (a: number, b: number) => Story;
const STORIES: Record<Op, StoryFn[]> = {
  '+': [
    (a, b) => ({ emoji: '🐠', text: `${a} fish in the tank. ${b} more swim in.`, ask: 'How many now?' }),
    (a, b) => ({ emoji: '🌸', text: `${a} flowers in the garden. ${b} more grow.`, ask: 'How many now?' }),
    (a, b) => ({ emoji: '🍪', text: `${a} cookies in the jar. You bake ${b} more.`, ask: 'How many now?' }),
    (a, b) => ({ emoji: '⭐', text: `You have ${a} stickers. You get ${b} more.`, ask: 'How many now?' }),
    (a, b) => ({ emoji: '🐞', text: `${a} ladybugs on a leaf. ${b} more land.`, ask: 'How many now?' }),
  ],
  '-': [
    (a, b) => ({ emoji: '🍓', text: `${a} strawberries in a bowl. You eat ${b}.`, ask: 'How many are left?' }),
    (a, b) => ({ emoji: '🎈', text: `${a} balloons at the party. ${b} go pop!`, ask: 'How many are left?' }),
    (a, b) => ({ emoji: '🐦', text: `${a} birds in a tree. ${b} fly away.`, ask: 'How many are left?' }),
    (a, b) => ({ emoji: '🧁', text: `${a} cupcakes on a plate. Friends eat ${b}.`, ask: 'How many are left?' }),
    (a, b) => ({ emoji: '🦋', text: `${a} butterflies in the garden. ${b} fly off.`, ask: 'How many are left?' }),
  ],
  '×': [
    (a, b) => ({ emoji: '🍪', text: `${a} plates with ${b} cookies on each.`, ask: 'How many cookies?' }),
    (a, b) => ({ emoji: '🌷', text: `${a} pots with ${b} flowers in each.`, ask: 'How many flowers?' }),
    (a, b) => ({ emoji: '🐰', text: `${a} bunnies each eat ${b} carrots.`, ask: 'How many carrots?' }),
    (a, b) => ({ emoji: '🎁', text: `${a} bags with ${b} sweets in each.`, ask: 'How many sweets?' }),
  ],
  '÷': [
    (a, b) => ({ emoji: '🍓', text: `${a} strawberries shared by ${b} friends.`, ask: 'How many each?' }),
    (a, b) => ({ emoji: '🧁', text: `${a} cupcakes go in boxes of ${b}.`, ask: 'How many boxes?' }),
    (a, b) => ({ emoji: '🐟', text: `${a} fish, with ${b} in each tank.`, ask: 'How many tanks?' }),
    (a, b) => ({ emoji: '🌸', text: `${a} flowers in ${b} equal bunches.`, ask: 'How many in each?' }),
  ],
};

function makeStory(r: Rng, f: Fact): Story {
  return r.pick(STORIES[f.op])(f.a, f.b);
}

/** Taking the smaller digit from the bigger one in every column, a very common slip. */
function smallerFromBigger(a: number, b: number) {
  let n = 0;
  for (let p = 0; p < 3; p++) n += Math.abs(digit(a, p) - digit(b, p)) * 10 ** p;
  return n;
}

/** Wrong options built from common slips, so a guess is not obvious. */
export function makeChoices(r: Rng, f: Fact): number[] {
  const { a, b, c, op } = f;
  const slips: number[] = [];
  if (op === '+') {
    if (regroups(f)) slips.push(c - 10); // forgot to carry
    if (b < 10 && a >= 10) slips.push(a + 10 * b); // added to the tens instead of the ones
    slips.push(c + 10);
    if (c >= 100) slips.push(c - 100);
  } else if (op === '-') {
    if (regroups(f)) slips.push(smallerFromBigger(a, b));
    slips.push(c + 10, c - 10, a + b);
  } else if (op === '×') {
    slips.push(c + b, c - b, c + a, a + b); // one group too many or too few, or added
  } else {
    slips.push(c + 1, c - 1, b, c + 2);
  }
  slips.push(c + 1, c - 1, c + 2, c - 2);
  const out = new Set<number>([c]);
  for (const n of slips) {
    if (out.size >= 4) break;
    if (n > 0 && n <= 999 && n !== c) out.add(n);
  }
  while (out.size < 4) {
    const n = c + r.int(3, 9) * (r.chance(0.5) ? 1 : -1);
    if (n > 0) out.add(n);
  }
  return r.shuffle([...out]);
}

function makeCompareTarget(r: Rng, c: number): number {
  const deltas = c >= 100 ? [-100, -10, -1, 0, 0, 1, 10, 100] : c >= 20 ? [-10, -2, -1, 0, 0, 1, 2, 10] : [-3, -2, -1, 0, 0, 1, 2, 3];
  const than = c + r.pick(deltas);
  return than > 0 && than <= 999 ? than : c + 1;
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
  // Spread the operations evenly, in a shuffled order.
  const pattern = opsFor(level);
  const ops = r.shuffle(Array.from({ length: count }, (_, i) => pattern[i % pattern.length]));

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

/** How a sign is printed: a proper minus sign instead of a hyphen. */
export const opSymbol = (op: Op) => (op === '-' ? '−' : op);
