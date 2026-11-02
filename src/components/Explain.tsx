import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { explain, questionText, type Group, type Piece, type Scene } from '../lib/explain';
import { sounds } from '../lib/sound';
import type { Question } from '../lib/types';

/** Turns "*45* is bigger" into highlighted words. */
export function Highlight({ text }: { text: string }) {
  return (
    <>
      {text.split('*').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}
    </>
  );
}

const cls = (kind: string, p: Piece) => `${kind} ${p.color} ${p.state ?? ''}`;

function Rod({ piece }: { piece: Piece }) {
  return (
    <div class={cls('rod', piece)}>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

function Blocks({ group }: { group: Group }) {
  return (
    <div class="group">
      {group.rods.map((p, i) => (
        <Rod key={`r${i}`} piece={p} />
      ))}
      {group.cubes.length > 0 && (
        <div class="ones">
          {group.cubes.map((p, i) => (
            <div key={`c${i}`} class={cls('cube', p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stage({ scene }: { scene: Scene }) {
  if (scene.type === 'text') {
    return (
      <div class="stage">
        <div class="text-scene">
          {scene.lines.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <span class="arrow">⬇</span>}
              <span>{l.replace(/-/g, '−')}</span>
            </Fragment>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div class="stage">
      <div class="legend" aria-hidden="true">
        <span>
          <span class="rod">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</span> = 10
        </span>
        <span>
          <span class="cube" /> = 1
        </span>
      </div>
      {scene.parts.map((p, i) => (p === '+' ? <span key={i} class="plus">+</span> : <Blocks key={i} group={p} />))}
      {scene.result !== undefined && <span class="tally">= {scene.result}</span>}
    </div>
  );
}

export function ExplainSheet({ question, onClose }: { question: Question; onClose: () => void }) {
  const steps = explain(question);
  const [cur, setCur] = useState(0);
  const last = cur === steps.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'Enter') (last ? onClose() : setCur((c) => c + 1));
      if (e.key === 'ArrowLeft') setCur((c) => Math.max(0, c - 1));
      e.stopPropagation();
    };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [last, onClose]);

  const go = (d: number) => {
    sounds.tap();
    if (last && d > 0) return onClose();
    setCur((c) => Math.max(0, Math.min(steps.length - 1, c + d)));
  };

  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={`How to solve ${questionText(question)}`}>
        <div class="sheet-head">
          <p class="sheet-title">{questionText(question).replace(/-/g, '−')}</p>
          <button class="puffy icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <Stage key={cur} scene={steps[cur].scene} />
        <p class="caption" aria-live="polite">
          <Highlight text={steps[cur].caption} />
        </p>
        <div class="sheet-foot">
          <div class="steps" aria-label={`Step ${cur + 1} of ${steps.length}`}>
            {steps.map((_, i) => (
              <span key={i} class={i === cur ? 'on' : ''} />
            ))}
          </div>
          <button class="puffy" style={{ visibility: cur ? 'visible' : 'hidden' }} onClick={() => go(-1)}>
            ◀ Back
          </button>
          <button class="puffy berry" onClick={() => go(1)}>
            {last ? 'Got it!' : 'Next ▶'}
          </button>
        </div>
      </div>
    </div>
  );
}
