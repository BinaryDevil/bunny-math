/**
 * Static worksheet pages for search engines: one page per level in every language, plus an
 * index of them, a sitemap, and nothing that needs JavaScript. `npm run build` writes them
 * into dist/ (see vite.config.ts), next to the app.
 *
 *   /worksheets/                          English index
 *   /worksheets/times-tables-2-5-10/      one level, in English
 *   /zh-cn/worksheets/…                   the same in another language
 *
 * Each sheet uses a fixed seed, so a page shows the same questions on every build.
 * The page's words are in src/i18n/pages.ts, the sheet's in the app's own messages, and the
 * printed sheet uses the app's own styles.
 */
import { activate, format, getLang, LANGS, t, type Lang, type MessageKey, type Params } from '../i18n';
import { PAGE_MESSAGES, type PageKey } from '../i18n/pages';
import { encodeCode } from '../lib/codes';
import { LEVELS, opSymbol } from '../lib/generator';
import type { LevelId, Mode, Question } from '../lib/types';
import { keyAnswer, makeSheets } from '../lib/worksheet';

export const SITE = 'https://bunnyland.app';
export const QUESTIONS = 20;

/** The address of each level's page. Never rename one: other sites and search results link to them. */
export const SLUGS: Record<LevelId, string> = {
  1: 'addition-subtraction-within-20',
  2: 'addition-subtraction-no-carrying',
  3: 'addition-subtraction-carrying-borrowing',
  4: 'two-digit-addition-subtraction',
  5: 'three-digit-addition-subtraction',
  6: 'three-digit-regrouping',
  11: 'times-tables-2-5-10',
  12: 'times-tables-up-to-5',
  13: 'times-tables-up-to-10',
  14: 'multiplication-division-2-digit-by-1-digit',
};

export type Page = { path: string; html: string };

/** Where a page lives, from the site root, ending in "/". English has no language folder. */
const dirOf = (lang: Lang, level?: LevelId) => `${lang === 'en' ? '' : `${lang.toLowerCase()}/`}worksheets/${level ? `${SLUGS[level]}/` : ''}`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** For titles and descriptions: without the invisible word joiners t() adds in Chinese, Japanese and Korean. */
const plain = (s: string) => s.replace(/⁠/g, '');
/** A message from src/i18n/pages.ts, in the current language. */
const p = (key: PageKey, params?: Params) => format(PAGE_MESSAGES[getLang()][key], params);
const tx = (key: MessageKey, params?: Params) => esc(t(key, params));
const px = (key: PageKey, params?: Params) => esc(p(key, params));
const topic = (level: LevelId) => p(`page.lv.${level}` as PageKey);
const json = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

/** Same seed in every language, so a translated page shows the same sums. */
const seedFor = (level: LevelId) => 1000 + level;

function box(circle = false) {
  return `<span class="box${circle ? ' circle' : ''}"></span>`;
}

/** One question as printed. Keep in step with PrintedQuestion in components/Worksheet.tsx. */
function questionHtml(q: Question): string {
  const { a, op, b, c } = q.fact;
  const s = opSymbol(op);
  switch (q.kind) {
    case 'missing':
      return q.hide === 'a' ? `${box()} ${s} ${b} = ${c}` : `${a} ${s} ${box()} = ${c}`;
    case 'compare':
      return `${a} ${s} ${b} ${box(true)} ${q.than}`;
    case 'story':
      return `<span class="story">${q.story.emoji} ${tx(`story.${q.story.id}.text` as MessageKey, { a, b })}</span>${tx(`story.${q.story.id}.ask` as MessageKey)} ${box()}`;
    default:
      return `${a} ${s} ${b} = ${box()}`;
  }
}

function sheetHtml(level: LevelId): string {
  const [questions] = makeSheets(level, QUESTIONS, 1, seedFor(level));
  return `<article class="sheet-paper ws-page">
<header class="ws-head"><div><p class="ws-title">${tx('app.name')} 🐰</p><p class="ws-sub">${tx(`level.${level}.name` as MessageKey)} · ${tx(`level.${level}.blurb` as MessageKey)}</p></div>
<div class="ws-lines"><span>${tx('ws.name')} ____________________</span><span>${tx('ws.date')} ____________</span></div></header>
<div class="ws-grid">
${questions.map((q, i) => `<div class="ws-q"><span class="n">${i + 1}.</span><span>${questionHtml(q)}</span></div>`).join('\n')}
</div>
</article>
<article class="sheet-paper ws-answers"><p class="ws-title">${tx('ws.answers')}</p>
<section class="ws-key"><ol>${questions.map((q) => `<li>${esc(String(keyAnswer(q)))}</li>`).join('')}</ol></section>
</article>`;
}

/** Cards linking to each level's page, grouped by mode. */
function levelCards(lang: Lang, root: string, skip?: LevelId): string {
  const modes: Mode[] = ['plus', 'all'];
  return modes
    .map((mode) => {
      const items = LEVELS.filter((l) => l.mode === mode && l.id !== skip)
        .map((l) => `<li><a href="${root}${dirOf(lang, l.id)}"><b>${esc(topic(l.id))}</b><span>${tx(`level.${l.id}.name` as MessageKey)} · ${esc(l.example)}</span></a></li>`)
        .join('');
      return `<h2>${tx(`mode.${mode}.name` as MessageKey)}</h2><ul class="lv-list">${items}</ul>`;
    })
    .join('\n');
}

const PAGE_CSS = `
body.page { height: auto; user-select: text; -webkit-user-select: text; touch-action: auto; overscroll-behavior: auto; }
.page-wrap { max-width: 860px; margin: 0 auto; padding: 16px 16px 48px; }
.page a { color: var(--ink); }
.page-top { display: flex; justify-content: space-between; align-items: center; gap: 8px 16px; flex-wrap: wrap; margin-bottom: 20px; }
.brand { font-family: var(--display); font-size: 24px; text-decoration: none; }
.langs { display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 15px; }
.langs a { color: var(--ink-soft); }
.langs a[aria-current] { color: var(--ink); font-weight: 700; text-decoration: none; }
.crumbs { font-size: 15px; color: var(--ink-soft); margin-bottom: 8px; }
.page h1 { font-family: var(--display); font-weight: 400; font-size: clamp(26px, 5vw, 38px); line-height: 1.25; margin: 0 0 12px; }
:root:is(:lang(zh), :lang(ja), :lang(ko)) :is(.page h1, .brand) { font-weight: 700; }
.lead { font-size: 19px; line-height: 1.5; max-width: 65ch; margin-bottom: 10px; }
.page-actions { display: flex; gap: 12px; flex-wrap: wrap; margin: 20px 0 24px; }
.page-actions .puffy { min-height: 52px; padding: 8px 22px; font-size: 19px; font-weight: 700; display: inline-flex; align-items: center; text-decoration: none; }
.page-actions .puffy.berry { color: #fff; }
.page h2 { font-size: 22px; margin: 28px 0 10px; }
.lv-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.lv-list a { display: block; height: 100%; padding: 12px 16px; background: var(--card); border: var(--line) solid var(--ink); border-radius: var(--r-md); text-decoration: none; }
.lv-list b { display: block; font-size: 18px; line-height: 1.3; }
.lv-list span { font-size: 15px; color: var(--ink-soft); }
.fresh { font-size: 17px; margin-top: 20px; }
.page-foot { margin-top: 40px; font-size: 15px; color: var(--ink-soft); text-align: center; }
.page .ws-title { margin: 0; }
`;

type Shell = { lang: Lang; level?: LevelId; title: string; description: string; body: string; css: string[]; data: unknown[] };

function shell({ lang, level, title, description, body, css, data }: Shell): string {
  const dir = dirOf(lang, level);
  const root = '../'.repeat(dir.split('/').length - 1);
  const url = `${SITE}/${dir}`;
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l.id}" href="${SITE}/${dirOf(l.id, level)}">`).join('\n');
  const langLinks = LANGS.map(
    (l) => `<a href="${root}${dirOf(l.id, level)}" lang="${l.id}" hreflang="${l.id}"${l.id === lang ? ' aria-current="page"' : ''}>${esc(l.name)}</a>`,
  ).join('');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(plain(title))}</title>
<meta name="description" content="${esc(plain(description))}">
<link rel="canonical" href="${url}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${SITE}/${dirOf('en', level)}">
<meta name="theme-color" content="#FFF7FA">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Bunny Math">
<meta property="og:title" content="${esc(plain(title))}">
<meta property="og:description" content="${esc(plain(description))}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}apple-touch-icon.png">
${css.map((f) => `<link rel="stylesheet" href="${root}${f}">`).join('\n')}
<style>${PAGE_CSS}</style>
${data.map((d) => `<script type="application/ld+json">${json(d)}</script>`).join('\n')}
</head>
<body class="page">
<div class="page-wrap">
<header class="page-top no-print"><a class="brand" href="${root}">${tx('app.name')} 🐰</a><nav class="langs" aria-label="${px('page.languages')}">${langLinks}</nav></header>
<main>
${body}
</main>
<footer class="page-foot no-print"><p>${px('page.footer')} <a href="${root}">${px('page.home')}</a></p></footer>
</div>
</body>
</html>
`;
}

function levelPage(lang: Lang, level: LevelId, css: string[]): Page {
  const dir = dirOf(lang, level);
  const root = '../'.repeat(dir.split('/').length - 1);
  const name = topic(level);
  const desc = p(`page.lv.${level}.desc` as PageKey);
  const h1 = p('page.h1', { topic: name });
  const code = encodeCode({ adventure: false, level, length: QUESTIONS, seed: seedFor(level) });
  const play = `${root}?code=${encodeURIComponent(code)}&amp;lang=${lang}`;
  const indexUrl = `${SITE}/${dirOf(lang)}`;
  const body = `<div class="no-print">
<nav class="crumbs"><a href="${root}${dirOf(lang)}">${px('page.all')}</a> › ${esc(name)}</nav>
<h1>${esc(h1)}</h1>
<p class="lead">${esc(desc)}</p>
<p class="lead">${px('page.intro')}</p>
<div class="page-actions"><button class="puffy berry" type="button" onclick="print()">${px('page.print')}</button><a class="puffy" href="${play}">${px('page.play')}</a></div>
</div>
${sheetHtml(level)}
<section class="no-print">
<p class="fresh">${px('page.fresh')}</p>
<h2>${px('page.more')}</h2>
${levelCards(lang, root, level)}
</section>`;
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      name: plain(h1),
      description: plain(desc),
      learningResourceType: 'Worksheet',
      educationalUse: 'Practice',
      typicalAgeRange: '6-9',
      isAccessibleForFree: true,
      inLanguage: lang,
      url: `${SITE}/${dir}`,
      provider: { '@type': 'Organization', name: 'Bunny Math', url: `${SITE}/` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: plain(p('page.all')), item: indexUrl },
        { '@type': 'ListItem', position: 2, name: plain(name), item: `${SITE}/${dir}` },
      ],
    },
  ];
  const title = p('page.title', { topic: name });
  const description = p('page.desc', { desc });
  return { path: `${dir}index.html`, html: shell({ lang, level, title, description, body, css, data }) };
}

function indexPage(lang: Lang, css: string[]): Page {
  const dir = dirOf(lang);
  const root = '../'.repeat(dir.split('/').length - 1);
  const body = `<h1>${px('page.index.h1')}</h1>
<p class="lead">${px('page.index.desc')}</p>
${levelCards(lang, root)}
<p class="fresh">${px('page.fresh')}</p>`;
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: plain(p('page.index.h1')),
      description: plain(p('page.index.desc')),
      inLanguage: lang,
      url: `${SITE}/${dir}`,
    },
  ];
  return { path: `${dir}index.html`, html: shell({ lang, title: p('page.index.title'), description: p('page.index.desc'), body, css, data }) };
}

/**
 * Every worksheet page in every language. `css` is the app's built stylesheet(s), from the
 * site root (e.g. "assets/index-abc123.css"), so the printed sheet looks just like the app's.
 */
export function worksheetPages(css: string[]): Page[] {
  const before = getLang();
  try {
    return LANGS.flatMap(({ id }) => {
      activate(id);
      return [indexPage(id, css), ...LEVELS.map((l) => levelPage(id, l.id, css))];
    });
  } finally {
    activate(before);
  }
}

/** sitemap.xml: the app's home page and every worksheet page, each with its translations. */
export function sitemap(): string {
  const levels: (LevelId | undefined)[] = [undefined, ...LEVELS.map((l) => l.id)];
  const urls = levels.flatMap((level) =>
    LANGS.map((l) => {
      const alts = LANGS.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.id}" href="${SITE}/${dirOf(a.id, level)}"/>`).join('\n');
      return `  <url>\n    <loc>${SITE}/${dirOf(l.id, level)}</loc>\n${alts}\n  </url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${SITE}/</loc>
  </url>
${urls.join('\n')}
</urlset>
`;
}
