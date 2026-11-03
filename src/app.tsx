import { useEffect, useState } from 'preact/hooks';
import { ExplainPref } from './components/Explain';
import { Home } from './components/Home';
import { ModePick } from './components/ModePick';
import { Quiz, type QuizResult } from './components/Quiz';
import { Results, starsFor } from './components/Results';
import { Stickers } from './components/Stickers';
import { Worksheet } from './components/Worksheet';
import { activate, browserLangs, detectLang, LangContext, t, type Lang } from './i18n';
import { generateQuiz, nextLevel } from './lib/generator';
import { randomSeed } from './lib/rng';
import { setSound } from './lib/sound';
import { load, save, STICKERS, type Saved } from './lib/storage';
import type { LevelId, Mode, Question, Skill } from './lib/types';

type Screen =
  | { name: 'mode' }
  | { name: 'home' }
  | { name: 'quiz'; questions: Question[]; key: number }
  | { name: 'results'; result: QuizResult; sticker: string | null }
  | { name: 'stickers' }
  | { name: 'print' };

/** A ?seed=123 link always gives the same first quiz, handy for siblings racing each other. */
const urlSeed = Number(new URLSearchParams(location.search).get('seed')) || null;

export function App() {
  const [saved, setSaved] = useState<Saved>(load);
  // First visit: choose what to practice before anything else.
  const [screen, setScreen] = useState<Screen>(() => ({ name: saved.mode ? 'home' : 'mode' }));
  // Follow the browser's language until the child picks one. The detected language is never
  // saved, so changing the device language later still works until a manual pick.
  const [detected, setDetected] = useState<Lang>(() => detectLang(browserLangs()));
  const lang = saved.lang ?? detected;
  // Set before the children render, so every t() call below uses the new language.
  activate(lang);
  const mode: Mode = saved.mode ?? 'plus';
  const level = saved.levelFor[mode];

  useEffect(() => {
    save(saved);
    setSound(saved.sound);
  }, [saved]);

  useEffect(() => {
    const onChange = () => setDetected(detectLang(browserLangs()));
    addEventListener('languagechange', onChange);
    return () => removeEventListener('languagechange', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('app.name');
  }, [lang]);

  const update = (patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch }));
  const setLevel = (l: LevelId) => setSaved((s) => ({ ...s, levelFor: { ...s.levelFor, [mode]: l } }));

  function startQuiz(opts: { level?: LevelId; skills?: Skill[]; count?: number } = {}) {
    const seed = screen.name === 'home' && urlSeed && !opts.skills ? urlSeed : randomSeed();
    const questions = generateQuiz({ level: opts.level ?? level, count: opts.count ?? saved.length, seed, skills: opts.skills });
    setScreen({ name: 'quiz', questions, key: seed });
  }

  function finish(result: QuizResult) {
    const right = result.questions.filter((q) => result.firstTry[q.id]).length;
    const stars = starsFor(right, result.questions.length);
    const unowned = STICKERS.filter((s) => !saved.stickers.includes(s));
    const sticker = unowned.length ? unowned[Math.floor(Math.random() * unowned.length)] : null;
    // Practice rounds are shorter, so they don't count towards the level's best.
    const isFullQuiz = result.questions.length === saved.length;
    setSaved((s) => ({
      ...s,
      stickers: sticker ? [...s.stickers, sticker] : s.stickers,
      best: isFullQuiz ? { ...s.best, [level]: Math.max(s.best[level] ?? 0, stars) } : s.best,
    }));
    setScreen({ name: 'results', result, sticker });
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
            onStart={() => startQuiz()}
            onMode={() => setScreen({ name: 'mode' })}
            onStickers={() => setScreen({ name: 'stickers' })}
            onPrint={() => setScreen({ name: 'print' })}
          />
        );
      case 'quiz':
        return <Quiz key={screen.key} questions={screen.questions} onDone={finish} onQuit={() => setScreen({ name: 'home' })} />;
      case 'results':
        return (
          <Results
            result={screen.result}
            sticker={screen.sticker}
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
