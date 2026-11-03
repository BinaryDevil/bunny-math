import { createContext, Fragment } from 'preact';
import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLang, useT, type MessageKey } from '../i18n';
import { explain, questionText, type Group, type Piece, type Scene } from '../lib/explain';
import { sounds } from '../lib/sound';
import type { ExplainStyle } from '../lib/storage';
import type { Question } from '../lib/types';

/** The child's chosen explanation style, remembered by the app. */
export const ExplainPref = createContext<{ style: ExplainStyle; setStyle: (s: ExplainStyle) => void }>({
  style: 'blocks',
  setStyle: () => {},
});

const STYLES: { id: ExplainStyle; label: MessageKey }[] = [
  { id: 'blocks', label: 'sheet.blocks' },
  { id: 'column', label: 'sheet.columns' },
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
  const t = useT();
  const lang = useLang();
  // The captions are written in the current language, so build them again when it changes.
  const steps = useMemo(() => explain(question, style), [question, style, lang]);
  const [cur, setCur] = useState(0);
  useEffect(() => setCur(0), [style]);
  const last = cur === steps.length - 1;

  const sheetRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Move keyboard focus into the sheet when it opens, and give it back when it closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    nextRef.current?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') return onClose();
      if (e.key === 'Tab') return trapTab(e, sheetRef.current);
      // A focused button already answers Enter with a click; acting here too would skip a step.
      if (e.key === 'Enter' && e.target instanceof Element && e.target.closest('button')) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        last ? onClose() : setCur((c) => c + 1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCur((c) => Math.max(0, c - 1));
      }
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
      <div class="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={t('sheet.aria', { q: questionText(question) })}>
        <div class="sheet-head">
          <p class="sheet-title">{questionText(question).replace(/-/g, '−')}</p>
          <div class="seg style-pick" role="radiogroup" aria-label={t('sheet.showWith')}>
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
                {t(s.label)}
              </button>
            ))}
          </div>
          <button class="puffy icon-btn" aria-label={t('sheet.close')} onClick={onClose}>
            ✕
          </button>
        </div>
        <Stage key={`${style}-${cur}`} scene={steps[Math.min(cur, steps.length - 1)].scene} />
        <p class="caption" aria-live="polite">
          <Highlight text={steps[Math.min(cur, steps.length - 1)].caption} />
        </p>
        <div class="sheet-foot">
          <div class="steps" aria-label={t('sheet.step', { n: cur + 1, total: steps.length })}>
            {steps.map((_, i) => (
              <span key={i} class={i === cur ? 'on' : ''} />
            ))}
          </div>
          <button class="puffy" style={{ visibility: cur ? 'visible' : 'hidden' }} onClick={() => go(-1)}>
            {t('sheet.back')}
          </button>
          <button class="puffy berry" ref={nextRef} onClick={() => go(1)}>
            {t(last ? 'sheet.gotIt' : 'sheet.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Keeps Tab and Shift+Tab inside a modal, so keyboard users can't wander behind it. */
export function trapTab(e: KeyboardEvent, box: HTMLElement | null) {
  if (!box) return;
  const all = [...box.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')].filter(
    (el) => el.style.visibility !== 'hidden',
  );
  if (!all.length) return;
  const first = all[0];
  const lastEl = all[all.length - 1];
  const inside = box.contains(document.activeElement);
  if (e.shiftKey && (document.activeElement === first || !inside)) {
    e.preventDefault();
    lastEl.focus();
  } else if (!e.shiftKey && (document.activeElement === lastEl || !inside)) {
    e.preventDefault();
    first.focus();
  }
}
