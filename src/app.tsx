import { useEffect, useState } from 'preact/hooks';
import { Adventure } from './components/Adventure';
import { ExplainPref } from './components/Explain';
import { Leaderboard, NamePicker } from './components/Leaderboard';
import { Home } from './components/Home';
import { ModePick } from './components/ModePick';
import { Quiz, type QuizResult } from './components/Quiz';
import { Results, starsFor } from './components/Results';
import { Stickers } from './components/Stickers';
import { Worksheet } from './components/Worksheet';
import { activate, browserLangs, detectLang, isLang, LangContext, t, type Lang } from './i18n';
import { codeFromUrl, encodeCode, shareSeed, type ShareCode } from './lib/codes';
import { generateQuiz, nextLevel } from './lib/generator';
import { flush, submitRun } from './lib/leaderboard';
import { randomSeed } from './lib/rng';
import { depthFor, type Run } from './lib/run';
import { setAdventureSounds, setSound } from './lib/sound';
import { load, recordRun, save, STICKERS, type Saved } from './lib/storage';
import type { LevelId, Mode, Question, Skill } from './lib/types';

type Screen =
  | { name: 'mode' }
  | { name: 'home' }
  | { name: 'quiz'; questions: Question[]; key: number; practice: boolean; code: string | null; level: LevelId }
  | { name: 'results'; result: QuizResult; sticker: string | null; code: string | null }
  | { name: 'adventure'; level: LevelId; seed: number; depth: number; code: string; fromCode: boolean; key: number }
  | { name: 'leaderboard' }
  | { name: 'name' }
  | { name: 'stickers' }
  | { name: 'print' };

/** A ?seed=123 link always gives the same first quiz, handy for siblings racing each other. */
const urlSeed = Number(new URLSearchParams(location.search).get('seed')) || null;
/** A ?lang=fr link (from the worksheet pages) opens in that language, until the child picks one. It is never saved. */
const urlLang = new URLSearchParams(location.search).get('lang');
/** A ?code=🍓🦄🌙🐱🌸 link opens the "Have a code?" box on Home, ready to play. */
const urlCode = codeFromUrl();
// Tidy the address bar, so a reload or a bookmark doesn't replay the code.
if (urlCode || urlLang) {
  const url = new URL(location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('lang');
  history.replaceState(null, '', url);
}

export function App() {
  const [saved, setSaved] = useState<Saved>(load);
  // First visit: choose what to practice before anything else.
  const [screen, setScreen] = useState<Screen>(() => ({ name: saved.mode ? 'home' : 'mode' }));
  // Follow the browser's language until the child picks one. The detected language is never
  // saved, so changing the device language later still works until a manual pick.
  const [pendingCode, setPendingCode] = useState(urlCode?.text);
  const [detected, setDetected] = useState<Lang>(() => (isLang(urlLang) ? urlLang : detectLang(browserLangs())));
  const lang = saved.lang ?? detected;
  // Set before the children render, so every t() call below uses the new language.
  activate(lang);
  const mode: Mode = saved.mode ?? 'plus';
  const level = saved.levelFor[mode];

  useEffect(() => {
    save(saved);
    setSound(saved.sound);
    setAdventureSounds(saved.adventure);
  }, [saved]);

  // Night falls in Adventure (the switch on Home, and every Adventure screen).
  // Set while rendering (like the language) so a reload in Adventure never flashes the day look first.
  document.documentElement.toggleAttribute('data-night', saved.adventure && screen.name !== 'print');

  // Runs played offline are sent the next time the app opens.
  useEffect(() => {
    void flush();
  }, []);

  useEffect(() => {
    const onChange = () => setDetected(detectLang(browserLangs()));
    addEventListener('languagechange', onChange);
    return () => removeEventListener('languagechange', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('app.title');
  }, [lang]);

  const update = (patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch }));
  const setLevel = (l: LevelId) => setSaved((s) => ({ ...s, levelFor: { ...s.levelFor, [mode]: l } }));

  function startQuiz(opts: { level?: LevelId; skills?: Skill[]; count?: number; seed?: number } = {}) {
    const lvl = opts.level ?? level;
    const count = opts.count ?? saved.length;
    const practice = !!opts.skills;
    // Full quizzes use a seed small enough to share as a code. An old ?seed= link still works, without a code.
    const legacy = screen.name === 'home' && urlSeed && !practice && opts.seed === undefined ? urlSeed : null;
    const seed = opts.seed ?? legacy ?? (practice ? randomSeed() : shareSeed());
    const questions = generateQuiz({ level: lvl, count, seed, skills: opts.skills });
    const code = practice || legacy ? null : encodeCode({ adventure: false, level: lvl, length: count, seed });
    setScreen({ name: 'quiz', questions, key: Date.now(), practice, code, level: lvl });
  }

  function startAdventure(opts: { level?: LevelId; seed?: number; depth?: number; fromCode?: boolean } = {}) {
    const lvl = opts.level ?? level;
    const seed = opts.seed ?? shareSeed();
    const depth = opts.depth ?? depthFor(saved.adv.runsPlayed, saved.adv.wins);
    const code = encodeCode({ adventure: true, level: lvl, depth, seed });
    setScreen({ name: 'adventure', level: lvl, seed, depth, code, fromCode: !!opts.fromCode, key: Date.now() });
  }

  function playCode(c: ShareCode) {
    setPendingCode(undefined);
    if (c.adventure) {
      if (!saved.adventure) update({ adventure: true });
      startAdventure({ level: c.level, seed: c.seed, depth: c.depth, fromCode: true });
    } else startQuiz({ level: c.level, count: c.length, seed: c.seed });
  }

  function finishAdventure(run: Run, code: string) {
    const seen = new Set(saved.adv.seen);
    if (run.features.treats) seen.add('treats');
    if (run.features.paths) seen.add('paths');
    if (run.features.rascalHearts > 3) seen.add('tough');
    setSaved((s) => ({
      ...s,
      adv: { ...recordRun(s.adv, { code, carrots: run.carrots, won: run.stage.kind === 'won', meadowsCleared: run.meadowsCleared }), seen: [...seen] },
    }));
    return submitRun({ code, level: run.level, carrots: run.carrots });
  }

  function finish(result: QuizResult, practice: boolean, code: string | null, quizLevel: LevelId) {
    const right = result.questions.filter((q) => result.firstTry[q.id]).length;
    const stars = starsFor(right, result.questions.length);
    const unowned = STICKERS.filter((s) => !saved.stickers.includes(s));
    const sticker = unowned.length ? unowned[Math.floor(Math.random() * unowned.length)] : null;
    // "Practice more" rounds only ask the skills that were missed, so they don't count towards the level's best.
    // A friend's code may be for another level or mode: only the child's own level counts towards its best.
    const isFullQuiz = !practice && quizLevel === level;
    setSaved((s) => ({
      ...s,
      stickers: sticker ? [...s.stickers, sticker] : s.stickers,
      best: isFullQuiz ? { ...s.best, [level]: Math.max(s.best[level] ?? 0, stars) } : s.best,
    }));
    setScreen({ name: 'results', result, sticker, code });
  }

  const next = nextLevel(level);
  const body = (() => {
    switch (screen.name) {
      case 'mode':
        return (
          <ModePick
            current={saved.mode}
            lang={lang}
            onLang={(l) => update({ lang: l })}
            onPick={(m) => {
              update({ mode: m });
              setScreen({ name: 'home' });
            }}
          />
        );
      case 'home':
        return (
          <Home
            saved={saved}
            mode={mode}
            level={level}
            lang={lang}
            onLang={(l) => update({ lang: l })}
            onLevel={setLevel}
            onChange={update}
            onStart={() => (saved.adventure ? startAdventure() : startQuiz())}
            onBoard={() => setScreen({ name: 'leaderboard' })}
            onCode={playCode}
            pendingCode={pendingCode}
            onCodeClosed={() => setPendingCode(undefined)}
            onMode={() => setScreen({ name: 'mode' })}
            onStickers={() => setScreen({ name: 'stickers' })}
            onPrint={() => setScreen({ name: 'print' })}
          />
        );
      case 'quiz':
        return <Quiz key={screen.key} questions={screen.questions} onDone={(r) => finish(r, screen.practice, screen.code, screen.level)} onQuit={() => setScreen({ name: 'home' })} />;
      case 'results':
        return (
          <Results
            result={screen.result}
            sticker={screen.sticker}
            code={screen.code}
            canLevelUp={next !== null}
            onHome={() => setScreen({ name: 'home' })}
            onAgain={() => startQuiz()}
            onPractice={(skills) => startQuiz({ skills, count: 10 })}
            onNextLevel={() => {
              if (next === null) return;
              setLevel(next);
              startQuiz({ level: next });
            }}
          />
        );
      case 'adventure': {
        const sc = screen;
        return (
          <Adventure
            key={sc.key}
            level={sc.level}
            seed={sc.seed}
            depth={sc.depth}
            code={sc.code}
            fromCode={sc.fromCode}
            seen={saved.adv.seen}
            best={saved.adv.bestByCode[sc.code] ?? 0}
            jar={saved.adv.jar}
            onFinish={(run) => finishAdventure(run, sc.code)}
            onHome={() => setScreen({ name: 'home' })}
            onRematch={() => startAdventure({ level: sc.level, seed: sc.seed, depth: sc.depth, fromCode: sc.fromCode })}
            onNew={() => startAdventure()}
            onPractice={(lvl, skills) => startQuiz({ level: lvl, skills, count: 10 })}
          />
        );
      }
      case 'leaderboard':
        return <Leaderboard onBack={() => setScreen({ name: 'home' })} onName={() => setScreen({ name: 'name' })} />;
      case 'name':
        return <NamePicker onDone={() => setScreen({ name: 'leaderboard' })} />;
      case 'stickers':
        return <Stickers owned={saved.stickers} onBack={() => setScreen({ name: 'home' })} />;
      case 'print':
        return <Worksheet level={level} count={saved.length} onBack={() => setScreen({ name: 'home' })} />;
    }
  })();

  return (
    <LangContext.Provider value={lang}>
      <ExplainPref.Provider value={{ style: saved.explain, setStyle: (explain) => update({ explain }) }}>{body}</ExplainPref.Provider>
    </LangContext.Provider>
  );
}
