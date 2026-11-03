import { compareSign, digit, opSymbol } from './generator';
import { explanationText as text } from './explain-i18n';
import type { Language } from './i18n';
import type { ExplainStyle } from './storage';
import type { Fact, Question } from './types';

/**
 * Builds the "Show me how" steps for a question. Each step is one picture and one short line.
 * Two styles:
 * - blocks: base-ten blocks (a square is 100, a rod is 10, a cube is 1), and dot arrays for × and ÷
 * - column: the written column method (竖式), one column at a time
 *
 * Captions use *stars* around the words to highlight.
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
  /** `rows` rows of `cols` dots; with `totals`, each row shows the running count. */
  | { type: 'array'; rows: number; cols: number; totals?: boolean; result?: number }
  /** `focus` is the column (from the left) being worked on. */
  | { type: 'column'; width: number; rows: ColRow[]; focus?: number; division?: boolean; result?: number };
export type Step = { scene: Scene; caption: string };

const PLACE = ['column.ones', 'column.tens', 'column.hundreds'] as const;
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
const units = (language: Language, n: number, unit: 'one' | 'ten' | 'hundred') => {
  const key = n === 1 ? `units.${unit}` as const : `units.${unit}s` as const;
  return text(language, key, { n });
};
const sym = (op: Fact['op']) => opSymbol(op);

/** "3 hundreds, 4 tens and 5 ones" (leaving out the zeros). */
function placeWords(n: number, language: Language) {
  const parts = [
    [Math.floor(n / 100), 'hundred'],
    [T(n), 'ten'],
    [O(n), 'one'],
  ]
    .filter(([k]) => k)
    .map(([k, w]) => units(language, k as number, w as 'one' | 'ten' | 'hundred'));
  return parts.length > 1 ? text(language, 'units.join', { first: parts.slice(0, -1).join(', '), last: parts.at(-1)! }) : parts[0];
}

const marked = (pieces: Piece[], from: number, to: number) => pieces.map((p, i) => (i >= from && i < to ? { ...p, state: 'mark' as const } : p));
const gone = (pieces: Piece[], n: number) => pieces.map((p, i) => (i >= pieces.length - n ? { ...p, state: 'gone' as const } : p));

/* ---------- Blocks ---------- */

function addBlocks({ a, b, c }: Fact, language: Language): Step[] {
  const steps: Step[] = [
    { scene: { type: 'blocks', parts: [group(a, 'a'), '+', group(b, 'b')] }, caption: text(language, 'blocks.make', { a, b }) },
  ];
  let flats = [...many(H(a), { color: 'a' }), ...many(H(b), { color: 'b' })];
  let rods = [...many(T(a), { color: 'a' }), ...many(T(b), { color: 'b' })];
  let cubes = [...many(O(a), { color: 'a' }), ...many(O(b), { color: 'b' })];
  const show = (g: Group): Scene => ({ type: 'blocks', parts: [g] });
  const onesSum = O(a) + O(b);

  steps.push({
    scene: show({ flats, rods, cubes }),
    caption: a < 10 && b < 10 ? text(language, 'blocks.combineSmall', { sum: onesSum }) : text(language, 'blocks.combineOnes', { equation: `${O(a)} + ${O(b)} = ${onesSum}` }),
  });
  if (onesSum >= 10) {
    steps.push({ scene: show({ flats, rods, cubes: marked(cubes, 0, 10) }), caption: text(language, 'blocks.circleOnes', {}) });
    rods = [...rods, { color: 'new' }];
    cubes = cubes.slice(10);
    steps.push({ scene: show({ flats, rods, cubes }), caption: text(language, 'blocks.exchangeTen', {}) });
  }

  const carried = onesSum >= 10 ? 1 : 0;
  const tensSum = T(a) + T(b) + carried;
  if (T(b) > 0 || tensSum >= 10) {
    const terms = [T(a), ...(T(b) ? [T(b)] : []), ...(carried ? [1] : [])];
    steps.push({ scene: show({ flats, rods, cubes }), caption: text(language, 'blocks.combineTens', { equation: `${terms.join(' + ')} = ${tensSum}` }) });
  }
  if (tensSum >= 10) {
    steps.push({ scene: show({ flats, rods: marked(rods, 0, 10), cubes }), caption: text(language, 'blocks.circleTens', {}) });
    flats = [...flats, { color: 'new' }];
    rods = rods.slice(10);
    steps.push({ scene: show({ flats, rods, cubes }), caption: text(language, 'blocks.exchangeHundred', {}) });
  }
  if (H(b) > 0) {
    const terms = [H(a), H(b), ...(tensSum >= 10 ? [1] : [])];
    steps.push({ scene: show({ flats, rods, cubes }), caption: text(language, 'blocks.combineHundreds', { equation: `${terms.join(' + ')} = ${H(c)}` }) });
  }
  steps.push({
    scene: { type: 'blocks', parts: [group(c, 'a')], result: c },
    caption: c >= 10 ? text(language, 'blocks.placeResult', { places: placeWords(c, language), result: c }) : text(language, 'blocks.countResult', { result: c }),
  });
  return steps;
}

function subBlocks({ a, b, c }: Fact, language: Language): Step[] {
  const steps: Step[] = [{ scene: { type: 'blocks', parts: [group(a, 'a')] }, caption: text(language, 'blocks.start', { a }) }];
  let flats = many(H(a), { color: 'a' });
  let rods = many(T(a), { color: 'a' });
  let cubes = many(O(a), { color: 'a' });
  const push = (caption: string, g: Group = { flats, rods, cubes }) => steps.push({ scene: { type: 'blocks', parts: [g] }, caption });

  if (O(a) < O(b)) {
    if (rods.length === 0) {
      push(text(language, 'blocks.shortOnesNoTens', { needed: O(b), available: O(a) }), { flats: marked(flats, flats.length - 1, flats.length), rods, cubes });
      flats = flats.slice(1);
      rods = many(10, { color: 'new' });
      push(text(language, 'blocks.breakHundred', {}));
      push(text(language, 'blocks.takeTen', {}), { flats, rods: marked(rods, rods.length - 1, rods.length), cubes });
    } else {
      push(text(language, 'blocks.shortOnes', { needed: O(b), available: O(a) }), { flats, rods: marked(rods, rods.length - 1, rods.length), cubes });
    }
    rods = rods.slice(1);
    cubes = [...cubes, ...many(10, { color: 'new' })];
    push(text(language, 'blocks.breakTen', {}));
  }
  if (O(b) > 0) {
    cubes = gone(cubes, O(b));
    push(text(language, 'blocks.takeAway', { amount: units(language, O(b), 'one') }));
  }
  if (rods.length < T(b)) {
    push(text(language, 'blocks.shortTens', { needed: T(b), available: rods.length }), { flats: marked(flats, flats.length - 1, flats.length), rods, cubes });
    flats = flats.slice(1);
    rods = [...rods, ...many(10, { color: 'new' })];
    push(text(language, 'blocks.breakHundred', {}));
  }
  if (T(b) > 0) {
    rods = gone(rods, T(b));
    push(text(language, 'blocks.takeAway', { amount: units(language, T(b), 'ten') }));
  }
  if (H(b) > 0) {
    flats = gone(flats, H(b));
    push(text(language, 'blocks.takeAway', { amount: units(language, H(b), 'hundred') }));
  }
  steps.push({
    scene: { type: 'blocks', parts: [group(c, 'a')], result: c },
    caption: c >= 10 ? text(language, 'blocks.placeLeft', { places: placeWords(c, language), result: c }) : text(language, 'blocks.left', { result: c }),
  });
  return steps;
}

/** Skip-counting list: "4, 8, 12" or "4, 8, 12 … 36". */
function countBy(step: number, times: number) {
  const all = Array.from({ length: times }, (_, i) => step * (i + 1));
  const shown = times > 5 ? [...all.slice(0, 3), '…', all.at(-1)] : all;
  return shown.map((n, i) => (i === shown.length - 1 ? `*${n}*` : n)).join(', ').replace(', …,', ' …');
}

function timesBlocks({ a, b, c }: Fact, language: Language): Step[] {
  if (a <= 10 && b <= 10) {
    return [
      { scene: { type: 'array', rows: a, cols: b }, caption: text(language, 'times.rows', { a, b }) },
      { scene: { type: 'array', rows: a, cols: b, totals: true }, caption: text(language, 'times.count', { b, count: countBy(b, a) }) },
      { scene: { type: 'array', rows: a, cols: b, totals: true, result: c }, caption: `${a} × ${b} = *${c}*` },
    ];
  }
  const big = Math.max(a, b);
  const n = Math.min(a, b);
  const tensPart = big - O(big);
  const steps: Step[] = [
    {
      scene: { type: 'blocks', parts: Array.from({ length: n }, () => group(big, 'a')) },
      caption: text(language, 'times.groups', { a, b, n, big }),
    },
  ];
  if (O(big) === 0) {
    steps.push({ scene: { type: 'text', lines: [text(language, 'times.tensScene', { n, tens: T(big), result: n * T(big) })] }, caption: text(language, 'times.tens', { n, tens: T(big), result: n * T(big) }) });
  } else {
    steps.push(
      { scene: { type: 'text', lines: [`${big} = ${tensPart} + ${O(big)}`] }, caption: text(language, 'times.split', { big }) },
      { scene: { type: 'text', lines: [`${n} × ${tensPart} = ${n * tensPart}`] }, caption: text(language, 'times.lots', { n, part: tensPart, result: n * tensPart }) },
      { scene: { type: 'text', lines: [`${n} × ${O(big)} = ${n * O(big)}`] }, caption: text(language, 'times.lots', { n, part: O(big), result: n * O(big) }) },
    );
  }
  steps.push({
    scene: { type: 'blocks', parts: [group(c, 'a')], result: c },
    caption: O(big) === 0 ? text(language, 'times.result', { result: c }) : `${n * tensPart} + ${n * O(big)} = *${c}*`,
  });
  return steps;
}

function divideBlocks({ a, b, c }: Fact, language: Language): Step[] {
  if (c <= 10) {
    return [
      { scene: { type: 'blocks', parts: [group(a, 'a')] }, caption: text(language, 'divide.howMany', { a, b }) },
      { scene: { type: 'array', rows: c, cols: b, totals: true }, caption: text(language, 'divide.rows', { b, count: countBy(b, c) }) },
      { scene: { type: 'array', rows: c, cols: b, totals: true, result: c }, caption: text(language, 'divide.rowsResult', { a, b, c }) },
    ];
  }
  const easy = Math.floor(a / (10 * b)) * 10 * b;
  const rest = a - easy;
  const steps: Step[] = [
    { scene: { type: 'blocks', parts: [group(a, 'a')] }, caption: text(language, 'divide.share', { a, b }) },
    { scene: { type: 'text', lines: [rest ? `${a} = ${easy} + ${rest}` : `${a} = ${easy}`] }, caption: rest ? text(language, 'divide.split', { a }) : text(language, 'divide.easy', { a }) },
    { scene: { type: 'text', lines: [`${easy} ÷ ${b} = ${easy / b}`] }, caption: text(language, 'divide.eachGets', { amount: easy / b }) },
  ];
  if (rest) steps.push({ scene: { type: 'text', lines: [`${rest} ÷ ${b} = ${rest / b}`] }, caption: text(language, 'divide.more', { amount: rest / b }) });
  steps.push({
    scene: { type: 'blocks', parts: Array.from({ length: b }, () => group(c, 'a')), result: c },
    caption: rest ? text(language, 'divide.eachResult', { equation: `${easy / b} + ${rest / b} = *${c}*` }) : text(language, 'divide.eachResult', { equation: `*${c}*` }),
  });
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



function addColumn({ a, b, c }: Fact, language: Language): Step[] {
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
  const steps: Step[] = [{ scene: scene(), caption: text(language, 'column.stack', {}) }];
  const top = Math.max(len(a), len(b));
  let k = 0;
  for (let p = 0; p < top; p++) {
    const col = width - 1 - p;
    const terms = [...(p < len(a) ? [digit(a, p)] : []), ...(p < len(b) ? [digit(b, p)] : []), ...(k ? [k] : [])];
    const sum = terms.reduce((x, y) => x + y, 0);
    const place = text(language, PLACE[p], {});
    const equation = `${terms.join(' + ')} = ${sum}`;
    if (sum >= 10 && p < top - 1) {
      ans[col] = { t: String(sum % 10), tone: 'new' };
      carry[col - 1] = { t: '1', tone: 'carry' };
      steps.push({ scene: scene(col), caption: text(language, 'column.writeCarry', { place, equation, digit: sum % 10, carry: 1 }) });
      k = 1;
    } else {
      digitsAt(sum, width, 'new', col).forEach((cell, i) => cell && (ans[i] = cell));
      steps.push({ scene: scene(col), caption: text(language, 'column.write', { place, equation, digit: sum }) });
      k = 0;
    }
  }
  steps.push({ scene: scene(undefined, c), caption: `*${a} + ${b} = ${c}*` });
  return steps;
}

function subColumn({ a, b, c }: Fact, language: Language): Step[] {
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
  const steps: Step[] = [{ scene: scene(), caption: text(language, 'column.stack', {}) }];
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
    const place = text(language, PLACE[p], {});
    let caption: string;
    if (short && borrowed) caption = text(language, 'column.borrowAgain', { place, equation: sum });
    else if (short) caption = text(language, 'column.borrow', { place, a: da, b: db, equation: sum });
    else if (borrowed) caption = text(language, 'column.borrowed', { place, equation: sum });
    else if (!hasB) caption = text(language, 'column.nothing', { place, digit: da });
    else caption = text(language, 'column.subtract', { place, equation: sum });
    if (leadingZero) caption = text(language, 'column.noLeadingZero', { caption });
    steps.push({ scene: scene(col), caption });
    borrowed = short ? 1 : 0;
  }
  steps.push({ scene: scene(undefined, c), caption: `*${a} − ${b} = ${c}*` });
  return steps;
}

function timesColumn({ a, b, c }: Fact, language: Language): Step[] {
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
  const steps: Step[] = [{ scene: scene(), caption: swap ? text(language, 'column.swap', { top, bottom: m }) : text(language, 'column.stack', {}) }];
  let k = 0;
  for (let p = 0; p < len(top); p++) {
    const col = width - 1 - p;
    const d = digit(top, p);
    const prod = d * m + k;
    const place = text(language, PLACE[p], {});
    const equation = `${d} × ${m}${k ? ` + ${k}` : ''} = ${prod}`;
    if (prod >= 10 && p < len(top) - 1) {
      ans[col] = { t: String(prod % 10), tone: 'new' };
      k = Math.floor(prod / 10);
      carry[col - 1] = { t: String(k), tone: 'carry' };
      steps.push({ scene: scene(col), caption: text(language, 'column.writeCarry', { place, equation, digit: prod % 10, carry: k }) });
    } else {
      digitsAt(prod, width, 'new', col).forEach((cell, i) => cell && (ans[i] = cell));
      steps.push({ scene: scene(col), caption: text(language, 'column.write', { place, equation, digit: prod }) });
      k = 0;
    }
  }
  steps.push({ scene: scene(undefined, c), caption: `*${a} × ${b} = ${c}*` });
  return steps;
}

/** Long division with the 厂-shaped bracket: divide, multiply, take away, bring down. */
function divideColumn({ a, b, c }: Fact, language: Language): Step[] {
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
  const steps: Step[] = [{ scene: scene(), caption: text(language, 'column.divideStart', { a, b }) }];
  let cur = 0;
  let started = false;
  for (let i = 0; i < width; i++) {
    cur = cur * 10 + ds[i];
    if (!started && cur < b && i < width - 1) {
      steps.push({ scene: scene(i), caption: text(language, 'column.lessThan', { current: cur, divisor: b, next: cur * 10 + ds[i + 1] }) });
      continue;
    }
    started = true;
    const q = Math.floor(cur / b);
    const prod = q * b;
    const rem = cur - prod;
    quotient[i] = { t: String(q), tone: 'new' };
    work.push({ cells: digitsAt(prod, width, 'b', i) });
    steps.push({ scene: scene(i), caption: text(language, 'column.divideWrite', { current: cur, divisor: b, quotient: q, product: prod }) });
    if (i < width - 1) {
      const row = rem ? digitsAt(rem, width, 'a', i) : Array<Cell | null>(width).fill(null);
      row[i + 1] = { t: String(ds[i + 1]), tone: 'new' };
      work.push({ cells: row, rule: true });
      steps.push({
        scene: scene(i + 1),
        caption: text(language, 'column.bringDown', { current: cur, product: prod, remainder: rem, digit: ds[i + 1], next: rem * 10 + ds[i + 1] }),
      });
      cur = rem;
    } else {
      work.push({ cells: digitsAt(rem, width, 'a', i), rule: true });
      steps.push({ scene: scene(i), caption: text(language, 'column.noRemainder', { current: cur, product: prod }) });
    }
  }
  steps.push({ scene: scene(undefined, c), caption: `*${a} ÷ ${b} = ${c}*` });
  return steps;
}

/* ---------- Putting it together ---------- */

const BUILDERS: Record<ExplainStyle, Record<Fact['op'], (f: Fact, language: Language) => Step[]>> = {
  blocks: { '+': addBlocks, '-': subBlocks, '×': timesBlocks, '÷': divideBlocks },
  column: { '+': addColumn, '-': subColumn, '×': timesColumn, '÷': divideColumn },
};

export function factSteps(f: Fact, style: ExplainStyle = 'blocks', language: Language = 'en'): Step[] {
  return BUILDERS[style][f.op](f, language);
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

export function explain(q: Question, style: ExplainStyle = 'blocks', language: Language = 'en'): Step[] {
  if (q.kind === 'missing') {
    const f = inverse(q);
    const steps = factSteps(f, style, language);
    const last = steps[steps.length - 1];
    return [
      {
        scene: { type: 'text', lines: [questionText(q), `${f.a} ${sym(f.op)} ${f.b} = ?`] },
        caption: text(language, 'missing.invert', {}),
      },
      ...steps.slice(0, -1),
      { ...last, caption: text(language, 'missing.result', { result: f.c }) },
    ];
  }
  const steps = factSteps(q.fact, style, language);
  if (q.kind === 'compare') {
    const sign = compareSign(q.fact.c, q.than);
    const key = { '<': 'compare.less', '>': 'compare.greater', '=': 'compare.equal' } as const;
    steps.push({
      scene: { type: 'text', lines: [`${q.fact.c} ${sign} ${q.than}`] },
      caption: text(language, key[sign], { value: q.fact.c, other: q.than }),
    });
  }
  return steps;
}
