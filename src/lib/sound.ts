/** Tiny sound effects made with Web Audio, so there are no audio files to load. */
let ctx: AudioContext | null = null;
/** Adventure sounds go through a soft filter so the chiptune squares never sound harsh. */
let night: BiquadFilterNode | null = null;
let enabled = true;
let adventure = false;

export function setSound(on: boolean) {
  enabled = on;
}

/** Adventure mode swaps in punchier, more mischievous versions of the same sounds. */
export function setAdventureSounds(on: boolean) {
  adventure = on;
}

/** A note at `freq` (gliding to `to`, if given), starting `start` seconds from now. */
function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18, to?: number) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(adventure && night ? night : ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function play(fn: () => void) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    if (!night) {
      night = ctx.createBiquadFilter();
      night.type = 'lowpass';
      night.frequency.value = 2200;
      night.connect(ctx.destination);
    }
    // iOS reports 'interrupted' after a call or a trip to the home screen, not only 'suspended'.
    if (ctx.state !== 'running') void ctx.resume();
    fn();
  } catch {
    // Audio not available: stay quiet.
  }
}

const quiz = {
  tap: () => tone(660, 0, 0.06, 'triangle', 0.06),
  right: () => [784, 988, 1319].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle')),
  wrong: () => [330, 262].forEach((f, i) => tone(f, i * 0.13, 0.22, 'sine', 0.14)),
  pop: () => tone(880, 0, 0.12, 'square', 0.05),
  done: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle')),
};

const adv = {
  tap: () => {
    tone(392, 0, 0.035, 'square', 0.05);
    tone(196, 0, 0.05, 'triangle', 0.06);
  },
  right: () => {
    tone(131, 0, 0.35, 'triangle', 0.2);
    [392, 523, 784].forEach((f, i) => tone(f, i * 0.07, 0.28, 'square', 0.06));
    tone(1568, 0.24, 0.2, 'triangle', 0.08);
  },
  /** Rascal snickers. */
  wrong: () => [988, 831, 988, 831].forEach((f, i) => tone(f, i * 0.085, 0.07, 'square', 0.04)),
  pop: () => {
    tone(900, 0, 0.12, 'square', 0.06, 300);
    tone(1319, 0.1, 0.15, 'triangle', 0.08);
  },
  done: () => {
    const notes: [number, number, number][] = [[392, 0, 0.1], [392, 0.12, 0.1], [392, 0.24, 0.1], [523, 0.36, 0.4], [659, 0.8, 0.14], [784, 0.96, 0.6]];
    notes.forEach(([f, at, d]) => tone(f, at, d, 'square', 0.07));
    tone(131, 0.36, 0.5, 'triangle', 0.18);
    tone(196, 0.96, 0.7, 'triangle', 0.18);
  },
};

export const sounds = {
  tap: () => play(adventure ? adv.tap : quiz.tap),
  right: () => play(adventure ? adv.right : quiz.right),
  wrong: () => play(adventure ? adv.wrong : quiz.wrong),
  pop: () => play(adventure ? adv.pop : quiz.pop),
  done: () => play(adventure ? adv.done : quiz.done),
  /** Adventure only: a heart is lost. */
  heart: () =>
    play(() => {
      tone(440, 0, 0.4, 'sawtooth', 0.08, 110);
      tone(70, 0.35, 0.3, 'sine', 0.3);
    }),
  /** A hit on Rascal in a showdown. */
  hit: () => play(adv.pop),
  /** Bunny turns into Rascal: a falling whoosh, a thud, and a giggle. */
  toRascal: () =>
    play(() => {
      const was = adventure;
      adventure = true;
      tone(900, 0, 0.7, 'sawtooth', 0.07, 90);
      tone(98, 0.55, 0.5, 'triangle', 0.2);
      tone(147, 0.55, 0.5, 'triangle', 0.16);
      [988, 831, 988, 831, 740].forEach((f, i) => tone(f, 1.05 + i * 0.075, 0.07, 'square', 0.04));
      adventure = was;
    }),
  /** Rascal turns back into Bunny: a rising sparkle. */
  toBunny: () =>
    play(() => {
      const was = adventure;
      adventure = false;
      tone(260, 0, 0.45, 'sine', 0.14, 1200);
      [1047, 1319, 1568].forEach((f, i) => tone(f, 0.4 + i * 0.08, 0.3, 'triangle', 0.1));
      adventure = was;
    }),
};
