# 🚀 Supabase → Cloudflare D1 Migration Plan

**Початок:** 02.06.2026
**Owner:** vg@abrisart.com (target CF account)
**Target D1:** `barpi-bible` (UUID `45c93052-c82c-4d0c-90...`)

---

## Цілі

1. Перенести 24+ MoySklad таблиць + 10+ view-ів з Supabase Postgres у Cloudflare D1 (SQLite)
2. Переписати `moysklad-sync` Edge Function у Cloudflare Worker з Cron Trigger
3. Створити Worker REST API замість Supabase REST (для дашбордів)
4. Замінити Magic Link + Custom Google OAuth → **Cloudflare Access** (Zero Trust)
5. Очистити Supabase після успішного cutover

---

## Стек ДО і ПІСЛЯ

| Шар | Supabase (зараз) | Cloudflare (після) |
|---|---|---|
| Database | Postgres `zrcqmwlpsggiqgipvxhv.supabase.co` | D1 `barpi-bible` SQLite |
| ORM-views | PostgreSQL views | SQLite views + Worker computed |
| Sync job | Edge Function v9 + pg_cron | Worker `moysklad-sync` + Cron Trigger |
| REST API | PostgREST auto-gen | Worker `data-api` |
| Auth | Magic Link + Google OAuth | **Cloudflare Access** (Zero Trust) |
| Allowlist | у `bb.js` + `auth-callback/index.html` | у CF Access policy |
| Session | localStorage 7 days | CF Access cookie 7 days |
| Frontend | static + bb.js BB.AUTH gate | static + CF Access edge gate |

---

## Послідовність (cutover plan)

### Phase 1 — Підготовка (без зміни production)

- [x] Інвентар Supabase схеми (відомо: 24+ tables + 10+ views)
- [ ] D1 schema SQL (SQLite-compatible) → `cf-migration/d1-schema.sql`
- [ ] Worker `moysklad-sync` код → `cf-migration/workers/moysklad-sync/`
- [ ] Worker `data-api` код → `cf-migration/workers/data-api/`
- [ ] `wrangler.toml` файли
- [ ] Dump SQL script для Supabase → `cf-migration/dump-supabase.sql`

### Phase 2 — Розгортання нової інфраструктури (paralel до Supabase)

- [ ] Створити D1 schema у `barpi-bible` (`wrangler d1 execute`)
- [ ] Завантажити секрети Worker (MOYSKLAD_TOKEN, etc.)
- [ ] Deploy `moysklad-sync` Worker
- [ ] Запустити sync вручну — перевірити що дані з'являються у D1
- [ ] Deploy `data-api` Worker
- [ ] Test API endpoints (curl)

### Phase 3 — Auth → Cloudflare Access

- [ ] У CF Dashboard → Zero Trust → Settings → Authentication → додати Google as IdP
- [ ] Створити Access Application: `brand.barpi.ua/dashboard/*`
- [ ] Policy: Emails in {6 users} OR Email domain ends with @barpi.com.ua
- [ ] Session duration: 7 days
- [ ] Test: open dashboard у incognito → має показатись CF Access login

### Phase 4 — Frontend cleanup

- [ ] `bb.js` v4.0 — викинути `BB.AUTH` цілком (CF Access робить auth на edge)
- [ ] `bb.js` — оновити `BB.api()` на новий Worker URL
- [ ] Видалити `/auth-callback/` (не потрібен)
- [ ] Деплой нової `bb.js`
- [ ] Тест 8 дашбордів — кожен показує реальні дані

### Phase 5 — Cleanup Supabase

- [ ] Pause Supabase pg_cron job
- [ ] Видалити Edge Function `moysklad-sync` v9
- [ ] Залишити Supabase у read-only режимі на 7 днів (rollback safety net)
- [ ] Через 7 днів — pause/delete Supabase project

---

## Auth: Cloudflare Access як працює

```
[User] → brand.barpi.ua/dashboard/
   ↓ Cloudflare edge intercept
[CF Access]
   ↓ Has valid CF_Authorization cookie?
   ├─ YES → forward to GH Pages → render dashboard
   └─ NO  → show CF Access login page
            ↓ User selects Google (or email PIN)
            ↓ Redirect to Google OAuth
            ↓ Callback to CF
            ↓ Verify email in allowlist
            ↓ Set CF_Authorization cookie (7d)
            ↓ Redirect to original /dashboard/...
[Dashboard renders]
```

**Переваги перед Supabase Auth:**
- 0 коду на нашому боці (CF робить все)
- Edge-level: запит з фронтенду навіть не доходить до GH Pages без auth
- Built-in IdPs: Google, GitHub, OneTimePin, SAML, OIDC
- Безкоштовно до 50 users
- Audit logs у CF Dashboard

---

## Worker endpoints (data-api)

### Replacements for current Supabase REST calls:

| Supabase REST (зараз) | Worker endpoint (буде) |
|---|---|
| `/rest/v1/v_customer_metrics?...` | `GET https://barpi-api.workers.dev/v_customer_metrics?...` |
| `/rest/v1/v_pnl_monthly?...` | `GET https://barpi-api.workers.dev/v_pnl_monthly?...` |
| `/rest/v1/brand_ideas?...` | `GET https://barpi-api.workers.dev/brand_ideas?...` |
| POST `/rest/v1/brand_ideas` | `POST https://barpi-api.workers.dev/brand_ideas` |
| PATCH `/rest/v1/brand_ideas?id=eq.X` | `PATCH https://barpi-api.workers.dev/brand_ideas/{id}` |

Auth via CF Access JWT in `Cf-Access-Jwt-Assertion` header (auto-injected by Access).

---

## SQLite incompatibilities з PostgreSQL

Що треба переписати:

| PG | SQLite |
|---|---|
| `JSONB` | `TEXT` (`json_extract()` для query) |
| `UUID` | `TEXT` (генерувати у Worker) |
| `TIMESTAMPTZ` | `TEXT` ISO8601 або `INTEGER` unix-ms |
| `NUMERIC(14,2)` | `REAL` (з округленням) або `INTEGER` (cents) |
| `gen_random_uuid()` | `crypto.randomUUID()` у Worker |
| `now()` | `CURRENT_TIMESTAMP` або `unixepoch()` |
| `ON CONFLICT ... DO UPDATE` | Same — підтримується |
| Window functions | Same — підтримується |
| `WITH RECURSIVE` | Same — підтримується |

---

## Файли цієї міграції

```
cf-migration/
├── MIGRATION_PLAN.md         ← цей файл
├── d1-schema.sql             ← повна DDL для D1
├── dump-supabase.sql         ← SELECT для експорту
├── workers/
│   ├── moysklad-sync/
│   │   ├── wrangler.toml     ← config + cron + D1 binding
│   │   └── src/index.js      ← 24 endpoint sync
│   └── data-api/
│       ├── wrangler.toml     ← config + D1 binding
│       └── src/index.js      ← REST API
└── README.md                 ← як використовувати
```

---

## Rollback план

Якщо щось зламається після cutover:

1. Revert `bb.js` на v3.3 (магік-лінк + Google OAuth повертається)
2. Re-enable Supabase pg_cron
3. Supabase проект досі живий (7-day safety window)
4. Дашборди знов тягнуть з Supabase REST

---

## Очікувані затрати

- D1 free tier: 5GB storage, 25M reads/day, 50K writes/day — purpose-сluffit для нашого scale
- Workers free tier: 100K req/day — достатньо
- CF Access free: до 50 users
- **Очікувано: $0/місяць** (vs $0/місяць Supabase free, але з email rate limits)

---

*Документ оновлюється у міру прогресу.*
