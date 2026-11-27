-- Barpi Giveaways · таблиці в D1 barpi-bible (27.11.2026). Час усюди: unix-секунди, ставить воркер.
CREATE TABLE IF NOT EXISTS gw_giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',      -- open | frozen | drawn
  source TEXT NOT NULL DEFAULT 'instagram', -- instagram | demo (репетиція на вигаданих коментарях) | example (навчальний приклад на реальному пості)
  media_id TEXT, media_permalink TEXT, media_caption TEXT, media_thumb TEXT, media_ts INTEGER,
  starts_at INTEGER, ends_at INTEGER,
  config TEXT NOT NULL DEFAULT '{}',        -- JSON: умови, кількість переможців і резерву, призи, правила, святковий режим
  comments_total INTEGER NOT NULL DEFAULT 0,
  accounts_count INTEGER NOT NULL DEFAULT 0,
  ok_count INTEGER NOT NULL DEFAULT 0,
  fetched_at INTEGER, fetch_error TEXT, fetch_partial INTEGER NOT NULL DEFAULT 0,
  frozen_at INTEGER, frozen_by TEXT, pool_hash TEXT, pool_count INTEGER,
  drawn_at INTEGER,
  gen INTEGER NOT NULL DEFAULT 0,           -- покоління: росте після анулювання жеребкування
  public_token TEXT, published INTEGER NOT NULL DEFAULT 0,
  calendar_id INTEGER,
  created_by TEXT, created_at INTEGER, updated_at INTEGER,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS gw_giveaways_token ON gw_giveaways(public_token);
CREATE TABLE IF NOT EXISTS gw_comments (
  giveaway_id INTEGER NOT NULL,
  ig_id TEXT NOT NULL,
  parent_ig_id TEXT,
  username TEXT, text TEXT, ts INTEGER, like_count INTEGER NOT NULL DEFAULT 0,
  gone INTEGER NOT NULL DEFAULT 0,          -- зник з Instagram при повному повторному зборі
  PRIMARY KEY (giveaway_id, ig_id)
);
CREATE TABLE IF NOT EXISTS gw_decisions (
  giveaway_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  decision TEXT NOT NULL,                   -- ok | fail | review
  reason TEXT, by TEXT, at INTEGER,
  PRIMARY KEY (giveaway_id, username)
);
CREATE TABLE IF NOT EXISTS gw_pool (
  giveaway_id INTEGER NOT NULL,
  n INTEGER NOT NULL,
  username TEXT NOT NULL, ig_id TEXT NOT NULL,
  PRIMARY KEY (giveaway_id, n)
);
CREATE TABLE IF NOT EXISTS gw_draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveaway_id INTEGER NOT NULL,
  gen INTEGER NOT NULL DEFAULT 0,
  round INTEGER NOT NULL,                   -- 1 = основне жеребкування, далі додаткові вибори
  kind TEXT NOT NULL,                       -- main | extra
  algo TEXT NOT NULL, seed TEXT NOT NULL, pool_hash TEXT NOT NULL, pool_count INTEGER NOT NULL,
  picks TEXT NOT NULL,                      -- JSON-масив номерів у порядку вибору
  taken TEXT,                               -- JSON-масив номерів, виключених з цього кола
  by TEXT, at INTEGER,
  void INTEGER NOT NULL DEFAULT 0, void_reason TEXT, void_by TEXT, void_at INTEGER,
  UNIQUE (giveaway_id, gen, round)
);
CREATE TABLE IF NOT EXISTS gw_winners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveaway_id INTEGER NOT NULL,
  gen INTEGER NOT NULL DEFAULT 0,
  round INTEGER NOT NULL,
  role TEXT NOT NULL,                       -- winner | reserve
  position INTEGER NOT NULL,
  n INTEGER NOT NULL, username TEXT NOT NULL, ig_id TEXT,
  prize TEXT,
  verdict TEXT NOT NULL DEFAULT 'pending',  -- pending | ok | failed
  verdict_reason TEXT, verdict_by TEXT, verdict_at INTEGER,
  promoted_from INTEGER,                    -- id переможця, якого замінив цей резервний
  void INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS gw_winners_g ON gw_winners(giveaway_id, gen);
CREATE TABLE IF NOT EXISTS gw_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveaway_id INTEGER, at INTEGER NOT NULL, by TEXT, action TEXT NOT NULL, detail TEXT
);
CREATE INDEX IF NOT EXISTS gw_log_g ON gw_log(giveaway_id, id);
CREATE TABLE IF NOT EXISTS gw_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, config TEXT NOT NULL,
  created_by TEXT, created_at INTEGER, deleted INTEGER NOT NULL DEFAULT 0
);
