// Layout regression check in a real browser engine (WebKit by default, i.e. Safari's engine).
//
//   npm run build && npm run test:e2e
//   E2E_BROWSER=chromium npm run test:e2e      # if WebKit can't run on this machine
//   E2E_SHOTS=/tmp/shots                        # where screenshots go (default: /tmp/shots)
//
// Needs a browser once: `npx playwright install webkit` (or chromium).
// For every language and a range of phone sizes it checks that the home-screen title never
// covers the top bar, that every top-bar control is the element a tap at its centre hits,
// and that the language picker really switches the language.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as pw from 'playwright';

const ENGINE = process.env.E2E_BROWSER || 'webkit';
const SHOTS = process.env.E2E_SHOTS || '/tmp/shots';
const PORT = Number(process.env.E2E_PORT || 4179);
const BASE = process.env.E2E_URL || `http://127.0.0.1:${PORT}/`;
const LANGS = ['en', 'zh-CN', 'zh-TW', 'fr', 'es', 'de', 'ja', 'ko', 'pt'];
const SIZES = [[430, 932], [393, 852], [375, 667], [320, 568]];
const MODES = ['plus', 'all'];
const KEY = 'bunny-math:v1';

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
const failures = [];
const results = [];

function saved(lang, mode) {
  return JSON.stringify({ mode, lang, levelFor: { plus: 4, all: 13 }, explain: 'blocks', length: 10, sound: true, stickers: [], best: {} });
}

async function newPage([width, height], state) {
  const opts = { viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true };
  if (ENGINE !== 'firefox') opts.isMobile = true;
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(([k, v]) => { if (v && !sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [KEY, state]);
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForSelector('.topbar');
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/** Runs in the page: hit-test every top-bar control and measure the title against the bar. */
function inspect() {
  const out = { problems: [] };
  const bar = document.querySelector('.topbar');
  const b = bar.getBoundingClientRect();
  const controls = [...bar.querySelectorAll(':scope > button, :scope > .lang-pick')];
  out.controls = controls.length;
  for (const c of controls) {
    const r = c.getBoundingClientRect();
    const name = c.getAttribute('aria-label') || c.querySelector('select')?.getAttribute('aria-label') || c.className;
    if (r.left < 0 || r.right > innerWidth + 0.5 || r.top < 0) out.problems.push(`control off-screen: ${name}`);
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !c.contains(hit)) out.problems.push(`tap on "${name}" hits ${hit ? hit.tagName + '.' + hit.className : 'nothing'}`);
  }
  // Anything outside the top bar that overlaps it (title, its words, bunny, tagline...).
  const intersects = (r) => r.width > 0 && r.height > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
  for (const el of document.querySelectorAll('.home-body *, .mode-body *')) {
    if (intersects(el.getBoundingClientRect())) { out.problems.push(`overlaps top bar: ${el.tagName}.${el.className?.baseVal ?? el.className}`); break; }
  }
  // Nothing sticks out sideways (clipped level cards or ✓ badge, zoomed-out page).
  if (document.documentElement.scrollWidth > innerWidth) out.problems.push(`page is ${document.documentElement.scrollWidth}px wide`);
  for (const el of document.querySelectorAll('.home-body, .mode-body')) {
    if (el.scrollWidth > el.clientWidth + 1) out.problems.push(`content wider than ${el.className} (${el.scrollWidth} > ${el.clientWidth})`);
  }
  const title = document.querySelector('.title, .mode-title');
  if (title) {
    const tr = title.getBoundingClientRect();
    out.title = { top: Math.round(tr.top), height: Math.round(tr.height), font: getComputedStyle(title).fontSize };
    if (tr.left < -0.5 || tr.right > innerWidth + 0.5) out.problems.push('title wider than the screen');
    // Each word of the home title stays on one line (no "うさ / ぎ").
    for (const s of title.querySelectorAll(':scope > span')) {
      const lh = parseFloat(getComputedStyle(s).fontSize);
      if (s.offsetHeight > lh * 1.6) out.problems.push(`title word "${s.textContent}" breaks inside`);
    }
  }
  return out;
}

async function checkStart(page) {
  // The Start button must be reachable (scrolled into view if the screen is short) and tappable.
  const start = page.locator('.start');
  await start.scrollIntoViewIfNeeded();
  const ok = await start.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && el.contains(hit);
  });
  await page.evaluate(() => document.querySelector('.home-body')?.scrollTo(0, 0));
  return ok ? [] : ['start button not tappable'];
}

for (const size of SIZES) {
  for (const lang of LANGS) {
    for (const mode of MODES) {
      const page = await newPage(size, saved(lang, mode));
      const r = await page.evaluate(inspect);
      if (mode === 'plus') await page.screenshot({ path: join(SHOTS, `home-${lang}-${size[0]}x${size[1]}.png`) });
      r.problems.push(...(await checkStart(page)));
      // Mode, language, code, print, stickers, sound.
      if (r.controls !== 6) r.problems.push(`expected 6 top-bar controls, found ${r.controls}`);
      results.push({ screen: `home/${mode}`, lang, size: size.join('x'), ok: !r.problems.length, title: r.title });
      if (r.problems.length) failures.push(`home/${mode} ${lang} ${size.join('x')}: ${r.problems.join('; ')}`);
      await page.context().close();
    }
    // First visit: the mode screen, which also has the picker.
    const page = await newPage(size, JSON.stringify({ lang }));
    const r = await page.evaluate(inspect);
    if (r.controls !== 1) r.problems.push(`expected the language picker, found ${r.controls} controls`);
    await page.screenshot({ path: join(SHOTS, `mode-${lang}-${size[0]}x${size[1]}.png`) });
    results.push({ screen: 'mode', lang, size: size.join('x'), ok: !r.problems.length });
    if (r.problems.length) failures.push(`mode ${lang} ${size.join('x')}: ${r.problems.join('; ')}`);
    await page.context().close();
  }

  // A real tap on the picker reaches the <select>, and picking a language switches the UI.
  const page = await newPage(size, saved('ja', 'plus'));
  const problems = [];
  const box = await page.locator('.lang-pick').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  if (focused !== 'SELECT') problems.push(`tap on picker focused ${focused}, not the <select>`);
  await page.locator('.lang-pick select').selectOption('en');
  if ((await page.locator('.title').textContent()).replace(/\s+/g, ' ').trim() !== 'Bunny Math') problems.push('ja -> en did not switch the title');
  if ((await page.locator('.lang-short').innerText()) === '日') problems.push('badge still shows 日 after picking en');
  await page.locator('.lang-pick select').selectOption('ja');
  if (!(await page.locator('.title').textContent()).includes('うさぎ')) problems.push('en -> ja did not switch back');
  if (!(await page.waitForFunction(() => document.documentElement.lang === 'ja', null, { timeout: 2000 }).catch(() => false))) problems.push('<html lang> not ja');
  results.push({ screen: 'picker-switch', lang: 'ja<->en', size: size.join('x'), ok: !problems.length });
  if (problems.length) failures.push(`picker ${size.join('x')}: ${problems.join('; ')}`);
  await page.context().close();
}

await browser.close();
server?.kill();

console.log(`engine: ${ENGINE} ${pw[ENGINE].name()}  screenshots: ${SHOTS}`);
const bySize = {};
for (const r of results) (bySize[r.size] ??= []).push(r);
for (const [size, rs] of Object.entries(bySize)) {
  const bad = rs.filter((r) => !r.ok);
  console.log(`${size}: ${rs.length - bad.length}/${rs.length} pass${bad.length ? '  FAIL: ' + bad.map((r) => `${r.screen}:${r.lang}`).join(', ') : ''}`);
}
if (failures.length) {
  console.error('\n' + failures.join('\n'));
  process.exit(1);
}
console.log('all layout checks passed');
