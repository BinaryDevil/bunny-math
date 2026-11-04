import { useEffect, useState } from 'preact/hooks';
import { tn, useT, type Lang } from '../i18n';
import { levelRate } from '../lib/carrots';
import type { ShareCode } from '../lib/codes';
import { levelsFor, MODES } from '../lib/generator';
import { fetchBoard, leaderboardOn, type Entry } from '../lib/leaderboard';
import { sounds } from '../lib/sound';
import { LENGTHS, type Saved } from '../lib/storage';
import type { LevelId, Mode } from '../lib/types';
import { Bunny } from './Bunny';
import { LangPicker } from './LangPicker';
import { Rascal } from './Rascal';
import { Warmup } from './Warmup';
import { CodeEntry } from './Share';

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
  onBoard: () => void;
  onCode: (c: ShareCode, text: string) => void;
  /** A code from a link, waiting to be played. */
  pendingCode?: string;
  /** The code box was closed without playing: the link's code is used up, so it doesn't open again. */
  onCodeClosed: () => void;
};

/** The big Adventure switch. Turning it on morphs Bunny into Rascal and the app into night. */
function AdventureSwitch({ on, isNew, onToggle }: { on: boolean; isNew: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <button class={`puffy adv-switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={onToggle}>
      <span class="adv-switch-text">
        <b>{t('adv.switch')}</b>
        <small>{t(on ? 'adv.switchOn' : 'adv.switchOff')}</small>
      </span>
      {isNew && !on && <span class="new-tag">{t('adv.new')}</span>}
      <span class="knob-track" aria-hidden="true">
        <span class="knob">{on ? '🌙' : '☀️'}</span>
      </span>
    </button>
  );
}

export function SoundButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <button class="puffy icon-btn" aria-label={t(on ? 'home.soundOff' : 'home.soundOn')} aria-pressed={on} onClick={onToggle}>
      {on ? '🔊' : '🔇'}
    </button>
  );
}

export function Home({ saved, mode, level, lang, onLang, onLevel, onMode, onChange, onStart, onStickers, onPrint, onBoard, onCode, pendingCode, onCodeClosed }: Props) {
  const t = useT();
  const levels = levelsFor(mode);
  const adv = saved.adventure;
  const [morph, setMorph] = useState(false);
  const [coding, setCoding] = useState(!!pendingCode);
  const [me, setMe] = useState<Entry | null | undefined>(undefined);
  useEffect(() => {
    if (adv && leaderboardOn()) fetchBoard().then((b) => setMe(b?.me?.total ? b.me : null));
  }, [adv]);
  function toggleAdventure() {
    adv ? sounds.toBunny() : sounds.toRascal();
    setMorph(true);
    setTimeout(() => setMorph(false), 900);
    onChange({ adventure: !adv, adv: adv ? saved.adv : { ...saved.adv, seen: [...new Set([...saved.adv.seen, 'adventure'])] } });
  }
  const pick = (patch: Partial<Saved>) => {
    sounds.tap();
    onChange(patch);
  };
  return (
    <section class="screen">
      <header class="topbar">
        <button class="puffy mode-btn" aria-label={t('home.modeAria', { mode: t(`mode.${mode}.name`) })} onClick={onMode}>
          <span class="signs">
            {MODES[mode].signs.split(' ').map((s) => (
              <span key={s}>{s}</span>
            ))}
          </span>
          <span class="caret" aria-hidden="true">▾</span>
        </button>
        <span class="spacer" />
        <LangPicker lang={lang} onChange={onLang} />
        <button class="puffy icon-btn" aria-label={t('adv.haveCode')} onClick={() => { sounds.tap(); setCoding(true); }}>
          🔑
        </button>
        <button class="puffy icon-btn" aria-label={t('home.print')} onClick={onPrint}>
          🖨️
        </button>
        <button class="puffy icon-btn" aria-label={t('home.stickers')} onClick={onStickers}>
          📒
        </button>
        <SoundButton on={saved.sound} onToggle={() => onChange({ sound: !saved.sound })} />
      </header>
      <div class="adv-row">
        <AdventureSwitch on={adv} isNew={!saved.adv.seen.includes('adventure')} onToggle={toggleAdventure} />
      </div>
      <div class="home-body">
        <div class="hero">
          <div class={`hero-face ${morph ? 'morph' : ''}`} key={String(adv)}>
            {adv ? <Rascal mood="smirk" /> : <Bunny mood="happy" />}
            {morph && <span class="smoke" aria-hidden="true" />}
          </div>
          <div>
            <h1 class="title">
              <span>{t('app.nameA')}</span> <span>{t('app.nameB')}</span>
            </h1>
            <p class="tagline">{t(adv ? 'adv.tagline' : 'home.tagline')}</p>
            {adv && leaderboardOn() && (
              <button class="puffy board-card" onClick={onBoard}>
                {me ? t('adv.board', { rank: me.rank, total: me.total }) : t('adv.boardJoin')} <span aria-hidden="true">›</span>
              </button>
            )}
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
                {adv && (
                  <span class="lv-carrots" aria-label={tn('adv.levelRate', levelRate(l.id))}>
                    🥕×{levelRate(l.id)}
                  </span>
                )}
                {!adv && saved.best[l.id] ? (
                  <span class="lv-stars" aria-label={tn('home.best', saved.best[l.id]!)}>
                    {'⭐'.repeat(saved.best[l.id]!)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {!adv && <div class="length">
            <span id="len-label">{t('home.questions')}</span>
            <div class="seg" role="radiogroup" aria-labelledby="len-label">
              {LENGTHS.map((n) => (
                <button key={n} role="radio" aria-checked={saved.length === n} onClick={() => pick({ length: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>}
          <button class="puffy berry start" onClick={onStart}>
            {t(adv ? 'adv.start' : 'home.start')}
          </button>
        </div>
      </div>
      {coding && <CodeEntry initial={pendingCode} onClose={() => { setCoding(false); onCodeClosed(); }} onPlay={(c, text) => { setCoding(false); onCode(c, text); }} />}
      <Warmup level={level} />
    </section>
  );
}
