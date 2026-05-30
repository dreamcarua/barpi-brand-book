# 🛠 Barpi Brand Bible — Runbook

**Last updated:** 30.05.2026
**Maintainer:** vg@abrisart.com

Стислий технічний довідник для команди — як додавати/редагувати/деплоїти.

---

## 📐 Архітектура

| Шар | Технологія | Де |
|---|---|---|
| **Frontend** | Static HTML + vanilla JS | GitHub Pages → `brand.barpi.ua` |
| **Repo** | `dreamcarua/barpi-brand-book` | main branch auto-deploy |
| **CSS/JS** | `assets/bb.css` v2.4, `assets/bb.js` v3.2 | one source of truth |
| **Data API** | Supabase REST | `https://zrcqmwlpsggiqgipvxhv.supabase.co/rest/v1/` |
| **Auth** | Supabase Magic Link OTP | guards `/dashboard/*` only |
| **MS Sync** | Edge Function `moysklad-sync` v9 + pg_cron | runs hourly, 24 endpoints |
| **Drive integration** | Direct download URLs | `uc?export=download&id={fileId}` |

---

## 📄 Додавання нової сторінки до Brand Bible

1. **Створити папку** з назвою маленькими літерами: `/new-section/index.html`
2. **Скопіювати шаблон** з існуючої сторінки (рекомендовано: `/team/` або `/touchpoints/`)
3. **Замінити placeholders:**
   - `<title>` — `Назва · Barpi Brand Bible`
   - `<meta description>`, `<link rel="canonical">`
   - `<span class="chapter-num">XX · ...</span>` — номер за порядком у sidebar
   - `<h1>...</h1>` з двомовним `<span data-lang>`
4. **Підключити bb.js + bb.css**:
   ```html
   <link rel="stylesheet" href="/assets/bb.css">
   <button class="menu-toggle" aria-label="Menu">☰</button>
   <div class="app">
     <div id="bb-sidebar"></div>
     <main class="main">...</main>
   </div>
   <script src="/assets/bb.js"></script>
   ```
5. **Додати у sidebar** у `assets/bb.js` → `BB.SIDEBAR_HTML` (відповідна `nav-group`)
6. **Додати у SEARCH_INDEX** у `assets/bb.js`
7. **Додати у `sitemap.xml`** у корені repo
8. Commit + push до `main` → GH Pages auto-deploy ~30 сек

### ⚠️ Обов'язково: двомовність UK + EN

**Кожен** текстовий елемент має містити обидва варіанти:
```html
<span data-lang="uk">Текст українською</span><span data-lang="en">English text</span>
```
Це не just-nice-to-have — це **жорстке правило** (див. memory: bilingual-rule). Перевірка через QA балансу spans.

---

## 📊 Додавання нового дашборда

1. Створити `/dashboard/new-name/index.html`
2. **ОБОВ'ЯЗКОВО:**
   - Підключити `<script src="/assets/bb.js"></script>` — це включає auth-gate
   - Інакше дашборд буде ПУБЛІЧНИЙ (як був /events/ до 30.05.2026)
3. Додати у `BB.DASHBOARD_LINKS` в `bb.js`:
   ```js
   {href:'/dashboard/new-name/', label:'🎯 New', match:'new-name'}
   ```
4. Додати картку у `/dashboard/index.html` (gateway page)
5. Якщо дашборд використовує дані з Supabase — використовувати `BB.api()` helper
6. Двомовність — як для BB сторінок

---

## 🔐 Управління auth — додати/видалити user

**Allowlist у 2 файлах** (мають бути синхронізовані):
1. `assets/bb.js` → `BB.AUTH.ALLOWED` (рядки ~360)
2. `auth-callback/index.html` → `ALLOWED` (рядок ~30)

```js
ALLOWED: [
  'vg@abrisart.com',
  'office@barpi.com.ua',
  'aksonov@barpi.com.ua',
  'pylyp@abrisart.com',
  'office@abrisart.com',
  'vg@dreamcar.ua',
  // 'new-user@barpi.com.ua',  // ← додати тут
]
```

**Після додавання:** commit, push, ~30 сек на деплой. User одразу зможе залогінитись.

**Видалення:** прибрати email з обох файлів. Існуюча сесія залишиться валідною ≤7 днів. Для негайного revoke — Supabase Dashboard → Auth → Users → Delete.

Деталі в `AUTH_SETUP.md`.

---

## 💾 МойСклад інтеграція — таблиці і view-и

### Назви таблиць (важливо!)

| Логічна назва | Реальна таблиця | Колонки |
|---|---|---|
| Відвантаження | `moysklad_demand` | `id, ms_id, ms_name, moment, sum_uah, sku_id, qty, ...` |
| Платежі вхідні | `moysklad_payments` | `id, ms_id, moment, sum_uah, last_synced` |
| Платежі вихідні | `moysklad_payments_out` | `id, ms_id, moment, sum_uah, last_synced` |
| Постачання | `moysklad_supplies` | `id, ms_id, moment, sum_uah, supplier` |
| Виробничі акти | `moysklad_processing_acts` | `id, plan_ms_id, materials_sum_uah, products_qty, ...` |
| Залишки по складах | `moysklad_stock_by_store` | `store_ms_id, product_ms_id, stock_qty` |
| Замовлення клієнтів | `moysklad_customer_orders` | — |
| Замовлення постачальникам | `moysklad_purchase_orders` | — |
| Повернення | `moysklad_returns` | — |
| Списання | `moysklad_losses` | — |
| Переміщення | `moysklad_moves` | ⚠️ 0 rows — sync not running |
| Зарплати | `moysklad_payroll` | ⚠️ 0 rows |
| Договори | `moysklad_contracts` | ⚠️ 0 rows |
| Контрагенти | `moysklad_counterparties` | — |
| Товари | `moysklad_products` | `ms_id, sku_id, ms_name, unit_price` |
| Магазини | `moysklad_stores` | — |

### ⚠️ Колонка `updated_at` НЕ існує

У більшості MS таблиць немає колонки `updated_at`. Замість неї — `last_synced` або `moment` (бізнес-момент).

```sql
-- ❌ Так НЕ працює:
SELECT * FROM moysklad_demand ORDER BY updated_at DESC;

-- ✅ Правильно:
SELECT * FROM moysklad_demand ORDER BY last_synced DESC;
SELECT * FROM moysklad_demand ORDER BY moment DESC;
```

### Dashboard view-и (production-ready)

| View | Призначення | Дашборд |
|---|---|---|
| `v_customer_360` | KPI customer | Customer 360 |
| `v_customer_metrics`, `v_customer_dow`, `v_customer_timeline` | Деталі | Customer 360 |
| `v_pnl_monthly`, `v_cash_flow` | P&L | Financial |
| `v_sales_by_day`, `v_sales_by_sku` | Продажі | Sales Performance |
| `v_production_monthly`, `v_production_efficiency` | Виробництво | Production |
| `v_inventory_extended`, `v_inventory_by_store` | Залишки | Inventory |

---

## 🎨 Робота з Drive файлами

### Direct download URL format
```
https://drive.google.com/uc?export=download&id={FILE_ID}
```

Файл має бути **anyone-with-link** для працездатності з brand.barpi.ua.

### Корпоративний Drive
- Owner: `barpiwork@gmail.com`
- 3 root папки:
  - **Активні матеріали:** `1UBkJ_eeue0TsDmXki8HgkyZWYHleUtiO`
  - **Документи + презентації:** `1aeoGMNKoHVxwmtFHFCvIB7Rq9FFXoGf3`
  - **Архів:** `17UubRwNz2GJMxtgZaY8kRU1PafIeCCyj`

Усі ключові файли вже зкаталогизовані у `/downloads/`.

---

## 🚀 Deploy + monitoring

### Auto-deploy
- Push до `main` branch → GH Pages rebuild ~30 сек
- DNS / CDN: Cloudflare (CNAME у repo root)

### Edge Functions (Supabase)
- `moysklad-sync` v9 — деплой через GitHub Action `SUPABASE_ACCESS_TOKEN`
- pg_cron schedule: hourly

### Перевірка свіжості даних
```bash
APIKEY="<anon key з bb.js>"
curl -s -H "apikey: $APIKEY" -H "Authorization: Bearer $APIKEY" \
  "https://zrcqmwlpsggiqgipvxhv.supabase.co/rest/v1/moysklad_demand?select=last_synced&order=last_synced.desc&limit=1"
```

Якщо `last_synced > 6 годин` — sync проблеми. Перевірити GitHub Action logs.

---

## 🔧 Часті проблеми + рішення

### Magic link не приходить
1. Перевірити Supabase email rate limit (4/година на free tier)
2. Перевірити Site URL у Supabase Auth → URL Configuration: має бути `https://brand.barpi.ua`
3. Перевірити `Redirect URLs` allowlist: `https://brand.barpi.ua/auth-callback/**`
4. Скрипт: `./supabase/configure-auth.sh` (з `SUPABASE_ACCESS_TOKEN`)

### bb.js не оновлюється у браузері
- Hard reload (Cmd+Shift+R / Ctrl+Shift+R)
- Browser кеш CSS/JS може триматись до 4 годин (`cache-control: max-age=14400`)
- Через JS bust: `<script src="/assets/bb.js?v=20260530">`

### Дашборд показує застарілі дані
- Перевірити `last_synced` у відповідній таблиці
- GH Action `moysklad-sync` — перевірити останній run
- Часто причина: rotated MS API token

### Mobile меню не відкривається
- Перевірити що `<button class="menu-toggle">` присутня
- Перевірити що `<script src="/assets/bb.js">` підключений
- На дашбордах: `body.has-topnav .menu-toggle { display: none }` (за дизайном)

---

## 📞 Хто за що відповідає

| Зона | Owner | Email |
|---|---|---|
| Frontend BB | Vadym | vg@abrisart.com |
| Backend (Supabase + MS sync) | Vadym | vg@abrisart.com |
| Виробництво + якість | Oleksandr (COO) | aksonov@barpi.com.ua |
| Команда + операційка | Pylyp (CFO) | pylyp@abrisart.com |
| Press / PR | Vadym | vg@abrisart.com або office@barpi.com.ua |
| Юридичне / TM | Pylyp Hryshyn (TM owner) | pylyp@abrisart.com |

---

## 🗺 Куди далі

Backlog у `/roadmap/`. Великі речі:
- Q3: Custom SMTP (Resend) — прибрати email rate limit
- Q3: RLS + JWT — hard security
- Q3: Сертифікат відповідності продовження
- Q4: Експорт у ЄС (PL, CZ перші)

---

*Якщо щось не описано тут — допиши і закомить. Runbook = living doc.*
