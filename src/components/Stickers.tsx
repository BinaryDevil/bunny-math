import { useT } from '../i18n';
import { STICKERS } from '../lib/storage';

export function Stickers({ owned, onBack }: { owned: string[]; onBack: () => void }) {
  const t = useT();
  return (
    <section class="screen">
      <header class="topbar">
        <button class="puffy icon-btn" aria-label={t('book.back')} onClick={onBack}>
          ◀
        </button>
      </header>
      <div class="book-body">
        <h1 class="book-title">{t('book.title')}</h1>
        <p class="book-count">{t('book.count', { owned: owned.length, total: STICKERS.length })}</p>
        <div class="book">
          {STICKERS.map((s) =>
            owned.includes(s) ? (
              <div key={s} class="sticker" role="img" aria-label={t('book.sticker')}>
                {s}
              </div>
            ) : (
              <div key={s} class="sticker empty" role="img" aria-label={t('book.empty')}>
                ?
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
