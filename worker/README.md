# Bunny API

The server for the Bunny games, starting with Bunny Math. One Worker and one database
(`bunny-collection`) serve them all, so a player keeps one name across every game.

A Cloudflare Worker with a D1 (SQLite) database. It keeps each player's all-time carrot total
and serves the leaderboard. The app calls it from the browser.

## Deploy

It's live at `https://bunny-api.bunny-api.workers.dev`, with the `bunny-collection` database
already made. Unlike the site, it isn't deployed automatically: after changing it, run these in
this `worker/` folder.

1. `npm install`, and `npx wrangler login` once (opens a browser to sign in to Cloudflare)
2. `npm run db:migrate` if you added a file to `migrations/`
3. `npm run deploy`

Check it's up: open `<worker URL>/health`; it should say `{"ok":true}`.

The app finds the server through `VITE_LEADERBOARD_URL` in the root `.env.production`. Change it
there if the server's address ever changes.

**Sites allowed to call it** are listed in `ALLOWED_ORIGINS` in `wrangler.toml` (now bunnyland.app,
www.bunnyland.app, the old GitHub Pages address, and localhost). When a game moves to a new
address, add its origin (like `https://example.com`, no trailing slash) and run `npm run deploy`
again. Otherwise browsers on the new site can't reach the server. Games under bunnyland.app paths,
like `bunnyland.app/music/`, share the `https://bunnyland.app` origin and need nothing new.

**Starting over on another Cloudflare account:** run `npx wrangler d1 create bunny-collection`,
put the `database_id` it prints into `wrangler.toml`, then follow the steps above. Point
`VITE_LEADERBOARD_URL` at the URL `npm run deploy` prints.

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
