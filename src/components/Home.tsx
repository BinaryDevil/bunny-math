import { tn, useT, type Lang } from '../i18n';
import { levelsFor, MODES } from '../lib/generator';
import { sounds } from '../lib/sound';
import type { Saved } from '../lib/storage';
import type { LevelId, Mode } from '../lib/types';
import { Bunny } from './Bunny';
import { LangPicker } from './LangPicker';

export const LENGTHS = [10, 15, 20];

type Props = {
  saved: Saved;
  mode: Mode;
  level: LevelId;
  lang: Lang;
  onLang: (l: Lang) => void;
  onLevel: (l: LevelId) => void;
  onMode: () => void;
  onChange: (patch: Partial<Saved>) => void;
  onStart: () => void;
  onStickers: () => void;
  onPrint: () => void;
};

export function SoundButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <button class="puffy icon-btn" aria-label={t(on ? 'home.soundOff' : 'home.soundOn')} aria-pressed={on} onClick={onToggle}>
      {on ? '🔊' : '🔇'}
    </button>
  );
}

export function Home({ saved, mode, level, lang, onLang, onLevel, onMode, onChange, onStart, onStickers, onPrint }: Props) {
  const t = useT();
  const levels = levelsFor(mode);
  const pick = (patch: Partial<Saved>) => {
    sounds.tap();
    onChange(patch);
  };
  return (
    <section class="screen">
      <header class="topbar">
        <button class="puffy mode-btn" aria-label={t('home.modeAria', { mode: t(`mode.${mode}.name`) })} onClick={onMode}>
          {MODES[mode].signs} <span aria-hidden="true">▾</span>
        </button>
        <span class="spacer" />
        <LangPicker lang={lang} onChange={onLang} />
        <button class="puffy icon-btn" aria-label={t('home.print')} onClick={onPrint}>
          🖨️
        </button>
        <button class="puffy icon-btn" aria-label={t('home.stickers')} onClick={onStickers}>
          📒
        </button>
        <SoundButton on={saved.sound} onToggle={() => onChange({ sound: !saved.sound })} />
      </header>
      <div class="home-body">
        <div class="hero">
          <Bunny mood="happy" />
          <div>
            <h1 class="title">
              <span>{t('app.nameA')}</span> <span>{t('app.nameB')}</span>
            </h1>
            <p class="tagline">{t('home.tagline')}</p>
          </div>
        </div>
        <div class="home-pick">
          <div class={`levels n${levels.length}`} role="radiogroup" aria-label={t('home.level')}>
            {levels.map((l) => (
              <button key={l.id} class="level" role="radio" aria-checked={level === l.id}
                onClick={() => {
                  sounds.tap();
                  onLevel(l.id);
                }}>
                <span class="lv-name">{t(`level.${l.id}.name`)}</span>
                <span class="lv-eg">{l.example}</span>
                {saved.best[l.id] ? (
                  <span class="lv-stars" aria-label={tn('home.best', saved.best[l.id]!)}>
                    {'⭐'.repeat(saved.best[l.id]!)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div class="length">
            <span id="len-label">{t('home.questions')}</span>
            <div class="seg" role="radiogroup" aria-labelledby="len-label">
              {LENGTHS.map((n) => (
                <button key={n} role="radio" aria-checked={saved.length === n} onClick={() => pick({ length: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button class="puffy berry start" onClick={onStart}>
            {t('home.start')}
          </button>
        </div>
      </div>
    </section>
  );
}
