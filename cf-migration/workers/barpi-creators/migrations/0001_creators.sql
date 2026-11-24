-- barpi-creators 0001 · заявки блогерів і UGC-авторів (influencer-director, рішення Вадима 24.11.2026).
-- Окремо від B2B-лідів (/staty-partnerom/) і від найму (hr_*). D1 barpi-bible: платимо лише Rows Written,
-- тому журнал змін живе в одному рядку (history JSON), а не в окремій таблиці.
CREATE TABLE IF NOT EXISTS creators_applications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL DEFAULT 'application',   -- application | ambassador (внесено вручну з брендбуку)
  created_at    INTEGER NOT NULL,                      -- unix seconds
  updated_at    INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'new',
  first_reply_at INTEGER,                              -- перший вихід зі статусу new (SLA 24 год)
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  telegram      TEXT,
  city          TEXT,
  profile_url   TEXT,
  platform      TEXT,
  audience      TEXT,                                  -- lt1k | 1-5k | 5-20k | 20-100k | 100k+ | ugc
  role          TEXT,                                  -- owner | petfluencer | cynologist | groomer | vet | shop | shelter | ugc
  pets          TEXT,                                  -- dog | cat | both | other
  formats       TEXT,                                  -- через кому
  sample_url    TEXT,
  idea          TEXT,
  age_ok        INTEGER NOT NULL DEFAULT 0,
  consent       INTEGER NOT NULL DEFAULT 0,
  utm_source    TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT,
  referrer      TEXT,
  landing       TEXT,
  score         INTEGER,
  score_why     TEXT,
  flags         TEXT,
  owner         TEXT,                                  -- хто веде (email з Access)
  offer         TEXT,                                  -- що пропонуємо: набір / продукт / гонорар
  promo_code    TEXT,
  fee_uah       REAL,
  ship_cost_uah REAL,
  ship_doc      TEXT,                                  -- номер документа МойСклад
  ship_ttn      TEXT,
  shipped_at    INTEGER,
  content_url   TEXT,
  content_at    INTEGER,
  notes         TEXT,
  history       TEXT,                                  -- JSON [{at,by,what}]
  ip_hash       TEXT
);
CREATE INDEX IF NOT EXISTS idx_creators_status ON creators_applications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_creators_code ON creators_applications(promo_code);
CREATE TABLE IF NOT EXISTS creators_digest_sent (day TEXT PRIMARY KEY, at INTEGER NOT NULL);
