# Barpi — Робоча пам'ять проекту

## Проект
**Barpi** (barpi.com.ua) — український бренд натуральних смаколиків (м'ясні + сирні) для собак і котів за запатентованою технологією SNECO.

Юридична особа: **ТОВ «ПЕТ КОРП»** · ЄДРПОУ 45519838 · м. Мукачево
Контакти: office@barpi.com.ua, +380633639658

Засновники: Вадим і Пилип Гришин (через snEco) + Олександр Аксьонов (ОД Barpi).

## Команда (Brand Book v7)
| Хто | Роль | Email |
|-----|------|-----------|
| Вадим | Маркетинг онлайн, digital, e-commerce | vg@abrisart.com |
| Олександр Аксьонов | ОД, мережі, продажі | — |
| Альона | SMM / SEO / партнери | alona@barpi.ua |
| Мар'яна | Регіональні продажі | maryana@barpi.ua |
| Пилип | Технологічний партнер (snEco) | fg@abrisart.com |

## Платформа
- **Brand Essence:** Турбота щодня
- **Головна фраза:** Турбота для справжніх друзів
- **Продуктова правда:** Один інгредієнт. Без зайвого.
- **Технологічний доказ:** Створено за запатентованою технологією SNECO

## SNECO технологія
- 34–38°C, до 99% видалення вологи, до 95% поживних
- 12 місяців без холодильника (0–30°C)
- ✅ «технологія SNECO» / «запатентована технологія»; ❌ NASA, ❌ космічний візуал

## Продукти
- **М'ясні (з субпродуктів):** пупочки, крекер (рубець), зефір (легені), безе (вим'я), печінка, хрустики (трахея), довгожуйка, серденька
- **Сирні:** сир кульки (Гауда), сир стіки (Сулугуні), сир 100г — для pet-food
- **Апетайзери (топпери):** рубець, печінка, легені — 80–120г
- **Котяча лінійка:** серденька + зефір
- **Формати:** міні 15/20г (~60 грн), великі 60/100г (~240 грн), сети 899/1399 грн

## Юридичний контур
- ТМ №383307 (08.04.2026 → 25.10.2034)
- ТУ У 10.9-45519838-001:2024
- r-UA-21-17 (потужність оператора)
- Сертифікат №ТЕР.1.Х.112-24 (⚠️ перевірити оновлення)
- Лаб-висновок №001636 н/24 від 14.10.2024
- Патент №160558

## Tone of Voice
**70% турбота / 30% дружба.** Як друг, який дбає.
**Заборонено:** «лікує», «найкращі», медичні обіцянки, «купуйте терміново», «м'ясні смаколики» (звужує — є сирна лінійка), «мікрохвильова технологія/сушка» у B2C (тільки «низькотемпературне вакуумне сушіння»), «космічні технології» як головний описувач (лише точково: «космічна якість», «натхнено підходами до збереження їжі для космічних місій»).

## Візуальна ідентичність (канон = Guideline 2026.1, синхр. з barpi.com.ua)
- Палітра: #FAF7F7 (фон беж-білий) · #333333 (текст) · #001154 (Barpi Navy — бренд-акцент) · #BAD9F4 (м'який блакитний — бейджі, CTA-фон, accent UI)
- Пропорції: 65–75% фон / 20–25% текст / 3–5% синій
- 10 SKU-кольорів (Product Accent) — маркери смаків, ніколи не у логотипі
- Шрифти: **Rubik** (Google Fonts) — основний цифровий (сайт, Bible, SMM, документи); **Qanelas Soft** — display (лого, упаковка, друк; файли у Drive)
- Лого: «barpi» + синя крапка над «i» + лапка; чорний/білий; не перефарбовувати під SKU
- ⚠️ ЗАСТАРІЛЕ (не використовувати як базу): #FAFAFA/#1A1A1A/#2F6FED і «Qanelas як єдиний шрифт» — це legacy з Brand Book v7 / SMM Doc 03 v1.2
- ❌ #FEBF27 (жовтий DreamCar) — не колір Barpi, прибрано з Bible UI 07.07.2026
- AI — лише для moodboard, НЕ для тварин/UGC

## Канали
- E-ZOO, MasterZoo, PetHouse, GooDwine (мережі)
- GaraPet, 13Cats, Darwin, Zooresort, Lapa, Miska, ZooPROStore, QuadroPets, ZooProfi
- barpi.com.ua (Хорошоп) + Instagram @barpi.ua

---

## Brand Bible — цей repo

**Live:** https://brand.barpi.ua (поточна версія v1.1, 28.05.2026)
**Repo:** github.com/dreamcarua/barpi-brand-book

### Інфраструктура (живе)

#### Cloudflare (account: ab63a85bdfbf5894c28efe7076acbd82, Vg@abrisart.com)
| Ресурс | Значення | Статус |
|---|---|---|
| GitHub Pages | brand.barpi.ua | ✅ Live |
| DNS CNAME | brand → dreamcarua.github.io | ✅ |
| D1 `barpi-bible` | `45c93052-c82c-4d0c-901b-2999187643b9` (WEUR) | ✅ schema + seed |
| KV `barpi-bible-acl` | `5d2685f414a14ff4ac050eea5b19bdcf` | ✅ створено |
| Worker `barpi-auth` | code у `barpi-auth/` | ⏳ deploy від vg |

#### Supabase (organization: dreamcar / moaoqclcxvwoewslpmoc)
| Ресурс | Значення | Статус |
|---|---|---|
| Project `barpi-hq` | `zrcqmwlpsggiqgipvxhv` (eu-central-1) | ✅ ACTIVE_HEALTHY |
| Project URL | https://zrcqmwlpsggiqgipvxhv.supabase.co | ✅ |
| DB size | 11 MB після seed | ✅ |
| Schema | 17 таблиць (users, desks, publications, …) | ✅ |
| RLS policies | усі таблиці + 5 ролей | ✅ |
| Seed | 5 users + 6 рубрик + 4 launches + 5 publications | ✅ |

### Деплоєні дашборди
| Що | URL | Стек |
|---|---|---|
| Brand Bible | brand.barpi.ua | GitHub Pages |
| Каталог дашбордів | brand.barpi.ua/dashboard/ | GitHub Pages |
| **Barpi HQ** (новий) | **brand.barpi.ua/dashboard/hq/** | Supabase + jsDelivr CDN |
| SMM Dashboard v1 | brand.barpi.ua/dashboard/smm/ | localStorage |
| Sales / Inventory / Partners / Events | /dashboard/{name}/ | placeholder |

### НЕ змінювати без обговорення
- «Турбота для справжніх друзів» — головна фраза
- «Один інгредієнт. Без зайвого.» — product truth
- 34–38°C — SNECO (не 24–26°C як snEco)
- Засновники: Вадим і Пилип **Гришин** + ОД Олександр Аксьонов
- ❌ NASA і космічний візуал
- ❌ «м'ясні смаколики» — правильно «натуральні» або «м'ясні і сирні»
- ❌ «космічні технології» як головний слоган/описувач — лише точково
- Транслітерація прізвища: **Hryshyn** (не Gryshyn); Пилип (не Філіп)
- Канон візуалу: Rubik + #001154/#BAD9F4 (Guideline 2026.1) — НЕ Qanelas-only, НЕ #2F6FED

## Пріоритети Q3 2026
1. SMM + UGC + Instagram (тепер з Barpi HQ)
2. B2B-дистрибуція
3. Сайт + e-commerce + SEO

## TODO для повного запуску (від vg)
- [ ] Google OAuth у Supabase barpi-hq → Auth → Providers → Google
- [ ] Telegram bot для Barpi: @barpi_team_bot через @BotFather → token у Edge Function secrets
- [ ] МойСклад API token → GitHub Secret `MOYSKLAD_TOKEN` для Sales/Inventory dashboards
- [ ] Resend domain barpi.ua + API key для Worker barpi-auth (Cloudflare)
- [ ] Wrangler deploy `barpi-auth` Worker
- [ ] Сертифікат відповідності №ТЕР.1.Х.112-24 — перевірити чи оновлений

## Уподобання Вадима
- Мова: українська · Дати: DD.MM.YYYY · Час зона: CET/CEST
- Структуровано, без води
- Дій сам через MCP/git/bash коли можеш
- Платні плани: Supabase free tier OK поки не виросло (2 active projects, 500MB DB, 1GB Storage)
