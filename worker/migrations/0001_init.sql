-- Players have no accounts: a device registers and keeps an id plus a secret.
-- Only a SHA-256 hash of the secret is stored.
CREATE TABLE players (
  id          TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  adj         TEXT NOT NULL,
  noun        TEXT NOT NULL,
  -- All-time carrots from accepted runs. Only ever goes up.
  total       INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL, -- ms since epoch
  -- When `total` last changed, so ties go to whoever got there first.
  updated_at  INTEGER NOT NULL
);

-- Only one "Bouncy Otter", whatever its emoji. Case-sensitive (SQLite's default BINARY collation).
CREATE UNIQUE INDEX players_name ON players (adj, noun);

-- Leaderboard order: most carrots first, then whoever reached that total first.
CREATE INDEX players_rank ON players (total DESC, updated_at ASC);

CREATE TABLE runs (
  run_id     TEXT PRIMARY KEY, -- made by the client, so a repeated post counts once
  player_id  TEXT NOT NULL REFERENCES players (id),
  code       TEXT NOT NULL,    -- the run's share code, stored as given
  level      INTEGER NOT NULL,
  carrots    INTEGER NOT NULL CHECK (carrots >= 0),
  created_at INTEGER NOT NULL  -- ms since epoch
);

-- For counting a player's runs in the last 24 hours.
CREATE INDEX runs_player_time ON runs (player_id, created_at);

-- Adding a run adds its carrots to the player's total in the same statement,
-- so a run can never be stored without being counted, or counted twice.
CREATE TRIGGER runs_add_to_total AFTER INSERT ON runs
BEGIN
  UPDATE players
     SET total = total + NEW.carrots,
         updated_at = CASE WHEN NEW.carrots > 0 THEN NEW.created_at ELSE updated_at END
   WHERE id = NEW.player_id;
END;
