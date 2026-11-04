// @vitest-environment happy-dom
/** Keyboard use of the quiz and "Show me how", and which rounds count towards a level's best stars. */
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { ExplainSheet } from './components/Explain';
import { Quiz } from './components/Quiz';
import type { Question } from './lib/types';

// happy-dom has no canvas for confetti.
vi.mock('./lib/celebrate', () => ({ smallBurst: () => {}, bigParty: () => {} }));
// Every quiz is "7 + 8" questions, so the test knows the answers.
vi.mock('./lib/generator', async (orig) => ({
  ...(await orig<typeof import('./lib/generator')>()),
  generateQuiz: ({ count }: { count: number }) => Array.from({ length: count }, (_, i) => sum(`q${i + 1}`)),
}));

let root: HTMLElement;
beforeEach(() => {
  localStorage.clear();
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  act(() => render(null, root));
  root.remove();
  vi.restoreAllMocks();
});

function sum(id: string): Question {
  return { id, kind: 'type', skill: 'add20', fact: { a: 7, op: '+', b: 8, c: 15 } };
}
const key = (k: string, target: EventTarget = window) => act(() => void target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })));
const stepLabel = () => root.querySelector('.steps')!.getAttribute('aria-label');

describe('"Show me how" with a keyboard', () => {
  it('moves focus to Next when it opens', () => {
    act(() => render(<ExplainSheet question={sum('q1')} onClose={() => {}} />, root));
    expect(document.activeElement?.textContent).toContain('Next');
  });

  it('Enter on a focused button is left to the button, so a step is never skipped', () => {
    act(() => render(<ExplainSheet question={sum('q1')} onClose={() => {}} />, root));
    const before = stepLabel();
    key('Enter', root.querySelector('.sheet-foot .berry')!);
    expect(stepLabel()).toBe(before);
    key('ArrowRight');
    expect(stepLabel()).not.toBe(before);
  });

  it('gives focus back to what had it when it closes', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    act(() => render(<ExplainSheet question={sum('q1')} onClose={() => {}} />, root));
    expect(document.activeElement).not.toBe(opener);
    act(() => render(null, root));
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('quiz keyboard', () => {
  const mount = () => act(() => render(<Quiz questions={[sum('q1'), sum('q2')]} onDone={() => {}} onQuit={() => {}} />, root));
  const shown = () => root.querySelector('.equation')!.textContent;

  it('Enter on a focused keypad key checks the answer instead of typing the digit again', () => {
    mount();
    const one = [...root.querySelectorAll<HTMLButtonElement>('.pad .key')].find((b) => b.textContent === '1')!;
    key('1');
    key('5');
    key('Enter', one);
    expect(root.querySelector('.feedback.good')).not.toBeNull();
    expect(shown()).toContain('15');
    expect(shown()).not.toContain('151');
  });

  it('Enter on the focused "Show me how" button is left to that button', () => {
    mount();
    key('1');
    key('Enter', root.querySelector('.hint-btn')!);
    expect(root.querySelector('.feedback')).toBeNull();
  });

  it('after closing "Show me how", typing an answer and Enter checks it instead of reopening the sheet', () => {
    mount();
    const hint = root.querySelector<HTMLButtonElement>('.hint-btn')!;
    hint.focus();
    act(() => hint.click());
    key('Escape');
    expect(root.querySelector('.sheet')).toBeNull();
    expect(document.activeElement).toBe(hint);
    key('1', hint);
    key('5', document.activeElement!);
    key('Enter', document.activeElement!);
    expect(root.querySelector('.sheet')).toBeNull();
    expect(root.querySelector('.feedback.good')).not.toBeNull();
  });

  it('Escape closes the "Stop?" dialog', () => {
    mount();
    act(() => root.querySelector<HTMLButtonElement>('.topbar .icon-btn')!.click());
    expect(root.querySelector('[role=alertdialog]')).not.toBeNull();
    key('Escape');
    expect(root.querySelector('[role=alertdialog]')).toBeNull();
  });
});

describe('best stars', () => {
  it('a "Practice more" round of 10 does not count as the level\'s best, even when quizzes are 10 long', () => {
    localStorage.setItem('bunny-math:v1', JSON.stringify({ mode: 'plus', length: 10, sound: false }));
    act(() => render(<App />, root));
    const answer = (n: string) => {
      for (const d of n) key(d);
      key('Enter');
    };
    const click = (sel: string) => act(() => root.querySelector<HTMLButtonElement>(sel)!.click());

    // Full quiz: every question wrong twice, then right when it comes back.
    click('.start');
    for (let i = 0; i < 10; i++) {
      answer('3');
      key('Enter'); // try again
      answer('3');
      key('Enter'); // next
    }
    for (let i = 0; i < 10; i++) {
      answer('15');
      key('Enter');
    }
    expect(root.querySelector('.res-actions')).not.toBeNull();
    const bestAfterQuiz = JSON.parse(localStorage.getItem('bunny-math:v1')!).best[1] ?? 0;
    expect(bestAfterQuiz).toBeLessThan(3);

    // Practice round: all right first time.
    click('.res-actions .butter');
    for (let i = 0; i < 10; i++) {
      answer('15');
      key('Enter');
    }
    expect(root.querySelector('.res-actions')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('bunny-math:v1')!).best[1] ?? 0).toBe(bestAfterQuiz);
  });
});

describe('feedback when an answer is judged', () => {
  it('buzzes and jolts once for right and for wrong, in the same keypress', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
    act(() => render(<Quiz questions={[sum('q1'), sum('q2')]} onDone={() => {}} onQuit={() => {}} />, root));
    const body = root.querySelector('.quiz-body')!;
    key('9');
    key('Enter');
    expect(vibrate).toHaveBeenLastCalledWith([15, 80, 15]);
    expect(body.classList.contains('jolt-wrong')).toBe(true);
    key('Enter'); // try again
    key('1');
    key('5');
    key('Enter');
    expect(vibrate).toHaveBeenLastCalledWith([18]);
    expect(root.querySelector('.quiz-body')!.classList.contains('jolt-right')).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(2);
    delete (navigator as unknown as Record<string, unknown>).vibrate;
  });
});
