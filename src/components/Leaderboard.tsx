import { useEffect, useState } from 'preact/hooks';
import { t, useT } from '../i18n';
import { fetchBoard, rename, savedPlayer, type Board, type Entry } from '../lib/leaderboard';
import { NAME_ADJECTIVES, NAME_EMOJI, NAME_NOUNS, nameText, randomName, type PlayerName } from '../lib/names';
import { sounds } from '../lib/sound';
import { Rascal } from './Rascal';

function Row({ e, me }: { e: Entry; me: boolean }) {
  return (
    <li class={`lb-row ${me ? 'me' : ''}`} aria-label={t('lb.rank', { rank: e.rank, name: e.display, total: e.total })}>
      <span class="lb-rank">#{e.rank}</span>
      <span class="lb-name">
        {e.display}
        {me && <span class="you-tag">{t('lb.you')}</span>}
      </span>
      <span class="lb-total">{e.total} 🥕</span>
    </li>
  );
}

export function Leaderboard({ onBack, onName }: { onBack: () => void; onName: () => void }) {
  useT();
  const [board, setBoard] = useState<Board | null | 'loading'>('loading');
  useEffect(() => {
    fetchBoard().then(setBoard);
  }, []);
  const me = board && board !== 'loading' ? board.me : null;
  // Players who haven't won a carrot yet aren't shown.
  const top = board && board !== 'loading' ? board.top.filter((e) => e.total > 0) : [];
  const podium = top.slice(0, 3);
  const rest = top.slice(3);
  const near = board && board !== 'loading' && me && !top.some((e) => e.rank === me.rank) ? board.near.filter((e) => e.total > 0) : [];
  return (
    <section class="screen">
      <header class="topbar">
        <button class="puffy icon-btn" aria-label={t('lb.back')} onClick={onBack}>
          ◀
        </button>
        <span class="spacer" />
        {savedPlayer() && (
          <button class="puffy" onClick={onName}>
            {t('lb.changeName')}
          </button>
        )}
      </header>
      <div class="lb-body">
        <h1 class="adv-title">🏆 {t('lb.title')}</h1>
        <p class="adv-text">{t('lb.sub')}</p>
        {board === 'loading' && <p class="adv-text">{t('lb.loading')}</p>}
        {board === null && (
          <div class="adv-panel">
            <Rascal mood="dizzy" />
            <p class="adv-text">{t('lb.offline')}</p>
          </div>
        )}
        {podium.length > 0 && (
          <ol class="podium">
            {podium.map((e) => (
              <li key={e.rank} class={`p${e.rank} ${me?.rank === e.rank ? 'me' : ''}`} aria-label={t('lb.rank', { rank: e.rank, name: e.display, total: e.total })}>
                <span class="medal">{['🥇', '🥈', '🥉'][e.rank - 1] ?? `#${e.rank}`}</span>
                <span class="p-emoji">{Array.from(e.display)[0]}</span>
                <span class="p-name">{e.display.split(' ').slice(1).join(' ')}</span>
                {me?.rank === e.rank && <span class="you-tag">{t('lb.you')}</span>}
                <span class="lb-total">{e.total} 🥕</span>
              </li>
            ))}
          </ol>
        )}
        {rest.length > 0 && (
          <ol class="lb-list">
            {rest.map((e) => (
              <Row key={e.rank} e={e} me={me?.rank === e.rank} />
            ))}
          </ol>
        )}
        {near.length > 0 && (
          <>
            <p class="lb-gap" aria-hidden="true">⋯</p>
            <ol class="lb-list">
              {near.map((e) => (
                <Row key={e.rank} e={e} me={me?.rank === e.rank} />
              ))}
            </ol>
          </>
        )}
        {board && board !== 'loading' && !me?.total && <p class="adv-text">{t('lb.join')}</p>}
      </div>
    </section>
  );
}

const WHEELS = [
  { key: 'emoji', list: NAME_EMOJI, part: 'name.emoji' },
  { key: 'adj', list: NAME_ADJECTIVES, part: 'name.adj' },
  { key: 'noun', list: NAME_NOUNS, part: 'name.noun' },
] as const;

/** Pick a name from three wheels. Names are never typed, so they're always kid-safe. */
export function NamePicker({ onDone }: { onDone: () => void }) {
  useT();
  const [name, setName] = useState<PlayerName>(() => savedPlayer()?.name ?? randomName());
  const [state, setState] = useState<'idle' | 'saving' | 'taken' | 'offline'>('idle');
  const spin = (key: (typeof WHEELS)[number]['key'], list: readonly string[], by: number) => {
    sounds.tap();
    setState('idle');
    setName((n) => ({ ...n, [key]: list[(list.indexOf(n[key]) + by + list.length) % list.length] }));
  };
  /** A random name that nobody has yet: tries a few until the server says yes. */
  async function surprise() {
    sounds.tap();
    setState('saving');
    for (let i = 0; i < 8; i++) {
      const n = randomName();
      setName(n);
      const r = await rename(n);
      if (r === 'taken') continue;
      if (r === 'ok') sounds.pop();
      setState(r === 'ok' ? 'idle' : r);
      return;
    }
    setState('taken');
  }

  async function save() {
    sounds.tap();
    setState('saving');
    const r = await rename(name);
    if (r === 'ok') {
      sounds.right();
      onDone();
    } else setState(r);
  }
  return (
    <section class="screen">
      <header class="topbar">
        <button class="puffy icon-btn" aria-label={t('lb.back')} onClick={onDone}>
          ◀
        </button>
      </header>
      <div class="lb-body">
        <h1 class="adv-title">{t('name.title')}</h1>
        <p class="name-preview" aria-live="polite">
          {nameText(name)}
        </p>
        <div class="wheels">
          {WHEELS.map(({ key, list, part }) => (
            <div key={key} class="wheel">
              <button class="puffy icon-btn" aria-label={t('name.prev', { part: t(part) })} onClick={() => spin(key, list, -1)}>
                ▲
              </button>
              <span class={`wheel-val ${key}`}>{name[key]}</span>
              <button class="puffy icon-btn" aria-label={t('name.next', { part: t(part) })} onClick={() => spin(key, list, 1)}>
                ▼
              </button>
            </div>
          ))}
        </div>
        {state === 'taken' && <p class="code-bad">{t('name.taken')}</p>}
        {state === 'offline' && <p class="code-bad">{t('name.offline')}</p>}
        <div class="res-actions">
          <button class="puffy butter" disabled={state === 'saving'} onClick={surprise}>
            {t('name.random')}
          </button>
          <button class="puffy berry" disabled={state === 'saving'} onClick={save}>
            {t('name.save')}
          </button>
        </div>
      </div>
    </section>
  );
}
