/** Tiny sound effects made with Web Audio, so there are no audio files to load. */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSound(on: boolean) {
  enabled = on;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function play(fn: () => void) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    // iOS reports 'interrupted' after a call or a trip to the home screen, not only 'suspended'.
    if (ctx.state !== 'running') void ctx.resume();
    fn();
  } catch {
    // Audio not available: stay quiet.
  }
}

export const sounds = {
  tap: () => play(() => tone(660, 0, 0.06, 'triangle', 0.06)),
  right: () => play(() => [784, 988, 1319].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle'))),
  wrong: () => play(() => [330, 262].forEach((f, i) => tone(f, i * 0.13, 0.22, 'sine', 0.14))),
  pop: () => play(() => tone(880, 0, 0.12, 'square', 0.05)),
  done: () => play(() => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle'))),
};
