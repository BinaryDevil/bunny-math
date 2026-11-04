/**
 * A buzz when an answer is judged: one short pulse for right, two for wrong.
 *
 * - Android Chrome (and other browsers with the Vibration API): `navigator.vibrate`.
 * - iPhone Safari has no Vibration API. Safari 17.4+ has `<input type="checkbox" switch>`, and on
 *   iOS 18+ toggling one plays the system "switch" haptic, also when its label is clicked from
 *   script. We use that only when `navigator.vibrate` is missing. Caveats, honestly:
 *   - It is an undocumented side effect, not an API. From iOS 18.4 it reportedly needs a recent
 *     tap (a click, about 1 s of grace); the ios-haptics library reports Apple turned it off in
 *     iOS 26.5. On those versions, and on Macs, it does nothing at all.
 *   - Both judged-answer paths call this synchronously inside the tap's click handler, so the
 *     first pulse is inside the gesture. The second "wrong" pulse comes 100 ms later from a
 *     timer: still well inside the ~1 s grace if that is how iOS counts it, but if a version
 *     only allows clicks in the handler itself, the wrong answer feels like a single pulse.
 *   - A hardware-keyboard answer (Enter on an iPad) isn't a click, so iOS may stay silent.
 *   - The label and switch are `display: none`, live for a moment in <body> and are then
 *     removed: no layout box means no layout shift, no scrolling, nothing a screen reader or
 *     Tab can reach, and WebKit can't focus it (it can't focus elements with no box). We still
 *     put focus back if it ever moved, because the quiz relies on focus for Enter.
 *
 * Haptics ignore the app's sound switch: that button says "sound", and a quiet buzz is
 * just what helps when the sound is off (a classroom). They also ignore
 * prefers-reduced-motion, which is about things moving on screen, not vibration; the phone's
 * own settings (Android's touch feedback, iOS's System Haptics) still turn them off.
 * Nothing here ever throws.
 */

export const PULSE = { right: [18], wrong: [15, 80, 15] } as const;
/** The gap between the two iOS taps for a wrong answer. */
export const IOS_GAP_MS = 100;

type Kind = keyof typeof PULSE;

/** iOS's switch haptic, if this browser has `switch` checkboxes. Returns whether it tried. */
function switchTap(): boolean {
  if (typeof document === 'undefined' || typeof HTMLInputElement === 'undefined') return false;
  if (!('switch' in HTMLInputElement.prototype)) return false;
  const before = document.activeElement;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.append(input);
  // Nobody else hears about this click or the switch's change.
  const hush = (e: Event) => e.stopPropagation();
  label.addEventListener('click', hush);
  input.addEventListener('change', hush);
  document.body.append(label);
  try {
    label.click();
  } finally {
    label.remove();
    if (document.activeElement !== before && before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true });
  }
  return true;
}

export function buzz(kind: Kind) {
  try {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (nav && typeof nav.vibrate === 'function') {
      nav.vibrate([...PULSE[kind]]);
      return;
    }
    if (!switchTap()) return;
    if (kind === 'wrong') setTimeout(() => { try { switchTap(); } catch { /* stay still */ } }, IOS_GAP_MS);
  } catch {
    // No vibration here: stay still.
  }
}

export const haptics = {
  right: () => buzz('right'),
  wrong: () => buzz('wrong'),
};
