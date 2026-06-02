-- ============================================================
-- Barpi D1 Schema (SQLite) — 02.06.2026
-- Конвертовано з Supabase PostgreSQL
-- TIMESTAMPTZ → TEXT (ISO8601)
-- UUID → TEXT
-- NUMERIC → REAL
-- JSONB → TEXT (json_extract для query)
-- ============================================================

-- ============================================================
-- MOYSKLAD MASTER DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS moysklad_products (
  ms_id           TEXT PRIMARY KEY,
  ms_name         TEXT,
  sku_id          TEXT,
  unit_price      REAL,
  ms_path         TEXT,
  ms_archived     INTEGER DEFAULT 0,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_sku ON moysklad_products(sku_id);

CREATE TABLE IF NOT EXISTS moysklad_counterparties (
  ms_id           TEXT PRIMARY KEY,
  ms_name         TEXT,
  ms_type         TEXT,
  ms_phone        TEXT,
  ms_email        TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moysklad_stores (
  ms_id           TEXT PRIMARY KEY,
  ms_name         TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moysklad_organizations (
  ms_id           TEXT PRIMARY KEY,
  ms_name         TEXT,
  ms_inn          TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moysklad_expense_items (
  ms_id           TEXT PRIMARY KEY,
  ms_name         TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MOYSKLAD TRANSACTIONAL DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS moysklad_demand (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  ms_name         TEXT,
  moment          TEXT,
  sum_uah         REAL,
  agent_ms_id     TEXT,
  store_ms_id     TEXT,
  organization_ms_id TEXT,
  positions_json  TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_demand_moment ON moysklad_demand(moment);
CREATE INDEX IF NOT EXISTS idx_demand_agent ON moysklad_demand(agent_ms_id);

CREATE TABLE IF NOT EXISTS moysklad_demand_positions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  demand_ms_id    TEXT,
  product_ms_id   TEXT,
  sku_id          TEXT,
  qty             REAL,
  price_uah       REAL,
  sum_uah         REAL,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (demand_ms_id) REFERENCES moysklad_demand(ms_id),
  FOREIGN KEY (product_ms_id) REFERENCES moysklad_products(ms_id)
);
CREATE INDEX IF NOT EXISTS idx_dpos_demand ON moysklad_demand_positions(demand_ms_id);
CREATE INDEX IF NOT EXISTS idx_dpos_product ON moysklad_demand_positions(product_ms_id);

CREATE TABLE IF NOT EXISTS moysklad_payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  ms_name         TEXT,
  moment          TEXT,
  sum_uah         REAL,
  agent_ms_id     TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_moment ON moysklad_payments(moment);

CREATE TABLE IF NOT EXISTS moysklad_payments_out (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  ms_name         TEXT,
  moment          TEXT,
  sum_uah         REAL,
  agent_ms_id     TEXT,
  expense_item_id TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pmtout_moment ON moysklad_payments_out(moment);
CREATE INDEX IF NOT EXISTS idx_pmtout_item ON moysklad_payments_out(expense_item_id);

CREATE TABLE IF NOT EXISTS moysklad_supplies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  ms_name         TEXT,
  moment          TEXT,
  sum_uah         REAL,
  agent_ms_id     TEXT,
  store_ms_id     TEXT,
  positions_json  TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_supplies_moment ON moysklad_supplies(moment);

CREATE TABLE IF NOT EXISTS moysklad_customer_orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  ms_name         TEXT,
  moment          TEXT,
  sum_uah         REAL,
  state           TEXT,
  agent_ms_id     TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_corders_moment ON moysklad_customer_orders(moment);
CREATE INDEX IF NOT EXISTS idx_corders_state ON moysklad_customer_orders(state);

CREATE TABLE IF NOT EXISTS moysklad_purchase_orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  ms_name         TEXT,
  moment          TEXT,
  sum_uah         REAL,
  state           TEXT,
  agent_ms_id     TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moysklad_returns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  ms_name         TEXT,
  moment          TEXT,
  sum_uah         REAL,
  agent_ms_id     TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moysklad_losses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  ms_name         TEXT,
  moment          TEXT,
  sum_uah         REAL,
  store_ms_id     TEXT,
  reason          TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moysklad_moves (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  ms_name         TEXT,
  moment          TEXT,
  from_store_ms_id TEXT,
  to_store_ms_id  TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moysklad_processing_plans (
  ms_id           TEXT PRIMARY KEY,
  ms_name         TEXT,
  products_json   TEXT,
  materials_json  TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moysklad_processing_acts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  plan_ms_id      TEXT,
  moment          TEXT,
  materials_sum_uah REAL,
  products_qty    REAL,
  store_ms_id     TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_ms_id) REFERENCES moysklad_processing_plans(ms_id)
);
CREATE INDEX IF NOT EXISTS idx_pacts_moment ON moysklad_processing_acts(moment);
CREATE INDEX IF NOT EXISTS idx_pacts_plan ON moysklad_processing_acts(plan_ms_id);

CREATE TABLE IF NOT EXISTS moysklad_stock_by_store (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  store_ms_id     TEXT,
  product_ms_id   TEXT,
  stock_qty       REAL,
  in_transit      REAL DEFAULT 0,
  reserved        REAL DEFAULT 0,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_ms_id, product_ms_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_product ON moysklad_stock_by_store(product_ms_id);

CREATE TABLE IF NOT EXISTS moysklad_contracts (
  ms_id           TEXT PRIMARY KEY,
  ms_name         TEXT,
  agent_ms_id     TEXT,
  state           TEXT,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moysklad_payroll (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ms_id           TEXT UNIQUE,
  moment          TEXT,
  employee_ms_id  TEXT,
  sum_uah         REAL,
  raw_json        TEXT,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SALES FACT TABLE (denormalized for fast dashboard queries)
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_sku (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  demand_ms_id    TEXT,
  moment          TEXT,
  agent_ms_id     TEXT,
  product_ms_id   TEXT,
  sku_id          TEXT,
  qty             REAL,
  price_uah       REAL,
  sum_uah         REAL,
  paid_uah        REAL DEFAULT 0,
  cost_per_unit   REAL,
  margin_uah      REAL,
  last_synced     TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_moment ON sales_sku(moment);
CREATE INDEX IF NOT EXISTS idx_sales_agent ON sales_sku(agent_ms_id);
CREATE INDEX IF NOT EXISTS idx_sales_sku ON sales_sku(sku_id);

-- ============================================================
-- BRAND BIBLE INTERACTIVE DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS brand_ideas (
  id              TEXT PRIMARY KEY,            -- UUID generated in Worker
  title           TEXT NOT NULL,
  body            TEXT,
  author_name     TEXT,
  author_email    TEXT,
  section_id      TEXT,
  status          TEXT DEFAULT 'new' CHECK(status IN ('new','reviewing','accepted','done','rejected')),
  upvotes         INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON brand_ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON brand_ideas(created_at);

-- ============================================================
-- DASHBOARD VIEWS (SQLite-compatible)
-- ============================================================

DROP VIEW IF EXISTS v_sales_by_day;
CREATE VIEW v_sales_by_day AS
SELECT
  substr(moment, 1, 10) AS day,
  COUNT(DISTINCT demand_ms_id) AS orders,
  SUM(qty) AS qty,
  SUM(sum_uah) AS revenue,
  SUM(paid_uah) AS paid,
  SUM(margin_uah) AS margin
FROM sales_sku
WHERE moment IS NOT NULL
GROUP BY substr(moment, 1, 10);

DROP VIEW IF EXISTS v_sales_by_sku;
CREATE VIEW v_sales_by_sku AS
SELECT
  sku_id,
  product_ms_id,
  COUNT(DISTINCT demand_ms_id) AS orders,
  SUM(qty) AS qty,
  SUM(sum_uah) AS revenue,
  SUM(paid_uah) AS paid,
  AVG(price_uah) AS avg_price,
  SUM(margin_uah) AS margin,
  CASE WHEN SUM(sum_uah) > 0
       THEN ROUND(100.0 * SUM(margin_uah) / SUM(sum_uah), 1)
       ELSE NULL END AS margin_pct
FROM sales_sku
WHERE sku_id IS NOT NULL
GROUP BY sku_id, product_ms_id;

DROP VIEW IF EXISTS v_customer_metrics;
CREATE VIEW v_customer_metrics AS
SELECT
  agent_ms_id,
  COUNT(DISTINCT demand_ms_id) AS orders,
  SUM(sum_uah) AS revenue,
  SUM(paid_uah) AS paid,
  MIN(moment) AS first_purchase,
  MAX(moment) AS last_purchase,
  julianday(MAX(moment)) - julianday(MIN(moment)) AS days_active
FROM sales_sku
WHERE agent_ms_id IS NOT NULL
GROUP BY agent_ms_id;

DROP VIEW IF EXISTS v_customer_dow;
CREATE VIEW v_customer_dow AS
SELECT
  CAST(strftime('%w', moment) AS INTEGER) AS dow,
  COUNT(DISTINCT demand_ms_id) AS orders,
  SUM(sum_uah) AS revenue
FROM sales_sku
WHERE moment IS NOT NULL
GROUP BY dow;

DROP VIEW IF EXISTS v_customer_timeline;
CREATE VIEW v_customer_timeline AS
SELECT
  substr(moment, 1, 7) AS month,
  COUNT(DISTINCT agent_ms_id) AS customers,
  COUNT(DISTINCT demand_ms_id) AS orders,
  SUM(sum_uah) AS revenue,
  SUM(paid_uah) AS paid
FROM sales_sku
WHERE moment IS NOT NULL
GROUP BY substr(moment, 1, 7)
ORDER BY month;

DROP VIEW IF EXISTS v_pnl_monthly;
CREATE VIEW v_pnl_monthly AS
WITH revenue AS (
  SELECT substr(moment, 1, 7) AS month, SUM(sum_uah) AS revenue
  FROM moysklad_demand WHERE moment IS NOT NULL
  GROUP BY substr(moment, 1, 7)
),
cogs AS (
  SELECT substr(moment, 1, 7) AS month, SUM(materials_sum_uah) AS cogs
  FROM moysklad_processing_acts WHERE moment IS NOT NULL
  GROUP BY substr(moment, 1, 7)
),
opex AS (
  SELECT substr(moment, 1, 7) AS month, SUM(sum_uah) AS opex
  FROM moysklad_payments_out WHERE moment IS NOT NULL
  GROUP BY substr(moment, 1, 7)
)
SELECT
  COALESCE(r.month, c.month, o.month) AS month,
  COALESCE(r.revenue, 0) AS revenue,
  COALESCE(c.cogs, 0) AS cogs,
  COALESCE(r.revenue, 0) - COALESCE(c.cogs, 0) AS gross_profit,
  COALESCE(o.opex, 0) AS opex,
  COALESCE(r.revenue, 0) - COALESCE(c.cogs, 0) - COALESCE(o.opex, 0) AS net_profit
FROM revenue r
LEFT JOIN cogs c ON c.month = r.month
LEFT JOIN opex o ON o.month = r.month
ORDER BY month;

DROP VIEW IF EXISTS v_cash_flow;
CREATE VIEW v_cash_flow AS
WITH inflow AS (
  SELECT substr(moment, 1, 7) AS month, SUM(sum_uah) AS inflow
  FROM moysklad_payments WHERE moment IS NOT NULL
  GROUP BY substr(moment, 1, 7)
),
outflow AS (
  SELECT substr(moment, 1, 7) AS month, SUM(sum_uah) AS outflow
  FROM moysklad_payments_out WHERE moment IS NOT NULL
  GROUP BY substr(moment, 1, 7)
)
SELECT
  COALESCE(i.month, o.month) AS month,
  COALESCE(i.inflow, 0) AS inflow,
  COALESCE(o.outflow, 0) AS outflow,
  COALESCE(i.inflow, 0) - COALESCE(o.outflow, 0) AS net_cash
FROM inflow i
LEFT JOIN outflow o ON o.month = i.month
ORDER BY month;

DROP VIEW IF EXISTS v_production_monthly;
CREATE VIEW v_production_monthly AS
SELECT
  substr(moment, 1, 7) AS month,
  COUNT(*) AS acts,
  SUM(products_qty) AS products_made,
  SUM(materials_sum_uah) AS materials_cost
FROM moysklad_processing_acts
WHERE moment IS NOT NULL
GROUP BY substr(moment, 1, 7)
ORDER BY month;

DROP VIEW IF EXISTS v_production_efficiency;
CREATE VIEW v_production_efficiency AS
SELECT
  plan_ms_id,
  COUNT(*) AS runs,
  AVG(products_qty) AS avg_products,
  AVG(materials_sum_uah) AS avg_materials,
  CASE WHEN AVG(products_qty) > 0
       THEN AVG(materials_sum_uah) / AVG(products_qty)
       ELSE NULL END AS cost_per_product
FROM moysklad_processing_acts
WHERE plan_ms_id IS NOT NULL
GROUP BY plan_ms_id;

DROP VIEW IF EXISTS v_inventory_extended;
CREATE VIEW v_inventory_extended AS
SELECT
  s.store_ms_id,
  st.ms_name AS store_name,
  s.product_ms_id,
  p.ms_name AS product_name,
  p.sku_id,
  s.stock_qty,
  s.in_transit,
  s.reserved,
  s.stock_qty - s.reserved AS available,
  s.last_synced
FROM moysklad_stock_by_store s
LEFT JOIN moysklad_products p ON p.ms_id = s.product_ms_id
LEFT JOIN moysklad_stores st ON st.ms_id = s.store_ms_id
WHERE s.stock_qty > 0;

DROP VIEW IF EXISTS v_dashboard_kpis;
CREATE VIEW v_dashboard_kpis AS
SELECT
  (SELECT COUNT(*) FROM moysklad_demand) AS total_orders,
  (SELECT COUNT(DISTINCT agent_ms_id) FROM moysklad_demand) AS total_customers,
  (SELECT SUM(sum_uah) FROM moysklad_demand) AS total_revenue,
  (SELECT SUM(sum_uah) FROM moysklad_payments) AS total_paid,
  (SELECT MAX(last_synced) FROM moysklad_demand) AS last_sync;

-- ============================================================
-- SYNC METADATA (track each MS endpoint sync state)
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_state (
  entity          TEXT PRIMARY KEY,
  last_synced_at  TEXT,
  last_moment     TEXT,
  rows_synced     INTEGER DEFAULT 0,
  last_error      TEXT,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Initial seed
INSERT OR IGNORE INTO sync_state(entity, last_synced_at) VALUES
  ('product', NULL),
  ('counterparty', NULL),
  ('store', NULL),
  ('organization', NULL),
  ('expenseitem', NULL),
  ('demand', NULL),
  ('paymentin', NULL),
  ('paymentout', NULL),
  ('supply', NULL),
  ('customerorder', NULL),
  ('purchaseorder', NULL),
  ('salesreturn', NULL),
  ('loss', NULL),
  ('move', NULL),
  ('processingplan', NULL),
  ('processing', NULL),
  ('stock_by_store', NULL),
  ('contract', NULL),
  ('payroll', NULL);

-- ============================================================
-- DONE — verify
-- ============================================================
-- SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
-- SELECT name FROM sqlite_master WHERE type='view' ORDER BY name;
