# ✅ Cutover Checklist — Supabase → Cloudflare D1

**Дата старту:** 02.06.2026
**Status:** ⏳ Code ready, чекає на твої кроки

---

## Що зроблено автоматично (✅)

- [x] D1 schema applied у `barpi-bible` (24 tables + 11 views)
- [x] Worker `barpi-sync` code committed (`cf-migration/workers/barpi-sync/`)
- [x] Worker `barpi-api` code committed (`cf-migration/workers/barpi-api/`)
- [x] `bb-v4-preview.js` skeleton ready
- [x] Документація: MIGRATION_PLAN.md, README.md, GOOGLE_OAUTH_SETUP.md

## Що треба зробити тобі (5 кроків, ~30 хв)

### ☐ Крок 1: Deploy 2 Workers (10 хв)

Локально у терміналі:

```bash
# Auth wrangler один раз
npm install -g wrangler
wrangler login   # браузер → залогінся як vg@abrisart.com
wrangler whoami  # перевір що показує vg@abrisart.com

# Clone repo якщо ще не клонував
git clone https://github.com/dreamcarua/barpi-brand-book.git
cd barpi-brand-book

# Deploy sync worker
cd cf-migration/workers/barpi-sync
wrangler secret put MOYSKLAD_TOKEN    # встав MS token (знайдеш у Supabase secrets)
wrangler secret put SYNC_API_KEY      # будь-який random string, напр.:
                                       # openssl rand -hex 32
wrangler deploy

# → запам'ятай URL який покаже: https://barpi-sync.<щось>.workers.dev

# Deploy API worker
cd ../barpi-api
wrangler deploy

# → запам'ятай URL: https://barpi-api.<щось>.workers.dev
```

### ☐ Крок 2: Запусти перший sync вручну (15 хв)

```bash
# Замінити <SYNC_KEY> на те що ставив у Крок 1
curl -X POST "https://barpi-sync.<твій>.workers.dev/sync?key=<SYNC_KEY>"

# Зачекай 5-15 хв (24 endpoints, тисячі рядків)
# Слідкуй за прогресом:
wrangler tail barpi-sync
```

Перевір що дані з'явились:

```bash
wrangler d1 execute barpi-bible --command "SELECT entity, last_synced_at, rows_synced FROM sync_state"
wrangler d1 execute barpi-bible --command "SELECT COUNT(*) FROM moysklad_demand"
wrangler d1 execute barpi-bible --command "SELECT COUNT(*) FROM sales_sku"
```

Очікувано: тисячі рядків demand, sales, payments. Якщо порожньо — глянь логи: `wrangler tail barpi-sync`.

### ☐ Крок 3: Перенести `brand_ideas` (5 хв)

У Supabase Dashboard → SQL Editor:

```sql
-- Експорт ideas як INSERT statements
SELECT 'INSERT INTO brand_ideas (id,title,body,author_name,author_email,section_id,status,upvotes,created_at) VALUES (' ||
  quote_literal(id::text) || ',' ||
  quote_literal(title) || ',' ||
  quote_literal(COALESCE(body, '')) || ',' ||
  quote_nullable(author_name) || ',' ||
  quote_nullable(author_email) || ',' ||
  quote_nullable(section_id) || ',' ||
  quote_literal(status) || ',' ||
  upvotes || ',' ||
  quote_literal(created_at::text) || ');'
FROM brand_ideas;
```

Скопіюй результат → запусти у D1:

```bash
wrangler d1 execute barpi-bible --command "<вставив сюди>"
```

(Якщо `brand_ideas` поки порожня — пропусти крок.)

### ☐ Крок 4: Налаштуй Cloudflare Access (10 хв)

Детальна інструкція у `cf-migration/README.md` → Phase 4.

Коротко:
1. CF Dashboard → Zero Trust → Sign up Free (50 users)
2. Settings → Authentication → Add Google IdP (тот же OAuth client що для Supabase)
   - У Google Cloud → додай `https://barpi.cloudflareaccess.com/cdn-cgi/access/callback` у Authorized redirect URIs
3. Access → Applications → Add Self-hosted:
   - Domain: `brand.barpi.ua`
   - Path: `/dashboard`
   - Session: 7 days
   - Policy: Allow → Emails → 6 allowlisted emails

Тест: incognito → https://brand.barpi.ua/dashboard/ → має показатись CF Access login.

### ☐ Крок 5: Cutover bb.js (5 хв)

Один з двох варіантів:

**Швидкий (вручну):**
1. Відкрий `cf-migration/bb-v4-preview.js`
2. Заміни `https://barpi-api.YOUR-SUBDOMAIN.workers.dev` на справжній URL з Кроку 1
3. Скопіюй блоки з v3.3 куди вказано (sidebar, mobile menu, etc.)
4. Замінитити `assets/bb.js` → commit → push

**Скажи мені** — я зроблю це автоматично коли скажеш «деплой v4».

---

## 🧪 Verification Tests (після всіх 5 кроків)

```bash
# 1. API живий
curl https://barpi-api.<твій>.workers.dev/healthz
# → {"status":"ok","d1":"barpi-bible","demand_rows":N}

# 2. Дашбордні view працюють
curl "https://barpi-api.<твій>.workers.dev/v_pnl_monthly?limit=12"
curl "https://barpi-api.<твій>.workers.dev/v_customer_metrics?limit=10"
curl "https://barpi-api.<твій>.workers.dev/v_sales_by_day?order=day.desc&limit=30"

# 3. Brand Bible: відкрий https://brand.barpi.ua/dashboard/customer-360/
# → CF Access login → after auth → дашборд показує реальні дані з D1

# 4. Cron sync працює
# Зачекай 1 годину → перевір що last_synced_at оновився:
wrangler d1 execute barpi-bible --command "SELECT entity, last_synced_at FROM sync_state ORDER BY last_synced_at DESC LIMIT 5"
```

---

## 🧹 Phase 6: Supabase cleanup (через 7 днів)

Залишити Supabase як safety net на тиждень. Через 7 днів:

```sql
-- У Supabase SQL Editor
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE 'moysklad%';
```

Settings → Edge Functions → `moysklad-sync` → Delete

Settings → General → **Pause project**

Через 30 днів → Delete project (rollback вже неможливий).

---

## 🚨 Rollback план

Якщо щось зламається на Кроці 5 (cutover bb.js):

```bash
cd barpi-brand-book
git revert HEAD   # повертає v3.3 з Supabase
git push          # auto-deploy GH Pages
```

Supabase досі живий (Кроки 1-5 його не чіпали), тому все буде працювати як раніше.

---

## 💬 Питання?

Якщо застряг на якомусь кроці — кидай скрін або текст помилки. Більшість проблем — wrong account у wrangler або відсутні secrets.

---

*Це фінальна стадія міграції — після Кроку 5 Supabase можна виключати.*
