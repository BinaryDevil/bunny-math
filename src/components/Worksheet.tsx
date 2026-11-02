import { useMemo, useState } from 'preact/hooks';
import { LEVELS, compareSign, correctAnswer, generateQuiz, opSymbol } from '../lib/generator';
import { randomSeed } from '../lib/rng';
import type { LevelId, Question } from '../lib/types';

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

const keyAnswer = (q: Question) => (q.kind === 'compare' ? compareSign(q.fact.c, q.than) : correctAnswer(q));

export function Worksheet({ level, count, onBack }: { level: LevelId; count: number; onBack: () => void }) {
  const [seed, setSeed] = useState(randomSeed);
  const questions = useMemo(() => generateQuiz({ level, count, seed, kinds: ['type', 'type', 'missing', 'compare', 'story'] }), [level, count, seed]);
  const lv = LEVELS.find((l) => l.id === level)!;

  return (
    <section class="screen print-screen">
      <div class="print-bar no-print">
        <button class="puffy" onClick={onBack}>
          ◀ Back
        </button>
        <button class="puffy" onClick={() => setSeed(randomSeed())}>
          🔄 New questions
        </button>
        <button class="puffy berry" onClick={() => print()}>
          🖨️ Print
        </button>
      </div>
      <article class="sheet-paper">
        <header class="ws-head">
          <div>
            <h1 class="ws-title">Bunny Math 🐰</h1>
            <p class="ws-sub">
              {lv.name} · {lv.blurb}
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
        <section class="ws-key">
          <h2>Answers</h2>
          <ol>
            {questions.map((q) => (
              <li key={q.id}>{keyAnswer(q)}</li>
            ))}
          </ol>
        </section>
      </article>
    </section>
  );
}
