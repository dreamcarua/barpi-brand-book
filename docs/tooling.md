# Barpi Brand Book — інструменти, доступи, звіти

Читати перед використанням будь-якого інструмента, MCP, воркера чи акаунта цього проєкту.
Значень секретів тут немає і не буде — лише **де вони лежать**. Репозиторій публічний.
Конкретні URL, id ресурсів і команди з реальними хостами — у `RUNBOOK.md` і `SECURITY.md`, вони вже в репо.

## Інструменти і конектори

| Інструмент / MCP | Для чого | Як зайти | Особливості |
|---|---|---|---|
| GitHub MCP / `gh` CLI | читати й писати цей репо з будь-якого чату | у Cowork авторизовано; на Mac `gh auth status` | пуш через `push_files` — один коміт на одну логічну зміну; GitHub MCP не вміє видаляти файли |
| Desktop Commander (Mac) | shell, wrangler, git, локальні файли | тека має бути підключена в Cowork | кожен виклик — новий shell; `rm` тільки з дозволу |
| Cloudflare MCP / `wrangler` | Workers, D1, R2, KV | `CLOUDFLARE_API_TOKEN` в оточенні власника | робочий шлях деплою воркерів — wrangler на Mac, не GitHub Actions (див. пастки) |
| МойСклад REST API | джерело правди для товарів і продажів | тільки через воркер `barpi-sync`; токен — секрет воркера | ліміт запитів; сторінка 100 рядків; агент не пише в МойСклад |
| Cloudflare Access | гейт на `/dashboard/*` | allowlist із 5 email, сесія 30 днів | source of truth — CF Dashboard UI; знімок у `cf-access-policy.json` |
| Supabase MCP | історичний контур `barpi-hq` | — | ⚠️ проєкт зник/paused (P2-9). Дані живуть у D1, не в Supabase |

## Ідентифікатори (не секрети)

Значення лежать у файлах, які вже є в репо — не дублюємо їх тут:

| Що | Де взяти |
|---|---|
| Cloudflare account id, D1 `barpi-bible` id | `cf-migration/workers/*/wrangler.toml`, `docs/archive/CLAUDE.md.03.09.2026.md` |
| KV `barpi-bible-acl` | `docs/archive/CLAUDE.md.03.09.2026.md` |
| R2 бакети `barpi-backups` (щотижневі бекапи), `barpi-kb-files` (вкладення Бази знань) | `cf-migration/workers/barpi-api/wrangler.toml` |
| URL воркерів, CF Access app/policy id | `RUNBOOK.md` |
| Supabase project ref (історичний) | `DEPLOY_NOTES.md` |

## Секрети — тільки назви і місце зберігання

| Назва | Де живе | Хто ротує |
|---|---|---|
| `MOYSKLAD_TOKEN` | wrangler secret воркера `barpi-sync` | власник |
| `SYNC_API_KEY` | wrangler secret воркера `barpi-sync` | власник |
| `API_AUTH_KEY` | wrangler secret воркера `barpi-api` | власник |
| `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_ZONE_ID` | згадані у `.github/workflows/*.yml`, але **у GitHub-секретах репо їх немає** (`gh secret list` порожній станом на 03.09.2026) | власник |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Supabase Functions → Secrets (історичний контур telegram-bot) | власник |
| `JWT_SECRET`, `RESEND_API_KEY` | заплановані секрети воркера `barpi-auth` (ще не задеплоєний) | власник |

Порядок ротації кожного — `SECURITY.md`. Інвентар з датами останньої ротації — там само.

## Патерни входу — як тут реально роблять повторювані дії

| Дія | Кроки | Запасний шлях |
|---|---|---|
| Задеплоїти воркер (`barpi-api`, `barpi-sync`) | зробити бекап поточної версії через CF API → `wrangler deploy` з теки `cf-migration/workers/<name>/` на Mac → smoke-тест `/healthz` (`RUNBOOK.md` §1) | `gh workflow run deploy-workers.yml` — але спершу треба поставити `CF_API_TOKEN` і `CF_ACCOUNT_ID` |
| Оновити security-headers | правка `cloudflare/response-headers-ruleset.json` → пуш у `main` запускає `deploy-cf-headers.yml` | `curl -X PUT` на ruleset endpoint (`RUNBOOK.md`, той самий JSON) |
| Застосувати патч до контенту | покласти `.patch` у теку `patches/` і запушити в `main` → воркфлоу `apply-patch.yml` застосує, видалить файл і закомітить від імені `barpi-bot` | застосувати `git apply` локально і закомітити самому |
| Перегенерувати og-image | правка `og.svg` → `og-image.yml` рендерить `assets/og-image.png` і комітить | `rsvg-convert -w 1200 -h 630 og.svg` локально |
| Ручний запуск синхронізації | `POST /sync?key=<SYNC_API_KEY>&only=<entity>&all=1` на воркер `barpi-sync` (`RUNBOOK.md` §0, §3) | почекати годинний cron |
| Повний ребілд `sales_sku` | той самий запит із `&full=1`; сам по собі раз на добу о 03:00 UTC | скинути курсор: `UPDATE sync_state SET last_moment=NULL WHERE entity='sales_sku'` |
| Опублікувати зміну сайту | коміт у `main` → GitHub Pages деплоїть за ~30 с на brand.barpi.ua | — |
| Дати не-інженеру правити розділ | GitHub collaborator (Write) + інструкція з `RUNBOOK.md` §7 | — |
| Бекап / відновлення D1 | щонеділі 04:00 UTC `barpi-api.scheduled()` пише знімок у таблицю `_backups` і в R2 `barpi-backups` | D1 Time Travel до 30 днів (`RUNBOOK.md` §4) |

## База знань і файли

`/dashboard/knowledge/` — База знань за чек-листом SC Consulting (з 19.08.2026). Питання й відповіді — таблиці `kb_questions`, `kb_answers`, `kb_question_state` у D1; вкладення — R2-бакет `barpi-kb-files` через `POST /kb_files` воркера `barpi-api`. Видалення файлу — м'яке: рядок позначається `deleted=1`, об'єкт у R2 лишається. Відповіді рендеряться як Markdown (marked + DOMPurify) з 02.09.2026.

## Reporting — канал звітів

**Станом на 03.09.2026 канал не підключений.** У репо немає жодного GitHub-секрета (`gh secret list -R dreamcarua/barpi-brand-book` порожній), тому воркфлоу `report-to-telegram.yml` не створювався: він упав би з порожньою змінною.

Що є натомість: Edge Function `telegram-bot` у Supabase (`supabase/functions/telegram-bot/`) — вона приймає команди від людей (`/sale`, `/stats`, `/publications`), а не надсилає звіти агента, і живе в контурі `barpi-hq`, який зараз під питанням (P2-9).

Щоб увімкнути канал: поставити два секрети (команди — у `docs/tasks.md`, розділ ⏸), після чого додати `.github/workflows/report-to-telegram.yml` за шаблоном A.8 набору memory-kit і `reports/README.md`. До того момент Exit-звіт віддається у відповіді користувачу і рядком у `docs/tasks.md`.

## Межі — чого агент свідомо не робить

| Дія | Хто робить | Чому не агент |
|---|---|---|
| Змінити видимість репозиторію | власник | незворотно за секунди, репо публічне і живий сайт |
| Будь-який платіж, апгрейд тарифу | власник | завжди |
| Ротувати ключ у зовнішньому сервісі (Cloudflare, МойСклад) | власник | наслідки для інших систем не видно з цього репо |
| Правити дані в МойСклад | Олександр Аксьонов | це джерело правди для грошей |
| Переписати git-історію (`bfg`) | власник | руйнівно для всіх клонів |
