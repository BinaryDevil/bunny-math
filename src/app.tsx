import { useEffect, useState } from 'preact/hooks';
import { Home } from './components/Home';
import { Quiz, type QuizResult } from './components/Quiz';
import { Results, starsFor } from './components/Results';
import { Stickers } from './components/Stickers';
import { Worksheet } from './components/Worksheet';
import { generateQuiz } from './lib/generator';
import { randomSeed } from './lib/rng';
import { setSound } from './lib/sound';
import { load, save, STICKERS, type Saved } from './lib/storage';
import type { LevelId, Question, Skill } from './lib/types';

type Screen =
  | { name: 'home' }
  | { name: 'quiz'; questions: Question[]; key: number }
  | { name: 'results'; result: QuizResult; sticker: string | null }
  | { name: 'stickers' }
  | { name: 'print' };

/** A ?seed=123 link always gives the same first quiz, handy for siblings racing each other. */
const urlSeed = Number(new URLSearchParams(location.search).get('seed')) || null;

export function App() {
  const [saved, setSaved] = useState<Saved>(load);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  useEffect(() => {
    save(saved);
    setSound(saved.sound);
  }, [saved]);

  const update = (patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch }));

  function startQuiz(opts: { level?: LevelId; skills?: Skill[]; count?: number } = {}) {
    const level = opts.level ?? saved.level;
    const seed = screen.name === 'home' && urlSeed && !opts.skills ? urlSeed : randomSeed();
    const questions = generateQuiz({ level, count: opts.count ?? saved.length, seed, skills: opts.skills });
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
      best: isFullQuiz ? { ...s.best, [s.level]: Math.max(s.best[s.level] ?? 0, stars) } : s.best,
    }));
    setScreen({ name: 'results', result, sticker });
  }

  switch (screen.name) {
    case 'home':
      return (
        <Home
          saved={saved}
          onChange={update}
          onStart={() => startQuiz()}
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
          canLevelUp={saved.level < 4}
          onHome={() => setScreen({ name: 'home' })}
          onAgain={() => startQuiz()}
          onPractice={(skills) => startQuiz({ skills, count: 10 })}
          onNextLevel={() => {
            const level = (saved.level + 1) as LevelId;
            update({ level });
            startQuiz({ level });
          }}
        />
      );
    case 'stickers':
      return <Stickers owned={saved.stickers} onBack={() => setScreen({ name: 'home' })} />;
    case 'print':
      return <Worksheet level={saved.level} count={saved.length} onBack={() => setScreen({ name: 'home' })} />;
  }
}
