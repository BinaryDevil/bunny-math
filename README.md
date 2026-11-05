# Bunny Math 🐰

Cute maths practice for kids around 4 to 9: adding and taking away, or all four operations. Play it at **[bunnyland.app](https://bunnyland.app)**, the home of the Bunny games.

There are no accounts. Progress is saved on the device. The only thing that ever goes to a server is the optional carrot leaderboard, under a made-up name.

## What's in it

**Practice**
- Two modes, picked on the first visit and switchable from the home screen:
  - **Add & take away**, 8 levels: first two for the youngest (only plain one-digit "a + b = ?" and "a − b = ?", answers up to 10, then adding past 10; no Adventure), then within 20, no carrying, carrying/borrowing, two-digit sums, three-digit sums, and three-digit sums with lots of carrying (including borrowing across a zero)
  - **All four**, 4 levels: tables of 2, 5 and 10; tables up to 5; tables up to 10; two-digit × and ÷ by one digit. Two thirds of the questions are × or ÷.
- 5 question types: type the answer, pick the answer, missing number, compare (< = >), picture stories. The youngest's two levels only ask "type the answer".
- Missed questions come back at the end; results show stars, skills, and a sticker reward
- Printable worksheets with an answer key (🖨️ on the home screen)

**Worksheet pages** (for search engines, and for parents who arrive from one)
- [bunnyland.app/worksheets/](https://bunnyland.app/worksheets/): a plain page per level with a printable sheet and its answers, in all 9 languages (`/zh-cn/worksheets/`, `/fr/worksheets/`, …). No JavaScript needed.
- "Practice online" opens the app at that level, in that language (`?code=…&lang=fr`).
- Made by `npm run build`, together with `sitemap.xml`. Page addresses (`SLUGS` in `src/pages/worksheets.ts`) must never change, because search results link to them.

**Adventure** (meet Rascal, Bunny's mischievous twin)
- Every level except the youngest's two (with Adventure on, Home doesn't list them)
- Cross 3 meadows of questions with 3 hearts, then beat Rascal in a showdown at the end of each one
- Right answers win carrots: harder levels and harder sums pay more
- New things unlock one run at a time: treats at rest stops (lucky clover, carrot cake, magnifier), then a Sunny or Tricky path, then a tougher Rascal after 3 wins

**Share codes**
- Every quiz and adventure has a 5-emoji code, like 🍓🦄🌙🐱🌸. Typing it in (🔑 Have a code?) or opening a `?code=` link gives exactly the same questions on any device, so siblings can race each other. No server is involved.
- Old `?seed=123` links still work.

**Carrot Champs leaderboard**
- All-time carrot totals from Adventure, shared across every Bunny game
- Names are picked from kid-safe word lists (like "Bouncy Otter"), never typed
- Runs played offline are sent once the device is back online

**Show me how**
- Explains each question step by step, in one of two styles (the choice is remembered):
  - **Blocks**: hundreds, tens and ones blocks, and dot arrays for × and ÷
  - **Columns**: the written column method (竖式), one column at a time, with carried digits, borrow dots, and long division

**9 languages**: English, 简体中文, 繁體中文, Français, Español, Deutsch, 日本語, 한국어, Português. The 🌐 button picks one; on the first visit it follows the browser's language.

## Run it

```bash
npm install
npm run dev
```

```bash
npm test
npm run build && npm run test:e2e   # every screen, 9 languages, phone/landscape/desktop sizes in WebKit (~5 min); needs `npx playwright install webkit` once
```

`npm run dev` runs without the leaderboard, which just doesn't show. To try it against the live server, put `VITE_LEADERBOARD_URL=https://api.bunnyland.app` in `.env.local`. Builds (`npm run build`) always use the address in `.env.production`.

## Deploy

The site is a [Cloudflare Worker](https://developers.cloudflare.com/workers/static-assets/) serving the built files, set up in `wrangler.toml`.

- **Automatic:** Cloudflare builds every push to `main` (`npm test && npm run build`, then `npx wrangler deploy`) and puts it live at bunnyland.app. If a test fails, nothing is deployed. Pushes to other branches get a preview build. The build settings live in the Cloudflare dashboard: **Workers & Pages → bunnyland → Settings → Builds**.
- **By hand:** `npm run deploy` builds and deploys from your machine (run `npx wrangler login` once first).

The build uses relative paths, so it also works under a sub-path like `bunnyland.app/math/`.

**The leaderboard server** (`worker/`) is a separate Worker and is deployed by hand: see [worker/README.md](worker/README.md). The app finds it through `VITE_LEADERBOARD_URL` in `.env.production`.

**Checks:** the `Checks` workflow (`.github/workflows/ci.yml`) runs the app's and the leaderboard server's tests on every PR and on `main`.

**GitHub Pages** only forwards old links now. Every push to `main` publishes `redirect/index.html`, which sends `binarydevil.github.io/bunny-math/…` to bunnyland.app and keeps `?code=` links working (see `.github/workflows/deploy.yml`).

## Where things are

- `src/lib/generator.ts`: makes the questions for each level
- `src/lib/explain.ts`: builds the "Show me how" steps
- `src/lib/run.ts`: one Adventure run (meadows, hearts, showdowns, treats, paths), as plain data with no screens
- `src/lib/carrots.ts`: what Adventure pays in carrots. The leaderboard server uses it too, to turn away impossible scores.
- `src/lib/codes.ts`: the 5-emoji share codes
- `src/lib/leaderboard.ts`: talks to the leaderboard server, with an offline queue
- `src/lib/names.ts`: the word lists for leaderboard names, shared with the server. Only add words to the end.
- `src/lib/storage.ts`: everything saved on the device
- `src/lib/worksheet.ts`: the questions on a printed sheet, shared by the app and the worksheet pages
- `src/pages/worksheets.ts`: the static worksheet pages and the sitemap, written into `dist/` by a small plugin in `vite.config.ts`
- `src/components/`: the screens (home, quiz, results, adventure, leaderboard, sticker book, worksheet) and the two bunnies (`Bunny.tsx`, `Rascal.tsx`)
- `src/i18n/`: translations, one file per language, plus `pages.ts` for the worksheet pages (see below)
- `public/`: copied into the site as is: icons, `og.png`, `robots.txt`, `manifest.webmanifest` (for adding the app to a home screen)
- `src/styles.css`: colors, fonts, and layouts for tablets and phones
- `worker/`: the leaderboard server (Cloudflare Worker + D1 database)
- `e2e/`: browser tests that screenshot every screen
- `redirect/`: the page GitHub Pages serves to forward old links
- `design/`: the original clickable mockup, a gallery of screens, and `og-card.html`, the picture shown when the link is shared (`public/og.png`, 1200×630). After editing it, take a 1200×630 screenshot of it and save over `public/og.png`.

## Languages

All the words the app shows, including the "Show me how" steps and the printed worksheets, live in `src/i18n/`. `en.ts` is the source of truth: every other language is typed as `Messages`, so TypeScript reports a missing or extra key, and `npm test` checks that every language has the same keys and `{placeholders}` as English.

- `{name}` is filled in by the code; `*stars*` mark highlighted words in the explanations.
- `_one` / `_other` pairs are plurals (picked with `Intl.PluralRules`). Languages without plurals repeat the same text.
- Numbers always use the digits 0–9, and the signs + − × ÷ stay the same in every language.
- The choice is saved on the device. Until a language is picked, it follows `navigator.languages` (zh-TW, zh-HK and zh-Hant → 繁體中文, other zh → 简体中文, pt-BR and pt-PT → Português), falling back to English.
- The link preview tags in `index.html` stay in English, since link previews don't run the app.
- The words on the worksheet pages are in `src/i18n/pages.ts`, kept apart so the app doesn't download them. Same rules: every language has the same keys and `{placeholders}` as English (checked by `npm test`).

To add a language:

1. Copy `src/i18n/fr.ts` to `src/i18n/<code>.ts`, rename the export, and translate the values (keep `{placeholders}` and `*stars*`).
2. In `src/i18n/index.ts`, add it to `LANGS` (code, native name, short badge) and to `MESSAGES`. If the browser uses a different code for it, teach `detectLang` the mapping.
3. If it uses a script the web fonts don't cover, add system fonts for it in `src/styles.css` (see the `--cjk` lines).
4. Run `npm test` and `npm run build`.

## License

All rights reserved. The code is public to read, not to reuse: see [LICENSE](LICENSE).
