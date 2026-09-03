# Barpi Brand Book — відкриті задачі

Оновлено: 03.09.2026
Трекер: немає (GitHub Issues порожні станом на 03.09.2026). Джерела рядків нижче: `BACKLOG.md` (07.07.2026), `PRIORITIZED_BACKLOG.md` (07.07.2026), `AUDIT_REPORT_2026-06-12.md`, `CHANGELOG.md`, `DEPLOY_NOTES.md`, коментарі у воркфлоу. Формулювання — цитатами з цих файлів; статуси там не переписані.

🔴 ламає продакшн · 🟡 незакінчений хвіст · ⚪ у черзі · ⏸ чекає рішення людини

## 🔴 Ламає продакшн

- **Злити гілку `memory-v8`** — установка системи пам'яті v8 (03.09.2026). Наступний крок: подивитися diff `main...memory-v8`, змерджити, видалити гілку. До злиття `AGENTS.md` і `docs/` не читаються сесіями, що працюють з `main`.
- **Живий воркер `barpi-api` старіший за копію в репо** — `PRIORITIZED_BACKLOG.md`, P1-2: «✅ у repo / 🔧 **live воркер = стара версія (`demand_rows:2110`), треба redeploy**». Наслідок: `/healthz` витікає лічильники, `X-Query-Failed` витікає SQL-помилки, гейт на PII-ресурси не активний. Наступний крок: `wrangler deploy` з `cf-migration/workers/barpi-api/` на Mac + `curl /healthz` (`RUNBOOK.md` §1).

## 🟡 Хвости — почато, не закінчено

- **P0-1 PII через Origin-spoof** — код закрито, live не закрито. `AUDIT_REPORT_2026-06-12.md`: «ПОТРІБНО ВІД VG щоб фікс став LIVE (інакше витік триває)». Наступний крок: новий CF API token → роут `api.barpi.ua` за CF Access → `ACCESS_AUD` у `wrangler.toml` → деплой → `ENFORCE_SENSITIVE=1` → перепідключити дашборди на новий хост.
- **P1-1 security-заголовки** — `PRIORITIZED_BACKLOG.md`: «🔧 ruleset готовий + workflow активний → треба CF_API_TOKEN». Наступний крок: поставити `CF_API_TOKEN` і `CF_ZONE_ID`, тоді `gh workflow run deploy-cf-headers.yml -R dreamcarua/barpi-brand-book`.
- **Автодеплой воркерів вимкнено** — коментар у `.github/workflows/deploy-workers.yml` (19.08.2026): «push-тригер вимкнено — repo secrets CF_API_TOKEN / CF_ACCOUNT_ID не налаштовані». Наступний крок: після появи секретів повернути блок `push: paths: ['cf-migration/workers/**']`.
- **Воркер `barpi-auth` не задеплоєний** — `BACKLOG.md`: «⏳ **TODO Worker deploy**: `cd barpi-auth && npx wrangler deploy` (від vg)», плюс «TODO Worker secrets: `wrangler secret put JWT_SECRET` + `RESEND_API_KEY`» і «TODO Worker route: `auth.barpi.ua` CNAME». Наступний крок: рішення власника, чи цей контур ще потрібен після переходу на CF Access (див. `docs/open-questions.md`).
- **`processing_acts.materials_sum_uah`** — `CHANGELOG.md` v6.0: «~15K ₴ stale vs live view computed (cache update needs D1 CPU budget > 30s — defer)». Наступний крок: синкати позиції supplies (`expand=positions.assortment`) → середня закупівельна ціна → JOIN у `v_production_efficiency`; оцінка ~3 год.
- **P2-9 Supabase `barpi-hq` — мертвий контур** — `PRIORITIZED_BACKLOG.md`: «підтверджено: у списку проектів лише dreamcar-hq; barpi-hq зник/paused. Data-контур = D1. Прибрати згадки Supabase з CLAUDE.md або реактивувати». Наступний крок: прибрати Supabase-згадки з `DEPLOY_NOTES.md` і `supabase/functions/telegram-bot/README.md` (в архівному `CLAUDE.md` лишити як є).
- **Telegram bot Barpi не заведений** — `CLAUDE.md` (архів): «Telegram bot для Barpi: @barpi_team_bot через @BotFather → token у Edge Function secrets»; `DEPLOY_NOTES.md` описує повний порядок. Наступний крок: рішення, чи бот живе в Supabase, чи переїжджає на Cloudflare разом з рештою.
- **`supabase/functions/telegram-bot/README.md:77` — «## TODO (наступні ітерації)»** — єдиний TODO у коді репо. Наступний крок: перечитати список після рішення по контуру бота.

## ⚪ Черга

Контент (з `BACKLOG.md`, «Brand-аудит 07.07.2026 — залишок»):

- **P1** «/photo/ — розширити з Doc 05: shot-list, світло, кропи 4:5/9:16, приклади ДО/ПІСЛЯ» — частково зроблено комітом `4acedbf`; наступний крок: звірити, чого бракує проти Doc 05/06.
- **P1** «/digital/ — розширити з Doc 08/09: рубрики тижня, 3 приклади caption, hashtag-політика» — частково зроблено тим самим комітом; наступний крок: те саме звіряння.
- **P2** «/downloads/ + /fonts/ — файли з Google Drive → R2/repo (версії, права, швидкість); зараз 25+ лінків на Drive». Наступний крок: перелити файли в R2 і замінити посилання.
- **P2** «favicon.ico (реальний .ico; зараз 15 сторінок лінкують на неіснуючий) + замінити og-image лінки після генерації PNG» — закрито комітами `c112637` і `01d41d3`; наступний крок: підтвердити й прибрати рядок з `BACKLOG.md`.
- **P2** «Qanelas Soft — перевірити комерційну ліцензію (файли з Drive; для друку/упаковки)». Наступний крок: знайти документ ліцензії, покласти посилання у `/fonts/`.
- **P3** «/logo/ — наповнити майстер-файлами SVG/PNG (зараз порожня папка з .gitkeep)».
- **P3** «EN-експорт: standalone EN-landing для ЄС-партнерів (зараз перемикач UK/EN)».
- **P3** «розділ «Заборонені прийоми» у /visual/: приклади поганих макетів (антиприклади)» — частково зроблено комітом `b892924` (Do/Don't); наступний крок: добрати антиприклади макетів.

Документи (з `BACKLOG.md`, «Поетапні дрібні задачі»):

- «`02_Guideline_Logo_Visual_Style.md`, `03_Knowledge_Base_2026.md`, `04_Target_Audience.md`, `05_Customer_Journey_Map.md` (готові локально)» + «`smm/01_Brand_Basics.md` … `16_Crisis_Communication.md` (16 готових локально)». Наступний крок: файли є лише на машині власника — попросити і закомітити в `documents/`.
- «Юридичні PDF: TM_383307, TU, certificate, lab_001636, patent_160558». Наступний крок: залити у `documents/`.
- «Завантажити логотипи (AI / SVG / PNG) у `logo/`», «Qanelas у `fonts/`», «дизайни упаковки у `packaging/`».

Дашборди й дані (з `BACKLOG.md`, «Фаза 4»):

- «Partner Pipeline: ручне ведення pipeline у dashboard з збереженням у D1», «Events Dashboard: трекінг фактів проведення (бюджет, зразки, UGC)», «Inventory Dashboard з реальними даними» (`DEPLOY_NOTES.md`).
- «Xорошоп webhook → sales_daily (авто-імпорт D2C продажів)» (`DEPLOY_NOTES.md`).
- «Hot reload публікацій з HQ → Telegram (авто-сповіщення про нові заплановані пости)» (`DEPLOY_NOTES.md`).

Технічний борг (з `PRIORITIZED_BACKLOG.md`):

- P2-1 «Rubik @import render-blocking» — 7→5 ваг зроблено, self-host у черзі.
- P2-3 «Logo base64 inline у bb.js» — винести у файл.
- P2-5 «barpi-sync GET / публічний» — віддає `sync_state` і `last_error` без ключа; закрити key-gate.
- P2-6 «barpi-api без rate-limit» — правило Cloudflare.
- P2-7 «Дашборди empty/error/stale UX».
- P2-8 «Lighthouse budget gate в CI».
- P3-3 «favicon крос-доменний», P3-4 «Підсторінки: бідний `<head>`», P3-5 «EN-повнота для ЄС-партнерів», P3-6 «downloads/logo/fonts/packaging — .gitkeep».

Моніторинг (з `BACKLOG.md`):

- «**Сертифікат відповідності №ТЕР.1.Х.112-24 діяв до 10.10.2025 — перевірити чи оновлено**». Наступний крок: запит Пилипу/Олександру, оновити `/documents/`.
- «Brand Book v7 / KB 2026 кажуть «м'ясні смаколики» — оновити у новій ітерації на «натуральні (м'ясні + сирні)»».

## ⏸ Чекає рішення людини

| Задача | Чому чекає | Чиє рішення | З якої дати |
|---|---|---|---|
| Поставити CF-секрети в репо | без них не працюють `deploy-cf-headers` і `deploy-workers`, а P0-1 і P1-1 не закриваються | Вадим | 12.06.2026 |
| Підключити канал звітів у Telegram | у репо немає жодного секрета; воркфлоу без них падає з порожньою змінною | Вадим | 03.09.2026 |
| P1-5 чистка git-історії від `SYNC_API_KEY` | `bfg --replace-text` руйнівний для всіх клонів; ключ уже ротовано | Вадим | 07.06.2026 |
| P1-6 звірити CF Access allowlist з `cf-access-policy.json` | source of truth — CF Dashboard UI, агент туди не ходить | Вадим | 12.06.2026 |
| Доля контуру `barpi-auth` і Supabase `barpi-hq` | дублює CF Access; тримати обидва — платити двічі увагою | Вадим | 07.07.2026 |
| Чи прибирати ідентифікатори Cloudflare/Supabase з публічного репо | вони вже опубліковані в `CLAUDE.md`, `RUNBOOK.md`, `wrangler.toml` | Вадим | 03.09.2026 |

Команди для двох перших рядків (значення підставити самому, `--body` обов'язковий — без нього `gh secret set` чекає вставки і Enter записує порожній секрет):

```
gh secret set CF_API_TOKEN  -R dreamcarua/barpi-brand-book --body "<значення>"
gh secret set CF_ACCOUNT_ID -R dreamcarua/barpi-brand-book --body "<значення>"
gh secret set CF_ZONE_ID    -R dreamcarua/barpi-brand-book --body "<значення>"
gh secret set TG_BOT_TOKEN  -R dreamcarua/barpi-brand-book --body "<значення>"
gh secret set TG_CHAT_ID    -R dreamcarua/barpi-brand-book --body "<значення>"
```

<!--
Правила (див. AGENTS.md → Entry/Exit):
- Задача записується в момент отримання, дослівно, з іменем автора.
- Кожен рядок — наступна конкретна дія, а не назва проблеми.
- Рядок видаляється, коли підтвердив автор, а не коли роботу зроблено. Видаляється, не закреслюється.
- Розділи за терміновістю, не за темою.
- Понад ~80 рядків — сигнал, що незакінчене накопичується, а не привід ділити файл.
-->
