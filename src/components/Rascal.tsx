import type { ComponentChildren } from 'preact';

/** Rascal: Bunny's mischievous Adventure twin. Dark fur, red eyes, a wonky crown. Cool, never scary. */
export type RascalMood = 'smirk' | 'laugh' | 'sulk' | 'dizzy';

const STROKE = '#1A0E22';
const FUR = '#5A3E6E';
const RED = '#FF3B5C';
const line = { stroke: STROKE, 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' } as const;

function Eyes({ mood }: { mood: RascalMood }) {
  if (mood === 'laugh') return <path d="M37 88 q8 -10 15 0 M68 88 q8 -10 15 0" {...line} stroke={RED} stroke-width={5} />;
  if (mood === 'dizzy')
    return (
      <g {...line} stroke={RED} stroke-width={3.5}>
        <path d="M39 80 l12 12 M51 80 l-12 12" />
        <path d="M69 80 l12 12 M81 80 l-12 12" />
      </g>
    );
  return (
    <>
      {/* Glowing red eyes with a cheeky half-lid. */}
      <circle cx="45" cy="87" r="8" fill={RED} opacity=".25" />
      <circle cx="75" cy="87" r="8" fill={RED} opacity=".25" />
      <circle cx="45" cy="87" r="5.5" fill={RED} />
      <circle cx="75" cy="87" r="5.5" fill={RED} />
      <circle cx="47" cy="85" r="1.8" fill="#fff" />
      <circle cx="77" cy="85" r="1.8" fill="#fff" />
      {mood === 'sulk' ? (
        <path d="M36 80 q9 4 17 1 M84 80 q-9 4 -17 1" {...line} stroke-width={4} />
      ) : (
        <path d="M35 77 l18 5 M85 77 l-18 5" {...line} stroke-width={4.5} />
      )}
    </>
  );
}

function Mouth({ mood }: { mood: RascalMood }) {
  if (mood === 'sulk') return <path d="M52 104 q8 -6 16 0" {...line} stroke="#F4D9FF" stroke-width={3.5} />;
  if (mood === 'dizzy') return <path d="M52 102 q4 -4 8 0 q4 4 8 0" {...line} stroke="#F4D9FF" stroke-width={3.5} />;
  if (mood === 'laugh')
    return (
      <>
        <path d="M50 97 q10 16 20 0 z" fill="#2A1236" stroke="#F4D9FF" stroke-width="3" stroke-linejoin="round" />
        <path d="M55 98 l2 4 l2 -4 M61 98 l2 4 l2 -4" fill="#fff" />
      </>
    );
  // A lopsided smirk with one tiny fang.
  return (
    <>
      <path d="M50 99 q10 7 20 -3" {...line} stroke="#F4D9FF" stroke-width={3.5} />
      <path d="M62 101 l2 5 l2 -5.5" fill="#fff" stroke="#F4D9FF" stroke-width="1" stroke-linejoin="round" />
    </>
  );
}

export function Rascal({ mood = 'smirk', class: cls = '', children }: { mood?: RascalMood; class?: string; children?: ComponentChildren }) {
  const paw = { fill: FUR, stroke: STROKE, 'stroke-width': 4 };
  return (
    <div class={`bunny rascal ${cls}`}>
      {children}
      <svg viewBox="0 0 120 132" aria-hidden="true">
        <g stroke={STROKE} stroke-width="4" fill={FUR}>
          {/* One ear flops: he's too cool to stand up straight. */}
          <ellipse cx="40" cy="34" rx="13" ry="32" transform="rotate(-14 40 34)" />
          <path d="M70 58 C 70 30, 80 8, 92 6 C 104 4, 104 22, 92 34 C 86 42, 84 52, 84 60 Z" />
        </g>
        <ellipse cx="40" cy="38" rx="6" ry="21" fill={RED} opacity=".85" transform="rotate(-14 40 38)" />
        <path d="M78 54 C 78 36, 84 18, 92 14 C 98 12, 98 22, 90 30 C 85 36, 84 46, 84 54 Z" fill={RED} opacity=".85" />
        <ellipse cx="60" cy="90" rx="46" ry="38" fill={FUR} stroke={STROKE} stroke-width="4" />
        {/* A wonky gold crown. */}
        <g transform="translate(46 44) rotate(-12)">
          <path d="M0 14 L2 0 L9 8 L15 -2 L21 8 L28 0 L30 14 Z" fill="#FFD45E" stroke={STROKE} stroke-width="3" stroke-linejoin="round" />
          <circle cx="15" cy="9" r="2.5" fill={RED} />
        </g>
        <Eyes mood={mood} />
        <ellipse cx="32" cy="101" rx="7" ry="4" fill={RED} opacity=".35" />
        <ellipse cx="88" cy="101" rx="7" ry="4" fill={RED} opacity=".35" />
        <path d="M56 93 h8 l-4 4 z" fill="#F4D9FF" stroke="#F4D9FF" stroke-width="2" stroke-linejoin="round" />
        <Mouth mood={mood} />
        {mood === 'laugh' ? (
          <>
            <ellipse cx="18" cy="104" rx="10" ry="12" {...paw} />
            <ellipse cx="102" cy="104" rx="10" ry="12" {...paw} />
          </>
        ) : (
          <>
            <ellipse cx="38" cy="124" rx="12" ry="8" {...paw} />
            <ellipse cx="82" cy="124" rx="12" ry="8" {...paw} />
          </>
        )}
      </svg>
    </div>
  );
}
