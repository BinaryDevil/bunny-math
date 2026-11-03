// @vitest-environment happy-dom
/**
 * End-to-end language wiring: the real <App> with a mocked navigator and localStorage.
 * First visit follows the browser; a pick from the visible picker is saved and wins on later visits.
 */
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { activate, browserLangs } from './i18n';

const KEY = 'bunny-math:v1';
let root: HTMLElement;

function setBrowser(languages: string[] | undefined, language?: string) {
  Object.defineProperty(navigator, 'languages', { configurable: true, get: () => languages });
  Object.defineProperty(navigator, 'language', { configurable: true, get: () => language });
}

function mount() {
  act(() => render(<App />, root));
}
function unmount() {
  act(() => render(null, root));
}
const picker = () => root.querySelector<HTMLSelectElement>('.lang-pick select')!;
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');

function pick(lang: string) {
  act(() => {
    picker().value = lang;
    picker().dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  unmount();
  root.remove();
  activate('en');
  vi.restoreAllMocks();
});

describe('first visit follows the browser language', () => {
  it.each([
    [['zh-HK', 'en-US'], 'zh-TW', '小兔數學'],
    [['zh-Hant-TW'], 'zh-TW', '小兔數學'],
    [['zh-SG'], 'zh-CN', '小兔数学'],
    [['zh'], 'zh-CN', '小兔数学'],
    [['nl-NL', 'fr-CA'], 'fr', 'Bunny Math'],
    [['pt-BR'], 'pt', 'Bunny Math'],
    [['es-MX'], 'es', 'Bunny Math'],
    [['de-AT'], 'de', 'Bunny Math'],
    [['ja-JP'], 'ja', 'うさぎさんすう'],
    [['ko-KR'], 'ko', '토끼 수학'],
    [['nl-NL', 'sv-SE'], 'en', 'Bunny Math'],
  ])('%j → %s', (langs, want, title) => {
    setBrowser(langs, langs[0]);
    mount();
    expect(picker().value).toBe(want);
    expect(document.documentElement.lang).toBe(want);
    expect(document.title).toBe(title);
  });

  it('shows translated text on the first screen', () => {
    setBrowser(['de-DE']);
    mount();
    expect(root.querySelector('.mode-title')!.textContent).toBe('Was wollen wir üben?');
  });

  it('uses navigator.language when navigator.languages is empty or missing', () => {
    setBrowser([], 'ja-JP');
    mount();
    expect(picker().value).toBe('ja');
    unmount();
    setBrowser(undefined, 'ko');
    mount();
    expect(picker().value).toBe('ko');
  });

  it('falls back to English when the browser gives nothing', () => {
    setBrowser(undefined, undefined);
    mount();
    expect(picker().value).toBe('en');
  });

  it('does not save the detected language, so a later visit follows a changed browser', () => {
    setBrowser(['fr-FR']);
    mount();
    expect(picker().value).toBe('fr');
    expect(localStorage.getItem(KEY)).not.toBeNull(); // the app did save its state…
    expect(stored()).not.toHaveProperty('lang'); // …but not the guessed language
    unmount();

    setBrowser(['es-ES']);
    mount();
    expect(picker().value).toBe('es');
  });

  it('follows a browser language change while open, until the child picks one', () => {
    setBrowser(['en-US']);
    mount();
    setBrowser(['de-DE']);
    act(() => void window.dispatchEvent(new Event('languagechange')));
    expect(picker().value).toBe('de');
    expect(document.documentElement.lang).toBe('de');

    pick('ja');
    setBrowser(['fr-FR']);
    act(() => void window.dispatchEvent(new Event('languagechange')));
    expect(picker().value).toBe('ja');
  });
});

describe('a manual pick', () => {
  it('switches the app at once, is saved, and overrides the browser on later visits', () => {
    setBrowser(['de-DE']);
    mount();
    pick('zh-TW');
    expect(document.documentElement.lang).toBe('zh-TW');
    expect(root.querySelector('.mode-title')!.textContent).toBe('我們來練習什麼？');
    expect(stored().lang).toBe('zh-TW');
    unmount();

    setBrowser(['ko-KR', 'en']);
    mount();
    expect(picker().value).toBe('zh-TW');
    expect(document.documentElement.lang).toBe('zh-TW');
  });

  it('is kept even when it matches what the browser would pick', () => {
    setBrowser(['fr-FR']);
    mount();
    pick('en');
    pick('fr');
    expect(stored().lang).toBe('fr');
    unmount();
    setBrowser(['es']);
    mount();
    expect(picker().value).toBe('fr');
  });

  it('keeps the rest of the saved progress', () => {
    localStorage.setItem(KEY, JSON.stringify({ mode: 'all', stickers: ['🍓'], levelFor: { plus: 3, all: 12 } }));
    setBrowser(['en']);
    mount();
    pick('pt');
    expect(stored()).toMatchObject({ lang: 'pt', mode: 'all', stickers: ['🍓'], levelFor: { plus: 3, all: 12 } });
  });

  it('a saved language that is no longer offered is ignored in favour of the browser', () => {
    localStorage.setItem(KEY, JSON.stringify({ lang: 'xx', mode: 'plus' }));
    setBrowser(['es-MX']);
    mount();
    expect(picker().value).toBe('es');
  });

  it('works when storage is blocked (it just is not remembered)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setBrowser(['ja']);
    mount();
    expect(picker().value).toBe('ja');
    pick('de');
    expect(picker().value).toBe('de');
  });
});

describe('browserLangs', () => {
  it('reads navigator.languages in order, else navigator.language', () => {
    expect(browserLangs({ languages: ['nl-NL', 'fr-CA'], language: 'nl-NL' })).toEqual(['nl-NL', 'fr-CA']);
    expect(browserLangs({ languages: [], language: 'pt-BR' })).toEqual(['pt-BR']);
    expect(browserLangs({ language: 'de-AT' })).toEqual(['de-AT']);
    expect(browserLangs({})).toEqual([]);
  });
});
