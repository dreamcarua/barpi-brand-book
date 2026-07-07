# Barpi Brand Bible — Changelog

## v7.1 (07.07.2026) — 📖 Book UX: наскрізна нумерація, prev/next, архітектура бренду

### 📖 Структура книги
- **Наскрізна нумерація розділів 01–25** за порядком sidebar-навігації. Було: дублікати (06×3, 08×2, 11×3, 15×3), «6» без нуля на /fonts/, /ideas/ без номера. Слот 23 зарезервовано за гейтованим /dashboard/ (не чіпався).
- **Prev/next навігація розділів** (bb.js v4.4: `BB.PAGE_ORDER` + `BB.injectPageNav`; bb.css v2.6: `.page-nav`). Інжектиться перед футером на всіх 24 публічних сторінках; /dashboard/ і 404 пропускаються. Повністю двомовна, hover/focus-стани.
- **Єдиний футер** на всіх сторінках: `© ТОВ «ПЕТ КОРП» / Pet Corp LLC · /page/ vX.X · DD.MM.YYYY` (було 4 формати, 6 сторінок без EN-версії).

### 📄 Контент
- **/architecture/ v3.0** — перебудовано зі стабу (27→69 двомовних пар): модель Branded House, портфель 17 SKU у 4 лінійках, правила написання Barpi/barpi/Барпі/SNECO/snEco/ТОВ «ПЕТ КОРП», SNECO у B2C vs B2B, co-branding, конкурентне поле.
- **/team/ v2.2** — додано бренд-говернанс: матриця «хто затверджує що» за наявними ролями + правило за замовчуванням «не описано у Bible → узгодь до публікації».

### 🔎 SEO / точність
- **og:image маніфесту**: og.svg → assets/og-image.png 1200×630 (FB/LinkedIn/Twitter не рендерять SVG у прев'ю) в OG, Twitter Card і JSON-LD.
- **Точність claim'ів на маніфесті**: «до 99%» вологи, «до 95%» поживних, «до 12 міс» — як у /tech/ (було абсолютні значення).
- **Пошук**: збагачено індекс /architecture/ і /team/ під новий контент.

## v7.0 (07.07.2026) — 🎨 Brand consistency, content & polish sweep

### 🎯 Brand canon (аудит #1)
- **Accent color:** прибрано чужий жовтий DreamCar `#FEBF27` з усього UI (bb.css `--accent`, bb.js, topnav.js, favicon, + CSS-fallback на 4 сторінках) → Barpi soft blue `#BAD9F4`. 0 залишків у публічних сторінках.
- **Messaging:** «космічні технології» як головний описувач → «запатентована технологія SNECO 34–38°C» (index og/twitter/manifesto, about, tech). «Мікрохвильова сушка» у B2C → «низькотемпературне вакуумне сушіння» (tech meta, labels). Космічна тема зведена до «лише точково».
- **Typography canon:** узгоджено двошрифтову систему — Rubik (цифровий) + Qanelas Soft (display) на /fonts/ і /visual/. Palette Doc 03 + CLAUDE.md синхронізовано з Guideline 2026.1.
- **Facts:** Пилип/Hryshyn (не Філіп/Gryshyn), 3→4 messaging pillars, специмен «100% М'ЯСО» → «ОДИН ІНГРЕДІЄНТ».
- **/voice/** повністю перебудовано: стаб (16 блоків) → повний ToV (129 двомовних блоків): характер, словник, формула поста, фрази, канали, хуки, CTA, do/don't.

### 📄 Content completeness
- **/photo/** — стаб → повний розділ (Doc 05+06): 8 типів фото, світло/фон, композиція, тех-вимоги, відео-хуки, 10 сюжетів, чек-листи.
- **/digital/** — стаб → повний (Doc 08+09): частота, 12 рубрик, тижневий план, сезонність 2026, шаблони підписів, хештеги, чек-лист.
- **/logo/** — порожня папка → повна сторінка + реальні майстер-файли (витягнуто з bb.js base64): dark/white PNG + WebP, охоронне поле, мін. розмір, заборони. Заведено у nav + search + sitemap.

### 🔎 SEO / icons / a11y
- **Favicon set:** повний набір у бренд-кольорах (multi-size .ico + apple-touch + icon-192/512 + site.webmanifest). Уніфіковано icon-блок на 25 сторінках, виправлено 10 крос-доменних посилань `barpi.com.ua/favicon.ico` → локальні (P3-3).
- **a11y:** контраст `--text-muted` 4.19→6.09, `--text-dim` 2.50→4.57 (WCAG AA). Візуальні Do/Don't антиприклади на /visual/.
- **JSON-LD:** реальний logo PNG + foundingDate. **og-image.png** відрендерено (22 биті посилання закрито).
- **CI:** активовано `ci.yml` (gitleaks + htmlhint + lychee + worker syntax); deploy-workflows готові (чекають CF secrets).

## v6.0 (10.06.2026) — 🛡 Autonomous hardening sweep

### 🔴 P0 Security incidents (виявлено + закрито)

- 🚨 **C3 — SQL injection через `select` parameter у barpi-api Worker**
  - Vector: `GET /v_dashboard_kpis?select=(SELECT GROUP_CONCAT(name) FROM sqlite_master)` exposed full schema
  - Discoverer: внутрішній security audit (Phase 1)
  - **Fix:** додано `SAFE_IDENT` regex `[a-zA-Z_][a-zA-Z0-9_]*`, validateSelect/validateOrder/validateColumnKey функції; 400 для invalid input, 500 errors no longer leak SQL strings
  - Defense-in-depth: graceful catch блокує leak навіть якщо validator пропустить
- 🚨 **C4 — Admin endpoints доступні з Origin (без API key)**
  - `/export`, `/backups`, `/alerts/run`, `/tables` приймали будь-який валідний Origin
  - **Fix:** додано ADMIN_PATHS set + isAdminPath() → require valid X-API-Key (CF JWT та Origin не достатньо)
- 🚨 **C5 — Internal tables accessible через generic dispatcher**
  - `/sqlite_master`, `/_backups`, `/_cf_KV` могли витягуватися
  - **Fix:** BLACKLIST + SQL filter `substr(name,1,1) != '_'`

### 🟢 Нові analytics views

| View | Призначення |
|---|---|
| `v_sku_profitability` | revenue × cost per SKU → gross margin (5.15M rev, 452K COGS, 4.7M GP) |
| `v_sku_cost` | weighted avg cost per produced SKU (з processing acts JSON1) |
| `v_customer_first_purchase` | cohort_month, days_since_last, lifetime_revenue per customer |
| `v_customer_cohorts` | retention matrix (M0..M12 active customers) |
| `v_customer_ltv` | per-cohort LTV summary з retention_pct |
| `v_counterparty_channel` | counterparty → channel mapping (B2B Network, Retail FOP, Marketplace, etc.) |
| `v_sales_by_channel` | revenue/customers per channel |
| `v_forecast` | run-rate проекція поточного місяця vs avg(last 3 months) |
| `v_data_quality_issues` | моніторинг known data quality gaps (orphans, etc.) |

### 🆕 alerts system

- `alerts` table + 5 rule generators: `margin_negative`, `margin_low`, `low_stock`, `sync_error`, `churn_risk`
- 17 active alerts згенеровано:
  - 🔴 D-0009 Сердце Кур. Сушене — margin -149.4% (loss-maker)
  - 🔴 D-0012 Вуха Кролячі Сушені — margin -88.2% (loss-maker)
  - 🔴 B-0015, B-0009 — low stock (<20 шт)
  - 🟡 8 churn risk customers (60-90 days since last)
- Endpoints: `GET /alerts`, `PATCH /alerts/:id` (resolve), `POST /alerts/run` (manual regen)
- Wired у `scheduled()` cron — auto-refresh щотижня

### 🚀 Performance optimization

- 10 нових D1 indexes (25 → 37 total): `idx_payments_agent`, `idx_pmtout_agent`, `idx_sales_sku`, `idx_sales_sku_moment` (compound), `idx_demand_agent_moment` (compound), `idx_supplies_agent`, `idx_counter_name`, `idx_pacts_plan_moment`, `idx_losses_moment`, `idx_corders_agent`
- `ANALYZE` для оновлення planner stats
- Heavy queries elim TEMP B-TREE (Customer 360 sort, Sales drill-down)
- Median endpoint timing <300ms на всіх 12 hot endpoints
- 20-parallel: p50 663ms, p95 1.55s

### 🧹 Cleanup

- D1 raw_json prune (>180 days for derived tables, >365 days for demand): 368.6 → 335.5 MB (-33 MB)
- Pruned: payments 613 rows, payments_out 534, supplies 108, customer_orders 787, purchase_orders 103, returns 11, losses 32, demand 277

### 📋 Documentation

- `cf-access-policy.json` exported (audit trail для 5-email allowlist)
- RUNBOOK.md updated з R2 backup + correct allowlist (раніше docs мали wrong emails)
- audit-log-2026-06-10.md (full technical log)

### 📊 Real-time stats (станом на 10.06.2026)

| | |
|---|---|
| Demand orders | 1 997 |
| Unique customers | 159 |
| Lifetime revenue | 5 322 886 ₴ |
| **Lifetime COGS (real)** | **452 170 ₴** |
| **Lifetime gross profit** | **4 698 947 ₴ (~88% margin)** |
| Active SKUs | 96 |
| Loss-makers | 2 SKU (D-0009, D-0012) |
| D1 size | 337 MB |
| Cost | $0/month |

### ⚠ Залишається

- Test commits 99315bcb, ef5c04d5 у git history (benign — content overwritten by subsequent commits, no real damage)
- `processing_acts.materials_sum_uah` ~15K ₴ stale vs live view computed (cache update needs D1 CPU budget > 30s — defer)

---

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

### Cost vs v3.x
- Supabase Pro $25/міс → $0 (paused)
- CF D1, Workers, Access — все на Free tier
- **Економія: ~$25/міс**

---

## v4.0 (02.06.2026) — 🔐 CF Access edge auth

- 🆕 **Cloudflare Access (Zero Trust)** активний на `brand.barpi.ua/dashboard/*` — team domain `uabarpi.cloudflareaccess.com`, 5-email allowlist, **30-day session**.
- 🆕 `bb.js v4.0` — викинуто `BB.AUTH` (frontend gate, Magic Link, Google OAuth) — заміна на CF Access edge auth.

---

## v3.4 (02.06.2026) — D1 cutover

- 🆕 `bb.js v3.4`: `BB.api` → Cloudflare D1 (`barpi-api` Worker) замість Supabase REST.

---

## v0.1.0 (27.05.2026) — Bootstrap
- Створено repo `dreamcarua/barpi-brand-book`
- CLAUDE.md, BACKLOG, CHANGELOG, CNAME, кістяк index.html
- Прототип: dreamcarua/sneco-brand-book v2.26
