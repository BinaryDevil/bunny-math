import { useState } from 'preact/hooks';
import { t, useT } from '../i18n';
import { CODE_EMOJI, codeLink, decodeCode, type ShareCode as Code } from '../lib/codes';
import { sounds } from '../lib/sound';

/** The 5-emoji code, with a button that shares a link to it (or copies it where sharing isn't offered). */
export function ShareCode({ code, text }: { code: string; text: string }) {
  useT();
  const [copied, setCopied] = useState(false);
  async function share() {
    sounds.tap();
    const url = codeLink(code);
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Cancelled, or no clipboard: nothing to do.
    }
  }
  return (
    <div class="share-row">
      <span class="share-label">{t('share.code')}</span>
      <span class="share-code">{code}</span>
      <button class="puffy butter share-btn" onClick={share}>
        {copied ? t('share.copied') : t('share.button')}
      </button>
    </div>
  );
}

/** Type a friend's code by tapping its 5 pictures. */
export function CodeEntry({ initial = '', onPlay, onClose }: { initial?: string; onPlay: (c: Code, text: string) => void; onClose: () => void }) {
  useT();
  const [chars, setChars] = useState<string[]>(() => Array.from(initial.replace(/[\s︎️]/g, '')).slice(0, 5));
  const text = chars.join('');
  const code = chars.length === 5 ? decodeCode(text) : null;
  const add = (e: string) => {
    sounds.tap();
    setChars((c) => (c.length < 5 ? [...c, e] : c));
  };
  return (
    <div class="scrim">
      <div class="dialog code-dialog" role="dialog" aria-modal="true" aria-label={t('code.title')}>
        <h2>{t('code.title')}</h2>
        <p>{t('code.body')}</p>
        <div class="code-slots" aria-live="polite">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} class={`code-slot ${chars[i] ? 'filled' : ''}`}>
              {chars[i] ?? ''}
            </span>
          ))}
          <button class="puffy icon-btn" aria-label={t('code.delete')} onClick={() => setChars((c) => c.slice(0, -1))}>
            ⌫
          </button>
        </div>
        {chars.length === 5 && !code && <p class="code-bad">{t('code.bad')}</p>}
        <div class="code-keys">
          {CODE_EMOJI.map((e) => (
            <button key={e} class="code-key" onClick={() => add(e)} disabled={chars.length >= 5}>
              {e}
            </button>
          ))}
        </div>
        <div class="dialog-actions">
          <button class="puffy" onClick={onClose}>
            {t('code.close')}
          </button>
          <button class="puffy berry" disabled={!code} onClick={() => code && onPlay(code, text)}>
            {t('code.go')}
          </button>
        </div>
      </div>
    </div>
  );
}
