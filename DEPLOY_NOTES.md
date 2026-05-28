# Deploy Notes — наступні кроки vg

> Все що Claude зробив сам, зафіксовано у [CHANGELOG.md](CHANGELOG.md). Тут — те що залишилось зробити тобі.

## 🟢 Що працює зараз

| Що | URL | Як перевірити |
|---|---|---|
| Brand Bible (live) | https://brand.barpi.ua | Відкрити у браузері, переглянути 18 розділів |
| GitHub Pages mirror | https://dreamcarua.github.io/barpi-brand-book/ | Те саме |
| SMM Dashboard | https://brand.barpi.ua/dashboard/smm/ | Спробувати додати кілька публікацій (працює без авторизації, дані у localStorage) |
| Каталог дашбордів | https://brand.barpi.ua/dashboard/ | Картки з посиланнями на кожен дашборд |

## ⏳ Що залишилось — Cloudflare Worker deploy

Worker code готовий у `barpi-auth/`. Deploy одною командою.

### 1. Зареєструвати домен у Resend (для OTP email)
1. https://resend.com → Domains → **Add Domain** → `barpi.ua`
2. Додати DNS-записи що покаже Resend (TXT/MX/DKIM) у Cloudflare DNS для зони `barpi.ua`
3. Дочекатись verified (5-30 хв)
4. **API Keys** → **Create API Key** → права send_emails, scope `barpi.ua` → скопіювати

### 2. Deploy Worker
```bash
git clone git@github.com:dreamcarua/barpi-brand-book.git
cd barpi-brand-book/barpi-auth
npm install

# Secrets (один раз)
npx wrangler login   # відкриє Cloudflare у браузері

# Випадковий JWT secret (32+ символи)
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET

# Resend API key
npx wrangler secret put RESEND_API_KEY
# (вставити з кроку 1)

# Deploy
npx wrangler deploy
# → буде доступний на https://barpi-auth.<account>.workers.dev
```

### 3. Custom subdomain для Worker (опціонально, але рекомендовано)
```bash
# У wrangler.toml розкоментувати:
# [[routes]]
# pattern = "auth.barpi.ua/*"
# zone_name = "barpi.ua"

# Додати DNS у Cloudflare:
# CNAME auth → <account>.workers.dev (proxied 🟠)

# Redeploy
npx wrangler deploy
```

### 4. Перевірка
```bash
curl https://auth.barpi.ua/
# → {"ok":true,"service":"barpi-auth","version":"1.0"}

# Запитати OTP (на whitelist email)
curl -X POST https://auth.barpi.ua/api/otp/request \
  -H "Content-Type: application/json" \
  -d '{"email":"vg@abrisart.com","block":"admin"}'
# → {"ok":true,"message":"Code sent if authorized."}
# Перевірити email
```

### 5. Додати whitelist інших користувачів
Після першого успішного входу як адмін → отримаєш JWT. Зберігаєш його, потім:
```bash
TOKEN="<твій JWT>"
curl -X POST https://auth.barpi.ua/api/admin/whitelist/update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"block":"smm-dashboard","emails":["vg@abrisart.com","alona@barpi.ua"]}'
```

## 📝 Що ще варто додати у наступних сесіях

### Документи (15 markdown файлів локально готові, треба пушити)
Скрипт для batch-push (працює з MCP в Cowork сесії):
```
documents/smm/01_Brand_Basics.md … 16_Crisis_Communication.md
documents/02_Guideline_Logo_Visual_Style.md
documents/03_Knowledge_Base_2026.md
documents/04_Target_Audience.md
documents/05_Customer_Journey_Map.md
```
Локальні джерела: `/Users/vadimgrishin/Library/Application Support/Claude/local-agent-mode-sessions/.../outputs/docs_md/`

### МойСклад інтеграція (Фаза 4)
1. Створити API token у МойСклад: Налаштування → Точки доступу → JSON API
2. Додати у GitHub Secrets `MOYSKLAD_TOKEN`
3. Створити `.github/workflows/moysklad-sync.yml` (форк sneco)
4. Створити `barpi-auth/scripts/moysklad_sync.py` (форк)

### Локальна wrangler для адмін-щоденних задач
```bash
# Перевірити whitelist
npx wrangler kv:key get --namespace-id=5d2685f414a14ff4ac050eea5b19bdcf 'wl:smm-dashboard'

# Прямий запит D1
npx wrangler d1 execute barpi-bible --command "SELECT COUNT(*) FROM sku_catalog;"

# Apply migration
npx wrangler d1 execute barpi-bible --file=barpi-auth/migrations/0001_schema.sql --remote
```

## 🆔 Cloudflare resource IDs (вже у CLAUDE.md)

| Ресурс | ID |
|---|---|
| Account | `ab63a85bdfbf5894c28efe7076acbd82` (Vg@abrisart.com) |
| D1 `barpi-bible` | `45c93052-c82c-4d0c-901b-2999187643b9` (WEUR) |
| KV `barpi-bible-acl` | `5d2685f414a14ff4ac050eea5b19bdcf` |
| Zone `barpi.ua` | (вже додано) |

## 🔗 Зв'язок з snEco

| Файл snEco | Файл Barpi | Адаптовано |
|---|---|---|
| sneco-brand-book/index.html v2.26 | barpi-brand-book/index.html v1.0 | ✅ |
| sneco-auth/src/index.js | barpi-auth/src/index.js | ✅ Спрощено + ребрендинг |
| sneco-auth/wrangler.toml | barpi-auth/wrangler.toml | ✅ Свої D1/KV IDs |
| sneco/moysklad_sync.py | _todo_ | ⏳ Фаза 4 |
| sneco/dashboard.html | dashboard/smm/index.html | ✅ Тільки SMM поки |
