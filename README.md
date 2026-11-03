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

## Run it

```bash
npm install
npm run dev
```

```bash
npm test
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
- `src/styles.css`: colors, fonts, and layouts for tablets and phones
- `design/`: the original clickable mockup, and `og-card.html`, the picture shown when the link is shared (`public/og.png`, 1200×630). After editing it, take a 1200×630 screenshot of it and save over `public/og.png`.

## Languages

Choose English or 简体中文 from the language selector on the mode or home screen.
The choice is stored on the device alongside existing progress; older saved progress
continues to work. Interface strings and story translations live in `src/lib/i18n.ts`.
Explanation messages use semantic keys and named parameters in
`src/lib/explain-i18n.ts`; the teaching logic in `src/lib/explain.ts` selects those
keys directly. Keep the same keys and named parameters in every language, and run
the multilingual tests when adding or changing a teaching step. Adding a language
also requires translating the interface and story templates.
