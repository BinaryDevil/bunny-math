import { levelsFor, MODES } from '../lib/generator';
import { sounds } from '../lib/sound';
import type { Saved } from '../lib/storage';
import type { LevelId, Mode } from '../lib/types';
import { Bunny } from './Bunny';
import { LanguageSwitch, useLanguage } from './Language';

export const LENGTHS = [10, 15, 20];

type Props = {
  saved: Saved;
  mode: Mode;
  level: LevelId;
  onLevel: (l: LevelId) => void;
  onMode: () => void;
  onChange: (patch: Partial<Saved>) => void;
  onStart: () => void;
  onStickers: () => void;
  onPrint: () => void;
};

export function SoundButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { t } = useLanguage();
  return (
    <button class="puffy icon-btn" aria-label={t(on ? 'Turn sound off' : 'Turn sound on')} aria-pressed={on} onClick={onToggle}>
      {on ? '🔊' : '🔇'}
    </button>
  );
}

export function Home({ saved, mode, level, onLevel, onMode, onChange, onStart, onStickers, onPrint }: Props) {
  const { t } = useLanguage();
  const levels = levelsFor(mode);
  const pick = (patch: Partial<Saved>) => {
    sounds.tap();
    onChange(patch);
  };
  return (
    <section class="screen">
      <header class="topbar home-topbar">
        <button class="puffy mode-btn" aria-label={t('Practicing: {mode}. Change', { mode: t(MODES[mode].name) })} onClick={onMode}>
          {MODES[mode].signs} <span aria-hidden="true">▾</span>
        </button>
        <span class="spacer" />
        <LanguageSwitch />
        <span class="home-topbar-break" aria-hidden="true" />
        <button class="puffy icon-btn" aria-label={t("Print a worksheet")} onClick={onPrint}>
          🖨️
        </button>
        <button class="puffy icon-btn" aria-label={t("Sticker book")} onClick={onStickers}>
          📒
        </button>
        <SoundButton on={saved.sound} onToggle={() => onChange({ sound: !saved.sound })} />
      </header>
      <div class="home-body">
        <div class="hero">
          <Bunny mood="happy" />
          <div>
            <h1 class="title">
              <span>Bunny</span> <span>Math</span>
            </h1>
            <p class="tagline">{t("Pick a level and let's hop to it!")}</p>
          </div>
        </div>
        <div class="home-pick">
          <div class={`levels n${levels.length}`} role="radiogroup" aria-label={t("Level")}>
            {levels.map((l) => (
              <button key={l.id} class="level" role="radio" aria-checked={level === l.id}
                onClick={() => {
                  sounds.tap();
                  onLevel(l.id);
                }}>
                <span class="lv-name">{t(l.name)}</span>
                <span class="lv-eg">{l.example}</span>
                {saved.best[l.id] ? (
                  <span class="lv-stars" aria-label={t('Best: {n} stars', { n: saved.best[l.id]! })}>
                    {'⭐'.repeat(saved.best[l.id]!)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div class="length">
            <span id="len-label">{t("Questions")}</span>
            <div class="seg" role="radiogroup" aria-labelledby="len-label">
              {LENGTHS.map((n) => (
                <button key={n} role="radio" aria-checked={saved.length === n} onClick={() => pick({ length: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button class="puffy berry start" onClick={onStart}>
            {t("Start!")}
          </button>
        </div>
      </div>
    </section>
  );
}
