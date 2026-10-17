-- Migration 0001 (17.10.2026): Barpi · HR · найм (вакансії, кандидати, Talent pool, файли, канали)
-- + кар'єра на barpi.com.ua/kariera/. Рішення Вадима 17.10.2026: «повтори повністю функціонал» snEco і Abris Art.
-- Це міграція Abris Art 0027_hr_hiring.sql (зведена snEco 20260820 + 20260902 + 20260924 + 20261013) один в один,
-- щоб у групи була одна схема. Співробітники і фонд оплати праці свідомо НЕ створюються (як в Abris, друга фаза).
--
-- Ідемпотентна: лише CREATE ... IF NOT EXISTS і INSERT OR IGNORE. Таблиці нові, у D1 barpi-bible hr_* не було
-- (перевірено 17.10.2026: sqlite_master без hr%), бекап не потрібен.
-- Apply: cd cf-migration/workers/barpi-hr && npx wrangler@4.97.0 d1 execute barpi-bible --remote --file=migrations/0001_hr_hiring.sql
--
-- Що НІКОЛИ не йде на сайт barpi.com.ua: notes, manager, manager_id, priority, source, внутрішні
-- requirements, headcount, created_by тощо. Публічний API бере поля лише з білого списку
-- (src/careers.js, publicVacancy).

-- ── Довідники (підрозділи, посади, канали, причини відмови) ──
CREATE TABLE IF NOT EXISTS hr_dict (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,              -- department|position|source|reject_reason|company
  value       TEXT NOT NULL,
  meta        TEXT,                       -- JSON
  sort_order  INTEGER DEFAULT 100,
  active      INTEGER DEFAULT 1,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_dict_uq ON hr_dict(kind, value);

-- ── Вакансії (внутрішня частина + публікація на сайті) ──
CREATE TABLE IF NOT EXISTS hr_vacancies (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  title               TEXT NOT NULL,
  title_norm          TEXT GENERATED ALWAYS AS (replace(replace(lower(title),'''',''),'"','')) VIRTUAL,
  company             TEXT,
  department          TEXT,
  manager             TEXT,                  -- керівник (ПІБ або email), на сайт не йде
  manager_id          INTEGER,               -- друга фаза: id у hr_employees
  headcount           INTEGER DEFAULT 1,
  priority            TEXT DEFAULT 'normal', -- low | normal | high | critical
  open_date           TEXT,                  -- YYYY-MM-DD
  target_date         TEXT,
  close_date          TEXT,
  status              TEXT NOT NULL DEFAULT 'open', -- open | on_hold | closed | cancelled
  source              TEXT,
  currency            TEXT DEFAULT 'UAH',
  salary_from_kop     INTEGER DEFAULT 0,     -- 🔒 лише з доступом hr-payroll
  salary_to_kop       INTEGER DEFAULT 0,     -- 🔒
  requirements        TEXT,                  -- внутрішні вимоги, на сайт не йдуть
  notes               TEXT,
  -- публікація на barpi.com.ua
  publish_site        INTEGER DEFAULT 0,     -- 1 = показувати на сайті
  slug                TEXT,                  -- ^[a-z0-9-]{3,80}$
  public_title        TEXT,                  -- порожньо = title
  region              TEXT,                  -- ua | eu
  city                TEXT,
  work_format         TEXT,                  -- office | plant | hybrid | remote
  employment_type     TEXT,                  -- full | part | contract | internship
  lang                TEXT DEFAULT 'uk',     -- мова тексту вакансії: uk | en
  summary             TEXT,
  responsibilities    TEXT,                  -- по пункту на рядок
  public_requirements TEXT,                  -- по пункту на рядок
  offer               TEXT,                  -- по пункту на рядок
  show_salary         INTEGER DEFAULT 0,     -- 🔒 змінює лише hr-payroll
  published_at        INTEGER,               -- unix, коли publish_site став 1
  valid_through       TEXT,                  -- YYYY-MM-DD, після неї знімається з сайту
  created_at          INTEGER DEFAULT (strftime('%s','now')),
  updated_at          INTEGER DEFAULT (strftime('%s','now')),
  created_by          TEXT,
  updated_by          TEXT
);
CREATE INDEX IF NOT EXISTS idx_hr_vac_status  ON hr_vacancies(status);
CREATE INDEX IF NOT EXISTS idx_hr_vac_dept    ON hr_vacancies(department);
CREATE INDEX IF NOT EXISTS idx_hr_vac_open    ON hr_vacancies(open_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_vac_slug ON hr_vacancies(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hr_vac_publish ON hr_vacancies(publish_site, status);

-- ── Кандидати (воронка) ──
-- stage: new → screening → hr_interview → mgr_interview → offer → offer_accepted → hired
--        гілки виходу: offer_declined | rejected
CREATE TABLE IF NOT EXISTS hr_candidates (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name           TEXT NOT NULL,
  full_name_norm      TEXT GENERATED ALWAYS AS (replace(replace(lower(full_name),'''',''),'"','')) VIRTUAL,
  vacancy_id          INTEGER REFERENCES hr_vacancies(id) ON DELETE SET NULL,
  position            TEXT,
  company             TEXT,
  department          TEXT,
  source              TEXT,
  stage               TEXT NOT NULL DEFAULT 'new',
  rating              INTEGER,
  email               TEXT,
  phone               TEXT,
  linkedin            TEXT,
  cv_url              TEXT,
  currency            TEXT DEFAULT 'UAH',
  expected_salary_kop INTEGER DEFAULT 0,     -- 🔒
  owner_email         TEXT,
  first_contact_date  TEXT,
  screening_date      TEXT,
  hr_interview_date   TEXT,
  mgr_interview_date  TEXT,
  offer_date          TEXT,                  -- офер прийнято → Time to Hire
  offer_sent_date     TEXT,
  start_date          TEXT,
  closed_date         TEXT,
  reject_reason       TEXT,
  stage_changed_at    INTEGER DEFAULT (strftime('%s','now')),
  notes               TEXT,
  consent_at          INTEGER,               -- unix, згода у формі на сайті
  created_at          INTEGER DEFAULT (strftime('%s','now')),
  updated_at          INTEGER DEFAULT (strftime('%s','now')),
  created_by          TEXT,
  updated_by          TEXT
);
CREATE INDEX IF NOT EXISTS idx_hr_cand_stage  ON hr_candidates(stage);
CREATE INDEX IF NOT EXISTS idx_hr_cand_vac    ON hr_candidates(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_hr_cand_source ON hr_candidates(source);
CREATE INDEX IF NOT EXISTS idx_hr_cand_first  ON hr_candidates(first_contact_date);
CREATE INDEX IF NOT EXISTS idx_hr_cand_norm   ON hr_candidates(full_name_norm);

-- ── Історія рухів кандидата по воронці ──
CREATE TABLE IF NOT EXISTS hr_candidate_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL REFERENCES hr_candidates(id) ON DELETE CASCADE,
  from_stage   TEXT,
  to_stage     TEXT NOT NULL,
  at           INTEGER DEFAULT (strftime('%s','now')),
  actor_email  TEXT,
  note         TEXT
);
CREATE INDEX IF NOT EXISTS idx_hr_cev_cand ON hr_candidate_events(candidate_id, at);

-- ── Витрати на канали пошуку (Cost per Hire) ──
CREATE TABLE IF NOT EXISTS hr_source_costs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source     TEXT NOT NULL,
  period     TEXT NOT NULL,                  -- YYYY-MM
  currency   TEXT DEFAULT 'UAH',
  cost_kop   INTEGER DEFAULT 0,
  note       TEXT,
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  updated_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_srccost_uq ON hr_source_costs(source, period);

-- ── Журнал змін ──
CREATE TABLE IF NOT EXISTS hr_audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity      TEXT NOT NULL,                 -- candidate|vacancy|talent|source_cost|dict
  entity_id   INTEGER,
  action      TEXT NOT NULL,                 -- create|update|delete|stage|import|file_delete
  diff        TEXT,                          -- JSON
  actor_email TEXT,
  at          INTEGER DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_hr_audit_at  ON hr_audit_log(at);
CREATE INDEX IF NOT EXISTS idx_hr_audit_ent ON hr_audit_log(entity, entity_id);

-- ── Файли кандидата (CV, тестові). Самі файли в R2 barpi-hr-files, префікс hr/cv/<candidate_id>/ ──
-- Прямого URL немає: /files/* віддає лише uploads/*, а hr/* віддає воркер після перевірки доступу hr.
CREATE TABLE IF NOT EXISTS hr_files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL REFERENCES hr_candidates(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  r2_key       TEXT NOT NULL UNIQUE,
  size_bytes   INTEGER,
  mime         TEXT,
  kind         TEXT DEFAULT 'cv',
  uploaded_by  TEXT,
  uploaded_at  INTEGER DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_hr_files_candidate ON hr_files(candidate_id);

-- ── Talent pool (резерв на майбутні вакансії) ──
CREATE TABLE IF NOT EXISTS hr_talent_pool (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name            TEXT NOT NULL,
  full_name_norm       TEXT GENERATED ALWAYS AS (replace(replace(lower(full_name),'''',''),'"','')) VIRTUAL,
  candidate_id         INTEGER REFERENCES hr_candidates(id) ON DELETE SET NULL,
  position             TEXT,
  department           TEXT,
  company              TEXT,
  skills               TEXT,
  reason               TEXT,                 -- finalist | declined_offer | no_vacancy | referral | sourced | former_employee | website | other
  temperature          TEXT DEFAULT 'warm',  -- hot | warm | cold
  status               TEXT DEFAULT 'active',-- active | engaged | archived
  rating               INTEGER,
  source               TEXT,
  email                TEXT,
  phone                TEXT,
  linkedin             TEXT,
  cv_url               TEXT,
  location             TEXT,
  currency             TEXT DEFAULT 'UAH',
  expected_salary_kop  INTEGER,              -- 🔒
  last_contact_date    TEXT,
  next_contact_date    TEXT,
  consent_until        TEXT,
  engaged_candidate_id INTEGER REFERENCES hr_candidates(id) ON DELETE SET NULL,
  owner_email          TEXT,
  notes                TEXT,
  consent_at           INTEGER,              -- unix, згода у формі на сайті
  created_at           INTEGER DEFAULT (strftime('%s','now')),
  updated_at           INTEGER DEFAULT (strftime('%s','now')),
  created_by           TEXT,
  updated_by           TEXT
);
CREATE INDEX IF NOT EXISTS idx_hr_tp_status ON hr_talent_pool(status);
CREATE INDEX IF NOT EXISTS idx_hr_tp_next   ON hr_talent_pool(next_contact_date);
CREATE INDEX IF NOT EXISTS idx_hr_tp_cand   ON hr_talent_pool(candidate_id);
CREATE INDEX IF NOT EXISTS idx_hr_tp_norm   ON hr_talent_pool(full_name_norm);

-- ── Файли записів Talent pool (резюме із загальної анкети на сайті). R2: hr/cv/tp-<id>/ ──
CREATE TABLE IF NOT EXISTS hr_talent_files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  talent_id    INTEGER NOT NULL REFERENCES hr_talent_pool(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  r2_key       TEXT NOT NULL UNIQUE,
  size_bytes   INTEGER,
  mime         TEXT,
  kind         TEXT DEFAULT 'cv',
  uploaded_by  TEXT,
  uploaded_at  INTEGER DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_hr_tfiles_talent ON hr_talent_files(talent_id);

-- ── Стартові значення довідників (загальні канали і причини відмови; підрозділи вносить HR) ──
-- 'Сайт' обовʼязковий: з ним приходять відгуки з barpi.com.ua. 'Talent pool': з ним повертаються люди з резерву.
INSERT OR IGNORE INTO hr_dict (kind, value, sort_order) VALUES
  ('source', 'Сайт', 5),
  ('source', 'Work.ua', 10),
  ('source', 'Robota.ua', 20),
  ('source', 'LinkedIn', 30),
  ('source', 'Рекомендація', 40),
  ('source', 'Talent pool', 50),
  ('reject_reason', 'Не відповідає вимогам', 10),
  ('reject_reason', 'Зарплатні очікування', 20),
  ('reject_reason', 'Не вийшов на звʼязок', 30),
  ('reject_reason', 'Обрав іншу пропозицію', 40),
  ('reject_reason', 'Інше', 90);


-- ── Barpi: підрозділи і компанія (17.10.2026) ──
INSERT OR IGNORE INTO hr_dict (kind, value, sort_order) VALUES
  ('company', 'Barpi', 10),
  ('department', 'Продажі', 10),
  ('department', 'Маркетинг', 20),
  ('department', 'Виробництво', 30),
  ('department', 'Логістика', 40),
  ('department', 'Офіс', 50),
  ('source', 'Instagram', 35),
  ('source', 'Telegram', 36);
