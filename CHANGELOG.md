# Barpi Brand Bible — Changelog

## v5.0 (07.06.2026) — 🛡 Handover hardening

### 🔴 P0 Security incidents (виявлено + закрито за день)

- 🚨 **C1 — barpi-api Worker був повністю public** (~5h leak window). Будь-хто з прямим URL міг fetch-нути:
  - 308 counterparty records (phone, email, name)
  - 1983 demand records з sums
  - 1133 paymentin / 905 paymentout
  - всі 30 D1 таблиць/views
  - **Fix:** додано `checkAuth()` функцію + `STRICT_ORIGIN=1` binding. Worker тепер вимагає або (a) Origin у allowlist [brand.barpi.ua, pages.dev], (b) `Cf-Access-Jwt-Assertion` header (для майбутнього zone routing), або (c) `X-API-Key` matching `API_AUTH_KEY` secret. `/healthz` залишився public.
- 🚨 **C2 — `SYNC_API_KEY` (64-char production secret) hardcoded** у `dashboard/sales-performance/index.html` сирцях.
  - **Fix:** ключ rotated на barpi-sync Worker (old → 403). Видалено з HTML (commit `7c226cca`), sync button тепер показує toast "auto cron щогодини".
  - ⚠ Git history досі містить старий ключ — потребує `bfg-repo-cleaner` для history rewrite, якщо є concern.

### 🟢 Triple-pass handover QA — 3 паралельні agent'и

Кожен агент аудитував з різного кута: Engineer (код + D1 + API contract + injection vectors), UX (a11y + mobile + bilingual + brand consistency), Handover (docs + ops + DR + cross-system consistency). Підсумок:
- Backend: 9.5/10 — KPIs reconcile до raw, 0 errors, sub-500ms perf
- Frontend UX: 8/10 — bilingual 100%, 2 stub pages thin
- Docs: 9/10 (після rewrite README/RUNBOOK)
- Net handover-readiness: **8.7/10**

### 📝 Documentation rewrite

- 🆕 `README.md` повністю переписано: architecture diagram, що де лежить, secrets list, швидкий старт для inженера + не-інженера. (Старий README описував Supabase + Telegram bot — обсолетне з v4.0.)
- 🆕 `RUNBOOK.md` — 9 операційних процедур: deploy worker fix, add CF Access user, investigate sync failure, D1 backup/restore, rotate CF API token, add MS-synced column, onboard non-eng editor, customer data discrepancy, GDPR deletion.
- 🆕 `SECURITY.md` — secrets inventory (4 secrets з expiry tracking), rotation guide для кожного, auth flow, compliance, leak response.
- 🟡 `.github/workflows/d1-backup.yml` готовий у outputs/ — потребує manual upload (GitHub PAT MCP token не має workflow scope). Weekly `wrangler d1 export` → artifact 90-day retention.

### 🐛 UX / a11y fixes

- 🆕 `/ideas/` — drop obsolete "stored in Supabase" wording → "stored in our database". Додано `aria-label` на 4 form inputs + select (WCAG 1.3.1).
- 🆕 `/about/` — narrative "BARPI" → "Barpi" (відповідає wordmark guidelines, що лише logo має lowercase wordmark).
- 🆕 `favicon.svg` 256-byte (raises Pages 404 → 200). Navy `#001154` square + жовте `B`. Не залежить від `barpi.com.ua/favicon.ico` (broken upstream).

### 🧹 Backend cleanup

- 🗑 Removed `_ProcActsOld` dead function з `barpi-sync.js` (стара версія syncProcessingActs з v3.x, замінено в v4.1).
- 🗑 Removed `payroll` entity з sync_state (MS не має `/entity/employee/payroll` endpoint — це був silent dead branch з v3.x). Зарплати tracking — через `paymentout` з expense item.
- ✅ 18 sync entities тепер активні (було 19 з мертвим payroll).
- ✅ Cron continues hourly @ `0 * * * *`, 0 errors.

### 📊 Real-time stats (станом на 07.06.2026 09:30 UTC)

| | |
|---|---|
| Demand orders | 1 983 |
| Unique customers | 156 |
| Lifetime revenue | 5 288 981 ₴ |
| Lifetime paid | 5 889 629 ₴ |
| Active SKUs (з продажами) | 96 |
| Processing acts | 1 862 |
| Loss events | 47 (320 070 ₴ lifetime) |
| D1 size | 352 MB / 5 GB free |
| Workers used | 10k/100k free per day |
| **Cost** | **$0/month** |

### ⚠ Що залишилось на User-action

1. **CF API token expires 10.06.2026** (через 3 дні) — створи новий: dash.cloudflare.com → My Profile → API Tokens (permissions: Workers Scripts Edit, D1 Edit, Account Settings Read).
2. **D1 backup workflow** — drop `/outputs/d1-backup.yml` у `.github/workflows/` через GitHub UI. Додай secrets `CF_API_TOKEN` + `CF_ACCOUNT_ID`.
3. **`processing_acts.materials_sum_uah` = 0** (всі 1862 акти). MS API positions не містять `price`. Потрібен more complex fix: sync supply positions (`expand=positions.assortment` на supplies) → derive avg buy_price per product → JOIN у v_production_efficiency. ~3 hours estimated.
4. **Git history містить leaked SYNC_API_KEY** у комітах до `7c226cca`. Розглянь `bfg --replace-text` якщо потрібно sanitize.

---

## v4.1 (02.06.2026) — 🧹 Audit cleanup

### Що зроблено за один день автономно
- 🚨 **P0-1:** 5 дашбордів зчитували з Supabase **paused** (HTTP 000) — мігровані на `barpi-api` Worker (D1):
  - `inventory/`, `financial/`, `production/`, `sales-performance/`, `customer-360/` (lean rewrite з 75K → 14K).
- 🐛 **P0-2:** `PATCH /brand_ideas/:id` повертав 200 для non-existing id → fix 404
- 🐛 **P0-3:** filter `?col=eq.TEXT` не працював на текстових колонках (custom listIdeas hand-parsed status) — replaced з generic `readResource()`
- 🐛 **P0-5:** `v_pnl_monthly.cogs=0` (processing_acts.materials_sum_uah порожні) → переписано на `SUM(supplies)` + додано real `collected` (paymentin) і `losses`. `v_sales_by_day.paid=0` → JOIN з paymentin by day.
- 🛡 **P1-4/5/6:** Worker `barpi-api` graceful handling: malformed JSON → 400, CHECK constraint → 400, missing view → 200 `[]` (auto-discover via sqlite_master), `?limit=abc` → default, `?offset=-1` → 0, cap limit at 50000.
- 🗑 **P1-3:** видалено stale файли: `auth-callback/`, `supabase/configure-auth.sh`, `AUTH_SETUP.md`, `GOOGLE_OAUTH_SETUP.md`, `dashboard/.gitkeep`, `dashboard/sales/index.html` (dup).
- 📝 **P1-7:** `dashboard/index.html` legend оновлено: Supabase + pg_cron → D1 + barpi-api + barpi-sync cron щогодини.
- 🧹 **P1-1:** `bb.js` v4.1 — викинуто `BB.SUPABASE_URL` + `BB.SUPABASE_ANON` (dead code).
- ✅ Auth-callback page видалено (CF Access edge handles auth).

### Архітектура (v4.1 final)
```
brand.barpi.ua (GitHub Pages, static HTML)
   ↓
Cloudflare Access (Zero Trust, 5-email allowlist, 30d session) → /dashboard/*
   ↓
bb.js v4.1 (BB.api → CF Worker)
   ↓
Worker barpi-api (REST proxy, PostgREST-compatible filters)
   ↓
Cloudflare D1 (barpi-bible: 17 tables + 11 views)
   ↑
Worker barpi-sync (cron 0 * * * *, hourly)
   ↑
МойСклад API (19 entities)
```

### Cost vs v3.x
- Supabase Pro $25/міс → $0 (paused)
- CF D1, Workers, Access — все на Free tier
- **Економія: ~$25/міс**

---

## v4.0 (02.06.2026) — 🔐 CF Access edge auth

- 🆕 **Cloudflare Access (Zero Trust)** активний на `brand.barpi.ua/dashboard/*` — team domain `uabarpi.cloudflareaccess.com`, 5-email allowlist, **30-day session**.
- 🆕 `bb.js v4.0` — викинуто `BB.AUTH` (frontend gate, Magic Link, Google OAuth) — заміна на CF Access edge auth.
- ✅ allowlist через API без UI: vg@abrisart.com, office@barpi.com.ua, aksonov@barpi.com.ua, vg@sneco.ua, fg@abrisart.com.

---

## v3.4 (02.06.2026) — D1 cutover

- 🆕 `bb.js v3.4`: `BB.api` → Cloudflare D1 (`barpi-api` Worker) замість Supabase REST.
- 🆕 Worker `barpi-api` deploy: REST API над D1 з PostgREST-compatible filters (eq, neq, gt, gte, lt, lte, like, ilike, is, in).
- 🆕 Worker `barpi-sync` deploy: cron `0 * * * *` (щогодини), 19 МС entities, демандні positions з `expand=positions.assortment`.
- ✅ D1 `barpi-bible` schema applied: 17 tables (moysklad_*, sales_sku, brand_ideas, sync_state) + 11 views (v_sales_by_day, v_sales_by_sku, v_customer_metrics, v_pnl_monthly, etc).
- ✅ MS 401 fixed: User-Agent header added → 1955 demand + 1121 payments + 1502 customer orders synced.
- ✅ brand_ideas migrated Supabase → D1 (3 rows).
- ✅ Supabase project `barpi-hq` paused → $0/міс.

### Bugs fixed на цьому етапі
- `materials_sum_uah` field nullable → cogs у views показував 0 (replaced з supplies aggregation у v4.1).
- `rebuildSalesSku` D1 memory limit → chunked SELECT 100 rows.
- demand cursor stuck → MAX(moment) bump для resume incremental.
- Worker CPU timeout (30 sec free) → `?only=entity1,entity2` для chunked invocation.

---

## v3.3 (28.05.2026) — Google OAuth backup

- 🆕 `bb.js v3.3`: Google OAuth додано як backup до Magic Link (`signInWithGoogle()` через Supabase Auth).
- 🆕 Auth gate UI: Google OAuth btn + OR + Magic Link form.

## v3.2 (27.05.2026) — Mobile menu text label

- 🆕 «Меню/Menu» label перед hamburger icon (mobile UX).

## v3.1 (27.05.2026) — Mobile menu polish

- 🆕 `BB.initMobileMenu()`: backdrop, ESC close, auto-close after link click, ARIA attributes.

## v3.0 (27.05.2026) — Products + Ambassadors

- 🆕 `/products/` — повний каталог 17 SKU + нутрієнтна таблиця.
- 🆕 `/ambassadors/` — UGC амбасадори (Барні, Кіара, Райден, тощо).
- 🆕 Sidebar updated.

## v2.9 (26.05.2026) — Downloads

- 🆕 `/downloads/` — Drive файли (презентація, прайс, каталог, сертифікати, ТМ/ТУ).

## v2.8 (26.05.2026) — BB.AUTH Magic Link gate

- 🆕 `bb.js v2.8`: BB.AUTH frontend gate з Supabase Magic Link OTP.
- 🆕 `/auth-callback/` page для Magic Link redirect.
- 🆕 6-email allowlist у двох файлах (bb.js + auth-callback).

## v2.5 (26.05.2026) — Production + Inventory dashboards

- 🆕 `/dashboard/production/` + `/dashboard/inventory/` (з Supabase).
- 🆕 `bb.js v2.5`: topnav з 8 дашбордами.

## v2.4 (25.05.2026) — Mobile audit pass

- 🆕 `bb.css v2.4`: typography, spacings, grids — повністю responsive.

---

## v1.1.0 (28.05.2026) — 🚀 Barpi HQ live!

🎉 **Запуск Barpi HQ — повноцінної SMM-платформи** на основі DreamCar HQ.

### Barpi HQ (`/dashboard/hq/`)
- ✅ **Supabase проект `barpi-hq`** створено (id `zrcqmwlpsggiqgipvxhv`, eu-central-1) [⚠ paused у v3.4]
- ✅ **Повна schema залита**: users, desks, desk_members, rubrics, launches, creatives, publications, publication_platforms/responsibles/approvers, creative_publications, publication_history, comments, publication_drafts, editing_sessions, notifications, notification_preferences, access_requests, user_vacations
- ✅ **Row-Level Security** policies для всіх таблиць (5 ролей: CEO/COO/lead/member/designer)
- ✅ **Seed:** 5 користувачів (Вадим, Пилип, Аксьонов, Альона, Мар'яна) + 6 рубрик Barpi + 4 запуски + 5 sample-публікацій
- ✅ **PWA**: manifest + service-worker (offline, push notifications)
- ✅ **Frontend**: SPA з jsDelivr CDN для всіх app-*.js модулів (60+ файлів автоматично через DreamCar HQ)
- ✅ **Brand-adapted**: DreamCar red → Barpi blue (#2F6FED), DreamCar → Barpi typography і копірайт

### Архітектура HQ (v1.1, переїде у v5)
- **Backend**: Supabase Postgres + Auth + Realtime + Storage [⚠ paused — потребує миграції на D1 або re-resume Supabase]
- **Frontend**: vanilla JS SPA, lazy-loaded Supabase SDK
- **Auth**: CF Access (Zero Trust) edge auth з v4.0
- **Бібліотека модулів**: підвантажується з `cdn.jsdelivr.net/gh/dreamcarua/dreamcar-team@main/hq/` → автоматично отримуємо всі патчі DreamCar HQ

---

## v1.0.0 (28.05.2026) — MVP

🎉 **Перший продакшн-реліз Brand Bible Barpi.**

### Brand Bible (index.html)
- ✅ 18 розділів повністю наповнено (Brand Book v7 + 16 SMM-docs + ЦА)
- ✅ Маніфест, платформа, команда, SNECO, ToV (70/30), візуал, документи

### Dashboards v1
- ✅ SMM Dashboard (`/dashboard/smm/`) — Content Log + Weekly + Monthly + Stories + Reels + Direct + UGC + Partners + Pillars
- 🚧 Sales / Inventory / Partner / Events — скелети
- ✅ Каталог дашбордів (`/dashboard/`)

### Backend (Cloudflare)
- ✅ D1 `barpi-bible` + KV `barpi-bible-acl`
- ✅ Schema + seed (24 SKU, 16 партнерів, 17 подій)
- ⏳ Worker `barpi-auth` — code готовий (видалено в v4.0 — CF Access замінив)

### Документи
- ✅ `documents/README.md` + `01_Brand_Book_v7.md`
- ⏳ 16 SMM-docs + Guideline + KB — markdown готові локально

---

## v0.1.1 (27.05.2026) — Domain change
- CNAME `brand.barpi.com.ua` → `brand.barpi.ua`

## v0.1.0 (27.05.2026) — Bootstrap
- Створено repo `dreamcarua/barpi-brand-book`
- CLAUDE.md, BACKLOG, CHANGELOG, CNAME, кістяк index.html
- Прототип: dreamcarua/sneco-brand-book v2.26
