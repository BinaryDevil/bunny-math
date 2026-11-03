import { STICKERS } from '../lib/storage';
import { useLanguage } from './Language';

export function Stickers({ owned, onBack }: { owned: string[]; onBack: () => void }) {
  const { t } = useLanguage();
  return (
    <section class="screen">
      <header class="topbar">
        <button class="puffy icon-btn" aria-label={t("Back")} onClick={onBack}>
          ◀
        </button>
      </header>
      <div class="book-body">
        <h1 class="book-title">{t("My sticker book")}</h1>
        <p class="book-count">
          {t('{owned} of {total} stickers · finish a quiz to get one', { owned: owned.length, total: STICKERS.length })}
        </p>
        <div class="book">
          {STICKERS.map((s) =>
            owned.includes(s) ? (
              <div key={s} class="sticker" role="img" aria-label={t("sticker")}>
                {s}
              </div>
            ) : (
              <div key={s} class="sticker empty" aria-label={t("not found yet")}>
                ?
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
