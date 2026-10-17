# Handoff — стан посеред задачі

Оновлено: 17.10.2026 11:40 CEST

## Задача дослівно
«…повтори повністю функціонал [кар'єри snEco і Abris] … зроби красиво і зручно» — Вадим, 17.10.2026. Прев'ю показано, Вадим: «1. запускай 2. в чат наш Barpi хай бот пише! 3. не треба».

## Зроблено
- R2 `barpi-hr-files` створено; D1 barpi-bible: міграції 0001 і 0002 застосовано (через Cloudflare MCP), вакансія id 1 опублікована.
- Воркер `barpi-hr` задеплоєно (wrangler OAuth на mac-home), маршрути brand.barpi.ua/dashboard/api/hr/* і /hr-api/*, ACCESS_AUD закріплено. Секрети: TG_TOKEN (@barpiua_bot), HR_TG_CHATS (поки особистий чат Вадима), HR_ADMIN_EMAILS, HR_PAYROLL_EMAILS.
- Гілку careers злито в main: brand.barpi.ua/dashboard/careers/ і site-embed/careers.js + bp.css живі.
- Наскрізний тест з Origin barpi.com.ua: кандидат id 1 «ТЕСТ Claude (видалити)» з резюме в D1/R2. ВИДАЛИТИ після перевірки доставки.

## Не зроблено
1. Horoshop: сторінка /kariera/ (вміст = site-embed/pages/careers.html), лоадер у «Маркетингові сервіси»: додати "/kariera/" у P і підвантаження careers.js, V=9; пункт меню «Кар'єра». Mac на момент запису недоступний.
2. Групу «Barpi» в Telegram: id чату невідомий (TG_CHAT_ID_BARPI у memory-kit порожній, getUpdates бота порожній). Потрібно: бот @barpiua_bot у групі + будь-яке повідомлення з @barpiua_bot, тоді getUpdates → chat id → `wrangler secret put HR_TG_CHATS` (особистий чат Вадима + група).
3. Деплой правки «слід доставки в hr_audit_log (action notify)» — закомічено, не задеплоєно.

## Наступна одна дія
Коли Mac на звʼязку: деплой barpi-hr, перевірити notify у hr_audit_log, створити сторінку в Horoshop.
