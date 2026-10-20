-- barpi-mkt · маркетинговий календар і калькулятор промо (рішення Вадима 20.10.2026).
-- D1 barpi-bible. Дати активностей — київські календарні дні 'YYYY-MM-DD' (кінець включно).
-- Гроші — грн. Таблиці МойСкладу (moysklad_*, sales_sku) тут лише читаються.

CREATE TABLE IF NOT EXISTS mkt_partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  ptype TEXT NOT NULL DEFAULT 'other',  -- network | online | shop | distributor | marketplace | horeca | grooming | event | own | wholesale | other
  cp_ids TEXT,                          -- JSON-масив ms_id контрагентів МойСклад
  cp_rule TEXT,                         -- 'fop' = усі ФОП-контрагенти, крім закріплених за іншими партнерами
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  campaign TEXT,                        -- парасолька: «Black Friday 2026», «ДР ПЕТ КОРП» тощо
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  prep_date TEXT,                       -- дедлайн підготовки
  direction TEXT NOT NULL,              -- partners | ecom | pr
  partner_id INTEGER REFERENCES mkt_partners(id),
  activity_type TEXT,
  mechanic TEXT,
  discount_pct REAL,                    -- кінцева знижка покупцю, %
  supplier_discount_pct REAL,           -- наша знижка на відвантаження, %
  channel TEXT,
  owner TEXT,                           -- email відповідального
  priority TEXT NOT NULL DEFAULT 'P2',
  status TEXT NOT NULL DEFAULT 'planned',  -- idea | planned | approval | approved | prep | ready | active | done | postponed | cancelled
  budget_plan REAL NOT NULL DEFAULT 0,
  cost_fact REAL NOT NULL DEFAULT 0,
  file_url TEXT,
  post_url TEXT,
  skus TEXT,                            -- JSON-масив sku_id або вільний текст
  kpi_name TEXT,
  kpi_plan REAL,
  kpi_fact REAL,
  sellout_units REAL,                   -- продажі на полиці партнера за звітом партнера (якщо дав)
  sellout_revenue REAL,
  result TEXT,                          -- success | partial | fail
  decision TEXT,                        -- repeat | repeat_changed | change_discount | change_sku | change_mechanic | change_support | stop | test
  comment TEXT,
  checklist TEXT,                       -- JSON {"file":1,"creatives":1,"approval":1,"budget":1}
  promo_code TEXT,
  landing_url TEXT,
  calc_id INTEGER,
  ad_event_id TEXT,                     -- дзеркало в ad_events для ad-director (акції Barpi.ua)
  source TEXT,                          -- manual | import-xlsx-2026 | calc
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS mkt_act_dates ON mkt_activities(deleted, start_date, end_date);
CREATE INDEX IF NOT EXISTS mkt_act_partner ON mkt_activities(partner_id, start_date);

CREATE TABLE IF NOT EXISTS mkt_budget (
  ym TEXT PRIMARY KEY,                  -- 'YYYY-MM'
  plan_uah REAL NOT NULL DEFAULT 0,
  note TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS mkt_calcs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER,
  partner_id INTEGER,
  title TEXT NOT NULL,
  start_date TEXT, end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | planned | approved | active | completed | analysed | cancelled
  inputs TEXT,                          -- JSON: знижки, витрати, метод baseline, SKU
  snapshot TEXT,                        -- JSON: baseline, ціни, собівартість, залишки на момент збереження
  result TEXT,                          -- JSON: break-even, сценарії, прогноз
  verdict TEXT,                         -- green | yellow | red
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS mkt_analysis (
  activity_id INTEGER PRIMARY KEY,
  computed_at TEXT NOT NULL,
  data TEXT NOT NULL                    -- JSON post-analysis (кеш; перераховується кнопкою і нічним cron)
);

CREATE TABLE IF NOT EXISTS mkt_settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS mkt_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT DEFAULT CURRENT_TIMESTAMP,
  actor TEXT,
  action TEXT,
  entity TEXT,
  entity_id TEXT,
  before TEXT,
  after TEXT
);
CREATE INDEX IF NOT EXISTS mkt_audit_ent ON mkt_audit(entity, entity_id);

CREATE TABLE IF NOT EXISTS mkt_notify (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (day, kind, ref)
);

-- Налаштування за замовчуванням. Собівартість — методика КАНОН v4 (barpi-memory/docs/canon-v4-final.md):
-- змінні 620 грн/кг × вага нетто + пакування (малі 6,5 / великі 10,5 / банка 22,65). Праця — у постійних.
INSERT OR IGNORE INTO mkt_settings (k, v) VALUES
  ('cost_per_kg', '620'),
  ('pack_small', '6.5'),
  ('pack_large', '10.5'),
  ('pack_jar', '22.65'),
  ('appetizer_g', '80'),
  ('spec_change_date', '2026-09-14'),
  ('vat_rate', '20'),
  ('preload_days', '7'),
  ('post_days', '28'),
  ('baseline_days', '56'),
  ('abc_a', '80'),
  ('abc_b', '95'),
  ('green_max_growth', '30'),
  ('red_min_growth', '60'),
  ('promo_share_warn', '50'),
  ('digest_hour_kyiv', '9'),
  ('max_per_day', '6');

INSERT OR IGNORE INTO mkt_partners (name, ptype, cp_ids, cp_rule, note) VALUES
  ('MasterZoo', 'network', '["dc7c5ace-6ec7-11f0-0a80-117c000c6175"]', NULL, 'ТОВ «ПЕТМАЙСТЕР»'),
  ('Pethouse', 'network', '["d5feb1a9-fb23-11ef-0a80-13ce000522cd"]', NULL, 'ТОВ «УКРЗООГРУП»'),
  ('E-ZOO', 'network', '["6f188d36-f6aa-11f0-0a80-0b3300094444"]', NULL, 'ТОВ «Є-ЗОО»'),
  ('GoodWine', 'horeca', '["e5e2aaaf-34a7-11f0-0a80-1adf004c2449"]', NULL, 'ТОВ «БЮРО ВИН»'),
  ('Barpi.ua', 'own', '["692978bd-cc60-11ef-0a80-01a800502201"]', NULL, 'власний сайт'),
  ('Дрібний опт і локальні мережі', 'wholesale', NULL, 'fop', 'усі ФОП, крім окремо закріплених партнерів'),
  ('Darwin', 'shop', '["045731ae-2906-11f1-0a80-1d3c000d2c72"]', NULL, NULL),
  ('ZooProfi', 'shop', '["a30be7c7-c3af-11f0-0a80-027c00347284"]', NULL, 'Львів'),
  ('QuatroPets', 'shop', '["6d5b51a9-1175-11f1-0a80-13ad003f7c9e"]', NULL, NULL),
  ('ЗооСвіт', 'distributor', '["9164388f-be3c-11ef-0a80-0574000071cb","ae790683-c165-11f1-0a80-1132000de572"]', NULL, NULL),
  ('Лапа', 'network', '["7d78422d-a356-11f0-0a80-03c30007f0cf"]', NULL, NULL),
  ('13Cats', 'shop', '["46566861-2e65-11f1-0a80-0f5500069362"]', NULL, NULL),
  ('Miska', 'network', '["acca7a05-1938-11f1-0a80-1a860008365d"]', NULL, NULL),
  ('ZooResort', 'grooming', '["dfe08915-3555-11f0-0a80-1702000919d5"]', NULL, NULL),
  ('ZooProStore', 'shop', '["36dffd01-1bb4-11f1-0a80-1cac002e5e7f"]', NULL, NULL),
  ('СТ-ВЕТ', 'distributor', '["be276e66-f5c4-11ef-0a80-0319001f2da6"]', NULL, NULL),
  ('Суперпетс', 'distributor', '["556d29ae-2925-11f1-0a80-0d860012b0aa"]', NULL, NULL),
  ('Ветсінтез', 'distributor', NULL, NULL, 'контрагент у МойСклад не знайдено — закріпити вручну'),
  ('PedroPet', 'shop', NULL, NULL, 'контрагент у МойСклад не знайдено — закріпити вручну'),
  ('Фестивалі та події', 'event', NULL, NULL, 'офлайн-події; продажів у МойСклад немає'),
  ('Інші партнери', 'other', NULL, NULL, NULL);
