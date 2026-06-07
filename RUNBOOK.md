# Barpi Operations Runbook

Стандартні процедури для команди, що оперує Barpi Brand Bible + дашборди.

> Найновіше: 07.06.2026 · Стек: GitHub Pages + CF Workers + D1 + CF Access (без Supabase)

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
```

---

## 1. Deploy worker fix

**Коли:** правка в `barpi-api.js` або `barpi-sync.js`.

**Передумова:** wrangler CLI установлено + admin token.

```bash
# 1. Перевірити локально
cat worker.js | node -e "..."  # лінт, dry-run

# 2. Backup поточної версії перед деплоєм
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/workers/scripts/barpi-api" \
  -H "Authorization: Bearer $CF_TOKEN" > backup-$(date +%Y%m%d-%H%M).raw

# 3. Deploy
wrangler deploy --name barpi-api

# АБО через CF API (без wrangler):
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/workers/scripts/barpi-api" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -F "metadata=@metadata.json;type=application/json" \
  -F "index.js=@worker.js;type=application/javascript+module;filename=index.js"

# 4. Smoke test
curl https://barpi-api.vg-ab6.workers.dev/healthz
curl -H "Origin: https://brand.barpi.ua" https://barpi-api.vg-ab6.workers.dev/v_dashboard_kpis
```

**Rollback:** redeploy з backup-X.raw файлу.

---

## 2. Add/remove CF Access user

**Коли:** новий співробітник або звільнення.

**Метод A — через UI:**
1. https://one.dash.cloudflare.com → Access → Applications → знайти "barpi-brand-book-dashboards"
2. Policies → Allow → Include → emails → додати/видалити

**Метод B — через API:**
```bash
# Потрібен токен з Access:Edit правом
CF_TOKEN=...
ACCOUNT_ID=ab63a85bdfbf5894c28efe7076acbd82
APP_ID=e2567fcf-df3b-4920-8763-48dbffa4ba1b

# Отримати поточну policy
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/access/apps/$APP_ID/policies" \
  -H "Authorization: Bearer $CF_TOKEN"

# Оновити (PUT)
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/access/apps/$APP_ID/policies/<POLICY_ID>" \
  -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  -d '{"include":[{"email":{"email":"new@example.com"}}, ...всі інші...]}'
```

**Поточний allowlist (станом на 07.06.2026):**
- vg@abrisart.com (Vadym, founder)
- vg@sneco.ua (Vadym, founder #2)
- fg@abrisart.com (Filip, COO/finance)
- oleksandr@barpi.com.ua (Olexandr, Barpi operations)
- pylyp@barpi.com.ua (Pylyp)

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

**Auto backup (раз на тиждень):**
- GH Action `.github/workflows/d1-backup.yml` робить `wrangler d1 export` щонеділі
- Складає у `backups/d1-barpi-bible-YYYY-MM-DD.sql.gz` як артефакт

**Manual backup:**
```bash
wrangler d1 export barpi-bible --output backup-$(date +%Y%m%d).sql --remote
gzip backup-*.sql
# Завантажити в R2 або локально зберегти
```

**Restore (Time Travel — до 30 днів):**
```bash
# Список доступних bookmark
wrangler d1 time-travel info barpi-bible --remote

# Restore у точку:
wrangler d1 time-travel restore barpi-bible --bookmark <ID> --remote
```

**Disaster recovery (повний reload з MS):**
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
# https://dash.cloudflare.com/profile/api-tokens → Create Token
# Permissions:
#   - Workers Scripts: Edit
#   - D1: Edit
#   - Account Settings: Read
#   - (опційно) Zone:Edit для Access policies

# 2. Зберегти у password manager. Ніколи не комітити!

# 3. Оновити wrangler:
echo 'export CLOUDFLARE_API_TOKEN=cfut_...' >> ~/.zshrc

# 4. Знести старий токен з dashboard.
```

**Поточний token expires:** перевірити `curl https://api.cloudflare.com/client/v4/user/tokens/verify -H "Authorization: Bearer $TOKEN"`.

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

# 6. Якщо потрібно — оновити view:
wrangler d1 execute barpi-bible --file new_view.sql --remote
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

---

## Підтримка & ескалація

- Власник проекту: vg@abrisart.com
- Інфраструктурні питання (CF, D1): vg@abrisart.com
- MoySklad питання: oleksandr@barpi.com.ua
- Brand Book контент: vg@abrisart.com
