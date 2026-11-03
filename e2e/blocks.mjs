// "Show me how" in blocks mode: the base-ten blocks always fit inside their panel, and stay big
// enough to count. Walks every step of worst-case sums (lots of rods and cubes, trades, 3 digits,
// times and divide) at phone, landscape and desktop sizes.
//
//   npm run test:e2e                          (needs no build: it runs the Vite dev server)
//   E2E_BROWSER=chromium node e2e/blocks.mjs
//   E2E_SIZES=1024x640 E2E_CASES=15+27 E2E_SHOT=/tmp/x.png node e2e/blocks.mjs
import { spawn } from 'node:child_process';
import * as pw from 'playwright';

const ENGINE = process.env.E2E_BROWSER || 'webkit';
const PORT = Number(process.env.E2E_PORT || 4181);
const BASE = `http://127.0.0.1:${PORT}/e2e/harness/blocks.html`;
/** Smallest cube (and rod segment) in CSS px. Below this, kids can't count them. Desktops have room for 12. */
const MIN_CUBE = Number(process.env.E2E_MIN_CUBE || 10);
const MIN_CUBE_DESKTOP = 12;
// 1700x900 is a 1080p laptop at 150% zoom (where 15 + 27 spilled out); 1024x768-ish tablets both ways.
const SIZES = (process.env.E2E_SIZES || '1024x640,1280x720,1366x768,1700x900,1920x1080,1280x800,1180x820,820x1180,768x1024,430x932,393x852,375x667,375x548,320x568,932x430,844x390')
  .split(',').map((s) => s.split('x').map(Number));
const ALL_CASES = [
  // adding: 1 and 2 digits, carries, a two-digit sum that becomes three digits
  '7+8', '9+9', '15+27', '46+37', '78+21', '89+9', '97+86', '99+99',
  // adding: 3 digits (many squares, rods carried into a square)
  '368+275', '456+478', '799+199', '555+444', '99+901',
  // taking away: trading a rod for 10 cubes, a square for 10 rods, borrowing across a zero
  '17-9', '42-15', '91-19', '503-167', '900-123', '910-189', '999-111', '800-1',
  // times (n groups of a 2-digit number) and divide (groups of the answer)
  '49×6', '6×49', '49×2', '33×3', '25×4', '19×5', '16×6',
  '98÷2', '99÷3', '96÷4', '95÷5', '96÷6', '90÷9', '80÷8',
  // missing number: turned around into the other sum
  '?+27=42', '15+?=42',
];
const CASES = (process.env.E2E_CASES || ALL_CASES.join(',')).split(',');
const LANG = process.env.E2E_LANG || 'zh-CN';

function parse(c) {
  const m = c.match(/^(\?|\d+)([+\-×÷])(\?|\d+)(?:=(\d+))?$/);
  if (!m) throw new Error(`bad case ${c}`);
  const [, x, op, y, z] = m;
  if (x === '?') return { a: op === '+' ? +z - +y : +z + +y, op, b: +y, kind: 'missing', hide: 'a' };
  if (y === '?') return { a: +x, op, b: op === '+' ? +z - +x : +x - +z, kind: 'missing', hide: 'b' };
  return { a: +x, op, b: +y };
}

const server = spawn(process.execPath, [new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
for (let i = 0; ; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch {}
  if (i > 150) throw new Error('vite did not start');
  await new Promise((r) => setTimeout(r, 200));
}

/** Runs in the page: are all blocks inside the panel, the panel inside the sheet, the sheet on screen? */
function measure() {
  const out = { problems: [], minCube: Infinity, u: null };
  const stage = document.querySelector('.stage');
  const sheet = document.querySelector('.sheet');
  if (!stage || !stage.querySelector('.group')) return null; // not a blocks picture (dots, text)
  const sr = stage.getBoundingClientRect();
  const cs = getComputedStyle(stage);
  const inner = { left: sr.left + parseFloat(cs.borderLeftWidth), right: sr.right - parseFloat(cs.borderRightWidth), top: sr.top + parseFloat(cs.borderTopWidth), bottom: sr.bottom - parseFloat(cs.borderBottomWidth) };
  const outside = (r, b) => r.left < b.left - 0.5 || r.right > b.right + 0.5 || r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5;
  let worst = 0;
  const blocks = [...stage.querySelectorAll(':scope > :not(.legend), .rod, .cube, .flat')].filter((el) => !el.closest('.legend'));
  for (const el of [...blocks, stage.querySelector('.legend')]) {
    const r = el.getBoundingClientRect();
    if (outside(r, inner)) {
      const by = Math.max(inner.left - r.left, r.right - inner.right, inner.top - r.top, r.bottom - inner.bottom);
      if (by > worst) worst = by;
    }
  }
  if (worst) out.problems.push(`blocks stick out of the panel (by up to ${Math.round(worst)}px)`);
  // The legend must not sit on top of the blocks.
  const lg = stage.querySelector('.legend')?.getBoundingClientRect();
  if (lg) for (const el of blocks) {
    const r = el.getBoundingClientRect();
    if (r.left < lg.right && r.right > lg.left && r.top < lg.bottom && r.bottom > lg.top) { out.problems.push('blocks under the legend'); break; }
  }
  // The panel is inside the sheet, and the sheet on screen. (The sheet may scroll on small phones.)
  const sh = sheet.getBoundingClientRect();
  if (sr.left < sh.left - 0.5 || sr.right > sh.right + 0.5) out.problems.push('panel sticks out of the sheet sideways');
  if (sh.left < -0.5 || sh.top < -0.5 || sh.right > innerWidth + 0.5 || sh.bottom > innerHeight + 0.5) out.problems.push('sheet off screen');
  const sheetScrolls = sheet.scrollHeight > sheet.clientHeight + 1;
  if (sheetScrolls && innerWidth > 1000) out.problems.push('sheet scrolls on a desktop screen');
  if (stage.scrollHeight > stage.clientHeight + 1 || stage.scrollWidth > stage.clientWidth + 1) out.problems.push('panel scrolls');
  for (const el of stage.querySelectorAll(':scope > .group .cube, :scope > .group .rod i')) {
    const r = el.getBoundingClientRect();
    out.minCube = Math.min(out.minCube, el.tagName === 'I' ? r.height : r.width);
  }
  out.u = parseFloat(getComputedStyle(stage.querySelector('.group')).getPropertyValue('--u')) || null;
  out.sheetScrolls = sheetScrolls;
  return out;
}

const browser = await pw[ENGINE].launch();
const rows = [];
const failures = [];
const jobs = SIZES.map((s) => s);
await Promise.all(Array.from({ length: Number(process.env.E2E_WORKERS || 4) }, async () => {
  while (jobs.length) {
    const [width, height] = jobs.shift();
    const mobile = width < 1000;
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 3 : 1, hasTouch: mobile, isMobile: mobile && ENGINE !== 'firefox', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForFunction(() => window.show);
    await page.evaluate(() => document.fonts.ready);
    let min = Infinity;
    let scrolled = 0;
    let total = 0;
    let minAt = '';
    for (const c of CASES) {
      await page.evaluate(([q, lang]) => window.show(q, lang), [parse(c), LANG]);
      await page.waitForSelector('.sheet');
      for (let step = 0; step < 20; step++) {
        await page.waitForTimeout(16);
        const m = await page.evaluate(measure);
        const where = `${width}x${height} ${c} step ${step + 1}`;
        if (m) {
          if (m.minCube < min) { min = m.minCube; minAt = `${c} step ${step + 1}`; }
          const floor = mobile ? MIN_CUBE : MIN_CUBE_DESKTOP;
          if (m.minCube < floor - 0.01) m.problems.push(`cubes too small to count (${m.minCube.toFixed(1)}px < ${floor}px)`);
          // When the sheet has to scroll anyway, there's no reason for small cubes.
          if (m.sheetScrolls && m.minCube < 12 - 0.01) m.problems.push('sheet scrolls, yet the cubes were shrunk below 12px');
          if (m.sheetScrolls) scrolled++;
          total++;
          for (const p of m.problems) failures.push(`${where}: ${p}`);
          if (process.env.E2E_VERBOSE) console.log(where, JSON.stringify(m));
        }
        if (process.env.E2E_SHOT && step === Number(process.env.E2E_STEP || 0)) await page.screenshot({ path: process.env.E2E_SHOT });
        const done = await page.evaluate(() => { const d = [...document.querySelectorAll('.steps span')]; return d.findIndex((s) => s.classList.contains('on')) === d.length - 1; });
        if (done) break;
        await page.locator('.sheet-foot .berry').evaluate((el) => el.click());
      }
    }
    rows.push([`${width}x${height}`, min, minAt, `${scrolled}/${total}`]);
    await ctx.close();
  }
}));
await browser.close();
server.kill();

rows.sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }));
console.log(`engine: ${ENGINE}  cases: ${CASES.length}  per size: smallest cube, and how many block steps need the sheet scrolled`);
for (const [sz, min, at, sc] of rows) console.log(`  ${sz.padEnd(10)} ${min === Infinity ? '-' : min.toFixed(1) + 'px'}  (${at})  scrolls ${sc}`);
if (failures.length) {
  const byProblem = new Map();
  for (const f of failures) { const [w, p] = f.split(': '); if (!byProblem.has(p.replace(/\d+(\.\d+)?px/g, 'Npx'))) byProblem.set(p.replace(/\d+(\.\d+)?px/g, 'Npx'), []); byProblem.get(p.replace(/\d+(\.\d+)?px/g, 'Npx')).push(w); }
  for (const [p, w] of byProblem) console.error(`\n${p}\n   ${w.length}x: ${w.slice(0, 10).join(', ')}${w.length > 10 ? ', ...' : ''}`);
  console.error(`\n${failures.length} problems`);
  process.exit(1);
}
console.log('blocks always fit their panel');
