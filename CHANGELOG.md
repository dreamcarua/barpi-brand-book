# Barpi Brand Bible — Changelog

## v1.1.0 (28.05.2026) — 🚀 Barpi HQ live!

🎉 **Запуск Barpi HQ — повноцінної SMM-платформи** на основі DreamCar HQ.

### Barpi HQ (`/dashboard/hq/`)
- ✅ **Supabase проект `barpi-hq`** створено (id `zrcqmwlpsggiqgipvxhv`, eu-central-1)
- ✅ **Повна schema залита**: users, desks, desk_members, rubrics, launches, creatives, publications, publication_platforms/responsibles/approvers, creative_publications, publication_history, comments, publication_drafts, editing_sessions, notifications, notification_preferences, access_requests, user_vacations
- ✅ **Row-Level Security** policies для всіх таблиць (5 ролей: CEO/COO/lead/member/designer)
- ✅ **Seed:** 5 користувачів (Вадим, Пилип, Аксьонов, Альона, Мар'яна) + 6 рубрик Barpi + 4 запуски + 5 sample-публікацій
- ✅ **PWA**: manifest + service-worker (offline, push notifications)
- ✅ **Frontend**: SPA з jsDelivr CDN для всіх app-*.js модулів (60+ файлів автоматично через DreamCar HQ)
- ✅ **Brand-adapted**: DreamCar red → Barpi blue (#2F6FED), DreamCar → Barpi typography і копірайт

### Архітектура HQ
- **Backend**: Supabase Postgres + Auth + Realtime + Storage
- **Frontend**: vanilla JS SPA, lazy-loaded Supabase SDK
- **Auth**: Google OAuth (планується) + demo-mode (localStorage) поки що
- **Бібліотека модулів**: підвантажується з `cdn.jsdelivr.net/gh/dreamcarua/dreamcar-team@main/hq/` → автоматично отримуємо всі патчі DreamCar HQ

### Що нового vs v1.0
| v1.0 SMM Dashboard | v1.1 Barpi HQ |
|---|---|
| localStorage | Postgres у хмарі (Supabase) |
| тільки vg | 5 ролей + whitelist + RLS |
| одна вкладка | Календар (4 view) + Дошка + Бібліотека + Запуски |
| ручне введення | Soft-locks, audit log, comments, real-time |
| без auth | OAuth + Telegram login (планується) |
| статичний | PWA з offline |

### TODO для повного запуску (від vg)
1. Google OAuth у Supabase: Authentication → Providers → Google → enable
2. Створити Telegram bot через @BotFather → `dreamcar_team_bot` (адаптувати для Barpi) → додати token у Edge Function secrets
3. Налаштувати Realtime channels для presence

---

## v1.0.0 (28.05.2026) — MVP

🎉 **Перший продакшн-реліз Brand Bible Barpi.**

### Brand Bible (index.html)
- ✅ 18 розділів повністю наповнено (Brand Book v7 + 16 SMM-docs + ЦА)
- ✅ Маніфест, платформа, команда, SNECO, ToV (70/30), візуал, документи

### Dashboards v1
- ✅ SMM Dashboard (`/dashboard/smm/`) — Content Log + Weekly + Monthly + Stories + Reels + Direct + UGC + Partners + Pillars
- 🚧 Sales / Inventory / Partner / Events — скелети
- ✅ Каталог дашбордів (`/dashboard/`)

### Backend (Cloudflare)
- ✅ D1 `barpi-bible` + KV `barpi-bible-acl`
- ✅ Schema + seed (24 SKU, 16 партнерів, 17 подій)
- ⏳ Worker `barpi-auth` — code готовий, deploy від vg

### Документи
- ✅ `documents/README.md` + `01_Brand_Book_v7.md`
- ⏳ 16 SMM-docs + Guideline + KB — markdown готові локально

---

## v0.1.1 (27.05.2026) — Domain change
- CNAME `brand.barpi.com.ua` → `brand.barpi.ua`

## v0.1.0 (27.05.2026) — Bootstrap
- Створено repo `dreamcarua/barpi-brand-book`
- CLAUDE.md, BACKLOG, CHANGELOG, CNAME, кістяк index.html
- Прототип: dreamcarua/sneco-brand-book v2.26
