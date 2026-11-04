/**
 * A little jolt of the question area when an answer is judged: one small bump for right,
 * two quick shakes for wrong. The animation is CSS (`.jolt-right` / `.jolt-wrong` in
 * styles.css): transform only, on `.quiz-body`, which sits inside `.screen { overflow: hidden }`,
 * so it never changes layout or adds a scrollbar, and it doesn't touch the top bar, the
 * feedback banner or the "Show me how" sheet (they aren't inside it).
 * Skipped entirely under prefers-reduced-motion (the CSS turns it off there too).
 */
export type Jolt = 'right' | 'wrong';
const CLASSES = ['jolt-right', 'jolt-wrong'];

export function reducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function jolt(el: HTMLElement | null | undefined, kind: Jolt) {
  if (!el) return;
  try {
    el.classList.remove(...CLASSES);
    if (reducedMotion()) return;
    // Reading layout here lets the same animation start again on the very next answer.
    void el.offsetWidth;
    el.classList.add(`jolt-${kind}`);
    const done = (e: AnimationEvent) => {
      if (e.target !== el) return;
      el.classList.remove(`jolt-${kind}`);
      el.removeEventListener('animationend', done);
    };
    el.addEventListener('animationend', done);
  } catch {
    // No animation: nothing to see.
  }
}
