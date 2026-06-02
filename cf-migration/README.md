# 🚀 CF Migration — Deploy Guide

**D1 database:** `barpi-bible` (UUID `45c93052-c82c-4d0c-901b-2999187643b9`) — schema applied ✅
**Account:** vg@abrisart.com (`ab63a85bdfbf5894c28efe7076acbd82`)

---

## ✅ Phase 1: COMPLETE — D1 schema applied

24 tables + 11 views + sync_state seeded (19 entities).

Verify:
```bash
wrangler d1 execute barpi-bible --command "SELECT type, name FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name"
```

---

## 🛠 Phase 2: Deploy 2 Workers

### Option A — Локально через wrangler (швидше)

```bash
# 1. Auth wrangler (один раз)
npm install -g wrangler
wrangler login   # відкриє браузер → залогінся як vg@abrisart.com

# 2. Set MoySklad token (один раз)
cd cf-migration/workers/barpi-sync
echo "<your-moysklad-token>" | wrangler secret put MOYSKLAD_TOKEN
echo "$(openssl rand -hex 32)" | wrangler secret put SYNC_API_KEY  # для manual trigger
wrangler deploy

# 3. Deploy data-api
cd ../barpi-api
wrangler deploy
```

### Option B — Через GitHub Action (auto-deploy on push)

1. CF Dashboard → My Profile → API Tokens → Create Token → **«Edit Cloudflare Workers»** template
2. У GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
   - `CLOUDFLARE_API_TOKEN` = (з кроку 1)
   - `CF_ACCOUNT_ID` = `ab63a85bdfbf5894c28efe7076acbd82`
   - `MOYSKLAD_TOKEN` = (твій MS token)
3. Push до main → workflow `.github/workflows/deploy-cf-workers.yml` сам задеплоїть

---

## 🔑 Phase 3: Тест — запусти sync вручну

```bash
# 1. Перевір статус worker
curl https://barpi-sync.<your-subdomain>.workers.dev/

# 2. Запусти повний sync вручну (заміни KEY на той що ти ставив)
curl -X POST "https://barpi-sync.<your-subdomain>.workers.dev/sync?key=<SYNC_API_KEY>"

# 3. Перевір що дані з'явились у D1
wrangler d1 execute barpi-bible --command "SELECT entity, last_synced_at, rows_synced FROM sync_state"
wrangler d1 execute barpi-bible --command "SELECT COUNT(*) FROM moysklad_demand"
```

**Перший sync може тривати 5-15 хв** (24 endpoint, тисячі рядків).

---

## 🔐 Phase 4: Cloudflare Access (Zero Trust) — налаштування

### Крок 1 — Увімкнути Zero Trust

1. CF Dashboard → Zero Trust → Settings → Account → **Sign up Free** plan (50 users)
2. Team name → `barpi`

### Крок 2 — Додати Google як Identity Provider

1. Zero Trust → Settings → Authentication → Login methods → **+ Add new**
2. Обери **Google**
3. Reuse Google OAuth client який ми вже створили для Supabase (або створи новий):
   - Client ID: (з Google Cloud Console)
   - Client Secret: (з Google Cloud Console)
4. **IMPORTANT** — у Google Cloud Console → Credentials → твій OAuth client → Authorized redirect URIs додай:
   ```
   https://barpi.cloudflareaccess.com/cdn-cgi/access/callback
   ```
5. Save

### Крок 3 — Створити Access Application

1. Zero Trust → Access → Applications → **+ Add an application** → **Self-hosted**
2. Налаштуй:
   - **Name:** `Barpi Dashboards`
   - **Session duration:** 7 days
   - **Application domain:** `brand.barpi.ua`
   - **Path:** `/dashboard` (буде закривати `/dashboard/*`)
3. **Identity providers:** обери Google + Login with PIN (backup)
4. **Policy:**
   - Name: `Allowed users`
   - Action: **Allow**
   - Include → **Emails** → enter:
     ```
     vg@abrisart.com
     office@barpi.com.ua
     aksonov@barpi.com.ua
     pylyp@abrisart.com
     office@abrisart.com
     vg@dreamcar.ua
     ```
5. Save

### Крок 4 — Перевір

Відкрий https://brand.barpi.ua/dashboard/ у incognito → має з'явитись **Cloudflare Access login** (не наш custom modal).

---

## 🔄 Phase 5: Cutover bb.js → Worker API

Коли все вище працює і дані у D1 — оновити frontend:

1. У `assets/bb.js`:
   ```js
   // ❌ Стара constanта (Supabase)
   BB.SUPABASE_URL = 'https://zrcqmwlpsggiqgipvxhv.supabase.co';
   BB.SUPABASE_ANON = '...';

   // ✅ Нова (D1 via Worker)
   BB.API_URL = 'https://barpi-api.<subdomain>.workers.dev';
   // Або custom domain: 'https://api.barpi.ua' якщо налаштуєш DNS
   ```

2. Оновити `BB.api()`:
   ```js
   BB.api = function(path, opts = {}) {
     return fetch(BB.API_URL + path, {
       ...opts,
       headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
       credentials: 'include',  // CF Access cookie
     });
   };
   ```

3. **Прибрати** `BB.AUTH` повністю — CF Access робить auth на edge

4. Дашборди — оновити endpoints:
   ```js
   // Старе:    fetch('/rest/v1/v_pnl_monthly?...')
   // Нове:     fetch(BB.API_URL + '/v_pnl_monthly?...')
   ```

5. Push → тест → готово

---

## 🧹 Phase 6: Cleanup Supabase (за 7 днів після successful cutover)

Як safety net залишити Supabase ще 7 днів, потім:

1. Supabase Dashboard → Edge Functions → `moysklad-sync` → Delete
2. SQL Editor: видалити pg_cron jobs:
   ```sql
   SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE 'moysklad%';
   ```
3. Settings → General → **Pause project** (можна re-enable якщо щось)
4. Через 30 днів — Delete project

---

## 📁 Структура файлів

```
cf-migration/
├── MIGRATION_PLAN.md          ← загальний план
├── README.md                  ← цей файл (deploy guide)
├── d1-schema.sql              ← SQL DDL (вже застосовано)
├── workers/
│   ├── barpi-sync/
│   │   ├── wrangler.toml      ← Cron config + D1 binding
│   │   └── src/index.js       ← 19 sync handlers
│   └── barpi-api/
│       ├── wrangler.toml      ← D1 binding
│       └── src/index.js       ← REST API for dashboards
└── (TBD) bb-v4-preview.js     ← новий bb.js без BB.AUTH
```

---

## ❓ Часті питання

### Worker деплоїться але `MOYSKLAD_TOKEN` відсутній
```bash
cd cf-migration/workers/barpi-sync
wrangler secret put MOYSKLAD_TOKEN
# Введи токен коли запитає
```

### D1 query через wrangler не працює
Перевір що ти на правильному акаунті:
```bash
wrangler whoami
# Має показати vg@abrisart.com
```

### CORS error від barpi-api на dashboard сторінці
Перевір `ALLOWED_ORIGINS` у `wrangler.toml`:
```
ALLOWED_ORIGINS = "https://brand.barpi.ua,https://barpi-brand-book.pages.dev"
```

### Cron sync не запускається
Перевір cron status:
```bash
wrangler tail barpi-sync
# Має показати "Triggered scheduled event" кожну годину
```

### CF Access блокує api.barpi.ua
Не вмикай Access на API subdomain — він має бути публічний (з CORS). Access тільки на `/dashboard/*` через брендуй.

---

*Якщо щось не йде — пиши, разом подебажимо.*
