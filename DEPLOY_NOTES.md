# Barpi — Deploy Notes

Стан деплоїв: що живе, що потребує ручної дії.

## ✅ Живе (production)

| Компонент | URL / Сервіс | Статус |
|---|---|---|
| Brand Bible | https://brand.barpi.ua | live |
| Sales Dashboard | https://brand.barpi.ua/dashboard/sales/ | live |
| HQ SMM | https://brand.barpi.ua/dashboard/hq/ | live |
| Supabase backend | https://zrcqmwlpsggiqgipvxhv.supabase.co | live |
| Telegram bot Edge Function | /functions/v1/telegram-bot | deployed (active v1) |

## ⚠️ Потребує ручної дії (UI-кліки)

### Telegram Bot setup

1. Створити бота в [@BotFather](https://t.me/BotFather) → `/newbot` → отримати токен.
2. Додати secrets у [Supabase Functions → Secrets](https://supabase.com/dashboard/project/zrcqmwlpsggiqgipvxhv/functions/secrets):
   - `TELEGRAM_BOT_TOKEN` = токен від BotFather
   - `TELEGRAM_WEBHOOK_SECRET` = `openssl rand -hex 32`
3. Зареєструвати webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://zrcqmwlpsggiqgipvxhv.supabase.co/functions/v1/telegram-bot" \
     -d "secret_token=<SECRET>"
   ```
4. Додати себе у whitelist:
   ```sql
   UPDATE public.users SET telegram_id = '<ТВІЙ TG ID>' WHERE email = 'vg@abrisart.com';
   ```
   ID отримаєш відправивши `/start` боту.

### Supabase Auth

Вже налаштовано:
- Google OAuth → Site URL `https://brand.barpi.ua`
- Redirect URLs: `https://brand.barpi.ua/**`

## 🔧 Иnfra reference

- **GitHub repo:** dreamcarua/barpi-brand-book
- **Pages branch:** main (auto-deploy via GitHub Pages)
- **Custom domain:** brand.barpi.ua (CNAME → dreamcarua.github.io)
- **Supabase project:** zrcqmwlpsggiqgipvxhv (eu-central-1, barpi-hq)
- **D1 database:** barpi-bible (Cloudflare)
- **KV namespace:** barpi-bible-acl (Cloudflare)

## 📦 Edge Functions на Supabase

| Function | URL | JWT |
|---|---|---|
| telegram-bot | /functions/v1/telegram-bot | false (custom secret auth) |

## 💡 Наступні кроки

- [ ] Hot reload публікацій з HQ → Telegram (авто-сповіщення про нові заплановані пости).
- [ ] Xорошоп webhook → sales_daily (авто-імпорт D2C продажів).
- [ ] МойСклад денний cron → sales_daily.
- [ ] Inventory Dashboard з реальними даними.
