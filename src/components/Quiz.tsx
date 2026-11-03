import { useEffect, useRef, useState } from 'preact/hooks';
import { t, useT, type MessageKey } from '../i18n';
import { smallBurst } from '../lib/celebrate';
import { compareSign, correctAnswer, opSymbol } from '../lib/generator';
import { sounds } from '../lib/sound';
import type { Answer, CompareSign, Question } from '../lib/types';
import { Bunny, type Mood } from './Bunny';
import { ExplainSheet } from './Explain';

export type QuizResult = { questions: Question[]; firstTry: Record<string, boolean> };

type Status = 'ask' | 'right' | 'wrong1' | 'wrong2';
type Item = { q: Question; review: boolean };

const ENCOURAGE: MessageKey[] = ['quiz.encourage.0', 'quiz.encourage.1', 'quiz.encourage.2', 'quiz.encourage.3', 'quiz.encourage.4'];
const CHEERS: MessageKey[] = ['quiz.cheer.0', 'quiz.cheer.1', 'quiz.cheer.2', 'quiz.cheer.3', 'quiz.cheer.4'];
const OP_LABEL = { '+': 'quiz.add', '-': 'quiz.sub', '×': 'quiz.times', '÷': 'quiz.divide' } as const;
const SIGN_WORDS = {
  '<': { aria: 'quiz.smallerThan', short: 'quiz.smaller' },
  '=': { aria: 'quiz.sameAs', short: 'quiz.same' },
  '>': { aria: 'quiz.biggerThan', short: 'quiz.bigger' },
} as const;
const SIGNS: CompareSign[] = ['<', '=', '>'];

export function fullFact(q: Question) {
  const { a, op, b, c } = q.fact;
  if (q.kind === 'compare') return `${a} ${opSymbol(op)} ${b} ${compareSign(c, q.than)} ${q.than}`;
  return `${a} ${opSymbol(op)} ${b} = ${c}`;
}

function shownAnswer(q: Question) {
  const ans = correctAnswer(q);
  return q.kind === 'compare' ? fullFact(q) : String(ans);
}

function label(q: Question) {
  switch (q.kind) {
    case 'missing':
      return t('quiz.missing');
    case 'choice':
      return t('quiz.choice');
    case 'compare':
      return t('quiz.compare');
    default:
      return t(OP_LABEL[q.fact.op]);
  }
}

function Prompt({ q, value, status }: { q: Question; value: string; status: Status }) {
  const { a, op, b, c } = q.fact;
  const slotCls = `slot ${status === 'right' ? 'right' : status === 'wrong1' || status === 'wrong2' ? 'wrong' : 'typing'}`;
  const slot = <span class={slotCls}>{value}</span>;
  const o = <span class="op">{opSymbol(op)}</span>;
  const eq = <span class="op">=</span>;
  // How many digits the line will show (the answer box included), so the CSS can fit it on one line.
  const digits = { '--digits': `${a}${b}${q.kind === 'compare' ? q.than : c}`.length };

  if (q.kind === 'story') {
    return (
      <>
        <div class="story">
          <span class="story-pic" aria-hidden="true">{q.story.emoji}</span>
          <p class="story-text">{t(`story.${q.story.id}.text`, { a, b })}</p>
        </div>
        <div class="story-ask">
          {t(`story.${q.story.id}.ask`)} {slot}
        </div>
      </>
    );
  }
  if (q.kind === 'missing') {
    return (
      <div class="equation" aria-live="polite" style={digits}>
        {q.hide === 'a' ? slot : <span>{a}</span>}
        {o}
        {q.hide === 'b' ? slot : <span>{b}</span>}
        {eq}
        <span>{c}</span>
      </div>
    );
  }
  if (q.kind === 'compare') {
    return (
      <div class="equation" aria-live="polite" style={digits}>
        <span>{a}</span>
        {o}
        <span>{b}</span>
        <span class={`${slotCls} sign`}>{value}</span>
        <span>{q.than}</span>
      </div>
    );
  }
  return (
    <div class="equation" aria-live="polite" style={digits}>
      <span>{a}</span>
      {o}
      <span>{b}</span>
      {eq}
      {slot}
    </div>
  );
}

export function Quiz({ questions, onDone, onQuit }: { questions: Question[]; onDone: (r: QuizResult) => void; onQuit: () => void }) {
  useT();
  const [items, setItems] = useState<Item[]>(() => questions.map((q) => ({ q, review: false })));
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('ask');
  const [tries, setTries] = useState(0);
  const [helped, setHelped] = useState(false);
  const [wrongPicks, setWrongPicks] = useState<Answer[]>([]);
  const [outcomes, setOutcomes] = useState<('ok' | 'miss')[]>([]);
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});
  const [explaining, setExplaining] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { q, review } = items[idx];
  const answer = correctAnswer(q);
  const usesPad = q.kind === 'type' || q.kind === 'story' || q.kind === 'missing';
  const isLast = idx === items.length - 1;

  function submit(given: Answer) {
    if (status !== 'ask') return;
    if (String(given) === String(answer)) {
      sounds.right();
      smallBurst(cardRef.current);
      setStatus('right');
      setInput(String(given));
      const clean = tries === 0 && !helped;
      if (!review) setFirstTry((f) => ({ ...f, [q.id]: clean }));
      setOutcomes((o) => [...o, clean ? 'ok' : 'miss']);
      if (!review && !clean) queueReview();
      return;
    }
    sounds.wrong();
    setWrongPicks((w) => [...w, given]);
    setInput(String(given));
    setTries((t) => t + 1);
    setStatus(tries === 0 ? 'wrong1' : 'wrong2');
    if (tries > 0) {
      if (!review) setFirstTry((f) => ({ ...f, [q.id]: false }));
      setOutcomes((o) => [...o, 'miss']);
      if (!review) queueReview();
    }
  }

  function queueReview() {
    setItems((list) => [...list, { q: { ...q, id: `${q.id}-again` }, review: true }]);
  }

  function next() {
    sounds.tap();
    if (isLast) {
      sounds.done();
      onDone({ questions, firstTry });
      return;
    }
    setIdx((i) => i + 1);
    setInput('');
    setStatus('ask');
    setTries(0);
    setHelped(false);
    setWrongPicks([]);
  }

  function tryAgain() {
    sounds.tap();
    setStatus('ask');
    setInput('');
  }

  function openHelp() {
    sounds.tap();
    if (status === 'ask') setHelped(true);
    setExplaining(true);
  }

  function closeHelp() {
    setExplaining(false);
    if (status === 'wrong1') tryAgain();
  }

  const press = (k: string) => {
    if (status !== 'ask') return;
    sounds.tap();
    if (k === 'back') setInput((v) => v.slice(0, -1));
    else if (k === 'clear') setInput('');
    else setInput((v) => (v.length < 3 ? (v === '0' ? k : v + k) : v));
  };

  // Keyboard support for laptops and tablets with keyboards.
  const keyRef = useRef<(e: KeyboardEvent) => void>(null);
  keyRef.current = (e: KeyboardEvent) => {
    if (explaining || quitting) return;
    if (status === 'ask') {
      if (usesPad && /^[0-9]$/.test(e.key)) press(e.key);
      else if (usesPad && e.key === 'Backspace') press('back');
      else if (usesPad && e.key === 'Enter' && input) submit(Number(input));
      else if (q.kind === 'compare' && SIGNS.includes(e.key as CompareSign)) submit(e.key as CompareSign);
      else if (q.kind === 'choice' && /^[1-4]$/.test(e.key)) submit(q.choices[Number(e.key) - 1]);
    } else if (e.key === 'Enter') {
      status === 'wrong1' ? tryAgain() : next();
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current?.(e);
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, []);

  const mood: Mood = status === 'right' ? 'happy' : status === 'ask' ? 'normal' : 'think';
  const bubble = t(status === 'right' ? CHEERS[idx % CHEERS.length] : status === 'ask' ? ENCOURAGE[idx % ENCOURAGE.length] : 'quiz.hmm');
  const mainCount = questions.length;
  const done = Math.min(idx, mainCount);

  return (
    <section class="screen">
      <header class="topbar">
        <button class="puffy icon-btn" aria-label={t('quiz.stop')} onClick={() => setQuitting(true)}>
          ✕
        </button>
        <ol class="dots" aria-label={t('quiz.progress', { n: Math.min(idx + 1, mainCount), total: mainCount })}>
          {items.map((it, i) => (
            <li key={it.q.id} class={`${it.review ? 'review' : ''} ${outcomes[i] ?? ''} ${i === idx ? 'now' : ''}`} />
          ))}
        </ol>
        <span class="count">{review ? t('quiz.again') : `${done + 1} / ${mainCount}`}</span>
      </header>

      <div class="quiz-body">
        <div class="q-pane">
          <div class="q-card" ref={cardRef}>
            {review ? <span class="review-tag">{t('quiz.oneMore')}</span> : <span class="tape" />}
            <Bunny mood={mood} class={`peek ${status === 'right' ? 'bounce' : ''}`} key={`${idx}-${status}`}>
              <span class="bubble">{bubble}</span>
            </Bunny>
            {q.kind !== 'story' && <p class="q-label">{label(q)}</p>}
            <Prompt q={q} value={usesPad ? input : status === 'ask' ? '' : input} status={status} />
            {status === 'ask' && (
              <div class="hint-row">
                <button class="puffy butter hint-btn" onClick={openHelp}>
                  {t('quiz.showMe')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div class="pad-pane">
          {usesPad && (
            <>
              <div class="pad">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((k) => (
                  <button key={k} class="puffy key" onClick={() => press(k)}>
                    {k}
                  </button>
                ))}
                <button class="puffy key side" aria-label={t('quiz.delete')} onClick={() => press('back')}>
                  ⌫
                </button>
                <button class="puffy key" onClick={() => press('0')}>
                  0
                </button>
                <button class="puffy key side" onClick={() => press('clear')}>
                  {t('quiz.clear')}
                </button>
              </div>
              <button class="puffy berry check" disabled={!input || status !== 'ask'} onClick={() => submit(Number(input))}>
                {t('quiz.check')}
              </button>
            </>
          )}
          {q.kind === 'choice' && (
            <div class="choices">
              {q.choices.map((n) => {
                const wrong = wrongPicks.includes(n);
                const right = status === 'right' && n === answer;
                return (
                  <button key={n} class={`puffy choice ${wrong ? 'picked-wrong' : ''} ${right ? 'picked-right' : ''}`} disabled={wrong || status !== 'ask'} onClick={() => submit(n)}>
                    {n}
                  </button>
                );
              })}
            </div>
          )}
          {q.kind === 'compare' && (
            <div class="choices signs">
              {SIGNS.map((s) => {
                const wrong = wrongPicks.includes(s);
                const right = status === 'right' && s === answer;
                return (
                  <button key={s} class={`puffy choice ${wrong ? 'picked-wrong' : ''} ${right ? 'picked-right' : ''}`} disabled={wrong || status !== 'ask'} onClick={() => submit(s)} aria-label={t(SIGN_WORDS[s].aria)}>
                    {s}
                    <small>{t(SIGN_WORDS[s].short)}</small>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {status === 'right' && (
        <div class="feedback good" role="status">
          <Bunny mood="happy" class="fb-face" />
          <div class="fb-text">
            <p class="fb-title">{t(CHEERS[idx % CHEERS.length])} ⭐</p>
            <p class="fb-sub">{fullFact(q)}</p>
          </div>
          <div class="fb-actions">
            <button class="puffy mint" onClick={next} autoFocus>
              {t(isLast ? 'quiz.seeStars' : 'quiz.next')}
            </button>
          </div>
        </div>
      )}
      {status === 'wrong1' && (
        <div class="feedback bad" role="status">
          <Bunny mood="think" class="fb-face" />
          <div class="fb-text">
            <p class="fb-title">{t('quiz.soClose')}</p>
            <p class="fb-sub">{t('quiz.oneMoreGo')}</p>
          </div>
          <div class="fb-actions">
            <button class="puffy butter" onClick={openHelp}>
              {t('quiz.showMe')}
            </button>
            <button class="puffy berry" onClick={tryAgain} autoFocus>
              {t('quiz.tryAgain')}
            </button>
          </div>
        </div>
      )}
      {status === 'wrong2' && (
        <div class="feedback bad" role="status">
          <Bunny mood="think" class="fb-face" />
          <div class="fb-text">
            <p class="fb-title">{t('quiz.answerIs', { answer: shownAnswer(q) })}</p>
            <p class="fb-sub">{t(review ? 'quiz.lookHow' : 'quiz.tryLater')}</p>
          </div>
          <div class="fb-actions">
            <button class="puffy butter" onClick={openHelp}>
              {t('quiz.showMe')}
            </button>
            <button class="puffy berry" onClick={next} autoFocus>
              {t(isLast ? 'quiz.seeStars' : 'quiz.next')}
            </button>
          </div>
        </div>
      )}

      {explaining && <ExplainSheet question={q} onClose={closeHelp} />}

      {quitting && (
        <div class="scrim">
          <div class="dialog" role="alertdialog" aria-modal="true" aria-label={t('quiz.stopTitle')}>
            <Bunny mood="think" />
            <h2>{t('quiz.stopTitle')}</h2>
            <p>{t('quiz.stopBody')}</p>
            <div class="dialog-actions">
              <button class="puffy" onClick={onQuit}>
                {t('quiz.stopYes')}
              </button>
              <button class="puffy berry" onClick={() => setQuitting(false)} autoFocus>
                {t('quiz.keepGoing')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
