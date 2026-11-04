import { useEffect, useRef, useState } from 'preact/hooks';
import { t, tn, useT, type MessageKey } from '../i18n';
import { bigParty, smallBurst } from '../lib/celebrate';
import { MEADOWS } from '../lib/carrots';
import { correctAnswer } from '../lib/generator';
import type { Posted } from '../lib/leaderboard';
import {
  answer, BAG_SIZE, canUse, choosePath, current, isOver, perfectEarned, pickTreat, practiceFor, preview, startRun, useTreat,
  type Gain, type Outcome, type Run, type Treat,
} from '../lib/run';
import { sounds } from '../lib/sound';
import type { Answer, CompareSign, LevelId, Question, Skill } from '../lib/types';
import { ExplainSheet } from './Explain';
import { AnswerPad, fullFact, label, Prompt, shownAnswer, SIGNS, type Status } from './Quiz';
import { Rascal, type RascalMood } from './Rascal';
import { ShareCode } from './Share';

const pickLine = (keys: MessageKey[], i: number) => t(keys[i % keys.length]);
const ASK: MessageKey[] = ['adv.ask.0', 'adv.ask.1', 'adv.ask.2', 'adv.ask.3'];
const TEASE: MessageKey[] = ['adv.tease.0', 'adv.tease.1', 'adv.tease.2', 'adv.tease.3'];
const GRUMBLE: MessageKey[] = ['adv.grumble.0', 'adv.grumble.1', 'adv.grumble.2', 'adv.grumble.3'];
const HIT: MessageKey[] = ['adv.sd.hit.0', 'adv.sd.hit.1', 'adv.sd.hit.2'];
const TREAT_ICON: Record<Treat, string> = { clover: '🍀', cake: '🍰', magnifier: '🔍' };

function clue(q: Question): string {
  if (q.kind === 'compare') return t('adv.clue.compare');
  if (q.kind === 'missing') return t('adv.clue.missing');
  return t(({ '+': 'adv.clue.add', '-': 'adv.clue.sub', '×': 'adv.clue.times', '÷': 'adv.clue.divide' } as const)[q.fact.op]);
}

/** Wrong answers the magnifier takes away: two of the four choices, or one of the three signs. */
function magnified(q: Question): Answer[] {
  const right = correctAnswer(q);
  if (q.kind === 'choice') return q.choices.filter((n) => n !== right).slice(0, 2);
  if (q.kind === 'compare') return SIGNS.filter((s) => s !== right).slice(0, 1);
  return [];
}

type Props = {
  level: LevelId;
  seed: number;
  depth: number;
  code: string;
  /** Playing someone else's code. */
  fromCode: boolean;
  /** Features already met, so the intro only points out new ones. */
  seen: string[];
  best: number;
  jar: number;
  onFinish: (run: Run) => Promise<Posted | null>;
  onHome: () => void;
  onRematch: () => void;
  onNew: () => void;
  onPractice: (level: LevelId, skills: Skill[]) => void;
};

type Banner = { kind: 'showdown'; meadow: number; rascal: number } | { kind: 'meadowWon'; perfect: number };

export function Adventure(props: Props) {
  useT();
  const [run, setRun] = useState<Run>(() => startRun(props));
  const [intro, setIntro] = useState(true);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [posted, setPosted] = useState<Posted | null | 'waiting'>('waiting');
  /** The stop dialog is open; `pending` is an answer whose result is on screen but not yet applied. */
  const [quitting, setQuitting] = useState<{ pending: Outcome | null } | null>(null);
  // The best and the jar from before this run (the app updates them once it ends).
  const [start] = useState(() => ({ best: props.best, jar: props.jar }));

  function apply(outcome: Outcome) {
    const before = run;
    const after = answer(run, outcome);
    if (before.stage.kind === 'meadow' && after.stage.kind === 'showdown') {
      sounds.pop();
      setBanner({ kind: 'showdown', meadow: after.stage.meadow, rascal: after.stage.rascal });
    } else if (before.stage.kind === 'showdown' && after.stage.kind !== 'showdown' && after.stage.kind !== 'lost') {
      setBanner({ kind: 'meadowWon', perfect: perfectEarned(before) });
    }
    setRun(after);
  }

  /** Stops the run. An answer already shown on screen (its carrots, or a lost heart) still counts. */
  function stop(pending: Outcome | null) {
    const r = pending ? answer(run, pending) : run;
    setRun(isOver(r) ? r : { ...r, stage: { kind: 'lost' } });
  }

  // Report the run once, when it ends.
  const reported = useRef(false);
  useEffect(() => {
    if (!isOver(run) || reported.current) return;
    reported.current = true;
    if (run.stage.kind === 'won') {
      sounds.done();
      bigParty();
    } else sounds.wrong();
    props.onFinish(run).then(setPosted, () => setPosted(null));
  }, [run]);

  if (intro) return <Intro {...props} run={run} onGo={() => { sounds.tap(); setIntro(false); }} />;
  if (isOver(run) && !banner) return <End {...props} best={start.best} jar={start.jar + run.carrots} run={run} posted={posted} />;

  const s = run.stage;
  let body;
  if (s.kind === 'rest') body = <Rest run={run} onPick={(tr) => { sounds.tap(); setRun(pickTreat(run, tr)); }} />;
  else if (s.kind === 'doors') body = <Doors onPick={(p) => { sounds.tap(); setRun(choosePath(run, p)); }} />;
  else {
    const cur = current(run);
    body = cur ? <Ask key={cur.key} run={run} onAnswer={apply} onTreat={(tr) => setRun(useTreat(run, tr))} onQuit={(pending) => setQuitting({ pending })} /> : null;
  }

  return (
    <>
      {body}
      {banner && <BannerCard banner={banner} onGo={() => { sounds.tap(); setBanner(null); }} />}
      {quitting && (
        <div class="scrim">
          <div class="dialog" role="alertdialog" aria-modal="true" aria-label={t('adv.stopTitle')}>
            <Rascal mood="smirk" />
            <h2>{t('adv.stopTitle')}</h2>
            <p>{t('adv.stopBody')}</p>
            <div class="dialog-actions">
              <button class="puffy" onClick={() => { stop(quitting.pending); setQuitting(null); }}>
                {t('adv.stopYes')}
              </button>
              <button class="puffy berry" onClick={() => setQuitting(null)} autoFocus>
                {t('quiz.keepGoing')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Intro ---------- */

function Intro({ run, fromCode, seen, onGo }: Props & { run: Run; onGo: () => void }) {
  const f = run.features;
  const news: MessageKey[] = [];
  if (fromCode) news.push('adv.intro.code');
  if (f.treats && !seen.includes('treats')) news.push('adv.intro.treats');
  if (f.paths && !seen.includes('paths')) news.push('adv.intro.paths');
  if (f.rascalHearts > 3 && !seen.includes('tough')) news.push('adv.intro.tough');
  return (
    <section class="screen adv-center">
      <div class="adv-intro">
        <Rascal mood="smirk" class="big" />
        <h1 class="adv-title">{t('adv.intro.title')}</h1>
        <p class="adv-text">{t('adv.intro.body')}</p>
        {news.map((k) => (
          <p key={k} class="adv-new">
            <span class="new-tag">{t('adv.new')}</span> {t(k)}
          </p>
        ))}
        <button class="puffy berry start" onClick={onGo} autoFocus>
          {t('adv.intro.go')}
        </button>
      </div>
    </section>
  );
}

/* ---------- Hearts, carrots and the map ---------- */

function Hearts({ n }: { n: number }) {
  const slots = Math.max(3, n);
  return (
    <span class="hearts" role="img" aria-label={tn('adv.hearts', n)}>
      {Array.from({ length: slots }, (_, i) => (
        <span key={i} class={i < n ? 'full' : 'empty'}>
          {i < n ? '❤️' : '🤍'}
        </span>
      ))}
    </span>
  );
}

function MeadowMap({ meadow, showdown }: { meadow: number; showdown: boolean }) {
  return (
    <ol class="meadow-map" aria-label={t('adv.meadow', { n: meadow + 1, total: MEADOWS })}>
      {Array.from({ length: MEADOWS }, (_, i) => (
        <li key={i} class={i < meadow ? 'done' : i === meadow ? (showdown ? 'now fight' : 'now') : ''}>
          {i < meadow ? '✓' : i + 1}
        </li>
      ))}
    </ol>
  );
}

/* ---------- One question ---------- */

function Ask({ run, onAnswer, onTreat, onQuit }: { run: Run; onAnswer: (o: Outcome) => void; onTreat: (t: Treat) => void; onQuit: (pending: Outcome | null) => void }) {
  const cur = current(run)!;
  const { q, comeback, showdown } = cur;
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('ask');
  const [tries, setTries] = useState(0);
  const [helped, setHelped] = useState(false);
  const [wrongPicks, setWrongPicks] = useState<Answer[]>([]);
  const [hidden, setHidden] = useState<Answer[]>([]);
  const [explaining, setExplaining] = useState(false);
  const [done, setDone] = useState<{ outcome: Outcome; gain: Gain } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const right = correctAnswer(q);
  const usesPad = q.kind === 'type' || q.kind === 'story' || q.kind === 'missing';
  const s = run.stage;
  const n = s.kind === 'meadow' ? s.idx : s.kind === 'showdown' ? s.idx : 0;

  function submit(given: Answer) {
    if (status !== 'ask') return;
    if (String(given) === String(right)) {
      const outcome: Outcome = tries > 0 ? 'second' : helped ? 'helped' : 'first';
      const gain = preview(run, outcome);
      gain.hit ? sounds.hit() : sounds.right();
      smallBurst(cardRef.current);
      setStatus('right');
      setInput(String(given));
      setDone({ outcome, gain });
      return;
    }
    setWrongPicks((w) => [...w, given]);
    setInput(String(given));
    setTries((x) => x + 1);
    if (tries === 0) {
      sounds.wrong();
      setStatus('wrong1');
      return;
    }
    const gain = preview(run, 'fail');
    gain.heartLost ? sounds.heart() : sounds.wrong();
    setStatus('wrong2');
    setDone({ outcome: 'fail', gain });
  }

  function next() {
    sounds.tap();
    if (done) onAnswer(done.outcome);
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

  function use(tr: Treat) {
    if (status !== 'ask' || !canUse(run, tr)) return;
    sounds.pop();
    if (tr === 'magnifier') setHidden(magnified(q));
    onTreat(tr);
  }

  const press = (k: string) => {
    if (status !== 'ask') return;
    sounds.tap();
    if (k === 'back') setInput((v) => v.slice(0, -1));
    else if (k === 'clear') setInput('');
    else setInput((v) => (v.length < 3 ? (v === '0' ? k : v + k) : v));
  };

  // Keyboard support, the same keys as a quiz.
  const keyRef = useRef<(e: KeyboardEvent) => void>(null);
  keyRef.current = (e: KeyboardEvent) => {
    if (explaining || document.querySelector('.scrim')) return;
    if (e.key === 'Enter') {
      const btn = e.target instanceof Element ? e.target.closest('button') : null;
      if (btn && !btn.closest('.pad')) return;
      e.preventDefault();
    }
    if (status === 'ask') {
      if (usesPad && /^[0-9]$/.test(e.key)) press(e.key);
      else if (usesPad && e.key === 'Backspace') press('back');
      else if (usesPad && e.key === 'Enter' && input) submit(Number(input));
      else if (q.kind === 'compare' && SIGNS.includes(e.key as CompareSign) && !hidden.includes(e.key as CompareSign)) submit(e.key as CompareSign);
      else if (q.kind === 'choice' && /^[1-4]$/.test(e.key)) {
        const pick = q.choices[Number(e.key) - 1];
        if (!hidden.includes(pick)) submit(pick);
      }
    } else if (e.key === 'Enter') {
      status === 'wrong1' ? tryAgain() : next();
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current?.(e);
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, []);

  // What the top bar shows: the answer just given counts straight away.
  const gain = done?.gain;
  const hearts = run.hearts - (gain?.heartLost ? 1 : 0);
  const carrots = run.carrots + (gain?.carrots ?? 0);
  const rascal = s.kind === 'showdown' ? s.rascal - (gain?.hit ? 1 : 0) : 0;
  const meadow = s.kind === 'meadow' || s.kind === 'showdown' ? s.meadow : 0;

  const mood: RascalMood = status === 'right' ? (gain?.hit ? 'dizzy' : 'sulk') : status === 'ask' ? 'smirk' : 'laugh';
  const bubble =
    status === 'right' ? pickLine(gain?.hit ? HIT : GRUMBLE, n) : status === 'wrong1' ? pickLine(TEASE, n) : status === 'wrong2' ? t('adv.win', { answer: shownAnswer(q) }) : pickLine(ASK, n);

  return (
    <section class={`screen adv ${showdown ? 'showdown' : ''}`}>
      <header class="topbar adv-hud">
        <button class="puffy icon-btn" aria-label={t('adv.stop')} onClick={() => onQuit(done?.outcome ?? null)}>
          ✕
        </button>
        <Hearts n={hearts} />
        <MeadowMap meadow={meadow} showdown={showdown} />
        <span class="carrot-count" aria-label={tn('adv.carrots', carrots)}>
          🥕 {carrots}
        </span>
      </header>

      {showdown && s.kind === 'showdown' && (
        <div class="rascal-bar" role="img" aria-label={tn('adv.rascalHearts', rascal)}>
          <Rascal mood={mood} class="tiny" />
          {Array.from({ length: s.rascalMax }, (_, i) => (
            <span key={i} class={i < rascal ? 'full' : 'empty'}>
              {i < rascal ? '💜' : '🤍'}
            </span>
          ))}
        </div>
      )}

      <div class="quiz-body">
        <div class="q-pane">
          <div class="q-card" ref={cardRef}>
            {comeback ? <span class="review-tag">{t('adv.again')}</span> : <span class="tape" />}
            <Rascal mood={mood} class={`peek ${status === 'right' ? 'bounce' : status === 'wrong1' || status === 'wrong2' ? 'shake' : ''}`} key={`${n}-${status}`}>
              <span class="bubble">{bubble}</span>
            </Rascal>
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
          {run.features.treats && run.bag.length > 0 && (
            <div class="bag" role="group" aria-label={t('adv.bag')}>
              {run.bag.map((tr, i) => (
                <button key={`${tr}-${i}`} class="puffy treat-btn" disabled={status !== 'ask' || !canUse(run, tr)} aria-label={t('adv.use', { treat: t(`adv.treat.${tr}`) })} onClick={() => use(tr)}>
                  {TREAT_ICON[tr]}
                </button>
              ))}
              {run.clover && <span class="clover-on" aria-label={t('adv.treat.clover.desc')}>🍀</span>}
            </div>
          )}
        </div>
        <div class="pad-pane">
          <AnswerPad q={q} input={input} status={status} wrongPicks={wrongPicks} hidden={hidden} onPress={press} onSubmit={submit} />
        </div>
      </div>

      {status === 'right' && gain && (
        <div class="feedback good" role="status">
          <Rascal mood={mood} class="fb-face" />
          <div class="fb-text">
            <p class="fb-title">{bubble}</p>
            <p class="fb-sub">
              {fullFact(q)} <span class="gain">{t('adv.gain', { n: gain.carrots })}</span>
              {gain.streakBonus > 0 && <span class="gain streak">{t('adv.streak', { n: run.streak + 1 })}</span>}
            </p>
          </div>
          <div class="fb-actions">
            <button class="puffy mint" onClick={next} autoFocus>
              {t('quiz.next')}
            </button>
          </div>
        </div>
      )}
      {status === 'wrong1' && (
        <div class="feedback bad" role="status">
          <Rascal mood="laugh" class="fb-face" />
          <div class="fb-text">
            <p class="fb-title">{bubble}</p>
            <p class="fb-sub">{clue(q)}</p>
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
      {status === 'wrong2' && gain && (
        <div class="feedback bad" role="status">
          <Rascal mood="laugh" class="fb-face" />
          <div class="fb-text">
            <p class="fb-title">{bubble}</p>
            <p class="fb-sub">
              {t(comeback || showdown ? 'adv.winShow' : 'adv.winLater')}{' '}
              {gain.heartLost && <span class="gain lost">{t('adv.heartLost')}</span>}
              {gain.saved && <span class="gain">{t('adv.saved')}</span>}
            </p>
          </div>
          <div class="fb-actions">
            <button class="puffy butter" onClick={openHelp}>
              {t('quiz.showMe')}
            </button>
            <button class="puffy berry" onClick={next} autoFocus>
              {t('quiz.next')}
            </button>
          </div>
        </div>
      )}

      {explaining && <ExplainSheet question={q} onClose={closeHelp} />}
    </section>
  );
}

/* ---------- Between meadows ---------- */

function BannerCard({ banner, onGo }: { banner: Banner; onGo: () => void }) {
  const fight = banner.kind === 'showdown';
  return (
    <div class="scrim night">
      <div class="dialog adv-banner" role="alertdialog" aria-modal="true" aria-label={t(fight ? 'adv.sd.title' : 'adv.sd.won')}>
        <Rascal mood={fight ? 'smirk' : 'sulk'} class={fight ? 'pop-in' : ''} />
        <h2>{t(fight ? 'adv.sd.title' : 'adv.sd.won')}</h2>
        {fight ? <p>{tn('adv.sd.body', banner.rascal)}</p> : banner.perfect > 0 ? <p class="gain">{t('adv.perfect', { n: banner.perfect })}</p> : null}
        <div class="dialog-actions">
          <button class="puffy berry" onClick={onGo} autoFocus>
            {t(fight ? 'adv.sd.go' : 'quiz.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Rest({ run, onPick }: { run: Run; onPick: (t: Treat | null) => void }) {
  if (run.stage.kind !== 'rest') return null;
  const full = run.bag.length >= BAG_SIZE;
  return (
    <section class="screen adv-center">
      <div class="adv-panel">
        <h1 class="adv-title">⛺ {t('adv.rest.title')}</h1>
        <p class="adv-text">{t(full ? 'adv.rest.full' : 'adv.rest.body')}</p>
        <Hearts n={run.hearts} />
        <div class="treats">
          {run.stage.offer.map((tr) => (
            <button key={tr} class="puffy treat" disabled={full} onClick={() => onPick(tr)}>
              <span class="treat-icon" aria-hidden="true">{TREAT_ICON[tr]}</span>
              <b>{t(`adv.treat.${tr}`)}</b>
              <small>{t(`adv.treat.${tr}.desc`)}</small>
            </button>
          ))}
        </div>
        <button class={`puffy ${full ? 'berry' : ''}`} onClick={() => onPick(null)}>
          {full ? t('quiz.next') : t('adv.rest.skip')}
        </button>
      </div>
    </section>
  );
}

function Doors({ onPick }: { onPick: (p: 'sunny' | 'tricky') => void }) {
  return (
    <section class="screen adv-center">
      <div class="adv-panel">
        <h1 class="adv-title">{t('adv.doors.title')}</h1>
        <div class="doors">
          <button class="puffy door sunny" onClick={() => onPick('sunny')}>
            <b>{t('adv.doors.sunny')}</b>
            <small>{t('adv.doors.sunnyDesc')}</small>
          </button>
          <button class="puffy door tricky" onClick={() => onPick('tricky')}>
            <b>{t('adv.doors.tricky')}</b>
            <small>{t('adv.doors.trickyDesc')}</small>
          </button>
        </div>
        <Rascal mood="smirk" class="peek-low">
          <span class="bubble">{t('adv.doors.rascal')}</span>
        </Rascal>
      </div>
    </section>
  );
}

/* ---------- The end ---------- */

function End({ run, code, best, jar, posted, onHome, onRematch, onNew, onPractice }: Props & { run: Run; posted: Posted | null | 'waiting' }) {
  const won = run.stage.kind === 'won';
  const practice = practiceFor(run);
  const rank = posted && posted !== 'waiting' ? posted : null;
  const movedUp = rank && rank.was !== undefined && rank.rank < rank.was;
  return (
    <section class="screen adv-center">
      <header class="topbar">
        <button class="puffy icon-btn" aria-label={t('res.home')} onClick={onHome}>
          🏠
        </button>
      </header>
      <div class="adv-panel adv-end">
        <Rascal mood={won ? 'sulk' : 'laugh'} class="big">
          <span class="bubble">{t(won ? 'adv.won.rascal' : 'adv.lost.rascal')}</span>
        </Rascal>
        <h1 class="adv-title">{t(won ? 'adv.won.title' : 'adv.lost.title')}</h1>
        <p class="end-carrots">{t('adv.end.carrots', { n: run.carrots })}</p>
        <p class="adv-text">
          {t('adv.end.meadows', { n: run.meadowsCleared, total: MEADOWS })} · {t('adv.end.jar', { n: jar })}
        </p>
        {rank && (
          <p class="rank-strip">
            {movedUp ? t('adv.end.rankUp', { rank: rank.rank }) : t('adv.end.rank', { rank: rank.rank })}
            {movedUp && <span class="up"> ▲ {rank.was! - rank.rank}</span>}
          </p>
        )}
        {best > 0 && <p class="adv-text small">{t('adv.end.best', { n: Math.max(best, run.carrots) })}</p>}
        <ShareCode code={code} text={t('share.advText', { n: run.carrots, code })} />
        <div class="res-actions">
          {!won && practice && (
            <button class="puffy butter" onClick={() => onPractice(practice.level, practice.skills)}>
              {t('adv.end.practice', { skill: t(`skill.${practice.skills[0]}`) })}
            </button>
          )}
          <button class="puffy berry" onClick={onRematch}>
            {t('adv.end.rematch')}
          </button>
          <button class="puffy" onClick={onNew}>
            {t('adv.end.new')}
          </button>
          <button class="puffy" onClick={onHome}>
            <span aria-hidden="true">🏠</span> {t('res.home')}
          </button>
        </div>
      </div>
    </section>
  );
}
