-- ad-director for Barpi (owner decision 13.10.2026). D1 barpi-bible.
-- Times: ISO 8601 UTC with Z. Money: UAH.

CREATE TABLE IF NOT EXISTS ad_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  project TEXT NOT NULL DEFAULT 'barpi',
  actor TEXT NOT NULL DEFAULT 'claude',
  action TEXT NOT NULL,              -- note | budget_step | pause_ad | new_test_ad | activate_ad | offer_switch | learning_reset
  status TEXT NOT NULL,              -- proposed | approved | rejected | done | failed | rolled_back
  entity_type TEXT, entity_id TEXT, entity_name TEXT,
  before TEXT, after TEXT,           -- JSON
  reason TEXT,
  metrics TEXT,                      -- JSON
  hypothesis TEXT, review_at TEXT, outcome TEXT, outcome_at TEXT,
  rollback TEXT                      -- JSON recipe
);
CREATE INDEX IF NOT EXISTS ad_journal_proj_at ON ad_journal(project, at);
CREATE INDEX IF NOT EXISTS ad_journal_status ON ad_journal(project, status);

CREATE TABLE IF NOT EXISTS ad_events (
  id TEXT PRIMARY KEY,               -- e.g. promo-2026-10-hrum10
  project TEXT NOT NULL DEFAULT 'barpi',
  kind TEXT NOT NULL DEFAULT 'promo',
  title TEXT NOT NULL,
  mechanic TEXT,                     -- what the buyer gets, verbatim for ad copy
  promo_code TEXT,
  landing_url TEXT,
  client_text TEXT,
  starts_at TEXT NOT NULL,           -- UTC ISO
  ends_at TEXT NOT NULL,             -- UTC ISO, half-open
  status TEXT NOT NULL DEFAULT 'planned',   -- planned | live | cancelled
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS ad_events_window ON ad_events(project, status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS ad_orders (
  order_no TEXT PRIMARY KEY,         -- Horoshop order number from the thank-you page
  placed_at TEXT NOT NULL,           -- UTC ISO, when the beacon arrived
  value REAL, currency TEXT DEFAULT 'UAH',
  items TEXT,                        -- JSON as the page reported it
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
  fbclid TEXT, touch_at TEXT, landing_url TEXT, referrer TEXT,
  first_touch TEXT,                  -- JSON: first utm set seen in 30 days
  paid_status TEXT NOT NULL DEFAULT 'unconfirmed',   -- unconfirmed | paid | cancelled
  paid_source TEXT, paid_checked_at TEXT,
  ua TEXT, raw TEXT
);
CREATE INDEX IF NOT EXISTS ad_orders_placed ON ad_orders(placed_at);
CREATE INDEX IF NOT EXISTS ad_orders_medium ON ad_orders(utm_medium);
