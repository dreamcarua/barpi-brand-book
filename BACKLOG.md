# Barpi Brand Bible — Backlog

## 🔥 Brand-аудит 07.07.2026 — залишок (P1→P3)
- [ ] **P1** /photo/ — розширити з Doc 05: shot-list, світло, кропи 4:5/9:16, приклади ДО/ПІСЛЯ
- [ ] **P1** /digital/ — розширити з Doc 08/09: рубрики тижня, 3 приклади caption, hashtag-політика
- [ ] **P2** /downloads/ + /fonts/ — файли з Google Drive → R2/repo (версії, права, швидкість); зараз 25+ лінків на Drive
- [ ] **P2** favicon.ico (реальний .ico; зараз 15 сторінок лінкують на неіснуючий) + замінити og-image лінки після генерації PNG
- [ ] **P2** Qanelas Soft — перевірити комерційну ліцензію (файли з Drive; для друку/упаковки)
- [ ] **P3** /logo/ — наповнити майстер-файлами SVG/PNG (зараз порожня папка з .gitkeep)
- [ ] **P3** EN-експорт: standalone EN-landing для ЄС-партнерів (зараз перемикач UK/EN)
- [ ] **P3** розділ «Заборонені прийоми» у /visual/: приклади поганих макетів (антиприклади)

> **Поточний статус:** v1.0 MVP (28.05.2026). Live: https://brand.barpi.ua

## ✅ Зроблено — Фаза 1: Brand Bible HTML v1.0

**Розділи index.html (18, наповнені реальним контентом):**
- ✅ 01 Маніфест
- ✅ 02 Про бренд (місія, бачення, цінності, 10 сегментів ЦА)
- ✅ 03 Команда & оргструктура (Аксьонов, Вадим, Альона, Мар'яна)
- ✅ 04 Історія & SNECO (34–38°C, 99% вологи, 95% поживних)
- ✅ 05 Меседжі & слогани + claims library
- ✅ 06 Візуальна система (лого, кольори, Qanelas, SKU-палітра)
- ✅ 07 Голос бренду (70/30)
- ✅ 08 Фотографія
- ✅ 09 Digital · Instagram · Reels (пілари, формати UGC)
- ✅ 10 Упаковка (24 SKU)
- ✅ 11 Партнери & Sales playbook (канали, фестивалі, дерево заперечень)
- ✅ 12 PR & криза
- ✅ 13 Touchpoints
- ✅ 14 Документи (ТМ, ТУ, патент, сертифікат, лаб)
- ✅ 15 Roadmap Q3 2026
- ✅ 16 Maintenance & versioning
- ✅ 17 Sec-dashboard каталог
- ✅ 18 Архітектура бренду

## ✅ Зроблено — Фаза 2: Інфраструктура
- ✅ DNS `brand.barpi.ua` → GitHub Pages (Cloudflare CNAME)
- ✅ HTTPS через Cloudflare
- ✅ Cloudflare D1 `barpi-bible` створено + schema + seed (SKU + partners + events)
- ✅ Cloudflare KV `barpi-bible-acl` створено
- ✅ Cloudflare Worker `barpi-auth` — code готовий у repo
- ⏳ **TODO Worker deploy**: `cd barpi-auth && npx wrangler deploy` (від vg)
- ⏳ **TODO Resend**: верифікувати домен `barpi.ua` + API key → wrangler secret
- ⏳ **TODO Worker secrets**: `wrangler secret put JWT_SECRET` + `RESEND_API_KEY`
- ⏳ **TODO Worker route**: `auth.barpi.ua` CNAME → `<account>.workers.dev`

## ✅ Зроблено — Фаза 3: SMM Dashboard
- ✅ Standalone HTML з повним функціоналом
- ✅ Content Log + Weekly + Monthly + Stories + Reels + Direct + UGC + Partners + Pillars
- ✅ KPI grid, розподіл за форматами і піларами, план vs факт
- ✅ Зберігання у localStorage (V2 → D1 через Worker API)

## 🟡 Поточне — Фаза 4: Дашборди продажів і операційки

### Заплановано (потребує МойСклад API token):
- [ ] **Sales Dashboard**: підключення МойСклад → D1 `sales_daily`
- [ ] **Inventory Dashboard**: МойСклад `/stock/all` → D1 `inventory_snapshot`
- [ ] **Partner Pipeline**: ручне ведення pipeline у dashboard з збереженням у D1
- [ ] **Events Dashboard**: трекінг фактів проведення (бюджет, зразки, UGC)
- [ ] GitHub Actions cron щодня → D1 (форк `moysklad_sync.py` зі snEco)
- [ ] Worker endpoints `/api/dashboard/{name}/data` з OTP-gate

### Що від vg:
- [ ] МойСклад API token → GitHub Secret `MOYSKLAD_TOKEN`
- [ ] Resend API key → wrangler secret `RESEND_API_KEY`

## ⚪ Фаза 5: Каталог + експорт + EN
- [ ] Sec-dashboard каталог — інтерактивні картки у Brand Bible
- [ ] EN-перемикач (ЄС-партнери)
- [ ] Maintenance UI для whitelist (через admin endpoint Worker)

## 📝 Поетапні дрібні задачі

### Документи (documents/)
- ✅ `README.md` — індекс
- ✅ `01_Brand_Book_v7.md` — повний markdown
- [ ] `02_Guideline_Logo_Visual_Style.md` (готовий локально, треба пушити)
- [ ] `03_Knowledge_Base_2026.md` (готовий локально)
- [ ] `04_Target_Audience.md` (готовий локально)
- [ ] `05_Customer_Journey_Map.md` (готовий локально)
- [ ] `smm/01_Brand_Basics.md` … `16_Crisis_Communication.md` (16 готових локально)
- [ ] Юридичні PDF: TM_383307, TU, certificate, lab_001636, patent_160558

### Logo / Fonts / Packaging
- [ ] Завантажити логотипи (AI / SVG / PNG) у `logo/` (4 варіанти × 3 формати)
- [ ] Завантажити Qanelas у `fonts/`
- [ ] Завантажити дизайни упаковки у `packaging/`

## ⚠️ Моніторинг
- [ ] **Сертифікат відповідності №ТЕР.1.Х.112-24 діяв до 10.10.2025 — перевірити чи оновлено**
- [ ] Brand Book v7 / KB 2026 кажуть «м'ясні смаколики» — оновити у новій ітерації на «натуральні (м'ясні + сирні)»
- [ ] Інтеграція з МойСклад — після того як буде надано API token

## 🎯 Що це дає

| Файл / резурс | URL | Стан |
|---|---|---|
| Brand Bible (live) | https://brand.barpi.ua | ✅ Live |
| Brand Bible (GitHub Pages) | https://dreamcarua.github.io/barpi-brand-book/ | ✅ Live |
| Repo | https://github.com/dreamcarua/barpi-brand-book | ✅ Public |
| SMM Dashboard | https://brand.barpi.ua/dashboard/smm/ | ✅ Live (localStorage) |
| Sales / Inventory / Partners / Events | https://brand.barpi.ua/dashboard/{name}/ | 🚧 Скелет |
| Cloudflare D1 | `barpi-bible` (WEUR) | ✅ Створено + seed |
| Cloudflare KV | `barpi-bible-acl` | ✅ Створено |
| Worker barpi-auth | code у repo | ⏳ Deploy від vg |
