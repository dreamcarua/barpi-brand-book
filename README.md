# Barpi Brand Bible

Внутрішня платформа Barpi: **brand book** + **операційні дашборди** з МойСклад → Cloudflare D1.

🔗 Live: https://brand.barpi.ua/

---

## Архітектура

```
┌─────────────┐    expand=positions    ┌─────────────────┐
│  МойСклад   │ ────────────────────→  │  Worker         │
│  (ERP)      │                        │  barpi-sync     │
└─────────────┘                        │  cron 0 * * * * │
                                       └────────┬────────┘
                                                │
                                                ▼
                                       ┌────────────────────┐
                                       │  Cloudflare D1     │
                                       │  barpi-bible       │
                                       │  ~352 MB / 30 таб. │
                                       └────────┬───────────┘
                                                │ PostgREST-style
                                                ▼
                                       ┌────────────────────┐
                                       │  Worker barpi-api  │
                                       │  STRICT_ORIGIN     │
                                       └────────┬───────────┘
                                                │ fetch()
                                                ▼
   ┌────────────────────┐     CF Access     ┌──────────────────────┐
   │  GitHub Pages      │ ─────gate─────→   │ /dashboard/* (6)     │
   │  brand.barpi.ua    │  5 emails allow   │ /customer-360/       │
   │                    │                   │ /financial/          │
   │ 22 BB сторінок     │                   │ /sales-performance/  │
   │ + 6 dashboards     │                   │ /production/         │
   └────────────────────┘                   │ /inventory/          │
                                            │ /events/             │
                                            └──────────────────────┘
```

**Стек:** GitHub Pages (статичний хост) → CF Access (auth) → CF Workers (D1 API + cron) → MoySklad (source).

**Жодного backend сервера, нуль БД крім D1, нуль контейнерів.** Все на CF free tier.

---

## Що де лежить

### Frontend (GitHub Pages, репо)

| Шлях | Призначення |
|---|---|
| `index.html` | головна, sitemap навігація |
| `about/` `architecture/` `tech/` ... (22 секції) | сторінки Brand Bible |
| `assets/bb.js` | shared JS: sidebar, sticky topnav, lang switcher, search index, dashboard topnav inject |
| `assets/bb.css` | shared CSS (тема, breakpoints, sidebar, typography) |
| `dashboard/{customer-360,financial,sales-performance,production,inventory,events}/` | 6 дашбордів — кожен self-contained HTML+JS+CSS, читає з `barpi-api` |
| `dashboard/index.html` | dashboard hub |
| `404.html`, `robots.txt`, `sitemap.xml`, `og.svg` | static assets |
| `.nojekyll` | відключає Jekyll на Pages |

### Backend (Cloudflare)

- **D1 `barpi-bible`** (UUID `45c93052-c82c-4d0c-901b-2999187643b9`)
  - 30 таблиць: `moysklad_*` (19 entities), `sales_sku` (denorm), `sync_state`, `brand_ideas`, etc.
  - 15 views: `v_dashboard_kpis`, `v_sales_by_*`, `v_customer_*`, `v_pnl_monthly`, `v_cash_flow`, ...
- **Worker `barpi-api`** — REST proxy до D1 з PostgREST-сумісним синтаксисом (`?col=eq.value`, `?order=col.desc`)
  - URL: https://barpi-api.vg-ab6.workers.dev
  - Auth: STRICT_ORIGIN (тільки brand.barpi.ua + pages.dev) АБО `X-API-Key` header
- **Worker `barpi-sync`** — щогодини pull-ить з MS у D1
  - Cron: `0 * * * *`
  - URL: https://barpi-sync.vg-ab6.workers.dev
  - Manual trigger: `POST /sync?key=<SYNC_API_KEY>` (тільки з admin token)
- **CF Access app** `uabarpi.cloudflareaccess.com` — захищає `/dashboard/*`. Allowlist: vg@abrisart.com, vg@sneco.ua, fg@abrisart.com, oleksandr@barpi.com.ua, pylyp@barpi.com.ua

### Secrets

| Secret | Де | Як ротувати |
|---|---|---|
| `MOYSKLAD_TOKEN` | wrangler secret на `barpi-sync` | див. `RUNBOOK.md` § rotate |
| `SYNC_API_KEY` | wrangler secret на `barpi-sync` | `wrangler secret put SYNC_API_KEY --name barpi-sync` |
| `API_AUTH_KEY` | wrangler secret на `barpi-api` (для backend access) | `wrangler secret put API_AUTH_KEY --name barpi-api` |
| CF API token | у власника проєкту | dash.cloudflare.com → My Profile → API Tokens |

**Жодних секретів у git.** Якщо побачив — викликай rotate негайно (`RUNBOOK.md` § leak).

---

## Швидкий старт для нового інженера

1. Клонувати repo: `gh repo clone dreamcarua/barpi-brand-book`
2. Прочитати `RUNBOOK.md` повністю.
3. Запросити wrangler-доступ у власника проекту.
4. Скласти список email щоб додати у CF Access (через CF dashboard → Zero Trust → Access → Applications).
5. Запустити `wrangler tail barpi-sync` — побачити cron у реальному часі.
6. Прочитати `CHANGELOG.md` — повна історія architectural decisions.

## Швидкий старт для не-інженера (контент-менеджер BB)

Хочу змінити текст на сторінці Brand Bible:
1. Зайти на github.com/dreamcarua/barpi-brand-book
2. Знайти потрібну папку (наприклад `/products/`) → `index.html`
3. Натиснути 🖉 Edit → внести зміни → Commit.
4. Через ~30 секунд правки live на https://brand.barpi.ua/

⚠ Не торкатися: `assets/bb.js`, `assets/bb.css`, `dashboard/*` — це код, ламається легко.

---

## Стан системи

- ✅ Всі 19 sync entities в `sync_state` оновлюються щогодини
- ✅ 22/22 BB сторінок з повним SEO meta
- ✅ 6/6 дашбордів через D1
- ✅ Lifetime revenue: ~5.3M ₴, 156 клієнтів
- ✅ CF Access enforced, barpi-api locked (STRICT_ORIGIN)
- ✅ Cost: $0/мес (все на free tier)

---

## Документація

- `CHANGELOG.md` — версії, architectural decisions, що змінилось
- `RUNBOOK.md` — операційні процедури (deploy, rotate, restore, etc.)
- `cf-migration/README.md` — історія міграції з Supabase у D1 (Травень 2026)

---

**Власник:** vg@abrisart.com · Реєстрація потужностей #17 · ТОВ «ПЕТ КОРП»
