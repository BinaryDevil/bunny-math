// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buzz, haptics, IOS_GAP_MS, PULSE } from './haptics';
import { jolt } from './shake';

const proto = HTMLInputElement.prototype as unknown as Record<string, unknown>;
let hadVibrate: PropertyDescriptor | undefined;

function setVibrate(fn: unknown) {
  Object.defineProperty(navigator, 'vibrate', { value: fn, configurable: true, writable: true });
}
/** Pretend to be Safari 17.4+: `switch` checkboxes exist, no Vibration API. */
function beSafari() {
  setVibrate(undefined);
  Object.defineProperty(proto, 'switch', { value: false, configurable: true, writable: true });
}

beforeEach(() => {
  hadVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
});
afterEach(() => {
  if (hadVibrate) Object.defineProperty(navigator, 'vibrate', hadVibrate);
  else delete (navigator as unknown as Record<string, unknown>).vibrate;
  delete proto.switch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('haptics', () => {
  it('right is one short pulse, wrong is two', () => {
    expect(PULSE.right).toHaveLength(1);
    expect(PULSE.right[0]).toBeLessThanOrEqual(25);
    expect(PULSE.wrong).toHaveLength(3); // pulse, gap, pulse
    expect(PULSE.wrong[0] + PULSE.wrong[1] + PULSE.wrong[2]).toBeLessThan(200);
  });

  it('uses navigator.vibrate with those patterns when it exists, and never the iOS switch', () => {
    const vibrate = vi.fn(() => true);
    setVibrate(vibrate);
    Object.defineProperty(proto, 'switch', { value: false, configurable: true, writable: true });
    const click = vi.spyOn(HTMLLabelElement.prototype, 'click');
    haptics.right();
    haptics.wrong();
    expect(vibrate).toHaveBeenNthCalledWith(1, [...PULSE.right]);
    expect(vibrate).toHaveBeenNthCalledWith(2, [...PULSE.wrong]);
    expect(click).not.toHaveBeenCalled();
  });

  it('is a silent no-op without navigator.vibrate or switch checkboxes', () => {
    setVibrate(undefined);
    const click = vi.spyOn(HTMLLabelElement.prototype, 'click');
    expect(() => buzz('right')).not.toThrow();
    expect(() => buzz('wrong')).not.toThrow();
    expect(click).not.toHaveBeenCalled();
    expect(document.querySelector('label')).toBeNull();
  });

  it('never throws when vibrate throws', () => {
    setVibrate(() => {
      throw new Error('blocked');
    });
    expect(() => haptics.right()).not.toThrow();
    expect(() => haptics.wrong()).not.toThrow();
  });

  it('on Safari, clicks a hidden switch label once for right, then cleans up', () => {
    beSafari();
    let seen: HTMLLabelElement | null = null;
    vi.spyOn(HTMLLabelElement.prototype, 'click').mockImplementation(function (this: HTMLLabelElement) {
      seen = this;
    });
    buzz('right');
    expect(seen).not.toBeNull();
    const label = seen!;
    expect(label.getAttribute('aria-hidden')).toBe('true');
    expect(label.style.display).toBe('none');
    const input = label.querySelector('input')!;
    expect(input.type).toBe('checkbox');
    expect(input.hasAttribute('switch')).toBe(true);
    expect(input.tabIndex).toBe(-1);
    expect(label.isConnected).toBe(false);
  });

  it('on Safari, taps twice for wrong, the second a moment later', () => {
    vi.useFakeTimers();
    beSafari();
    const click = vi.spyOn(HTMLLabelElement.prototype, 'click').mockImplementation(() => {});
    buzz('wrong');
    expect(click).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(IOS_GAP_MS);
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('leaves focus where it was, and keeps the click from bubbling', () => {
    beSafari();
    const btn = document.createElement('button');
    document.body.append(btn);
    btn.focus();
    const heard = vi.fn();
    document.addEventListener('click', heard);
    // A real label click would toggle (and might focus) the switch.
    vi.spyOn(HTMLLabelElement.prototype, 'click').mockImplementation(function (this: HTMLLabelElement) {
      this.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      this.querySelector('input')!.focus();
    });
    buzz('right');
    expect(document.activeElement).toBe(btn);
    expect(heard).not.toHaveBeenCalled();
    document.removeEventListener('click', heard);
    btn.remove();
  });

  it('never throws even if the label click does', () => {
    beSafari();
    vi.spyOn(HTMLLabelElement.prototype, 'click').mockImplementation(() => {
      throw new Error('nope');
    });
    expect(() => buzz('right')).not.toThrow();
    expect(document.querySelector('label')).toBeNull();
  });
});

describe('shake', () => {
  const motion = (reduce: boolean) =>
    vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q }) as MediaQueryList);

  it('adds a different class for right and wrong, and restarts on each answer', () => {
    motion(false);
    const el = document.createElement('div');
    jolt(el, 'wrong');
    expect(el.classList.contains('jolt-wrong')).toBe(true);
    jolt(el, 'right');
    expect(el.classList.contains('jolt-right')).toBe(true);
    expect(el.classList.contains('jolt-wrong')).toBe(false);
  });

  it('takes the class off when the animation ends', () => {
    motion(false);
    const el = document.createElement('div');
    jolt(el, 'right');
    el.dispatchEvent(new Event('animationend'));
    expect(el.className).toBe('');
  });

  it('does nothing under prefers-reduced-motion, or without an element', () => {
    motion(true);
    const el = document.createElement('div');
    jolt(el, 'wrong');
    expect(el.className).toBe('');
    expect(() => jolt(null, 'right')).not.toThrow();
  });
});
