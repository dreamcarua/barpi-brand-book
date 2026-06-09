# Barpi Operations Runbook

Стандартні процедури для команди, що оперує Barpi Brand Bible + дашборди.

> Найновіше: 09.06.2026 · Стек: GitHub Pages + CF Workers + D1 + R2 + CF Access (без Supabase)

---

## 0. Швидкі команди (cheat sheet)

```bash
# Перевірити стан системи
curl -s https://barpi-api.vg-ab6.workers.dev/healthz | jq .

# Перевірити sync_state (last sync per entity)
curl -s -H "Origin: https://brand.barpi.ua" \
  "https://barpi-api.vg-ab6.workers.dev/sync_state?select=entity,last_synced_at,rows_synced,last_error&order=entity" | jq .

# Manual sync trigger (admin only — потрібен SYNC_API_KEY)
wrangler secret get SYNC_API_KEY --name barpi-sync   # Отримати
curl -X POST "https://barpi-sync.vg-ab6.workers.dev/sync?key=<KEY>&only=demand&all=1"

# Download останній backup з D1 (admin only — потрібен API_AUTH_KEY)
curl -H "X-API-Key: <API_AUTH_KEY>" "https://barpi-api.vg-ab6.workers.dev/backups" | jq .
curl -H "X-API-Key: <API_AUTH_KEY>" "https://barpi-api.vg-ab6.workers.dev/backups/3" -o backup-3.json
```

---

## 1. Deploy worker fix

**Коли:** правка в `barpi-api.js` або `barpi-sync.js`.

**Передумова:** wrangler CLI установлено + admin token.

```bash
# 1. Backup поточної версії перед деплоєм
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/workers/scripts/barpi-api" \
  -H "Authorization: Bearer $CF_TOKEN" > backup-$(date +%Y%m%d-%H%M).raw

# 2. Deploy
wrangler deploy --name barpi-api

# АБО через CF API (без wrangler):
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/workers/scripts/barpi-api" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -F "metadata=@metadata.json;type=application/json" \
  -F "index.js=@worker.js;type=application/javascript+module;filename=index.js"

# 3. Smoke test
curl https://barpi-api.vg-ab6.workers.dev/healthz
curl -H "Origin: https://brand.barpi.ua" https://barpi-api.vg-ab6.workers.dev/v_dashboard_kpis
```

**Rollback:** redeploy з backup-X.raw файлу.

---

## 2. Add/remove CF Access user

**Коли:** новий співробітник або звільнення.

**Метод A — через UI:**
1. https://one.dash.cloudflare.com → Access → Applications → "Barpi Brand Bible Dashboards"
2. Policies → "Allowlist 5 emails" → Include → додати/видалити

**Метод B — через API:**
```bash
CF_TOKEN=...
ACCOUNT_ID=ab63a85bdfbf5894c28efe7076acbd82
APP_ID=e2567fcf-df3b-4920-8763-48dbffa4ba1b
POLICY_ID=12e4ee5e-982b-468b-b573-67c192e600a7

# Отримати поточну policy
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/access/apps/$APP_ID/policies/$POLICY_ID" \
  -H "Authorization: Bearer $CF_TOKEN" | jq .

# Оновити (PUT) — всі emails заново у одному масиві
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/access/apps/$APP_ID/policies/$POLICY_ID" \
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "decision": "allow",
    "name": "Allowlist 5 emails",
    "include": [
      {"email":{"email":"vg@abrisart.com"}},
      {"email":{"email":"office@barpi.com.ua"}},
      {"email":{"email":"aksonov@barpi.com.ua"}},
      {"email":{"email":"vg@sneco.ua"}},
      {"email":{"email":"fg@abrisart.com"}}
    ]
  }'
```

**Поточний allowlist (станом на 09.06.2026, source of truth = CF Dashboard):**
- vg@abrisart.com (Vadym Hryshyn, founder)
- vg@sneco.ua (Vadym, sneco identity)
- fg@abrisart.com (Pylyp Hryshyn, COO/finance)
- office@barpi.com.ua (Barpi office account)
- aksonov@barpi.com.ua (Oleksandr Aksonov, Barpi operations)

> Snapshot у `cf-access-policy.json` (commit 8ef8f4d0). Source of truth — CF Dashboard UI.
> Session duration: 720h (30 days).

---

## 3. Investigate sync failure

**Коли:** дашборди показують `Sync N годин тому` (більше за 2) або `last_error` непорожнє.

```bash
# 1. Перевірити sync_state
curl -s -H "Origin: https://brand.barpi.ua" \
  "https://barpi-api.vg-ab6.workers.dev/sync_state?last_error=not.is.null"

# 2. Manual run з debug:
SYNC_KEY=$(wrangler secret get SYNC_API_KEY --name barpi-sync)
curl -X POST "https://barpi-sync.vg-ab6.workers.dev/sync?key=$SYNC_KEY&only=demand&all=1" | jq .

# 3. Дивитись логи (live tail):
wrangler tail barpi-sync --format pretty
```

**Часті причини:**
- MS токен expired → ротувати: `wrangler secret put MOYSKLAD_TOKEN --name barpi-sync`
- MS API rate limit → почекати 10 хв
- Worker CPU timeout (30s) → синкати по 1 entity: `?only=demand`
- D1 quota exceeded → `wrangler d1 info barpi-bible` перевірити size

---

## 4. D1 backup & restore

### Автоматичний weekly backup (Cloudflare native)

Кожна неділя 04:00 UTC `barpi-api.scheduled()` cron:
1. Знімає snapshot 6 critical таблиць (`brand_ideas`, `sync_state`, `partner_pipeline`, `events`, `sku_catalog`, `partners`)
2. Зберігає у `_backups` table (12-week retention) — для швидкого доступу
3. Push-ить у R2 bucket `barpi-backups` під `weekly/YYYY-MM-DD-critical.json` (тривале зберігання)
4. Push-ить full D1 dump під `weekly/YYYY-MM-DD-full.json` (для disaster recovery)

### Manual download backup

```bash
API_KEY=<X-API-Key>

# Через worker (швидко, з _backups table):
curl -H "X-API-Key: $API_KEY" "https://barpi-api.vg-ab6.workers.dev/backups" | jq .
# → returns list: id, created_at, size_bytes

curl -H "X-API-Key: $API_KEY" "https://barpi-api.vg-ab6.workers.dev/backups/3" -o backup-3.json

# Через worker (R2 long-term archive):
curl -H "X-API-Key: $API_KEY" "https://barpi-api.vg-ab6.workers.dev/backups/r2" | jq .

# Через R2 API напряму:
CF_TOKEN=...
curl "https://api.cloudflare.com/client/v4/accounts/ab63a85bdfbf5894c28efe7076acbd82/r2/buckets/barpi-backups/objects" \
  -H "Authorization: Bearer $CF_TOKEN"

# On-demand export (full dump поточного стану):
curl -H "X-API-Key: $API_KEY" "https://barpi-api.vg-ab6.workers.dev/export?all=1" -o full-backup-$(date +%F).json
```

### Restore (Time Travel — до 30 днів)

```bash
wrangler d1 time-travel info barpi-bible --remote
wrangler d1 time-travel restore barpi-bible --bookmark <ID> --remote
```

### Disaster recovery (повний reload з MS)

```bash
# 1. Truncate всі таблиці (ОБЕРЕЖНО):
wrangler d1 execute barpi-bible --command "DELETE FROM moysklad_demand;" --remote
# ... для кожної таблиці

# 2. Reset cursors:
wrangler d1 execute barpi-bible --command "UPDATE sync_state SET last_moment=NULL;" --remote

# 3. Full re-sync:
curl -X POST "https://barpi-sync.vg-ab6.workers.dev/sync?key=$SYNC_KEY&all=1"
# ~10 хвилин на ~1900 demand + 1100 paymentin + ...
```

---

## 5. Rotate CF API token

**Коли:** expired або скомпрометований.

```bash
# 1. Створити новий токен:
# https://dash.cloudflare.com/profile/api-tokens → Create Token → Custom token
# Permissions:
#   - Account → Workers Scripts: Edit
#   - Account → D1: Edit
#   - Account → Workers R2 Storage: Edit
#   - Account → Workers KV Storage: Edit
#   - Account → Access: Apps and Policies: Edit
#   - Account → Account Settings: Read
#   - Zone (barpi.ua) → Workers Routes: Edit
#   - Zone (barpi.ua) → DNS: Edit

# 2. Зберегти у password manager. Ніколи не комітити!

# 3. Оновити wrangler:
echo 'export CLOUDFLARE_API_TOKEN=cfut_...' >> ~/.zshrc

# 4. Знести старий токен з dashboard.
```

**Перевірити expiry поточного токена:**
```bash
curl https://api.cloudflare.com/client/v4/user/tokens/verify -H "Authorization: Bearer $TOKEN" | jq .result
```

---

## 6. Add new MS-synced column

**Коли:** треба зберігати додаткове поле з МойСклад.

```bash
# 1. Додати колонку в D1:
wrangler d1 execute barpi-bible \
  --command "ALTER TABLE moysklad_demand ADD COLUMN new_field TEXT;" --remote

# 2. Оновити barpi-sync.js — додати extraColumns:
#   extraColumns: { new_field: r => r.someField || null }

# 3. Deploy worker:
wrangler deploy --name barpi-sync

# 4. Reset cursor для повного re-sync поля:
wrangler d1 execute barpi-bible \
  --command "UPDATE sync_state SET last_moment=NULL WHERE entity='demand';" --remote

# 5. Trigger sync:
curl -X POST "https://barpi-sync.vg-ab6.workers.dev/sync?key=$SYNC_KEY&only=demand&all=1"
```

---

## 7. Onboard non-engineer BB editor

**Сценарій:** хочу дозволити маркетологу правити текст на /products/.

1. Дати GitHub доступ як collaborator (Write):
   - Settings → Collaborators → Add → username

2. Відправити їм короткий гайд:
   > Hi! Заходиш на github.com/dreamcarua/barpi-brand-book → Знаходиш папку (наприклад `products/`) → `index.html` → Edit (олівчик зверху справа) → Внести правки → Commit changes (внизу) → Через 30 секунд live на https://brand.barpi.ua/products/

3. Попередити:
   > Не торкатися `assets/bb.js`, `assets/bb.css`, папок `dashboard/`, файлів `.yml/.toml/.json` — це код.

---

## 8. Customer data discrepancy support

**Сценарій:** клієнт пише "у вас неправильна сума у замовленні".

1. Знайти у МойСклад → це **source of truth**. D1 — лише копія.
2. Якщо у MS правильна → у D1 застаріла:
   - Перевірити `sync_state` → коли last_synced.
   - Trigger manual sync: `curl ...?only=demand`
3. Якщо помилка у MS → виправити там, sync підтягне.
4. ⚠ Ніколи не редагувати D1 напряму — буде overwritten cron-ом.

---

## 9. GDPR / right to deletion

**Сценарій:** клієнт просить видалити свої дані.

```bash
# 1. Знайти у МойСклад → видалити там (anonymize чи hard delete).
# 2. Знайти у D1 + видалити:
wrangler d1 execute barpi-bible \
  --command "DELETE FROM moysklad_counterparties WHERE ms_id='...';" --remote
wrangler d1 execute barpi-bible \
  --command "DELETE FROM moysklad_demand WHERE agent_ms_id='...';" --remote
wrangler d1 execute barpi-bible \
  --command "DELETE FROM sales_sku WHERE agent_ms_id='...';" --remote
wrangler d1 execute barpi-bible \
  --command "DELETE FROM moysklad_payments WHERE agent_ms_id='...';" --remote

# 3. Документувати у ticket: дата запиту, ms_id, виконано.
```

PII fields у D1: `moysklad_counterparties.ms_name`, `ms_phone`, `ms_email`; `brand_ideas.author_name`, `author_email`.

---

## Корисні URL та секрети

| | URL |
|---|---|
| Live site | https://brand.barpi.ua/ |
| CF Pages preview | https://barpi-brand-book.pages.dev/ |
| Worker barpi-api | https://barpi-api.vg-ab6.workers.dev |
| Worker barpi-sync | https://barpi-sync.vg-ab6.workers.dev |
| GitHub repo | https://github.com/dreamcarua/barpi-brand-book |
| CF Dashboard | https://dash.cloudflare.com (account `ab63a85b...`) |
| MoySklad | https://online.moysklad.ru/app/ |
| R2 bucket | barpi-backups (weur location) |

---

## Підтримка & ескалація

- Власник проекту: vg@abrisart.com
- Інфраструктурні питання (CF, D1, R2): vg@abrisart.com
- MoySklad питання: aksonov@barpi.com.ua
- Brand Book контент: vg@abrisart.com
