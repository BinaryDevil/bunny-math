import type { ComponentChildren } from 'preact';

export type Mood = 'normal' | 'happy' | 'cheer' | 'think';

const INK = '#4B2A5C';
const line = { stroke: INK, 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' } as const;

function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'happy' || mood === 'cheer') return <path d="M38 88 q7 -10 14 0 M68 88 q7 -10 14 0" {...line} stroke-width={4.5} />;
  return (
    <>
      <circle cx="45" cy="86" r="6" fill={INK} />
      <circle cx="75" cy="86" r="6" fill={INK} />
      <circle cx="47" cy="84" r="2" fill="#fff" />
      <circle cx="77" cy="84" r="2" fill="#fff" />
      {mood === 'think' && <path d="M37 76 q6 -5 13 -5 M83 76 q-6 -5 -13 -5" {...line} stroke-width={3.5} />}
    </>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  if (mood === 'think') return <path d="M54 102 q6 -3 12 0" {...line} stroke-width={3.5} />;
  if (mood === 'cheer') return <path d="M52 98 q8 14 16 0 z" fill="#FF5C9A" stroke={INK} stroke-width="3" stroke-linejoin="round" />;
  return <path d="M53 99 q3.5 5 7 0 q3.5 5 7 0" {...line} stroke-width={3.5} />;
}

export function Bunny({ mood = 'normal', class: cls = '', children }: { mood?: Mood; class?: string; children?: ComponentChildren }) {
  const paw = { fill: '#fff', stroke: INK, 'stroke-width': 4 };
  return (
    <div class={`bunny ${cls}`}>
      {children}
      <svg viewBox="0 0 120 132" aria-hidden="true">
        <g stroke={INK} stroke-width="4" fill="#fff">
          <ellipse cx="42" cy="34" rx="13" ry="32" transform="rotate(-8 42 34)" />
          <ellipse cx="78" cy="34" rx="13" ry="32" transform="rotate(8 78 34)" />
        </g>
        <ellipse cx="42" cy="38" rx="6" ry="21" fill="#FFD3E4" transform="rotate(-8 42 38)" />
        <ellipse cx="78" cy="38" rx="6" ry="21" fill="#FFD3E4" transform="rotate(8 78 38)" />
        <ellipse cx="60" cy="90" rx="46" ry="38" fill="#fff" stroke={INK} stroke-width="4" />
        <g transform="translate(86 52) rotate(18)" stroke={INK} stroke-width="3" stroke-linejoin="round" fill="#FF5C9A">
          <path d="M0 0 L-14 -9 L-14 9 Z" />
          <path d="M0 0 L14 -9 L14 9 Z" />
          <circle r="4.5" />
        </g>
        <Eyes mood={mood} />
        <ellipse cx="34" cy="100" rx="8" ry="5" fill="#FF9EC2" opacity=".75" />
        <ellipse cx="86" cy="100" rx="8" ry="5" fill="#FF9EC2" opacity=".75" />
        <path d="M56 93 h8 l-4 4 z" fill={INK} stroke={INK} stroke-width="2" stroke-linejoin="round" />
        <Mouth mood={mood} />
        {mood === 'cheer' ? (
          <>
            <ellipse cx="14" cy="76" rx="10" ry="12" {...paw} />
            <ellipse cx="106" cy="76" rx="10" ry="12" {...paw} />
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

export function Star({ empty = false }: { empty?: boolean }) {
  return (
    <svg viewBox="0 0 100 96" class={empty ? 'empty' : ''} aria-hidden="true">
      <path d="M50 6 L62 36 L94 38 L69 58 L77 90 L50 72 L23 90 L31 58 L6 38 L38 36 Z" fill="#FFD45E" stroke={INK} stroke-width="6" stroke-linejoin="round" />
      {!empty && <path d="M36 44 q6 -4 10 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8" />}
    </svg>
  );
}
