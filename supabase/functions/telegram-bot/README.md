# Telegram Bot — Barpi HQ

**Status:** ✅ Deployed (version 1, active)
**Live URL:** `https://zrcqmwlpsggiqgipvxhv.supabase.co/functions/v1/telegram-bot`
**Verify JWT:** false (custom webhook secret auth)

## Команди

| Команда | Опис |
|---|---|
| `/start` | Привітання + твій Telegram ID |
| `/help` | Список команд |
| `/sale <кільк> <sku> <канал> <грн> [нотатки]` | Додати продаж у `sales_daily` |
| `/stats` | KPI за останні 7 днів |
| `/publications` | План публікацій на сьогодні |
| `/me` | Твій whitelist-статус |

Приклад: `/sale 5 yalovich-30 e-zoo 450 промо`

## Налаштування (разове)

### 1. Створити бота у @BotFather

Telegram → [@BotFather](https://t.me/BotFather) → `/newbot` → ім'я `Barpi HQ` → username `barpi_hq_bot` (або інший вільний) → отримаєш `<BOT_TOKEN>`.

### 2. Поставити secrets у Supabase

Відкрий: https://supabase.com/dashboard/project/zrcqmwlpsggiqgipvxhv/functions/secrets

Додай 2 секрети:

| Key | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | `<BOT_TOKEN>` від BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | будь-який random string (напр. `openssl rand -hex 32`) |

### 3. Зареєструвати webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://zrcqmwlpsggiqgipvxhv.supabase.co/functions/v1/telegram-bot" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

Чи працює:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

### 4. Додати себе у whitelist

Відкрий бота в Telegram → `/start` → отримаєш свій Telegram ID.

Далі SQL у Supabase (https://supabase.com/dashboard/project/zrcqmwlpsggiqgipvxhv/sql):

```sql
UPDATE public.users SET telegram_id = '<ТВІЙ TELEGRAM ID>' WHERE email = 'vg@abrisart.com';
```

Потім у боті: `/me` → повинно показати твій профіль.

## Розробка / оновлення

Function деплоїться через Supabase MCP або CLI:

```bash
supabase functions deploy telegram-bot --no-verify-jwt
```

## Схема безпеки

1. **Verify JWT:** вимкнено — Telegram не присилає JWT.
2. **Webhook secret:** вхідний header `X-Telegram-Bot-Api-Secret-Token` перевіряється проти `TELEGRAM_WEBHOOK_SECRET`.
3. **Service role:** використовується для обходження RLS (бот пише від імені сервера).
4. **Whitelist:** `/me` перевіряє `users.telegram_id` — бот відповідає всім, але тільки whitelist-юзери бачать свій профіль.

## TODO (наступні ітерації)

- [ ] Перевіряти всі команди на whitelist (окрім /start, /help, /me).
- [ ] `/today` — продажі за сьогодні.
- [ ] `/week` — вибір періоду (вчора, 30 днів).
- [ ] Inline keyboard для вибору каналу/SKU.
- [ ] Notifications: авто-сповіщення про нові публікації з Barpi HQ.
- [ ] /report — щотижневий звіт PDF в чат.
