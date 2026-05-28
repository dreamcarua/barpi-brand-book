-- Barpi D1 base schema
-- Applied to D1 `barpi-bible` (uuid 45c93052-c82c-4d0c-901b-2999187643b9) on 2026-05-28

CREATE TABLE IF NOT EXISTS sku_catalog (
  sku_id TEXT PRIMARY KEY,
  barcode TEXT,
  name TEXT NOT NULL,
  ingredient TEXT,
  format_g INTEGER,
  category TEXT,
  brand_color TEXT,
  retail_price_uah REAL,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sales_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  channel TEXT NOT NULL,
  sku_id TEXT,
  qty INTEGER DEFAULT 0,
  revenue_uah REAL DEFAULT 0,
  orders INTEGER DEFAULT 0,
  source TEXT DEFAULT 'moysklad',
  synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sku_id) REFERENCES sku_catalog(sku_id)
);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_daily(date);
CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales_daily(channel);
CREATE INDEX IF NOT EXISTS idx_sales_sku ON sales_daily(sku_id);

CREATE TABLE IF NOT EXISTS inventory_snapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  qty_available INTEGER DEFAULT 0,
  qty_reserved INTEGER DEFAULT 0,
  qty_in_transit INTEGER DEFAULT 0,
  warehouse TEXT,
  synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sku_id) REFERENCES sku_catalog(sku_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_snapshot ON inventory_snapshot(snapshot_date, sku_id);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT,
  status TEXT,
  city TEXT,
  region TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  owner TEXT,
  active_points INTEGER DEFAULT 0,
  start_date TEXT,
  notes TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_pipeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_name TEXT NOT NULL,
  stage TEXT NOT NULL,
  contact_date TEXT,
  next_action TEXT,
  next_action_date TEXT,
  owner TEXT,
  probability INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT,
  event_date TEXT,
  event_date_end TEXT,
  attendees TEXT,
  budget_uah REAL DEFAULT 0,
  samples_distributed INTEGER DEFAULT 0,
  ugc_generated INTEGER DEFAULT 0,
  status TEXT,
  notes TEXT,
  result_summary TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

CREATE TABLE IF NOT EXISTS smm_content_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  channel TEXT NOT NULL,
  format TEXT NOT NULL,
  pillar TEXT NOT NULL,
  topic TEXT NOT NULL,
  hook TEXT,
  reach INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  direct_reqs INTEGER DEFAULT 0,
  website_clicks INTEGER DEFAULT 0,
  link TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_smm_date ON smm_content_log(date);
CREATE INDEX IF NOT EXISTS idx_smm_pillar ON smm_content_log(pillar);
