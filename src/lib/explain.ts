import { list, t, tn } from '../i18n';
import { compareSign, digit, opSymbol } from './generator';
import type { ExplainStyle } from './storage';
import type { Fact, Question } from './types';

/**
 * Builds the "Show me how" steps for a question. Each step is one picture and one short line.
 * Two styles:
 * - blocks ("Pictures"): base-ten blocks for + and − (a square is 100, a rod is 10, a cube is 1),
 *   bunny hops on a number line for times tables, and a split box (the area model) for bigger × and ÷
 * - column: the written column method (竖式), one column at a time
 *
 * Captions use *stars* around the words to highlight. They are written in the current
 * language (see src/i18n), so build the steps again after the language changes.
 */

export type Color = 'a' | 'b' | 'new';
export type Piece = { color: Color; state?: 'gone' | 'mark' };
export type Group = { flats?: Piece[]; rods: Piece[]; cubes: Piece[] };

/** One written digit in the column method. */
export type Cell = { t: string; tone?: 'a' | 'b' | 'new' | 'carry'; dot?: boolean };
export type ColRow = {
  /** The sign or divisor written to the left. */
  label?: string;
  cells: (Cell | null)[];
  /** Draw the line above this row. */
  rule?: boolean;
  /** Small carried digits. */
  carry?: boolean;
  /** The number being divided, under the division bracket. */
  bracket?: boolean;
};

export type Scene =
  | { type: 'blocks'; parts: (Group | '+')[]; result?: number }
  | { type: 'text'; lines: string[] }
  /**
   * Bunny hops along a number line from 0 to `max`: `hops` jumps of `step`. For ÷, `goal` rings the
   * end and `count` numbers the hops (1, 2, 3) instead of writing "+step" on them.
   */
  | { type: 'hops'; step: number; max: number; hops: number; goal?: boolean; count?: boolean; result?: number }
  /**
   * A box `rows` tall and `tens + ones` wide (the area model). `fill` colours in the parts, `split`
   * draws the line between them and `inside` writes a number in each. `ask`: the width isn't known
   * yet (÷), so the box is dashed and its top says "?". `width` writes the whole width on top (÷ answer).
   */
  | {
      type: 'box';
      rows: number;
      tens: number;
      ones: number;
      fill?: { tens?: boolean; ones?: boolean };
      split?: boolean;
      inside?: { tens?: number; ones?: number };
      ask?: boolean;
      width?: boolean;
      result?: number;
    }
  /** `focus` is the column (from the left) being worked on. */
  | { type: 'column'; width: number; rows: ColRow[]; focus?: number; division?: boolean; result?: number };
export type Step = { scene: Scene; caption: string };

const place = (p: number) => t(p === 0 ? 'place.0' : p === 1 ? 'place.1' : 'place.2');
const H = (n: number) => digit(n, 2);
const T = (n: number) => digit(n, 1);
const O = (n: number) => digit(n, 0);
const len = (n: number) => String(n).length;
const many = (n: number, piece: Piece): Piece[] => Array.from({ length: n }, () => ({ ...piece }));
const group = (n: number, color: Color): Group => ({
  flats: many(Math.floor(n / 100), { color }),
  rods: many(T(n), { color }),
  cubes: many(O(n), { color }),
});
/** "3 tens", "1 hundred", in the current language. */
const unit = (u: 'one' | 'ten' | 'hundred', n: number) => tn(`unit.${u}`, n);
const sym = (op: Fact['op']) => opSymbol(op);

/** "3 hundreds, 4 tens and 5 ones" (leaving out the zeros). */
function placeWords(n: number) {
  const parts: [number, 'hundred' | 'ten' | 'one'][] = [
    [Math.floor(n / 100), 'hundred'],
    [T(n), 'ten'],
    [O(n), 'one'],
  ];
  return list(parts.filter(([k]) => k).map(([k, u]) => unit(u, k)));
}

const marked = (pieces: Piece[], from: number, to: number) => pieces.map((p, i) => (i >= from && i < to ? { ...p, state: 'mark' as const } : p));
const gone = (pieces: Piece[], n: number) => pieces.map((p, i) => (i >= pieces.length - n ? { ...p, state: 'gone' as const } : p));

/* ---------- Blocks ---------- */

function addBlocks({ a, b, c }: Fact): Step[] {
  const steps: Step[] = [
    { scene: { type: 'blocks', parts: [group(a, 'a'), '+', group(b, 'b')] }, caption: t('ex.make', { a, b }) },
  ];
  let flats = [...many(H(a), { color: 'a' }), ...many(H(b), { color: 'b' })];
  let rods = [...many(T(a), { color: 'a' }), ...many(T(b), { color: 'b' })];
  let cubes = [...many(O(a), { color: 'a' }), ...many(O(b), { color: 'b' })];
  const show = (g: Group): Scene => ({ type: 'blocks', parts: [g] });
  const onesSum = O(a) + O(b);

  steps.push({
    scene: show({ flats, rods, cubes }),
    caption: a < 10 && b < 10 ? tn('ex.together', onesSum) : t('ex.togetherOnes', { sum: `${O(a)} + ${O(b)} = ${onesSum}` }),
  });
  if (onesSum >= 10) {
    steps.push({ scene: show({ flats, rods, cubes: marked(cubes, 0, 10) }), caption: t('ex.circleOnes') });
    rods = [...rods, { color: 'new' }];
    cubes = cubes.slice(10);
    steps.push({ scene: show({ flats, rods, cubes }), caption: t('ex.makeTen') });
  }

  const carried = onesSum >= 10 ? 1 : 0;
  const tensSum = T(a) + T(b) + carried;
  if (T(b) > 0 || tensSum >= 10) {
    const terms = [T(a), ...(T(b) ? [T(b)] : []), ...(carried ? [1] : [])];
    steps.push({ scene: show({ flats, rods, cubes }), caption: t('ex.nowTens', { sum: `${terms.join(' + ')} = ${tensSum}` }) });
  }
  if (tensSum >= 10) {
    steps.push({ scene: show({ flats, rods: marked(rods, 0, 10), cubes }), caption: t('ex.circleTens') });
    flats = [...flats, { color: 'new' }];
    rods = rods.slice(10);
    steps.push({ scene: show({ flats, rods, cubes }), caption: t('ex.makeHundred') });
  }
  if (H(b) > 0) {
    const terms = [H(a), H(b), ...(tensSum >= 10 ? [1] : [])];
    steps.push({ scene: show({ flats, rods, cubes }), caption: t('ex.nowHundreds', { sum: `${terms.join(' + ')} = ${H(c)}` }) });
  }
  steps.push({
    scene: { type: 'blocks', parts: [group(c, 'a')], result: c },
    caption: c >= 10 ? t('ex.addEnd', { parts: placeWords(c), c }) : t('ex.count', { c }),
  });
  return steps;
}

function subBlocks({ a, b, c }: Fact): Step[] {
  const steps: Step[] = [{ scene: { type: 'blocks', parts: [group(a, 'a')] }, caption: t('ex.start', { a }) }];
  let flats = many(H(a), { color: 'a' });
  let rods = many(T(a), { color: 'a' });
  let cubes = many(O(a), { color: 'a' });
  const push = (caption: string, g: Group = { flats, rods, cubes }) => steps.push({ scene: { type: 'blocks', parts: [g] }, caption });

  if (O(a) < O(b)) {
    if (rods.length === 0) {
      push(t('ex.onlyOnesNoTens', { ones: unit('one', O(b)), n: O(a) }), { flats: marked(flats, flats.length - 1, flats.length), rods, cubes });
      flats = flats.slice(1);
      rods = many(10, { color: 'new' });
      push(t('ex.breakHundred'));
      push(t('ex.takeTen'), { flats, rods: marked(rods, rods.length - 1, rods.length), cubes });
    } else {
      push(t('ex.onlyOnes', { ones: unit('one', O(b)), n: O(a) }), { flats, rods: marked(rods, rods.length - 1, rods.length), cubes });
    }
    rods = rods.slice(1);
    cubes = [...cubes, ...many(10, { color: 'new' })];
    push(t('ex.breakTen'));
  }
  if (O(b) > 0) {
    cubes = gone(cubes, O(b));
    push(t('ex.takeAway', { what: unit('one', O(b)) }));
  }
  if (rods.length < T(b)) {
    push(t('ex.onlyTens', { tens: unit('ten', T(b)), n: rods.length }), { flats: marked(flats, flats.length - 1, flats.length), rods, cubes });
    flats = flats.slice(1);
    rods = [...rods, ...many(10, { color: 'new' })];
    push(t('ex.breakHundred'));
  }
  if (T(b) > 0) {
    rods = gone(rods, T(b));
    push(t('ex.takeAway', { what: unit('ten', T(b)) }));
  }
  if (H(b) > 0) {
    flats = gone(flats, H(b));
    push(t('ex.takeAway', { what: unit('hundred', H(b)) }));
  }
  steps.push({
    scene: { type: 'blocks', parts: [group(c, 'a')], result: c },
    caption: c >= 10 ? t('ex.subEnd', { parts: placeWords(c), c }) : t('ex.left', { c }),
  });
  return steps;
}

/** Skip-counting list: "4, 8, 12" or "4, 8, 12 … 36". */
function countBy(step: number, times: number) {
  const all = Array.from({ length: times }, (_, i) => step * (i + 1));
  const shown = times > 5 ? [...all.slice(0, 3), '…', all[all.length - 1]] : all;
  return shown.map((n, i) => (i === shown.length - 1 ? `*${n}*` : n)).join(', ').replace(', …,', ' …');
}

/**
 * Times: small facts are bunny hops (4 × 6 is 4 hops of 6). Bigger ones (23 × 4) are a box 4 rows
 * tall and 23 wide, split into 20 and 3: 4 × 20 and 4 × 3, then add.
 */
function timesBlocks({ a, b, c }: Fact): Step[] {
  if (a <= 10 && b <= 10) {
    const line = { type: 'hops', step: b, max: c } as const;
    return [
      { scene: { ...line, hops: 0 }, caption: t('ex.hopsOf', { a, b }) },
      { scene: { ...line, hops: a }, caption: t('ex.countBy', { b, list: countBy(b, a) }) },
      { scene: { ...line, hops: a, result: c }, caption: `${a} × ${b} = *${c}*` },
    ];
  }
  const big = Math.max(a, b);
  const rows = Math.min(a, b);
  const tens = big - O(big);
  const ones = O(big);
  const box = { type: 'box', rows, tens, ones } as const;
  const steps: Step[] = [{ scene: box, caption: t('ex.boxOf', { a, b, n: rows, big }) }];
  if (ones === 0) {
    const tensWord = unit('ten', T(big));
    const total = unit('ten', rows * T(big));
    steps.push(
      { scene: { ...box, fill: { tens: true }, inside: { tens: c } }, caption: t('ex.lotsOfTens', { n: rows, t: tensWord, x: total }) },
      { scene: { ...box, fill: { tens: true }, inside: { tens: c }, result: c }, caption: t('ex.thats', { c }) },
    );
    return steps;
  }
  const x = rows * tens;
  const y = rows * ones;
  const split = { ...box, split: true };
  steps.push(
    { scene: split, caption: t('ex.split', { big }) },
    { scene: { ...split, fill: { tens: true }, inside: { tens: x } }, caption: `${rows} × ${tens} = *${x}*` },
    { scene: { ...split, fill: { tens: true, ones: true }, inside: { tens: x, ones: y } }, caption: `${rows} × ${ones} = *${y}*` },
    { scene: { ...split, fill: { tens: true, ones: true }, inside: { tens: x, ones: y }, result: c }, caption: `${x} + ${y} = *${c}*` },
  );
  return steps;
}

/**
 * Divide: small answers are bunny hops (24 ÷ 6: how many hops of 6 get to 24?). Bigger ones (84 ÷ 6)
 * are the same box as times with the width missing: 84 squares in 6 rows. Put 10 in each row (60),
 * share out the 24 left over (4 more each), so each row is 14.
 */
function divideBlocks({ a, b, c }: Fact): Step[] {
  if (c <= 10) {
    const line = { type: 'hops', step: b, max: a, goal: true, count: true } as const;
    return [
      { scene: { ...line, hops: 0 }, caption: t('ex.howManyHops', { a, b }) },
      { scene: { ...line, hops: c }, caption: t('ex.countBy', { b, list: countBy(b, c) }) },
      { scene: { ...line, hops: c, result: c }, caption: t('ex.thatsHops', { a, b, c }) },
    ];
  }
  const tens = c - O(c);
  const ones = O(c);
  const easy = tens * b;
  const rest = a - easy;
  const box = { type: 'box', rows: b, tens, ones } as const;
  const steps: Step[] = [
    { scene: { ...box, ask: true }, caption: t('ex.boxRows', { a, b }) },
    { scene: { ...box, ask: true, fill: { tens: true }, inside: { tens: easy } }, caption: t('ex.putIn', { x: tens, b, easy }) },
  ];
  if (!rest) {
    steps.push({ scene: { ...box, fill: { tens: true }, inside: { tens: easy }, width: true, result: c }, caption: t('ex.rowIsAll', { c }) });
    return steps;
  }
  const split = { ...box, split: true };
  steps.push(
    { scene: { ...box, ask: true, fill: { tens: true }, inside: { tens: easy } }, caption: t('ex.leftOver', { a, easy, rest }) },
    { scene: { ...split, fill: { tens: true, ones: true }, inside: { tens: easy, ones: rest } }, caption: t('ex.moreEach', { rest, b, y: ones }) },
    {
      scene: { ...split, fill: { tens: true, ones: true }, inside: { tens: easy, ones: rest }, width: true, result: c },
      caption: t('ex.rowIs', { x: tens, y: ones, c }),
    },
  );
  return steps;
}

/* ---------- Column method (竖式) ---------- */

/** A number written right-aligned in a row `width` digits wide, ending at column `end`. */
function digitsAt(n: number, width: number, tone: Cell['tone'], end = width - 1): (Cell | null)[] {
  const s = String(n);
  const row: (Cell | null)[] = Array(width).fill(null);
  for (let i = 0; i < s.length; i++) row[end - s.length + 1 + i] = { t: s[i], tone };
  return row;
}

const stack = () => t('ex.stack');

function addColumn({ a, b, c }: Fact): Step[] {
  const width = len(c);
  const carry: (Cell | null)[] = Array(width).fill(null);
  const ans: (Cell | null)[] = Array(width).fill(null);
  const scene = (focus?: number, result?: number): Scene => ({
    type: 'column',
    width,
    focus,
    result,
    rows: [
      { cells: digitsAt(a, width, 'a') },
      { label: '+', cells: digitsAt(b, width, 'b') },
      { cells: [...carry], carry: true },
      { cells: [...ans], rule: true },
    ],
  });
  const steps: Step[] = [{ scene: scene(), caption: stack() }];
  const top = Math.max(len(a), len(b));
  let k = 0;
  for (let p = 0; p < top; p++) {
    const col = width - 1 - p;
    const terms = [...(p < len(a) ? [digit(a, p)] : []), ...(p < len(b) ? [digit(b, p)] : []), ...(k ? [k] : [])];
    const sum = terms.reduce((x, y) => x + y, 0);
    const said = { place: place(p), sum: `${terms.join(' + ')} = ${sum}` };
    if (sum >= 10 && p < top - 1) {
      ans[col] = { t: String(sum % 10), tone: 'new' };
      carry[col - 1] = { t: '1', tone: 'carry' };
      steps.push({ scene: scene(col), caption: t('ex.colWriteCarry', { ...said, d: sum % 10, k: 1 }) });
      k = 1;
    } else {
      digitsAt(sum, width, 'new', col).forEach((cell, i) => cell && (ans[i] = cell));
      steps.push({ scene: scene(col), caption: t('ex.colWrite', { ...said, d: sum }) });
      k = 0;
    }
  }
  steps.push({ scene: scene(undefined, c), caption: `*${a} + ${b} = ${c}*` });
  return steps;
}

function subColumn({ a, b, c }: Fact): Step[] {
  const width = len(a);
  const dots: boolean[] = Array(width).fill(false);
  const ans: (Cell | null)[] = Array(width).fill(null);
  const scene = (focus?: number, result?: number): Scene => ({
    type: 'column',
    width,
    focus,
    result,
    rows: [
      { cells: digitsAt(a, width, 'a').map((cell, i) => (cell && dots[i] ? { ...cell, dot: true } : cell)) },
      { label: '−', cells: digitsAt(b, width, 'b') },
      { cells: [...ans], rule: true },
    ],
  });
  const steps: Step[] = [{ scene: scene(), caption: stack() }];
  let borrowed = 0;
  for (let p = 0; p < width; p++) {
    const col = width - 1 - p;
    const da = digit(a, p);
    const hasB = p < len(b);
    const db = hasB ? digit(b, p) : 0;
    const short = da - borrowed < db;
    if (short) dots[col - 1] = true;
    const top = da + (short ? 10 : 0);
    const r = top - borrowed - db;
    const leadingZero = p > 0 && Math.floor(c / 10 ** p) === 0;
    if (!leadingZero) ans[col] = { t: String(r), tone: 'new' };
    const sum = `*${top}${borrowed ? ' − 1' : ''}${hasB ? ` − ${db}` : ''} = ${r}*`;
    const pl = place(p);
    let caption: string;
    if (short && borrowed) caption = t('ex.borrowAgain', { place: pl, sum });
    else if (short) caption = t('ex.borrow', { place: pl, a: da, b: db, sum });
    else if (borrowed) caption = t('ex.dotLess', { place: pl, sum });
    else if (!hasB) caption = t('ex.nothingToTake', { place: pl, d: da });
    else caption = t('ex.plain', { place: pl, sum });
    if (leadingZero) caption = t('ex.noZero', { text: caption });
    steps.push({ scene: scene(col), caption });
    borrowed = short ? 1 : 0;
  }
  steps.push({ scene: scene(undefined, c), caption: `*${a} − ${b} = ${c}*` });
  return steps;
}

function timesColumn({ a, b, c }: Fact): Step[] {
  // The longer number goes on top, so we multiply by one digit.
  const swap = len(b) > len(a);
  const top = swap ? b : a;
  const m = swap ? a : b;
  const width = len(c);
  const carry: (Cell | null)[] = Array(width).fill(null);
  const ans: (Cell | null)[] = Array(width).fill(null);
  const scene = (focus?: number, result?: number): Scene => ({
    type: 'column',
    width,
    focus,
    result,
    rows: [
      { cells: digitsAt(top, width, 'a') },
      { label: '×', cells: digitsAt(m, width, 'b') },
      { cells: [...carry], carry: true },
      { cells: [...ans], rule: true },
    ],
  });
  const steps: Step[] = [{ scene: scene(), caption: swap ? t('ex.putOnTop', { top, m }) : stack() }];
  let k = 0;
  for (let p = 0; p < len(top); p++) {
    const col = width - 1 - p;
    const d = digit(top, p);
    const prod = d * m + k;
    const said = { place: place(p), sum: `${d} × ${m}${k ? ` + ${k}` : ''} = ${prod}` };
    if (prod >= 10 && p < len(top) - 1) {
      ans[col] = { t: String(prod % 10), tone: 'new' };
      k = Math.floor(prod / 10);
      carry[col - 1] = { t: String(k), tone: 'carry' };
      steps.push({ scene: scene(col), caption: t('ex.colWriteCarry', { ...said, d: prod % 10, k }) });
    } else {
      digitsAt(prod, width, 'new', col).forEach((cell, i) => cell && (ans[i] = cell));
      steps.push({ scene: scene(col), caption: t('ex.colWrite', { ...said, d: prod }) });
      k = 0;
    }
  }
  steps.push({ scene: scene(undefined, c), caption: `*${a} × ${b} = ${c}*` });
  return steps;
}

/** Long division with the 厂-shaped bracket: divide, multiply, take away, bring down. */
function divideColumn({ a, b, c }: Fact): Step[] {
  const ds = String(a).split('').map(Number);
  const width = ds.length;
  const quotient: (Cell | null)[] = Array(width).fill(null);
  const work: ColRow[] = [];
  const scene = (focus?: number, result?: number): Scene => ({
    type: 'column',
    width,
    focus,
    result,
    division: true,
    rows: [{ cells: [...quotient] }, { label: String(b), cells: digitsAt(a, width, 'a'), bracket: true }, ...work.map((r) => ({ ...r, cells: [...r.cells] }))],
  });
  const steps: Step[] = [{ scene: scene(), caption: t('ex.divStart', { a, b }) }];
  let cur = 0;
  let started = false;
  for (let i = 0; i < width; i++) {
    cur = cur * 10 + ds[i];
    if (!started && cur < b && i < width - 1) {
      steps.push({ scene: scene(i), caption: t('ex.lessThan', { cur, b, next: cur * 10 + ds[i + 1] }) });
      continue;
    }
    started = true;
    const q = Math.floor(cur / b);
    const prod = q * b;
    const rem = cur - prod;
    quotient[i] = { t: String(q), tone: 'new' };
    work.push({ cells: digitsAt(prod, width, 'b', i) });
    steps.push({ scene: scene(i), caption: t('ex.divStep', { cur, b, q, prod }) });
    if (i < width - 1) {
      const row = rem ? digitsAt(rem, width, 'a', i) : Array<Cell | null>(width).fill(null);
      row[i + 1] = { t: String(ds[i + 1]), tone: 'new' };
      work.push({ cells: row, rule: true });
      steps.push({
        scene: scene(i + 1),
        caption: t('ex.bringDown', { cur, prod, rem, d: ds[i + 1], next: rem * 10 + ds[i + 1] }),
      });
      cur = rem;
    } else {
      work.push({ cells: digitsAt(rem, width, 'a', i), rule: true });
      steps.push({ scene: scene(i), caption: t('ex.noneLeft', { cur, prod }) });
    }
  }
  steps.push({ scene: scene(undefined, c), caption: `*${a} ÷ ${b} = ${c}*` });
  return steps;
}

/* ---------- Putting it together ---------- */

const BUILDERS: Record<ExplainStyle, Record<Fact['op'], (f: Fact) => Step[]>> = {
  blocks: { '+': addBlocks, '-': subBlocks, '×': timesBlocks, '÷': divideBlocks },
  column: { '+': addColumn, '-': subColumn, '×': timesColumn, '÷': divideColumn },
};

export function factSteps(f: Fact, style: ExplainStyle = 'blocks'): Step[] {
  return BUILDERS[style][f.op](f);
}

/** Missing number: turn the sum around so it becomes a normal sum. */
export function inverse(q: Extract<Question, { kind: 'missing' }>): Fact {
  const { a, op, b, c } = q.fact;
  const hideB = q.hide === 'b';
  switch (op) {
    case '+':
      return hideB ? { a: c, op: '-', b: a, c: b } : { a: c, op: '-', b, c: a };
    case '-':
      return hideB ? { a, op: '-', b: c, c: b } : { a: c, op: '+', b, c: a };
    case '×':
      return hideB ? { a: c, op: '÷', b: a, c: b } : { a: c, op: '÷', b, c: a };
    case '÷':
      return hideB ? { a, op: '÷', b: c, c: b } : { a: c, op: '×', b, c: a };
  }
}

export function questionText(q: Question): string {
  const { a, op, b, c } = q.fact;
  const s = sym(op);
  if (q.kind === 'missing') return q.hide === 'a' ? `? ${s} ${b} = ${c}` : `${a} ${s} ? = ${c}`;
  return `${a} ${s} ${b}`;
}

export function explain(q: Question, style: ExplainStyle = 'blocks'): Step[] {
  if (q.kind === 'missing') {
    const f = inverse(q);
    const steps = factSteps(f, style);
    const last = steps[steps.length - 1];
    return [
      {
        scene: { type: 'text', lines: [questionText(q), `${f.a} ${sym(f.op)} ${f.b} = ?`] },
        caption: t('ex.turnAround'),
      },
      ...steps.slice(0, -1),
      { ...last, caption: t('ex.missingIs', { n: f.c }) },
    ];
  }
  const steps = factSteps(q.fact, style);
  if (q.kind === 'compare') {
    const sign = compareSign(q.fact.c, q.than);
    const key = ({ '<': 'ex.smaller', '>': 'ex.bigger', '=': 'ex.same' } as const)[sign];
    steps.push({
      scene: { type: 'text', lines: [`${q.fact.c} ${sign} ${q.than}`] },
      caption: t(key, { x: q.fact.c, y: q.than }),
    });
  }
  return steps;
}
