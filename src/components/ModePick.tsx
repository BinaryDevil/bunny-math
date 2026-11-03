import { useT, type Lang } from '../i18n';
import { MODES } from '../lib/generator';
import { sounds } from '../lib/sound';
import type { Mode } from '../lib/types';
import { Bunny } from './Bunny';
import { LangPicker } from './LangPicker';

/** Shown on the first visit, and from the home screen to switch. */
type Props = { current?: Mode; lang: Lang; onLang: (l: Lang) => void; onPick: (m: Mode) => void };

export function ModePick({ current, lang, onLang, onPick }: Props) {
  const t = useT();
  return (
    <section class="screen">
      <header class="topbar">
        <span class="spacer" />
        <LangPicker lang={lang} onChange={onLang} />
      </header>
      <div class="mode-body">
        <div class="mode-hero">
          <Bunny mood="happy" />
          <h1 class="mode-title">{t('mode.title')}</h1>
        </div>
        <div class="modes" role="radiogroup" aria-label={t('mode.aria')}>
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button
              key={m}
              class={`mode-card m-${m}`}
              role="radio"
              aria-checked={current === m}
              onClick={() => {
                sounds.tap();
                onPick(m);
              }}
            >
              <span class="mode-signs" aria-hidden="true">
                {MODES[m].signs.split(' ').map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </span>
              <span class="mode-name">{t(`mode.${m}.name`)}</span>
              <span class="mode-blurb">{t(`mode.${m}.blurb`)}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
