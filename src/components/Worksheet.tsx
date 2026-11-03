import { useMemo, useState } from 'preact/hooks';
import { t, useT } from '../i18n';
import { levelOf, opSymbol } from '../lib/generator';
import { randomSeed } from '../lib/rng';
import { keyAnswer, makeSheets } from '../lib/worksheet';
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
            {q.story.emoji} {t(`story.${q.story.id}.text`, { a, b })}
          </span>
          {t(`story.${q.story.id}.ask`)} <Box />
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

/**
 * Printable worksheets. Each sheet is one printed page; all the answers
 * come after the last sheet, starting on a new page.
 */
export function Worksheet({ level, count, onBack }: { level: LevelId; count: number; onBack: () => void }) {
  useT();
  const [seed, setSeed] = useState(randomSeed);
  const [pageCount, setPageCount] = useState(1);
  const pages = useMemo(() => makeSheets(level, count, pageCount, seed), [level, count, pageCount, seed]);
  const lv = levelOf(level);

  return (
    <section class="screen print-screen">
      <div class="print-bar no-print">
        <button class="puffy" onClick={onBack}>
          {t('ws.back')}
        </button>
        <div class="length">
          <span id="pages-label">{t('ws.pages')}</span>
          <div class="seg" role="radiogroup" aria-labelledby="pages-label">
            {PAGE_CHOICES.map((n) => (
              <button key={n} role="radio" aria-checked={pageCount === n} onClick={() => setPageCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <button class="puffy" onClick={() => setSeed(randomSeed())}>
          {t('ws.new')}
        </button>
        <button class="puffy berry" onClick={() => print()}>
          {t('ws.print')}
        </button>
      </div>

      {pages.map((questions, p) => (
        <article key={p} class="sheet-paper ws-page">
          <header class="ws-head">
            <div>
              <h1 class="ws-title">{t('app.name')} 🐰</h1>
              <p class="ws-sub">
                {t(`level.${lv.id}.name`)} · {t(`level.${lv.id}.blurb`)}
                {pageCount > 1 && ` · ${t('ws.pageOf', { p: p + 1, n: pageCount })}`}
              </p>
            </div>
            <div class="ws-lines">
              <span>{t('ws.name')} ____________________</span>
              <span>{t('ws.date')} ____________</span>
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
        <h2 class="ws-title">{t('ws.answers')}</h2>
        {pages.map((questions, p) => (
          <section key={p} class="ws-key">
            {pageCount > 1 && <h3>{t('ws.page', { p: p + 1 })}</h3>}
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
