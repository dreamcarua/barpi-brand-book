# barpi-deck

Cloudflare Worker — закриті паролем сторінки Barpi.

| Сторінка | Адреса | Пароль | Для кого |
|---|---|---|---|
| Інвестиційна презентація | https://brand.barpi.ua/deck | `DECK_PASSWORD` | покупець частки після NDA |
| Відповіді на чек-лист SC Consulting, 48 пунктів | https://brand.barpi.ua/checklist | `CHECKLIST_PASSWORD` | консультанти з супроводу угоди |
| База знань, 48 напрямів | https://brand.barpi.ua/kb | `KB_PASSWORD` | той, кому дозволено читати і правити базу |

Паролі і сесії роздільні: пароль від однієї сторінки не відкриває іншу.
Додати сторінку = один запис у `PAGES` в `src/index.js`, один секрет і один файл у R2.

## Чому саме так

`brand.barpi.ua` віддається з GitHub Pages, а репозиторій **публічний**. Тому сама
презентація ніколи не потрапляє в цей репозиторій — вона лежить у приватному R2-бакеті
`barpi-deck`, а воркер віддає її лише після перевірки пароля. У Git тут тільки код гейта.

CF Access на `/dashboard/*` не підходить: він працює за списком email з одноразовим кодом,
а зовнішньому інвестору потрібне просте «посилання + пароль».

## Маршрути

| Метод | Шлях | Що робить |
|---|---|---|
| GET | `/deck`, `/checklist`, `/kb` | є сесія — віддає сторінку з R2; немає — форма пароля |
| POST | `/deck`, `/checklist`, `/kb` | перевіряє пароль, ставить підписану cookie, редірект назад |
| GET | `/deck/pdf` | PDF-дубль презентації, тільки з сесією |
| GET | `/deck/exit`, `/checklist/exit`, `/kb/exit` | стирає сесію цієї сторінки |

## Як влаштований захист

- Cookie (`barpi_deck` / `barpi_chk`) = `<exp>.<HMAC-SHA256(exp, SESSION_SECRET)>` — сесія на 30 днів,
  `HttpOnly; Secure; SameSite=Lax`, `Path` дорівнює шляху сторінки. Стану на сервері немає.
- Throttle рахується окремо по IP + сторінка, тому підбір пароля до однієї не блокує іншу.
- Порівняння пароля і підпису — constant-time, без ранньої зупинки.
- Throttle перебору: 12 невдалих спроб з одного IP за 15 хвилин → 429. Лічильник у KV
  `barpi-bible-acl`, best-effort: збій KV не ламає вхід.
- `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: private, no-store`,
  `Referrer-Policy: no-referrer` на кожній відповіді.

## Bindings

- `DECK` — R2 bucket `barpi-deck` (приватний)
- `OTP_KV` — KV `barpi-bible-acl` (`5d2685f414a14ff4ac050eea5b19bdcf`), лише для throttle

## Секрети

```bash
cd barpi-deck
printf '%s' '<пароль>'      | npx wrangler secret put DECK_PASSWORD
printf '%s' '<пароль>'      | npx wrangler secret put CHECKLIST_PASSWORD
printf '%s' "$(openssl rand -hex 32)" | npx wrangler secret put SESSION_SECRET
```

Зміна `SESSION_SECRET` миттєво завершує всі відкриті сесії — це «вийти всім».

## Оновити презентацію

```bash
cd barpi-deck
npx wrangler r2 object put barpi-deck/index.html --file=<нова>.html \
  --content-type="text/html; charset=utf-8" --remote
npx wrangler r2 object put barpi-deck/deck.pdf --file=<новий>.pdf \
  --content-type="application/pdf" --remote
npx wrangler r2 object put barpi-deck/checklist.html --file=<нова>.html \
  --content-type="text/html; charset=utf-8" --remote
```

Деплою воркера при цьому не потрібно — він читає R2 на кожен запит.

## Deploy

```bash
npx wrangler deploy
```

## `/kb` — база знань за паролем

`brand.barpi.ua/dashboard/knowledge/` закрита Cloudflare Access за списком email, і пароль там неможливий
за конструкцією. Тому та сама сторінка віддається копією через воркер на `/kb` з власним паролем —
Access на цей шлях не поширюється, конфіг Access не змінювався.

Сторінка самодостатня: один `index.html` на 57 КБ, зовнішні залежності лише з CDN. Дані бере з воркера
`barpi-api` за заголовком `Origin: https://brand.barpi.ua`, тому на `/kb` працює так само, як на `/dashboard/`.

**Копія в R2 — це знімок.** Після зміни `dashboard/knowledge/index.html` у репозиторії треба перезалити:

```bash
npx wrangler r2 object put barpi-deck/kb.html --file=dashboard/knowledge/index.html \
  --content-type="text/html; charset=utf-8" --remote
```

**Сторінка дозволяє редагування**, а `barpi-api` перевіряє лише `Origin`, не особу. Тому пароль від `/kb`
дає і читання, і правки — видавати його лише тим, кому правки дозволені.
