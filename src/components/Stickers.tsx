import { STICKERS } from '../lib/storage';

export function Stickers({ owned, onBack }: { owned: string[]; onBack: () => void }) {
  return (
    <section class="screen">
      <header class="topbar">
        <button class="puffy icon-btn" aria-label="Back" onClick={onBack}>
          ◀
        </button>
      </header>
      <div class="book-body">
        <h1 class="book-title">My sticker book</h1>
        <p class="book-count">
          {owned.length} of {STICKERS.length} stickers · finish a quiz to get one
        </p>
        <div class="book">
          {STICKERS.map((s) =>
            owned.includes(s) ? (
              <div key={s} class="sticker" role="img" aria-label="sticker">
                {s}
              </div>
            ) : (
              <div key={s} class="sticker empty" aria-label="not found yet">
                ?
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
