-- 23.10.2026: окремий прайс партнера для калькулятора промо (пропозиція техчергового #20261022-1445-9fad, погоджено Вадимом).
-- Ціна з ПДВ за специфікацією партнера, чинна з valid_from. calcBase бере її ПЕРШОЮ: прайс партнера → фактична
-- середня ціна відвантажень → загальний оптовий прайс МойСклад. Самі ціни партнерів ЛИШЕ в D1, у репозиторій не класти.
CREATE TABLE IF NOT EXISTS mkt_partner_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  product_ms_id TEXT NOT NULL,
  barcode TEXT,
  price_vat REAL NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  source TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_pp ON mkt_partner_prices(partner_id, product_ms_id, valid_from);
