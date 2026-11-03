# Bunny Math 🐰

Cute maths practice for kids around 8: adding and taking away, or all four operations. It runs entirely in the browser: no accounts, no server, and progress is saved on the device.

- Two modes, picked on the first visit and switchable from the home screen:
  - **Add & take away**, 6 levels: within 20, no carrying, carrying/borrowing, two-digit sums, three-digit sums, and three-digit sums with lots of carrying (including borrowing across a zero)
  - **All four**, 4 levels: tables of 2, 5 and 10; tables up to 5; tables up to 10; two-digit × and ÷ by one digit. Two thirds of the questions are × or ÷.
- 5 question types: type the answer, pick the answer, missing number, compare (< = >), picture stories
- Fresh questions every time; `?seed=123` in the URL gives the same quiz again
- "Show me how" explains each question step by step, in one of two styles (the choice is remembered):
  - **Blocks**: hundreds, tens and ones blocks, and dot arrays for × and ÷
  - **Columns**: the written column method (竖式), one column at a time, with carried digits, borrow dots, and long division
- Missed questions come back at the end; results show stars, skills, and a sticker reward
- Printable worksheets with an answer key (🖨️ on the home screen)
- 9 languages: English, 简体中文, 繁體中文, Français, Español, Deutsch, 日本語, 한국어, Português. The 🌐 button picks one; on the first visit it follows the browser's language

## Run it

```bash
npm install
npm run dev
```

```bash
npm test
npm run build && npm run test:e2e   # every screen, 9 languages, phone/landscape/desktop sizes in WebKit (~5 min); needs `npx playwright install webkit` once
```

## Put it on GitHub Pages

1. Push this repo to GitHub.
2. In the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` then tests, builds, and publishes the app (see `.github/workflows/deploy.yml`).

The build uses relative paths, so it works under any repo name.

## Where things are

- `src/lib/generator.ts`: makes the questions for each level
- `src/lib/explain.ts`: builds the "Show me how" steps
- `src/components/`: the screens (home, quiz, results, sticker book, worksheet)
- `src/i18n/`: translations, one file per language (see below)
- `src/styles.css`: colors, fonts, and layouts for tablets and phones
- `design/`: the original clickable mockup, and `og-card.html`, the picture shown when the link is shared (`public/og.png`, 1200×630). After editing it, take a 1200×630 screenshot of it and save over `public/og.png`.

## Languages

All the words the app shows, including the "Show me how" steps and the printed worksheets, live in `src/i18n/`. `en.ts` is the source of truth: every other language is typed as `Messages`, so TypeScript reports a missing or extra key, and `npm test` checks that every language has the same keys and `{placeholders}` as English.

- `{name}` is filled in by the code; `*stars*` mark highlighted words in the explanations.
- `_one` / `_other` pairs are plurals (picked with `Intl.PluralRules`). Languages without plurals repeat the same text.
- Numbers always use the digits 0–9, and the signs + − × ÷ stay the same in every language.
- The choice is saved on the device. Until a language is picked, it follows `navigator.languages` (zh-TW, zh-HK and zh-Hant → 繁體中文, other zh → 简体中文, pt-BR and pt-PT → Português), falling back to English.
- The link preview tags in `index.html` stay in English, since link previews don't run the app.

To add a language:

1. Copy `src/i18n/fr.ts` to `src/i18n/<code>.ts`, rename the export, and translate the values (keep `{placeholders}` and `*stars*`).
2. In `src/i18n/index.ts`, add it to `LANGS` (code, native name, short badge) and to `MESSAGES`. If the browser uses a different code for it, teach `detectLang` the mapping.
3. If it uses a script the web fonts don't cover, add system fonts for it in `src/styles.css` (see the `--cjk` lines).
4. Run `npm test` and `npm run build`.
