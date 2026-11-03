# Bunny API

The server for the Bunny games, starting with Bunny Math. One Worker and one database
(`bunny-collection`) serve them all, so a player keeps one name across every game.

A Cloudflare Worker with a D1 (SQLite) database. It keeps each player's all-time carrot total
and serves the leaderboard. The app calls it from the browser.

## Deploy

Run these in this `worker/` folder.

1. `npm install`
2. `npx wrangler login` (opens a browser to sign in to Cloudflare)
3. `npx wrangler d1 create bunny-collection`, then copy the `database_id` it prints into
   `wrangler.toml`, in place of `REPLACE_WITH_YOUR_D1_ID`.
4. `npm run db:migrate` (creates the tables)
5. `npm run deploy`. It prints the Worker's URL, like `https://bunny-api.<you>.workers.dev`.
6. In the GitHub repo, go to **Settings → Secrets and variables → Actions → Variables** and add
   a variable `VITE_LEADERBOARD_URL` set to that URL. The app's build reads it.

Check it's up: open `<worker URL>/health`; it should say `{"ok":true}`.

**If the site moves** to a different address, add the new origin (like `https://example.com`, no
trailing slash) to `ALLOWED_ORIGINS` in `wrangler.toml` and run `npm run deploy` again. Otherwise
browsers on the new site can't reach the server.

## Develop

- `npm test` runs the tests in the Workers runtime with a local D1. No Cloudflare account needed.
- `npm run typecheck`
- `npx wrangler d1 migrations apply bunny-collection --local`, then `npm run dev`, runs the
  server at `http://localhost:8787` with a local database.

## API

All JSON. Authenticated calls send `Authorization: Bearer <secret>`.

| Call | Answer |
| --- | --- |
| `POST /players` `{}` | `201 {id, secret, name: {emoji, adj, noun}, display}` |
| `PUT /players/:id/name` `{emoji, adj, noun}` | `200 {name, display}`; `400 invalid_name`, `409 name_taken`, `401 unauthorized` |
| `POST /runs` `{runId, playerId, code, level, carrots}` | `200 {total, rank}`; `400 bad_run`, `401 unauthorized`, `409 run_id_taken`, `429 too_many_runs` |
| `GET /leaderboard?player=<id>` | `200 {top, me, near}`, entries are `{rank, display, total}` |
| `GET /health` | `200 {ok: true}` |

Names are unique by adjective + noun. Only a hash of each secret is stored. A player can post at
most 40 runs in any 24 hours, and a repeated `runId` counts once.
