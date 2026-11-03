import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { de } from './de';
import { en, type Messages } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { ko } from './ko';
import { pt } from './pt';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';

/**
 * A tiny hand-rolled i18n layer.
 *
 * - `en.ts` is the source of truth. Every other language is typed as `Messages`,
 *   so TypeScript flags a missing or extra key.
 * - `{name}` in a message is replaced by `params.name`.
 * - Plurals use two keys, `thing_one` and `thing_other`, picked with `tn()` via Intl.PluralRules.
 * - `*stars*` around words mark highlights (see `Highlight` in Explain.tsx); keep them in translations.
 * - Digits are never localized: numbers are always written with 0–9.
 */

/** Languages in the order shown in the picker. `short` is the badge on the picker button. */
export const LANGS = [
  { id: 'en', name: 'English', short: 'EN' },
  { id: 'zh-CN', name: '简体中文', short: '简' },
  { id: 'zh-TW', name: '繁體中文', short: '繁' },
  { id: 'fr', name: 'Français', short: 'FR' },
  { id: 'es', name: 'Español', short: 'ES' },
  { id: 'de', name: 'Deutsch', short: 'DE' },
  { id: 'ja', name: '日本語', short: '日' },
  { id: 'ko', name: '한국어', short: '한' },
  { id: 'pt', name: 'Português', short: 'PT' },
] as const;

export type Lang = (typeof LANGS)[number]['id'];
export type { Messages };
export type MessageKey = keyof Messages;
export type Params = Record<string, string | number>;

/** Keys that come in `_one` / `_other` pairs, named without the suffix. */
export type PluralKey = MessageKey extends infer K ? (K extends `${infer B}_one` ? B : never) : never;

export const MESSAGES: Record<Lang, Messages> = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, fr, es, de, ja, ko, pt };

export const isLang = (x: unknown): x is Lang => LANGS.some((l) => l.id === x);

/**
 * Picks the best language from the browser's preferences (navigator.languages), in order.
 * zh-Hant / zh-TW / zh-HK / zh-MO → Traditional, any other zh → Simplified,
 * otherwise the base language (pt-BR → pt, fr-CA → fr). Entries we don't offer are
 * skipped in favour of later ones; if nothing matches, English.
 */
export function detectLang(prefs: readonly (string | null | undefined)[] | undefined): Lang {
  for (const raw of prefs ?? []) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().toLowerCase().replace(/_/g, '-');
    const base = tag.split('-')[0];
    if (base === 'zh') {
      if (/-hans\b/.test(tag)) return 'zh-CN';
      return /-(hant|tw|hk|mo)\b/.test(tag) ? 'zh-TW' : 'zh-CN';
    }
    const hit = LANGS.find((l) => l.id === base);
    if (hit) return hit.id;
  }
  return 'en';
}

/** The browser's language list: navigator.languages, or navigator.language when that list is missing or empty. */
export function browserLangs(nav: Partial<Pick<Navigator, 'languages' | 'language'>> | undefined = globalThis.navigator): string[] {
  if (!nav) return [];
  if (nav.languages?.length) return [...nav.languages];
  return nav.language ? [nav.language] : [];
}

let current: Lang = 'en';
export const getLang = () => current;

/** Switches the language used by `t()`. The app calls this while rendering, before any child reads a string. */
export function activate(lang: Lang) {
  current = lang;
}

function interpolate(msg: string, params?: Params) {
  if (!params) return msg;
  return msg.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** The message for `key` in the current language, with `{params}` filled in. */
export function t(key: MessageKey, params?: Params): string {
  return format(MESSAGES[current][key] ?? en[key], params);
}

/** Fills in `{params}` and applies the current language's spacing rules. For messages kept outside MESSAGES. */
export function format(message: string, params?: Params): string {
  let msg = message;
  // French puts a (non-breaking) space before ! ? : ; so the sign never wraps onto its own line.
  if (current === 'fr') msg = msg.replace(/ ([!?:;])/g, ' $1');
  const out = interpolate(msg, params);
  return NO_SPACES.has(current) ? glueNumbers(out) : out;
}

/** Languages whose lines may wrap between any two characters, even inside "671こ" or "3条". */
const NO_SPACES = new Set<Lang>(['zh-CN', 'zh-TW', 'ja', 'ko']);
/**
 * Puts an invisible word joiner (U+2060) between a number and a letter right next to it, so a
 * number never wraps away from its counter word ("442 / こ"). `*` highlight marks are looked through.
 */
// No lookbehind here: Safari before 16.4 can't parse it, and one bad regex stops the whole app loading.
export const glueNumbers = (s: string) => s.replace(/(\p{L}\*?)(?=\d)/gu, '$1\u2060').replace(/(\d)(?=\*?\p{L})/gu, '$1\u2060');

const pluralRules = new Map<Lang, Intl.PluralRules>();
/** A message that depends on a count, e.g. tn('unit.ten', 3) → "3 tens". `{n}` is filled in automatically. */
export function tn(key: PluralKey, n: number, params?: Params): string {
  let rules = pluralRules.get(current);
  if (!rules) pluralRules.set(current, (rules = new Intl.PluralRules(current)));
  const form = rules.select(n) === 'one' ? 'one' : 'other';
  return t(`${key}_${form}` as MessageKey, { n, ...params });
}

/** "a, b and c" in the current language. */
export function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return t('list.and', { rest: items.slice(0, -1).join(t('list.sep')), last: items[items.length - 1] });
}

/** The current language, provided by the app so components re-render when it changes. */
export const LangContext = createContext<Lang>('en');

export const useLang = () => useContext(LangContext);

/** Subscribes the component to language changes and returns `t`. */
export function useT() {
  useContext(LangContext);
  return t;
}
