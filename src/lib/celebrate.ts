import confetti from 'canvas-confetti';

const COLORS = ['#FF5C9A', '#B9A2FF', '#5FD8B0', '#FFD45E', '#FFB08A'];

export function smallBurst(el?: Element | null) {
  const r = el?.getBoundingClientRect();
  const origin = r
    ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }
    : { x: 0.5, y: 0.4 };
  void confetti({ particleCount: 40, spread: 70, startVelocity: 30, scalar: 0.9, origin, colors: COLORS, disableForReducedMotion: true });
}

export function bigParty() {
  const opts = { particleCount: 80, spread: 80, startVelocity: 45, colors: COLORS, disableForReducedMotion: true };
  void confetti({ ...opts, angle: 60, origin: { x: 0, y: 0.7 } });
  void confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.7 } });
  setTimeout(() => void confetti({ ...opts, particleCount: 60, origin: { x: 0.5, y: 0.3 } }), 350);
}
