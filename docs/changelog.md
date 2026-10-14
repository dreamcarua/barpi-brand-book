# Barpi Brand Book — зміни поза git

Лише те, чого git не показує: правки в базі, налаштування зовнішніх сервісів, правила CDN, ручні запуски, тимчасові зміни. Остання колонка обов'язкова. Раз на квартал переносити в `docs/archive/<рік>-Q<n>.md`.

Продуктовий журнал релізів сайту й воркерів лишається в кореневому `CHANGELOG.md` — цей файл його не замінює і не дублює.

| Дата | Що змінилось | Як (скрипт / команда / UI) | Бекап / як відкотити |
|---|---|---|---|
| 10.10.2026 | PR з гілки `audit/2026-10-10-safe-fixes` (аудит 10.10.2026, НЕ змерджено, чекає власника): прибрано 5 прямих посилань Drive на прайс, КП мереж, тех-карти і PDF реквізитів (`partners/index.html` 71, 72, 91, 92; `documents/index.html` 61): замість них текст «за запитом / після авторизації» UK+EN; `architecture/index.html` 33: ТОВ тепер ліцензіат ТМ і патенту, а не власник; `ci.yml`: прибрано застарілий `--exclude-mail`, Lychee знову запускається (лишається `continue-on-error`); `robots.txt`: прибрано рядок `/kormotech/`. Самі файли на Drive лишаються доступними за посиланням: закриття доступу окрема дія поза git. | git, гілка + PR | не мерджити PR або `git revert` коміту злиття |
| 06.09.2026 | Воркер `barpi-api` о 10:54 UTC задеплоєно через script API повз репо — злетіли R2-біндинги `KBFILES` і `BACKUPS`, файли в Базі знань перестали додаватись і скачуватись. Живий CRUD `partner_pipeline` (від 04.09) перенесено в репо, воркер передеплоєно з `wrangler.toml`. Версія `dff0dac3`. | `npx wrangler deploy` у `cf-migration/workers/barpi-api` | попередня версія `6ba9f1e7` у `wrangler deployments list`, відкат через `wrangler rollback` |
| 03.09.2026 | Встановлено систему пам'яті агента v8 у гілку `memory-v8`: `AGENTS.md`, `docs/` (tasks, traps, tooling, architecture, decisions, personal, open-questions, changelog, handoff). Старий `CLAUDE.md` (130 рядків) скопійовано дослівно в `docs/archive/CLAUDE.md.03.09.2026.md`, новий `CLAUDE.md` — рядок `@AGENTS.md`. Жоден наявний файл не видалено і не скорочено. | git, гілка `memory-v8` | видалити гілку `memory-v8`; архівна копія `CLAUDE.md` лишається в `docs/archive/` |
| 07.06.2026 | Ротовано `SYNC_API_KEY` на воркері `barpi-sync` — старий ключ дає 403 | `wrangler secret put SYNC_API_KEY --name barpi-sync` | нового бекапу немає: ротація незворотна, старий ключ мертвий |
| 07.06.2026 | Ротовано / створено `API_AUTH_KEY` на воркері `barpi-api` | `wrangler secret put API_AUTH_KEY --name barpi-api` | те саме |
| 10.06.2026 | Prune `raw_json` у D1 (похідні таблиці >180 днів, `demand` >365): 368,6 → 335,5 МБ | SQL на D1 | D1 Time Travel (на той момент 30 днів) — вікно вже минуло |
| 10.06.2026 | Додано 10 індексів у D1 (25 → 37) + `ANALYZE` | SQL на D1 | `DROP INDEX` за іменами зі `CHANGELOG.md` v6.0 |
| 02.06.2026 | Увімкнено Cloudflare Access на `brand.barpi.ua/dashboard/*`, allowlist 5 email, сесія 30 днів | CF Dashboard UI (Zero Trust) | знімок політики — `cf-access-policy.json` (коміт `8ef8f4d0`) |
| 02.06.2026 | Supabase-проєкт переведено в паузу після переходу на D1 | Supabase Dashboard UI | реактивація з UI; станом на 07.07.2026 проєкту немає у списку |

<!-- Новий рядок додається В ТОЙ ЖЕ момент, коли зміну зроблено. Зміна без запису у цьому файлі невидима для наступної сесії. -->
