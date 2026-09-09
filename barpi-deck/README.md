# barpi-deck

Cloudflare Worker — сторінка інвестиційної презентації Barpi під паролем.

**Адреса:** https://brand.barpi.ua/deck

## Чому саме так

`brand.barpi.ua` віддається з GitHub Pages, а репозиторій **публічний**. Тому сама
презентація ніколи не потрапляє в цей репозиторій — вона лежить у приватному R2-бакеті
`barpi-deck`, а воркер віддає її лише після перевірки пароля. У Git тут тільки код гейта.

CF Access на `/dashboard/*` не підходить: він працює за списком email з одноразовим кодом,
а зовнішньому інвестору потрібне просте «посилання + пароль».

## Маршрути

| Метод | Шлях | Що робить |
|---|---|---|
| GET | `/deck` | є сесія — віддає презентацію з R2; немає — форма пароля |
| POST | `/deck` | перевіряє пароль, ставить підписану cookie, редірект на `/deck` |
| GET | `/deck/pdf` | PDF-дубль, тільки з сесією |
| GET | `/deck/exit` | стирає сесію |

## Як влаштований захист

- Cookie `barpi_deck` = `<exp>.<HMAC-SHA256(exp, SESSION_SECRET)>` — сесія на 30 днів,
  `HttpOnly; Secure; SameSite=Lax; Path=/deck`. Стану на сервері немає.
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
```

Деплою воркера при цьому не потрібно — він читає R2 на кожен запит.

## Deploy

```bash
npx wrangler deploy
```
