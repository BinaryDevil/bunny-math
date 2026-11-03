# AGENTS.md

[README.md](README.md) is the map: features, running, deploying, where things are, and the rules for translations.

## Checks

Run both before calling a change done. The `Checks` workflow runs the same on every PR.

- App: `npm test`, then `npm run build` (the build runs the type checker).
- Leaderboard server: `cd worker && npm test && npm run typecheck`.

`npm run test:e2e` screenshots every screen in WebKit (~5 min). Run it after layout or styling changes.

## Shared code

The server in `worker/` imports `src/lib/names.ts`, `src/lib/carrots.ts` and `src/lib/types.ts`. A change to any of them is a server change too: run the server checks, and redeploy it by hand (`cd worker && npm run deploy`), because only the site deploys on push.

## Deploying

A push to `main` deploys the site to bunnyland.app through Cloudflare Workers Builds. Branches and PRs get a preview build, reported as the `Workers Builds: bunnyland` check. `npm run deploy` uploads the working tree as it stands, uncommitted edits included, so commit first and let `main` deploy.

In `wrangler.toml`, top-level keys like `routes` go above the first `[table]`, or TOML files them under that table.
