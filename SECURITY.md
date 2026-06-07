# Barpi Security & Secrets

## Threat model

- Backend doesn't host PII publicly — D1 захищене Worker auth.
- /dashboard/* захищено CF Access (5 emails allowlist).
- Worker barpi-api validates Origin або X-API-Key (STRICT_ORIGIN mode).
- Source of truth = MoySklad. D1 — read-only cache, sync read-only token.

## Secrets inventory (станом на 07.06.2026)

| Secret | Сховище | Тип | Останнє обертання | TTL |
|---|---|---|---|---|
| `MOYSKLAD_TOKEN` | wrangler secret @ barpi-sync | API token (read+write MS) | <запис в історії MS> | infinite |
| `SYNC_API_KEY` | wrangler secret @ barpi-sync | manual trigger key | **07.06.2026** (ротовано) | infinite |
| `API_AUTH_KEY` | wrangler secret @ barpi-api | backend access (admin scripts) | **07.06.2026** (новий) | infinite |
| `CF_API_TOKEN` | env var у власника | Cloudflare API | 02.06.2026 | **10.06.2026 expires** ⚠ |

## Secrets які НЕ зберігаються в git

- `*.token`, `*.key`, `secrets.*` у `.gitignore`
- Жоден з вище секретів НЕ ПОВИНЕН бути в HTML/JS/MD файлах
- Якщо знаходиш у git history — rotate негайно (див. § Leak Response)

## Як ротувати

### MOYSKLAD_TOKEN
```bash
# 1. У MoySklad UI: Settings → API → створити новий token (READ-only достатньо)
# 2. Push до Worker:
wrangler secret put MOYSKLAD_TOKEN --name barpi-sync
# (paste new token)
# 3. Verify:
curl -X POST "https://barpi-sync.vg-ab6.workers.dev/sync?key=$SYNC_API_KEY&only=stores"
# 4. У MS видалити старий token
```

### SYNC_API_KEY
```bash
NEW_KEY=$(openssl rand -hex 32)
echo "Save in password manager: $NEW_KEY"
wrangler secret put SYNC_API_KEY --name barpi-sync
# paste $NEW_KEY
```

### API_AUTH_KEY
```bash
NEW_KEY=$(openssl rand -hex 32)
wrangler secret put API_AUTH_KEY --name barpi-api
# paste $NEW_KEY
```

### CF_API_TOKEN
- https://dash.cloudflare.com/profile/api-tokens
- Create Token → Custom token з permissions:
  - Account → Workers Scripts: Edit
  - Account → D1: Edit
  - Account → Account Settings: Read
  - (опційно) Zone → DNS: Edit (для wrangler routes)
  - (опційно) Zone → Workers Routes: Edit
- TTL: 3-12 місяців. Документувати exp у password manager.

## Leak response (P0 incident)

Знайшов секрет у public locale (git, HTML, JS):

1. **Rotate** негайно (5 min): сгенерувати новий + перезаписати worker secret + smoke test.
2. **Видалити** з джерела:
   - Якщо в git commit: revert або filter-branch (history rewrite — обережно)
   - Якщо в публічному файлі: edit + push
3. **Перевірити audit logs:**
   - CF audit: https://dash.cloudflare.com → Audit Log → шукати suspicious calls
   - MoySklad activity log
4. **Документувати** інцидент: time, secret type, scope, root cause, fix.

## Auth flow

```
1. User → brand.barpi.ua/dashboard/customer-360/
2. CF Access (uabarpi.cloudflareaccess.com) перевіряє email cookie
3. Якщо немає → redirect до login (email magic link від CF)
4. Після auth → session cookie 24h, full dashboard
5. Dashboard JS → fetch barpi-api.vg-ab6.workers.dev
6. Worker barpi-api перевіряє Origin (auto-set browser) → 200
7. Або X-API-Key (для backend scripts)
```

## Compliance

- **GDPR**: маємо процес on-demand видалення (див. RUNBOOK.md § 9)
- **Ukrainian data law**: дані у CF дата-центрах ЄС (Brussels/Amsterdam/Hamburg по карті)
- **Customer PII**: phone+email у D1, не у public web
- **Logs retention**: CF Worker logs — 7 днів (no manual export)
- **Backup retention**: D1 Time Travel — 30 днів

## Контакти

- Security incident: vg@abrisart.com
- Compliance/GDPR requests: vg@abrisart.com
