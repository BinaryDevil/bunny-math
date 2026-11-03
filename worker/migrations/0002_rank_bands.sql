-- How many players have totals in each score band, so a rank is a sum of a few band counts
-- instead of counting every player above. D1 bills each row a query reads, so counting
-- everyone above a player got dearer as the board grew; this keeps a rank to ~200 rows at most.
--
-- Three levels of bands, each 100 times wider than the one below:
--   level 0: 10 carrots wide, level 1: 1,000 wide, level 2: 100,000 wide.
-- Only players with carrots are counted; everyone on 0 shares the last rank.
CREATE TABLE rank_bands (
  level INTEGER NOT NULL,
  band  INTEGER NOT NULL, -- total / width, rounded down (integer division)
  n     INTEGER NOT NULL,
  PRIMARY KEY (level, band)
) WITHOUT ROWID;

INSERT INTO rank_bands (level, band, n)
  SELECT 0, total / 10, COUNT(*) FROM players WHERE total > 0 GROUP BY total / 10
  UNION ALL
  SELECT 1, total / 1000, COUNT(*) FROM players WHERE total > 0 GROUP BY total / 1000
  UNION ALL
  SELECT 2, total / 100000, COUNT(*) FROM players WHERE total > 0 GROUP BY total / 100000;

-- Keep the counts in step with every total change. Only bands that actually change are
-- touched, so a typical run adds 2 rows written (its level-0 band out and in).
CREATE TRIGGER players_bands_update AFTER UPDATE OF total ON players
WHEN NEW.total <> OLD.total
BEGIN
  UPDATE rank_bands SET n = n - 1
   WHERE OLD.total > 0
     AND ((level = 0 AND band = OLD.total / 10 AND OLD.total / 10 <> NEW.total / 10)
       OR (level = 1 AND band = OLD.total / 1000 AND OLD.total / 1000 <> NEW.total / 1000)
       OR (level = 2 AND band = OLD.total / 100000 AND OLD.total / 100000 <> NEW.total / 100000));
  INSERT INTO rank_bands (level, band, n)
    SELECT 0, NEW.total / 10, 1 WHERE NEW.total > 0 AND (OLD.total = 0 OR OLD.total / 10 <> NEW.total / 10)
    UNION ALL
    SELECT 1, NEW.total / 1000, 1 WHERE NEW.total > 0 AND (OLD.total = 0 OR OLD.total / 1000 <> NEW.total / 1000)
    UNION ALL
    SELECT 2, NEW.total / 100000, 1 WHERE NEW.total > 0 AND (OLD.total = 0 OR OLD.total / 100000 <> NEW.total / 100000)
  ON CONFLICT (level, band) DO UPDATE SET n = n + 1;
END;

-- Players always start on 0, but count one that doesn't, so the bands can never drift.
CREATE TRIGGER players_bands_insert AFTER INSERT ON players
WHEN NEW.total > 0
BEGIN
  INSERT INTO rank_bands (level, band, n)
    SELECT 0, NEW.total / 10, 1 WHERE true
    UNION ALL SELECT 1, NEW.total / 1000, 1 WHERE true
    UNION ALL SELECT 2, NEW.total / 100000, 1 WHERE true
  ON CONFLICT (level, band) DO UPDATE SET n = n + 1;
END;
