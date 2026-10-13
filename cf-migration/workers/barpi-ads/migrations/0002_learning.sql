-- ad-director learning loop for Barpi (system/README.md -> The learning loop). 13.10.2026.
-- Days are Europe/Kyiv calendar days (YYYY-MM-DD). Money: UAH.

-- per ad per Kyiv day, mirrored from Meta by the scheduled task «Barpi ads mirror»
CREATE TABLE IF NOT EXISTS ad_daily (
  day TEXT NOT NULL, ad_id TEXT NOT NULL,
  ad_name TEXT, adset_id TEXT, adset_name TEXT, campaign_id TEXT, campaign_name TEXT,
  spend REAL DEFAULT 0, impressions INTEGER DEFAULT 0, link_clicks INTEGER DEFAULT 0,
  purchases REAL DEFAULT 0, purchase_value REAL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (day, ad_id)
);
CREATE INDEX IF NOT EXISTS ad_daily_adset ON ad_daily(adset_id, day);

-- features of every ad (step 2 of the loop)
CREATE TABLE IF NOT EXISTS ad_features (
  ad_id TEXT PRIMARY KEY, ad_name TEXT, layer TEXT,
  source TEXT,          -- ugc_video | ugc_photo | product_photo | organic_post | organic_reel | creative_director | catalog
  format TEXT,          -- video_9x16 | video_4x5 | image | carousel | catalog
  angle TEXT, hook TEXT, offer_kind TEXT, price_shown REAL, product TEXT,
  animal TEXT, people INTEGER, text_density TEXT, sound INTEGER, landing TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), tagged_by TEXT
);

-- learnings (step 5)
CREATE TABLE IF NOT EXISTS ad_learnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT NOT NULL DEFAULT 'barpi',
  status TEXT NOT NULL DEFAULT 'candidate',   -- candidate | confirmed | refuted | retired
  statement TEXT NOT NULL, scope TEXT, evidence TEXT,   -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT, confirmed_at TEXT, refuted_at TEXT
);

-- snapshot before an ad is deleted
CREATE TABLE IF NOT EXISTS ad_archive (
  ad_id TEXT PRIMARY KEY, archived_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  snapshot TEXT NOT NULL   -- JSON: creative text, title, media, link, CTA, lifetime platform figures, real orders by UTM
);

-- Kyiv day of an order, set by worker barpi-ads
ALTER TABLE ad_orders ADD COLUMN day_kyiv TEXT;

-- facts: platform figures + real orders matched by utm_content = «adset name_ad name» + day type
CREATE VIEW IF NOT EXISTS ad_daily_real AS
SELECT d.*, COALESCE(o.n, 0) AS real_orders, COALESCE(o.rev, 0) AS real_revenue,
  CASE WHEN EXISTS (SELECT 1 FROM ad_events e WHERE e.project='barpi' AND e.status <> 'cancelled'
                    AND e.starts_at < d.day || 'T21:00:00Z' AND e.ends_at > date(d.day, '-1 day') || 'T21:00:00Z')
       THEN 'promo' ELSE 'normal' END AS day_type
FROM ad_daily d
LEFT JOIN (SELECT day_kyiv, utm_content, count(*) AS n, sum(value) AS rev FROM ad_orders
           WHERE paid_status <> 'cancelled' AND (substr(utm_medium,1,9)='facebook_' OR substr(utm_medium,1,10)='instagram_'
             OR substr(utm_medium,1,10)='messenger_' OR substr(utm_medium,1,17)='audience_network_' OR substr(utm_medium,1,8)='threads_')
           GROUP BY day_kyiv, utm_content) o
  ON o.day_kyiv = d.day AND o.utm_content = d.adset_name || '_' || d.ad_name;
