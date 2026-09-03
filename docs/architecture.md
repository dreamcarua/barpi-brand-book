# Barpi Brand Book — пам'ять про будову

Не опис коду (код це показує), а те, чого з коду не видно: хто джерело правди, що куди перезаписується, чим запускаються регулярні процеси, де шукати логи.

## Джерела правди

| Дані | Джерело правди | НЕ редагувати в | Примітка |
|---|---|---|---|
| Товари, SKU, залишки | МойСклад | D1 (`moysklad_*`, `stock_by_store`) | D1 — read-only кеш, синк переливає щогодини |
| Продажі, оплати, повернення, списання | МойСклад (`demand`, `paymentin`, `paymentout`, `salesreturn`, `loss`) | D1 | клієнт скаржиться на суму → дивитись у МойСклад, не в дашборд |
| Контрагенти, PII (ПІБ, телефон, email) | МойСклад | D1 (`moysklad_counterparties`) | видалення за GDPR — у двох місцях, `RUNBOOK.md` §9 |
| Собівартість і виробництво | МойСклад (`processing`, `supply`) | D1 | `materials_sum_uah` неповний — брати в'ю `v_sku_cost` |
| Ідеї, партнерський пайплайн, події, База знань, алерти | D1 (`brand_ideas`, `partner_pipeline`, `events`, `kb_*`, `alerts`) | — | цих сутностей у МойСклад немає, синк їх не чіпає |
| Вкладення Бази знань | R2 `barpi-kb-files` | — | у D1 лише метадані `kb_files`; видалення м'яке, об'єкт у R2 лишається |
| Список доступів до `/dashboard/*` | Cloudflare Access (UI) | `cf-access-policy.json` | JSON — знімок для аудиту, не конфіг |
| Контент Brand Bible | цей репо (`<розділ>/index.html`) | — | пуш у `main` → GitHub Pages за ~30 с |
| Бренд-канон (фрази, палітра, шрифти) | Guideline 2026.1 + `docs/archive/CLAUDE.md.03.09.2026.md` | — | Brand Book v7 і SMM Doc 03 v1.2 — legacy, не база |

## Що куди перезаписується

| Поле / таблиця | Ким пишеться | Ким перезаписується | Примітка |
|---|---|---|---|
| `moysklad_*` у D1 | воркер `barpi-sync` (годинний cron) | ним самим, за курсором `sync_state.last_moment` | будь-яка ручна правка зникає за годину |
| `sales_sku` | `rebuildSalesSku()` | інкрементально щогодини; повністю раз на добу о 03:00 UTC або `?full=1` | денормалізація демандів по SKU |
| `sync_state` | `barpi-sync` після кожної сутності | — | `last_error` непорожній = синк упав; курсор `NULL` = наступний прогін повний |
| `alerts` | генератори правил у `barpi-api.scheduled()` | щотижневим прогоном | 5 правил: margin_negative, margin_low, low_stock, sync_error, churn_risk |
| `_backups` | `barpi-api.scheduled()` щонеділі | ретеншен 12 тижнів | дублюється в R2 `barpi-backups` |
| `assets/og-image.png` | воркфлоу `og-image.yml` з `og.svg` | кожним пушем `og.svg` | правити SVG, PNG затреться |
| файли з `patches/*.patch` | воркфлоу `apply-patch.yml` | застосовує і **видаляє** патч, комітить від `barpi-bot` | патч у репо не лишається |
| security-заголовки зони | воркфлоу `deploy-cf-headers.yml` (PUT на ruleset entrypoint) | повністю замінює entrypoint-ruleset | це PUT, не PATCH: усе, чого немає у JSON, зникає |

## Канали запуску регулярних процесів

| Процес | Канал 1 | Канал 2 | Який головний |
|---|---|---|---|
| Синхронізація МойСклад → D1 | Cron Trigger воркера `barpi-sync`, `0 * * * *` | `POST /sync?key=…` вручну (`&only=`, `&all=1`, `&full=1`) | cron; ручний — для розслідування |
| Повний ребілд `sales_sku` | той самий cron, гілка «година = 03 UTC» | `?full=1` | cron |
| Тижневий бекап D1 + регенерація алертів | Cron Trigger воркера `barpi-api`, `0 4 * * SUN` | `POST /alerts/run`, `GET /export?all=1` (адмін-ключ) | cron |
| Публікація сайту | push у `main` → GitHub Pages | — | єдиний |
| Рендер og-image | push `og.svg` → `og-image.yml` | `workflow_dispatch` | push |
| Застосування патчів контенту | push `patches/*.patch` → `apply-patch.yml` | `workflow_dispatch` | push |
| Деплой воркерів | `wrangler` з Mac | `workflow_dispatch` `deploy-workers.yml` (потребує секретів, зараз не працює) | wrangler |
| Деплой security-заголовків | push `cloudflare/response-headers-ruleset.json` | `workflow_dispatch` | push (потребує секретів) |
| CI (gitleaks, HTMLHint, lychee, `node --check`) | push і PR у `main` | — | єдиний |

## Володіння

| Ресурс | Власник | Хто ще змінює | Що можна агенту |
|---|---|---|---|
| Репозиторій, GitHub Pages | Вадим | воркфлоу від імені `barpi-bot` | гілки, PR, коміти в контент |
| Cloudflare акаунт (Workers, D1, R2, KV, Access) | Вадим | — | читати; деплой і зміни — з дозволу |
| МойСклад | Олександр Аксьонов (операційка), Пилип (фінанси) | — | тільки читання через `barpi-sync` |
| Домен `barpi.ua` і DNS | Вадим | — | нічого без дозволу |

## Межі даних

| Канал | Видимість | Може нести | Не має нести |
|---|---|---|---|
| Репозиторій | публічний | контент бренду, код, id ресурсів (вже опубліковані) | значення токенів, chat id, телефони клієнтів, вивантаження контрагентів |
| `brand.barpi.ua` (корінь) | публічний | Brand Bible | будь-які дані клієнтів |
| `brand.barpi.ua/dashboard/*` | CF Access, 5 email | продажі, маржа, контрагенти | — |
| Воркер `barpi-api` | публічний URL | неперсональні агрегати за `Origin` | PII і фінанси — лише за верифікованим JWT або `X-API-Key` |
| `barpi-sync` `GET /` | публічний | статус | `sync_state` і `last_error` видно без ключа — відкритий пункт P2-5 |

## Логи — де опиняється який збій

| Джерело | Місце | Що там є | Чого там НЕ буде |
|---|---|---|---|
| Воркери `barpi-api`, `barpi-sync` | `wrangler tail <name>` (live), Cloudflare Workers logs | помилки виконання, статуси | ретроспектива глибше 7 днів — логи не експортуються |
| Синхронізація | таблиця `sync_state` у D1 (`last_synced_at`, `rows_synced`, `last_error`) | остання помилка на сутність | історія помилок — лише остання перезаписується |
| Ручний прогін синку | JSON-відповідь `POST /sync` (`results`, `errors`, `skipped`) | що синкнулось, що пропущено як «recent» | нічого не зберігається, читати одразу |
| GitHub Actions | `gh run list`, `gh run view <id> --log` | CI, og-image, apply-patch, деплої | воркфлоу, що не стартував (YAML-помилка), логів кроків не має |
| GitHub Pages | ран `pages-build-deployment` | збірка і публікація | помилки в JS сторінки — тільки в консолі браузера |
| Cloudflare Access | Audit Log у CF Dashboard | входи, зміни політик | у репо нічого |

## Запасні шляхи

| Дія | Основний | Запасний | Коли знадобився |
|---|---|---|---|
| Деплой воркера | `wrangler deploy` з Mac | `curl -X PUT` на Workers API з `metadata.json` (`RUNBOOK.md` §1) | коли немає wrangler |
| Відновлення D1 | D1 Time Travel (30 днів) | JSON з R2 `barpi-backups`, або повний ре-синк із МойСклад (~10 хв) | `RUNBOOK.md` §4 |
| Відкат воркера | redeploy з `backup-*.raw` | попередній коміт у репо (перевір, чи не старіший за живий) | 12.06.2026 |
| Правка контенту без агента | GitHub UI, олівець на `index.html` | — | `RUNBOOK.md` §7 |
