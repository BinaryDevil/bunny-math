import { MODES } from '../lib/generator';
import { sounds } from '../lib/sound';
import type { Mode } from '../lib/types';
import { Bunny } from './Bunny';
import { LanguageSwitch, useLanguage } from './Language';

/** Shown on the first visit, and from the home screen to switch. */
export function ModePick({ current, onPick }: { current?: Mode; onPick: (m: Mode) => void }) {
  const { t } = useLanguage();
  return (
    <section class="screen">
      <header class="topbar mode-language"><span class="spacer" /><LanguageSwitch /></header>
      <div class="mode-body">
        <div class="mode-hero">
          <Bunny mood="happy" />
          <h1 class="mode-title">{t("What shall we practice?")}</h1>
        </div>
        <div class="modes" role="radiogroup" aria-label={t("What to practice")}>
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
              <span class="mode-name">{t(MODES[m].name)}</span>
              <span class="mode-blurb">{t(MODES[m].blurb)}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
