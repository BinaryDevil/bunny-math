import { afterEach, describe, expect, it } from 'vitest';
import { explain } from '../lib/explain';
import { generateQuiz, LEVELS } from '../lib/generator';
import { en } from './en';
import { activate, detectLang, LANGS, list, MESSAGES, t, tn } from './index';

/** The set of {placeholders}; a translation may use one twice ("de {b} en {b}"). */
const placeholders = (msg: string) => [...new Set([...msg.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
const others = LANGS.filter((l) => l.id !== 'en');

afterEach(() => activate('en'));

describe('translations', () => {
  it.each(others)('$id has exactly the same keys as English', ({ id }) => {
    expect(Object.keys(MESSAGES[id]).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(others)('$id uses the same {placeholders} as English', ({ id }) => {
    const msgs = MESSAGES[id];
    for (const [key, msg] of Object.entries(en)) {
      expect(placeholders(msgs[key as keyof typeof en]), `${id} ${key}`).toEqual(placeholders(msg));
    }
  });

  it.each(LANGS)('$id has no empty messages and balanced *highlights*', ({ id }) => {
    for (const [key, msg] of Object.entries(MESSAGES[id])) {
      if (key !== 'list.sep') expect(msg.trim(), `${id} ${key}`).not.toBe('');
      expect((msg.match(/\*/g) ?? []).length % 2, `${id} ${key}`).toBe(0);
    }
  });

  it.each(LANGS)('$id writes numbers and math signs the same way as English (no full-width ０-９ ＋ − × ÷ ＝)', ({ id }) => {
    for (const [key, msg] of Object.entries(MESSAGES[id])) {
      expect(msg, `${id} ${key}`).not.toMatch(/[\uFF10-\uFF19\uFF0B\uFF0D\uFF1D\uFF1C\uFF1E]/);
      expect(msg.match(/\p{Nd}/gu)?.every((d) => /[0-9]/.test(d)) ?? true, `${id} ${key}`).toBe(true);
    }
  });

  it('every plural has both forms', () => {
    for (const key of Object.keys(en)) {
      if (key.endsWith('_one')) expect(en).toHaveProperty(key.replace(/_one$/, '_other'));
      if (key.endsWith('_other')) expect(en).toHaveProperty(key.replace(/_other$/, '_one'));
    }
  });
});

describe('t and friends', () => {
  it('fills in placeholders', () => {
    expect(t('quiz.progress', { n: 3, total: 15 })).toBe('Question 3 of 15');
    activate('zh-CN');
    expect(t('quiz.progress', { n: 3, total: 15 }).replace(/\u2060/g, '')).toBe('第3题，共15题');
  });

  it('keeps a number on the same line as its counter word in Chinese, Japanese and Korean', () => {
    const WJ = '\u2060';
    activate('ja');
    expect(t('story.strawberries.text', { a: 671, b: 442 })).toBe(`おさらに いちごが 671${WJ}こ。442${WJ}こ たべたよ。`);
    activate('zh-TW');
    expect(t('story.fish.text', { a: 12, b: 3 })).toBe(`魚缸裡有${WJ}12${WJ}條魚，又游進來${WJ}3${WJ}條。`);
    // Through *highlight* marks, and never inside math like "3 + 4 = 7".
    activate('zh-CN');
    expect(t('ex.together_other', { n: 7 })).toBe(`合在一起：一共*${WJ}7${WJ}*个一。`);
    expect(t('ex.togetherOnes', { sum: '3 + 4 = 7' })).toBe('先把个位合起来：*3 + 4 = 7*');
    activate('ko');
    expect(t('story.birds.text', { a: 9, b: 4 })).toContain(`9${WJ}마리`);
    // Languages with spaces are left alone.
    activate('de');
    expect(t('story.birds.text', { a: 9, b: 4 })).not.toContain(WJ);
  });

  it('picks plural forms', () => {
    expect(tn('unit.ten', 1)).toBe('1 ten');
    expect(tn('unit.ten', 4)).toBe('4 tens');
    activate('fr');
    expect(tn('unit.ten', 1)).toBe('1 dizaine');
    expect(tn('unit.ten', 4)).toBe('4 dizaines');
  });

  it('joins lists', () => {
    expect(list(['a', 'b', 'c'])).toBe('a, b and c');
    expect(list(['a'])).toBe('a');
    activate('zh-CN');
    expect(list(['甲', '乙', '丙'])).toBe('甲、乙和丙');
  });

  it('keeps French ! and ? on the same line as their word', () => {
    activate('fr');
    expect(t('home.start')).toBe('C’est parti !');
  });
});

describe('detectLang', () => {
  it.each([
    [['zh-TW'], 'zh-TW'],
    [['zh-HK'], 'zh-TW'],
    [['zh-Hant'], 'zh-TW'],
    [['zh-Hant-CN'], 'zh-TW'],
    [['zh-CN'], 'zh-CN'],
    [['zh'], 'zh-CN'],
    [['zh-Hans-HK'], 'zh-CN'],
    [['zh-SG'], 'zh-CN'],
    [['pt-BR'], 'pt'],
    [['pt-PT'], 'pt'],
    [['fr-CA'], 'fr'],
    [['de_AT'], 'de'],
    [['ja-JP'], 'ja'],
    [['ko-KR'], 'ko'],
    [['es-419'], 'es'],
    [['nl-NL', 'de-DE', 'en'], 'de'],
    [['nl-NL'], 'en'],
    [['nl-NL', 'fr-CA'], 'fr'],
    [['es-MX'], 'es'],
    [['de-AT'], 'de'],
    [['zh-MO'], 'zh-TW'],
    [['zh-Hans'], 'zh-CN'],
    [['zh-Hans-CN'], 'zh-CN'],
    [['ZH-tw'], 'zh-TW'],
    [['zh_TW'], 'zh-TW'],
    [['en-GB', 'zh-TW'], 'en'],
    [['ar', 'sv', 'zh-HK', 'zh-CN'], 'zh-TW'],
    [['', 'ko'], 'ko'],
    [['nl', 'sv', 'pl'], 'en'],
    [[], 'en'],
    [undefined, 'en'],
  ] as const)('%j → %s', (prefs, want) => {
    expect(detectLang(prefs)).toBe(want);
  });
});

describe('explanations in every language', () => {
  const quizzes = LEVELS.flatMap((l) => Array.from({ length: 8 }, (_, seed) => generateQuiz({ level: l.id, count: 15, seed: seed + 1 }))).flat();

  it.each(LANGS)('$id: every caption is filled in, with plain 0–9 digits', ({ id }) => {
    activate(id);
    for (const q of quizzes) {
      for (const style of ['blocks', 'column'] as const) {
        for (const step of explain(q, style)) {
          const where = `${id} ${q.fact.a}${q.fact.op}${q.fact.b} ${style}: ${step.caption}`;
          expect(step.caption, where).not.toMatch(/[{}]|undefined|NaN/);
          expect((step.caption.match(/\*/g) ?? []).length % 2, where).toBe(0);
          // Every digit is an ASCII 0–9 (no full-width or other numeral systems).
          expect(step.caption.match(/\p{Nd}/gu)?.every((d) => /[0-9]/.test(d)) ?? true, where).toBe(true);
          if (step.scene.type === 'text') for (const line of step.scene.lines) expect(line, where).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it('switching language changes the captions, and switching back restores them', () => {
    const q = generateQuiz({ level: 3, count: 1, seed: 1 })[0];
    const english = explain(q).map((s) => s.caption);
    activate('de');
    const german = explain(q).map((s) => s.caption);
    expect(german).not.toEqual(english);
    activate('en');
    expect(explain(q).map((s) => s.caption)).toEqual(english);
  });
});
