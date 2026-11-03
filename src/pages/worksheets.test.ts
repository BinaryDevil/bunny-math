// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { getLang, LANGS } from '../i18n';
import { PAGE_MESSAGES } from '../i18n/pages';
import { decodeCode } from '../lib/codes';
import { LEVELS } from '../lib/generator';
import { QUESTIONS, SITE, sitemap, SLUGS, worksheetPages } from './worksheets';

const CSS = ['assets/index-abc.css'];
const pages = worksheetPages(CSS);
const byPath = new Map(pages.map((p) => [p.path, p.html]));
// happy-dom would try to fetch the stylesheet, so it is renamed before parsing.
const doc = (path: string) => new DOMParser().parseFromString(byPath.get(path)!.replace(/rel="stylesheet"/g, 'rel="css"'), 'text/html');

const placeholders = (msg: string) => [...new Set([...msg.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

describe('page translations', () => {
  const en = PAGE_MESSAGES.en;
  it.each(LANGS.filter((l) => l.id !== 'en'))('$id has the same keys and {placeholders} as English', ({ id }) => {
    expect(Object.keys(PAGE_MESSAGES[id]).sort()).toEqual(Object.keys(en).sort());
    for (const [key, msg] of Object.entries(en)) expect(placeholders(PAGE_MESSAGES[id][key as keyof typeof en]), `${id} ${key}`).toEqual(placeholders(msg));
  });

  it.each(LANGS)('$id has a title for every level and writes numbers with 0–9', ({ id }) => {
    for (const l of LEVELS) expect(PAGE_MESSAGES[id][`page.lv.${l.id}` as keyof typeof en].trim()).not.toBe('');
    for (const [key, msg] of Object.entries(PAGE_MESSAGES[id])) {
      expect(msg.trim(), `${id} ${key}`).not.toBe('');
      expect(msg, `${id} ${key}`).not.toMatch(/[\uFF10-\uFF19\uFF0B\uFF0D\uFF1D\uFF1C\uFF1E]/);
    }
  });
});

describe('worksheet pages', () => {
  it('makes an index and one page per level, in every language', () => {
    expect(pages).toHaveLength(LANGS.length * (LEVELS.length + 1));
    expect(byPath.has('worksheets/index.html')).toBe(true);
    expect(byPath.has('worksheets/times-tables-2-5-10/index.html')).toBe(true);
    expect(byPath.has('zh-cn/worksheets/times-tables-2-5-10/index.html')).toBe(true);
    expect(new Set(Object.values(SLUGS)).size).toBe(LEVELS.length);
  });

  it('leaves the app language as it was', () => {
    expect(getLang()).toBe('en');
  });

  it('prints 20 questions and 20 answers', () => {
    for (const { path } of pages.filter((p) => !p.path.endsWith('worksheets/index.html'))) {
      const d = doc(path);
      expect(d.querySelectorAll('.ws-q'), path).toHaveLength(QUESTIONS);
      expect(d.querySelectorAll('.ws-key li'), path).toHaveLength(QUESTIONS);
    }
  });

  it('gives search engines a title, description, canonical address and every translation', () => {
    for (const { path } of pages) {
      const d = doc(path);
      const dir = path.replace(/index\.html$/, '');
      expect(d.title.length, path).toBeGreaterThan(10);
      expect(d.title, path).not.toMatch(/\{|⁠/);
      expect(d.querySelector('meta[name=description]')?.getAttribute('content'), path).not.toMatch(/\{|⁠/);
      expect(d.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe(`${SITE}/${dir}`);
      expect(d.querySelectorAll('link[rel=alternate][hreflang]')).toHaveLength(LANGS.length + 1);
      expect(d.querySelectorAll('h1'), path).toHaveLength(1);
      for (const s of d.querySelectorAll('script[type="application/ld+json"]')) expect(() => JSON.parse(s.textContent!)).not.toThrow();
    }
  });

  it('is written in its own language', () => {
    expect(doc('worksheets/times-tables-up-to-10/index.html').documentElement.lang).toBe('en');
    const zh = doc('zh-cn/worksheets/times-tables-up-to-10/index.html');
    expect(zh.documentElement.lang).toBe('zh-CN');
    expect(zh.querySelector('h1')!.textContent).toBe('九九乘法口诀练习题');
  });

  it('links to the stylesheet, the home page and other levels with paths that work from its folder', () => {
    const d = doc('zh-cn/worksheets/times-tables-up-to-10/index.html');
    expect(d.querySelector('link[rel=css]')!.getAttribute('href')).toBe('../../../assets/index-abc.css');
    expect(d.querySelector('.brand')!.getAttribute('href')).toBe('../../../');
    expect(d.querySelector('.lv-list a')!.getAttribute('href')).toBe('../../../zh-cn/worksheets/addition-subtraction-within-20/');
    expect(doc('worksheets/index.html').querySelector('link[rel=css]')!.getAttribute('href')).toBe('../assets/index-abc.css');
  });

  it('opens the app with a code for the same level, in the same language', () => {
    const d = doc('fr/worksheets/times-tables-2-5-10/index.html');
    const play = new URL(d.querySelector('.page-actions a')!.getAttribute('href')!, 'https://x.test/fr/worksheets/times-tables-2-5-10/');
    expect(play.pathname).toBe('/');
    expect(play.searchParams.get('lang')).toBe('fr');
    expect(decodeCode(play.searchParams.get('code')!)).toMatchObject({ adventure: false, level: 11, length: QUESTIONS });
  });

  it('shows the same questions on every build', () => {
    expect(worksheetPages(CSS)).toEqual(pages);
  });
});

describe('sitemap', () => {
  it('lists the home page and every worksheet page once', () => {
    const xml = sitemap();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toHaveLength(pages.length + 1);
    expect(new Set(locs).size).toBe(locs.length);
    expect(locs).toContain(`${SITE}/`);
    for (const { path } of pages) expect(locs).toContain(`${SITE}/${path.replace(/index\.html$/, '')}`);
  });
});
