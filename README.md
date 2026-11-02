# Bunny Math 🐰

Cute adding and taking-away practice for kids around 8. It runs entirely in the browser: no accounts, no server, and progress is saved on the device.

- 4 levels: within 20, no carrying, carrying/borrowing, and two-digit sums (answers up to 99)
- 5 question types: type the answer, pick the answer, missing number, compare (< = >), picture stories
- Fresh questions every time; `?seed=123` in the URL gives the same quiz again
- "Show me how" explains each question step by step with tens-and-ones blocks
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
- `design/`: the original clickable mockup
