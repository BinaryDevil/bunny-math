import { useEffect, useState } from 'preact/hooks';
import { generateQuiz } from '../lib/generator';
import { warmSound } from '../lib/sound';
import type { LevelId, Question } from '../lib/types';
import { AnswerPad, Prompt } from './Quiz';
import { Rascal } from './Rascal';

const KINDS = ['type', 'story', 'choice', 'missing', 'compare'] as const;
const noop = () => {};
let warmed = false;

/**
 * Gets the first quiz or Adventure question ready while Home sits idle.
 *
 * The very first question screen had a slow first layout (mostly finding a font for the ✕ stop
 * button), and the first sound made its tap lag. So, once per visit, this creates the audio
 * context and lays out an invisible question screen of each kind, with Rascal, then removes them.
 */
export function Warmup({ level }: { level: LevelId }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);

  useEffect(() => {
    if (warmed) return;
    const go = () => {
      warmed = true;
      warmSound();
      setQuestions(KINDS.map((k, i) => generateQuiz({ level, count: 1, seed: i + 1, kinds: [k], easeIn: false })[0]));
    };
    // Safari has no requestIdleCallback.
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(go, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(go, 500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!questions) return;
    // Keep them for a few frames so the browser surely lays them out, then let go.
    const id = setTimeout(() => setQuestions(null), 500);
    return () => clearTimeout(id);
  }, [questions]);

  if (!questions) return null;
  return (
    <div class="warmup" aria-hidden="true" inert>
      {questions.map((q) => (
        <section key={q.id + q.kind} class="screen adv">
          {/* ✕ and ✓ aren't in the app's fonts: the first one on screen sends the browser hunting through the system fonts. */}
          <header class="topbar adv-hud">
            <button class="puffy icon-btn">✕</button>
            <ol class="meadow-map">
              <li class="done">✓</li>
            </ol>
          </header>
          <div class="quiz-body">
            <div class="q-pane">
              <div class="q-card">
                <Rascal mood="smirk" class="peek">
                  <span class="bubble">…</span>
                </Rascal>
                <Prompt q={q} value="" status="ask" />
              </div>
            </div>
            <div class="pad-pane">
              <AnswerPad q={q} input="" status="ask" wrongPicks={[]} onPress={noop} onSubmit={noop} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
