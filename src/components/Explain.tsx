import { createContext, Fragment } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { explain, questionText, type Group, type Piece, type Scene } from '../lib/explain';
import { sounds } from '../lib/sound';
import type { ExplainStyle } from '../lib/storage';
import type { Question } from '../lib/types';

/** The child's chosen explanation style, remembered by the app. */
export const ExplainPref = createContext<{ style: ExplainStyle; setStyle: (s: ExplainStyle) => void }>({
  style: 'blocks',
  setStyle: () => {},
});

const STYLES: { id: ExplainStyle; label: string }[] = [
  { id: 'blocks', label: '🧱 Blocks' },
  { id: 'column', label: '✏️ Columns' },
];

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
      {!!group.flats?.length && (
        <div class="hundreds">
          {group.flats.map((p, i) => (
            <div key={`f${i}`} class={cls('flat', p)} />
          ))}
        </div>
      )}
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

function ArrayView({ scene }: { scene: Extract<Scene, { type: 'array' }> }) {
  const { rows, cols, totals, result } = scene;
  return (
    <div class="stage">
      <div class="dot-array" style={{ '--rows': rows, '--cols': cols }}>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} class={`dot-row ${r % 2 ? 'b' : 'a'}`}>
            {Array.from({ length: cols }, (_, c) => (
              <i key={c} />
            ))}
            {totals && <span class="dot-total">{(r + 1) * cols}</span>}
          </div>
        ))}
      </div>
      {result !== undefined && <span class="tally">= {result}</span>}
    </div>
  );
}

function ColumnView({ scene }: { scene: Extract<Scene, { type: 'column' }> }) {
  const { width, rows, focus, division } = scene;
  return (
    <div class="stage">
      <div class={`column-sum ${division ? 'division' : ''}`} style={{ '--w': width, '--rows': rows.length }}>
        {rows.map((row, r) => (
          <div key={r} class={`col-row ${row.rule ? 'rule' : ''} ${row.carry ? 'carry' : ''} ${row.bracket ? 'bracket' : ''}`}>
            <span class="col-label">{row.label}</span>
            {row.cells.map((cell, i) => (
              <span key={i} class={`col-cell ${i === focus ? 'on' : ''} ${cell?.tone ?? ''} ${cell?.dot ? 'dot' : ''}`}>
                {cell?.t}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stage({ scene }: { scene: Scene }) {
  if (scene.type === 'array') return <ArrayView scene={scene} />;
  if (scene.type === 'column') return <ColumnView scene={scene} />;
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
  const hasFlats = scene.parts.some((p) => p !== '+' && p.flats?.length);
  return (
    <div class={`stage ${hasFlats ? 'has-flats' : ''} ${scene.parts.length > 3 ? 'many' : ''}`}>
      <div class="legend" aria-hidden="true">
        {hasFlats && (
          <span>
            <span class="flat" /> = 100
          </span>
        )}
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
  const { style, setStyle } = useContext(ExplainPref);
  const steps = useMemo(() => explain(question, style), [question, style]);
  const [cur, setCur] = useState(0);
  useEffect(() => setCur(0), [style]);
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
          <div class="seg style-pick" role="radiogroup" aria-label="Show it with">
            {STYLES.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={style === s.id}
                onClick={() => {
                  sounds.tap();
                  setStyle(s.id);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button class="puffy icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <Stage key={`${style}-${cur}`} scene={steps[Math.min(cur, steps.length - 1)].scene} />
        <p class="caption" aria-live="polite">
          <Highlight text={steps[Math.min(cur, steps.length - 1)].caption} />
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
