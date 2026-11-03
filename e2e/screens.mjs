// Walks every screen (mode, home, quiz, feedback, "Show me how", quit dialog, results, sticker
// book, worksheet) in every language at phone, landscape and desktop sizes, and checks:
//  - every visible control is what a tap at its centre hits (nothing covers it),
//  - controls are on screen, or reachable by a scroll the user can actually do,
//  - nothing overlaps the top bar, nothing sticks out sideways, button text stays inside its button.
//
//   npm run build && npm run test:e2e           (runs after e2e/layout.mjs)
// 375x548 is an iPhone SE's real Safari viewport (screen minus the browser bars).
//   E2E_LANGS=ja,de E2E_SIZES=320x568 node e2e/screens.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as pw from 'playwright';

const ENGINE = process.env.E2E_BROWSER || 'webkit';
const SHOTS = process.env.E2E_SHOTS || '/tmp/shots';
const PORT = Number(process.env.E2E_PORT || 4180);
const BASE = process.env.E2E_URL || `http://127.0.0.1:${PORT}/`;
const LANGS = (process.env.E2E_LANGS || 'en,zh-CN,zh-TW,fr,es,de,ja,ko,pt').split(',');
const SIZES = (process.env.E2E_SIZES || '430x932,393x852,375x667,375x548,320x568,932x430,1280x800').split(',').map((s) => s.split('x').map(Number));
const KEY = 'bunny-math:v1';
// Plus level 6 has 3-digit sums (hundreds squares, column method); all level 14 has times/divide.
const RUNS = [
  { mode: 'plus', level: 6, seed: 7 },
  { mode: 'all', level: 14, seed: 11 },
];

mkdirSync(SHOTS, { recursive: true });

let server;
if (!process.env.E2E_URL) {
  server = spawn(process.execPath, [new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  for (let i = 0; ; i++) {
    try { if ((await fetch(BASE)).ok) break; } catch {}
    if (i > 100) throw new Error('vite preview did not start (did you run `npm run build`?)');
    await new Promise((r) => setTimeout(r, 200));
  }
}

const browser = await pw[ENGINE].launch();
const failures = new Map(); // problem -> [where...]
let checks = 0;

function note(where, problems) {
  checks++;
  for (const p of problems) {
    if (!failures.has(p)) failures.set(p, []);
    failures.get(p).push(where);
  }
}

async function newPage([width, height], state, query = '') {
  const mobile = width < 1000;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 3 : 1, hasTouch: mobile, isMobile: mobile && ENGINE !== 'firefox', reducedMotion: 'reduce' });
  await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [KEY, state]);
  const page = await ctx.newPage();
  await page.goto(BASE + query);
  await page.waitForSelector('.topbar, .print-bar');
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/** Runs in the page. Checks the top layer (open dialog, else the screen). */
function inspect() {
  const problems = [];
  const name = (el) => (el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24) || el.className).toString();
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
  const layer = document.querySelector('.scrim') || document.querySelector('.screen');
  const feedback = document.querySelector('.feedback');
  const controls = [...layer.querySelectorAll('button, select')].filter(visible)
    // Under the feedback banner the pad is meant to be covered; only the banner and the bar count.
    .filter((el) => !feedback || feedback.contains(el) || el.closest('.topbar') || el.closest('.scrim'));

  // Horizontal overflow of the page.
  if (document.documentElement.scrollWidth > innerWidth + 1) problems.push(`page wider than screen (${document.documentElement.scrollWidth}px)`);

  for (const el of controls) {
    // Bring it into view the way a user could: only scrollable (overflow auto/scroll) boxes may move.
    const hidden = [];
    for (let a = el.parentElement; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (/hidden|clip/.test(s.overflowY + s.overflowX)) hidden.push([a, a.scrollTop, a.scrollLeft]);
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // A box the user can't scroll moved: the control is cut off.
    let cut = false;
    for (const [a, t, l] of hidden) {
      const s = getComputedStyle(a);
      const userScrollsY = /auto|scroll/.test(s.overflowY);
      const userScrollsX = /auto|scroll/.test(s.overflowX);
      if ((!userScrollsY && a.scrollTop !== t) || (!userScrollsX && a.scrollLeft !== l)) cut = true;
      if (!userScrollsY) a.scrollTop = t;
      if (!userScrollsX) a.scrollLeft = l;
    }
    if (document.scrollingElement.scrollTop || document.scrollingElement.scrollLeft) {
      if (!document.querySelector('.print-screen')) cut = true;
    }
    const r = el.getBoundingClientRect();
    if (cut || r.top < -0.5 || r.left < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) {
      problems.push(`cut off / unreachable: ${name(el)}`);
      continue;
    }
    const target = el.closest('.lang-pick') || el;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !target.contains(hit)) problems.push(`tap on "${name(el)}" hits ${hit ? hit.tagName.toLowerCase() + '.' + (hit.className?.baseVal ?? hit.className) : 'nothing'}`);
    // Text spilling out of its button.
    if (el.tagName === 'BUTTON' && el.textContent.trim()) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const tr = range.getBoundingClientRect();
      if (tr.width && (tr.left < r.left - 1 || tr.right > r.right + 1 || tr.top < r.top - 6 || tr.bottom > r.bottom + 6)) problems.push(`text spills out of button "${name(el)}"`);
    }
  }
  // Restore scroll positions so screenshots look natural.
  for (const el of layer.querySelectorAll('*')) if (el.scrollTop && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = 0;

  // Nothing from the body overlaps the top bar.
  const bar = document.querySelector('.screen > .topbar');
  if (bar && !document.querySelector('.scrim')) {
    const b = bar.getBoundingClientRect();
    for (const el of bar.parentElement.querySelectorAll(':scope > :not(.topbar):not(.feedback) *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.left < b.right - 1 && r.right > b.left + 1 && r.top < b.bottom - 1 && r.bottom > b.top + 1 && getComputedStyle(el).visibility !== 'hidden') {
        problems.push(`overlaps top bar: ${el.tagName.toLowerCase()}.${el.className?.baseVal ?? el.className}`);
        break;
      }
    }
  }
  // Dialogs and sheets fit on screen.
  for (const el of document.querySelectorAll('.sheet, .dialog, .feedback')) {
    const r = el.getBoundingClientRect();
    if (r.top < -0.5 || r.left < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) problems.push(`${el.className.split(' ')[0]} doesn't fit the screen`);
  }
  // Things clipped sideways inside the screen (overflow: hidden hides them, so check the boxes).
  for (const el of layer.querySelectorAll('.q-card, .equation, .story, .stage, .caption, .panel, .sheet-head, .sheet-foot, .fb-text, .fb-actions, .dialog, .book, .sheet-paper, .print-bar')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.left < -0.5 || r.right > innerWidth + 0.5)) problems.push(`${el.className.split(' ')[0]} sticks out sideways`);
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible') problems.push(`content wider than .${el.className.split(' ')[0]} (${el.scrollWidth} > ${el.clientWidth})`);
  }
  return problems;
}

/** Click by script, so a covered control is reported by inspect() rather than stalling the run. */
async function tap(page, sel, nth = 0) {
  await page.locator(sel).nth(nth).evaluate((el) => el.click());
  await page.waitForTimeout(20);
}

async function check(page, where, shot) {
  await page.waitForTimeout(30);
  note(where, await page.evaluate(inspect));
  if (shot) await page.screenshot({ path: join(SHOTS, `${shot}.png`) });
}

/** Answer the current question wrong (twice, unless the guess was right), leaving the "answer is" banner up. */
async function answerWrong(page) {
  for (let i = 0; i < 2; i++) {
    if (await page.locator('.pad').count()) {
      for (const k of ['9', '9', '7']) await tap(page, `.key:text-is("${k}")`);
      await tap(page, '.check');
    } else {
      await tap(page, '.choice:not(:disabled)');
    }
    if (await page.locator('.feedback.good').count()) return 'right';
    if (i === 0) await tap(page, '.feedback .berry');
  }
  return 'wrong';
}

async function walk(size, lang) {
  const sz = size.join('x');
    const tag = `${lang}-${sz}`;
  // Mode picker (first visit) and home.
  let page = await newPage(size, JSON.stringify({ lang }));
  await check(page, `mode ${tag}`, `s-mode-${tag}`);
  await page.context().close();

  for (const run of RUNS) {
    const state = JSON.stringify({ mode: run.mode, lang, levelFor: { plus: run.level, all: run.level }, explain: 'blocks', length: 10, sound: false, stickers: ['🥕', '🌈'], best: { [run.level]: 2 } });
    page = await newPage(size, state, `?seed=${run.seed}`);
    await check(page, `home/${run.mode} ${tag}`, run.mode === 'plus' ? `s-home-${tag}` : null);

    // Quiz: every question; first one with the help sheet in both styles and the quit dialog.
    await tap(page, '.start');
    await page.waitForSelector('.quiz-body');
    const seen = new Set();
    for (let qn = 0; qn < 30 && (await page.locator('.quiz-body').count()); qn++) {
      const kind = await page.evaluate(() => (document.querySelector('.story') ? 'story' : document.querySelector('.signs') ? 'compare' : document.querySelector('.choices') ? 'choice' : document.querySelector('.slot.sign') ? 'sign' : 'pad'));
      const first = !seen.has(kind);
      seen.add(kind);
      await check(page, `quiz/${run.mode}/${kind} ${tag}`, first ? `s-quiz-${run.mode}-${kind}-${tag}` : null);
      if (qn === 0) {
        await tap(page, '.hint-btn');
        await page.waitForSelector('.sheet');
        for (const style of [0, 1]) {
          const styles = page.locator('.style-pick button');
          if (await styles.count()) await tap(page, '.style-pick button', style);
          for (let step = 0; step < 12; step++) {
            await check(page, `explain/${run.mode}/${style ? 'column' : 'blocks'} ${tag}`, step === 0 ? `s-explain-${run.mode}-${style}-${tag}` : null);
            const before = await page.locator('.caption').textContent();
            await tap(page, '.sheet-foot .berry');
            if (!(await page.locator('.sheet').count())) break;
            if ((await page.locator('.caption').textContent()) === before) break;
          }
          if (!(await page.locator('.sheet').count())) break;
        }
        if (await page.locator('.sheet').count()) await tap(page, '.sheet-head .icon-btn');
        await tap(page, '.topbar .icon-btn');
        await check(page, `quit-dialog ${tag}`, run.mode === 'plus' ? `s-quit-${tag}` : null);
        await tap(page, '.dialog .berry');
      }
      const res = await answerWrong(page);
      await check(page, `feedback/${res} ${tag}`, qn === 0 ? `s-feedback-${run.mode}-${tag}` : null);
      await tap(page, '.feedback .fb-actions .puffy:last-child');
    }
    await page.waitForSelector('.res-body');
    await check(page, `results/${run.mode} ${tag}`, `s-results-${run.mode}-${tag}`);

    if (run.mode === 'plus') {
      await tap(page, '.topbar .icon-btn'); // home
      await tap(page, '.topbar .icon-btn', 1); // stickers
      await page.waitForSelector('.book');
      await check(page, `stickers ${tag}`, `s-stickers-${tag}`);
      await tap(page, '.topbar .icon-btn');
      await tap(page, '.topbar .icon-btn', 0); // worksheet
      await page.waitForSelector('.print-bar');
      await check(page, `worksheet ${tag}`, `s-worksheet-${tag}`);
    }
    await page.context().close();
  }
  }

const jobs = SIZES.flatMap((size) => LANGS.map((lang) => [size, lang]));
const WORKERS = Number(process.env.E2E_WORKERS || 6);
let done = 0;
await Promise.all(Array.from({ length: WORKERS }, async () => {
  while (jobs.length) {
    const [size, lang] = jobs.shift();
    await walk(size, lang).catch((e) => note(`${lang} ${size.join('x')}`, [`crashed: ${e.message.split('\n')[0]}`]));
    done++;
    if (process.env.E2E_VERBOSE) console.log(`${done} done: ${lang} ${size.join('x')}`);
  }
}));

await browser.close();
server?.kill();

console.log(`engine: ${ENGINE}  checks: ${checks}  screenshots: ${SHOTS}`);
if (failures.size) {
  for (const [p, where] of failures) console.error(`\n${p}\n   ${where.length}x: ${[...new Set(where)].slice(0, 8).join(', ')}${where.length > 8 ? ', ...' : ''}`);
  process.exit(1);
}
console.log('all screen checks passed');
