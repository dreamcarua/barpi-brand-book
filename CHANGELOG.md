# Barpi Brand Bible — Changelog

## v1.0.0 (28.05.2026) — MVP

🎉 **Перший продакшн-реліз Brand Bible Barpi.**

### Brand Bible (index.html)
- ✅ 18 розділів повністю наповнено реальним контентом (із Brand Book v7 + 16 SMM-docs + ЦА)
- ✅ Маніфест, платформа бренду, команда, технологія SNECO, меседжі
- ✅ Візуальна система: палітра (#FAFAFA / #1A1A1A / #2F6FED + 10 SKU), Qanelas, правила лого
- ✅ Tone of Voice (70/30), фотографія, Digital, упаковка
- ✅ Партнери + Sales playbook, PR + криза, Touchpoints
- ✅ Документи (ТМ, ТУ, патент, сертифікат, лаб-висновок)
- ✅ Roadmap Q3 2026, Maintenance, Каталог дашбордів, Архітектура бренду

### Dashboards (5 шт)
- ✅ **SMM Dashboard** (`/dashboard/smm/`) — повний функціонал: Content Log, Weekly, Monthly, Stories, Reels, Direct, UGC, Partners, Pillars. Дані у localStorage (V2 → D1).
- 🚧 **Sales Dashboard** (`/dashboard/sales/`) — скелет з UI. Підключення МойСклад у Фазі 4.
- 🚧 **Inventory Dashboard** (`/dashboard/inventory/`) — скелет з UI.
- 🚧 **Partner Pipeline** (`/dashboard/partners/`) — скелет з даними партнерів з seed.
- 🚧 **Events Dashboard** (`/dashboard/events/`) — повний календар 2026.
- ✅ Каталог дашбордів (`/dashboard/`) з картками і статусами.

### Backend (Cloudflare)
- ✅ **D1 база `barpi-bible`** створено (uuid `45c93052-c82c-4d0c-901b-2999187643b9`)
- ✅ **KV `barpi-bible-acl`** створено (id `5d2685f414a14ff4ac050eea5b19bdcf`)
- ✅ Schema створена і seed застосовано:
  - 24 SKU у `sku_catalog`
  - 16 партнерів у `partners`
  - 17 подій у `events`
  - Порожні `sales_daily`, `inventory_snapshot`, `partner_pipeline`, `smm_content_log` (готові до даних)

### Worker (barpi-auth)
- ✅ Cloudflare Worker code (форк sneco-auth, адаптовано)
- ✅ `wrangler.toml` з bindings (D1 + KV)
- ✅ `package.json` + README з deploy-інструкцією
- ✅ SQL migrations: 0001_schema, 0002_seed_sku, 0003_seed_partners_events
- ⏳ Deploy від vg: `cd barpi-auth && npx wrangler deploy`

### Документи (documents/)
- ✅ `documents/README.md` — індекс всіх документів
- ✅ `01_Brand_Book_v7.md` — повний переклад DOCX → markdown
- ⏳ 16 SMM-docs + Guideline + KB + ЦА + CJM — markdown готові локально, додаються поступово

### Інфраструктура
- ✅ GitHub Pages live: https://dreamcarua.github.io/barpi-brand-book/
- ✅ Custom domain: https://brand.barpi.ua (CNAME + DNS в Cloudflare)
- ✅ HTTPS через Cloudflare
- ✅ Repo public, доступ через MCP

---

## v0.1.1 (27.05.2026) — Domain change
- CNAME `brand.barpi.com.ua` → `brand.barpi.ua`

## v0.1.0 (27.05.2026) — Bootstrap
- Створено repo `dreamcarua/barpi-brand-book`
- `CLAUDE.md` з повним контекстом
- `BACKLOG.md` з планом 5 фаз
- `index.html` — кістяк з 18 секціями placeholder
- Структура папок: documents, logo, fonts, packaging, dashboard, retail, strategy, hr, pricing, equipment-photos, event-photos, barpi-auth
- Прототип: dreamcarua/sneco-brand-book v2.26
