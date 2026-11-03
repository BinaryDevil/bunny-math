import { LANGS, useT, type Lang } from '../i18n';
import { sounds } from '../lib/sound';

/**
 * A small globe pill. A real <select> sits invisibly on top, so phones open their
 * own language list and keyboards and screen readers work as usual.
 */
export function LangPicker({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const t = useT();
  const cur = LANGS.find((l) => l.id === lang) ?? LANGS[0];
  return (
    <span class="puffy lang-pick no-print">
      <span aria-hidden="true">🌐</span>
      <span class="lang-short" aria-hidden="true" lang={cur.id}>
        {cur.short}
      </span>
      <select
        aria-label={t('lang.label')}
        title={t('lang.label')}
        value={lang}
        onChange={(e) => {
          sounds.tap();
          onChange(e.currentTarget.value as Lang);
        }}
      >
        {LANGS.map((l) => (
          <option key={l.id} value={l.id} lang={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </span>
  );
}
