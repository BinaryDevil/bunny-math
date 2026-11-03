import { afterEach, describe, expect, it, vi } from 'vitest';
import { load, save } from './storage';
import { LEVELS, generateQuiz } from './generator';
import { explain } from './explain';
import { explanationMessages } from './explain-i18n';
import { translate, localizeStory, normalizeLanguage } from './i18n';

describe('language support', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('preserves old progress and remembers the selected language', () => {
    let value = JSON.stringify({ mode: 'plus', level: 3, stickers: ['🐰'], best: { 3: 2 } });
    vi.stubGlobal('localStorage', { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } });
    const saved = load();
    expect(saved.language).toBe('en');
    expect(saved.levelFor.plus).toBe(3);
    expect(saved.stickers).toEqual(['🐰']);
    save({ ...saved, language: 'zh-CN' });
    expect(load()).toMatchObject({ language: 'zh-CN', stickers: ['🐰'], best: { 3: 2 } });
  });
  it('defaults unknown saved languages to English', () => {
    expect(normalizeLanguage(undefined)).toBe('en');
    expect(normalizeLanguage('fr')).toBe('en');
    expect(normalizeLanguage('zh-CN')).toBe('zh-CN');
  });
  it('translates interface strings and dynamic values', () => {
    expect(translate('zh-CN', 'Question {n} of {total}', { n: 2, total: 15 })).toBe('第 2 题，共 15 题');
    expect(translate('en', 'Start!')).toBe('Start!');
  });
  it('localizes story text without changing the problem', () => {
    const q = generateQuiz({ level: 1, count: 20, seed: 7, kinds: ['story'] }).find(q => q.kind === 'story')!;
    if (q.kind !== 'story') throw new Error('expected story');
    const story = localizeStory(q, 'zh-CN');
    expect(story.text).toMatch(/[\u4e00-\u9fff]/);
    expect(story.text).toContain(String(q.fact.a));
    expect(story.text).toContain(String(q.fact.b));
  });
  it('translates important regrouping steps without changing the arithmetic', () => {
    const q = { id: 'q', kind: 'type' as const, skill: 'borrow' as const, fact: { a: 503, op: '-' as const, b: 167, c: 336 } };
    const captions = explain(q, 'column', 'zh-CN').map(s => s.caption);
    expect(captions[1]).toContain('借 1');
    expect(captions[1]).toContain('13 − 7 = 6');
    expect(captions.at(-1)).toContain('503 − 167 = 336');
  });
  it('keeps the same teaching keys and named parameters in each language', () => {
    const en = explanationMessages.en;
    const zh = explanationMessages['zh-CN'];
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const parameters = (value: string) => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort();
      expect(parameters(zh[key]), key).toEqual(parameters(en[key]));
    }
  });
  it('generates structured localized steps for carrying and division', () => {
    const add = { id: 'add', kind: 'type' as const, skill: 'carry' as const, fact: { a: 38, op: '+' as const, b: 7, c: 45 } };
    expect(explain(add, 'blocks', 'zh-CN').map(s => s.caption)).toEqual([
      '用积木摆出 *38* 和 *7*。', '把个位合起来：*8 + 7 = 15*', '圈出 *10 个一*……', '……换成 *1 个十*！', '4 个十和 5 个一 = *45*',
    ]);
    const divide = { id: 'div', kind: 'type' as const, skill: 'divide' as const, fact: { a: 72, op: '÷' as const, b: 4, c: 18 } };
    const captions = explain(divide, 'column', 'zh-CN').map(s => s.caption);
    expect(captions[0]).toBe('*72* 里有多少个 *4*？从左边开始算。');
    expect(captions[2]).toBe('7 − 4 = 3。把 2 移下来：*32*。');
  });
  it('localizes all explanation captions and scene text across levels and styles', () => {
    for (const level of LEVELS) for (let seed = 1; seed <= 25; seed++) {
      for (const q of generateQuiz({ level: level.id, count: 15, seed })) for (const style of ['blocks', 'column'] as const) {
        for (const step of explain(q, style, 'zh-CN')) {
          expect(step.caption, `${JSON.stringify(q.fact)} ${style}`).not.toMatch(/[A-Za-z]/);
          if (step.scene.type === 'text') for (const line of step.scene.lines) expect(line).not.toMatch(/[A-Za-z]/);
        }
      }
    }
  });
});
