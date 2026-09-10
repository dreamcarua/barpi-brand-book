# barpi-deck

Cloudflare Worker — закриті паролем сторінки Barpi.

| Сторінка | Адреса | Пароль | Для кого |
|---|---|---|---|
| Інвестиційна презентація | https://brand.barpi.ua/deck | `DECK_PASSWORD` | покупець частки після NDA |
| Відповіді на чек-лист SC Consulting, 48 пунктів | https://brand.barpi.ua/checklist | `CHECKLIST_PASSWORD` | консультанти з супроводу угоди |

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
| GET | `/deck`, `/checklist` | є сесія — віддає сторінку з R2; немає — форма пароля |
| POST | `/deck`, `/checklist` | перевіряє пароль, ставить підписану cookie, редірект назад |
| GET | `/deck/pdf` | PDF-дубль презентації, тільки з сесією |
| GET | `/deck/exit`, `/checklist/exit` | стирає сесію цієї сторінки |

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
