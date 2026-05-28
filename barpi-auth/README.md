# barpi-auth

Cloudflare Worker для OTP-gate Barpi-дашбордів. Форк `sneco-auth` з адаптацією під Barpi.

## Архітектура

```
Browser → dashboard/<name>/index.html → POST /api/otp/request
       ↓
   Resend → email з 6-значним кодом
       ↓
Browser → POST /api/otp/verify → JWT token (24h)
       ↓
Browser → fetch(D1 data) з Authorization: Bearer <token>
```

## Bindings (`wrangler.toml`)

- **OTP_KV** = KV `barpi-bible-acl` (id: `5d2685f414a14ff4ac050eea5b19bdcf`)
- **DB** = D1 `barpi-bible` (id: `45c93052-c82c-4d0c-901b-2999187643b9`)

## Supported blocks

- `admin` — hardcoded до `ADMIN_EMAILS`
- `smm-dashboard`
- `sales-dashboard`
- `inventory-dashboard`
- `partner-dashboard`
- `events-dashboard`

## Deploy (від vg)

```bash
cd barpi-auth
npm install
# Secrets (один раз)
npx wrangler secret put JWT_SECRET          # → випадковий рядок 32+ символи
npx wrangler secret put RESEND_API_KEY      # → з resend.com (відправник noreply@barpi.ua)
# Deploy
npx wrangler deploy
# Перевірка
curl https://barpi-auth.<account>.workers.dev/
# → { ok: true, service: 'barpi-auth', version: '1.0' }
```

## Прив'язати кастомний роут (опціонально)

У `wrangler.toml` розкоментувати:
```toml
[[routes]]
pattern = "auth.barpi.ua/*"
zone_name = "barpi.ua"
```
Потім додати DNS CNAME `auth.barpi.ua` → `<account>.workers.dev`.

## Adapter для дашбордів

В кожному `dashboard/<name>/index.html` додається OTP-gate (JS), який:
1. Перевіряє localStorage на наявність JWT
2. Якщо немає → форма email → POST `/api/otp/request`
3. Email прийшов → форма коду → POST `/api/otp/verify` → JWT у localStorage
4. JWT використовується для авторизованих запитів до D1 через `/api/dashboard/<name>/data`

## Admin: керування whitelist

```bash
# Отримати поточний whitelist (треба JWT з isAdmin=true)
curl -X POST https://auth.barpi.ua/api/admin/whitelist/get \
  -H "Authorization: Bearer $TOKEN"

# Оновити whitelist для блоку
curl -X POST https://auth.barpi.ua/api/admin/whitelist/update \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"block":"smm-dashboard","emails":["vg@abrisart.com","alona@barpi.ua"]}'
```

## Поточні налаштування (`wrangler.toml`)

- `ADMIN_EMAILS = "vg@abrisart.com,fg@abrisart.com"`
- `SENDER_EMAIL = "noreply@barpi.ua"` (потрібно верифікувати домен у Resend)
- `ALLOWED_ORIGIN = "https://brand.barpi.ua"`

## Resend setup (від vg, разово)

1. Зайти на https://resend.com → Domains → Add `barpi.ua`
2. Додати TXT/MX/DKIM записи у Cloudflare DNS (Resend покаже)
3. Дочекатись verified
4. API Keys → Create → скопіювати → `wrangler secret put RESEND_API_KEY`
