import { useMemo, useState } from 'preact/hooks';
import { LEVELS, compareSign, correctAnswer, generateQuiz, opSymbol } from '../lib/generator';
import { randomSeed } from '../lib/rng';
import type { LevelId, Question } from '../lib/types';

export const PAGE_CHOICES = [1, 2, 3, 4, 5];

function Box({ circle = false }: { circle?: boolean }) {
  return <span class={`box ${circle ? 'circle' : ''}`} />;
}

function PrintedQuestion({ q }: { q: Question }) {
  const { a, op, b, c } = q.fact;
  const s = opSymbol(op);
  switch (q.kind) {
    case 'missing':
      return q.hide === 'a' ? (
        <span>
          <Box /> {s} {b} = {c}
        </span>
      ) : (
        <span>
          {a} {s} <Box /> = {c}
        </span>
      );
    case 'compare':
      return (
        <span>
          {a} {s} {b} <Box circle /> {q.than}
        </span>
      );
    case 'story':
      return (
        <span>
          <span class="story">
            {q.story.emoji} {q.story.text}
          </span>
          {op === '+' ? 'How many now?' : 'How many are left?'} <Box />
        </span>
      );
    default:
      return (
        <span>
          {a} {s} {b} = <Box />
        </span>
      );
  }
}

/** Story questions take two lines, so keep at most 2 per sheet so 20 questions still fit on one page. */
const MAX_STORIES = 2;
function fitOnePage(questions: Question[]): Question[] {
  let stories = 0;
  return questions.map((q) => (q.kind === 'story' && ++stories > MAX_STORIES ? { id: q.id, fact: q.fact, skill: q.skill, kind: 'type' } : q));
}

const keyAnswer = (q: Question) => (q.kind === 'compare' ? compareSign(q.fact.c, q.than) : correctAnswer(q));

/**
 * Printable worksheets. Each sheet is one printed page; all the answers
 * come after the last sheet, starting on a new page.
 */
export function Worksheet({ level, count, onBack }: { level: LevelId; count: number; onBack: () => void }) {
  const [seed, setSeed] = useState(randomSeed);
  const [pageCount, setPageCount] = useState(1);
  const pages = useMemo(() => {
    // One big batch so no sum repeats across sheets, then cut it into pages.
    const all = generateQuiz({ level, count: count * pageCount, seed, kinds: ['type', 'type', 'missing', 'compare', 'story'] });
    return Array.from({ length: pageCount }, (_, p) => fitOnePage(all.slice(p * count, (p + 1) * count)));
  }, [level, count, pageCount, seed]);
  const lv = LEVELS.find((l) => l.id === level)!;

  return (
    <section class="screen print-screen">
      <div class="print-bar no-print">
        <button class="puffy" onClick={onBack}>
          ◀ Back
        </button>
        <div class="length">
          <span id="pages-label">Pages</span>
          <div class="seg" role="radiogroup" aria-labelledby="pages-label">
            {PAGE_CHOICES.map((n) => (
              <button key={n} role="radio" aria-checked={pageCount === n} onClick={() => setPageCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <button class="puffy" onClick={() => setSeed(randomSeed())}>
          🔄 New questions
        </button>
        <button class="puffy berry" onClick={() => print()}>
          🖨️ Print
        </button>
      </div>

      {pages.map((questions, p) => (
        <article key={p} class="sheet-paper ws-page">
          <header class="ws-head">
            <div>
              <h1 class="ws-title">Bunny Math 🐰</h1>
              <p class="ws-sub">
                {lv.name} · {lv.blurb}
                {pageCount > 1 && ` · Page ${p + 1} of ${pageCount}`}
              </p>
            </div>
            <div class="ws-lines">
              <span>Name: ____________________</span>
              <span>Date: ____________</span>
            </div>
          </header>
          <div class="ws-grid">
            {questions.map((q, i) => (
              <div key={q.id} class="ws-q">
                <span class="n">{i + 1}.</span>
                <PrintedQuestion q={q} />
              </div>
            ))}
          </div>
        </article>
      ))}

      <article class="sheet-paper ws-answers">
        <h2 class="ws-title">Answers</h2>
        {pages.map((questions, p) => (
          <section key={p} class="ws-key">
            {pageCount > 1 && <h3>Page {p + 1}</h3>}
            <ol>
              {questions.map((q) => (
                <li key={q.id}>{keyAnswer(q)}</li>
              ))}
            </ol>
          </section>
        ))}
      </article>
    </section>
  );
}
