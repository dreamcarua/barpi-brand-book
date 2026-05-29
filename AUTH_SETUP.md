# 🔐 Barpi Dashboards — Auth Setup

Дашборди на `/dashboard/*` захищені Magic Link OTP через Supabase Auth.  
Сесія зберігається у `localStorage` на 7 днів.

---

## 1. Одноразова конфігурація (5 хв)

### A. Supabase Auth → Site URL + Redirect URLs

Magic link з email редіректить тільки на ALLOWLISTED URLs. Потрібно задати:

```
Site URL:       https://brand.barpi.ua
Redirect URLs:  https://brand.barpi.ua/**
                https://brand.barpi.ua/auth-callback/
                https://brand.barpi.ua/auth-callback/**
                https://brand.barpi.ua/dashboard/**
```

**Автомат (рекомендовано):**

```bash
# 1. Отримати Personal Access Token: https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN='sbp_xxxxx'

# 2. Запустити скрипт
./supabase/configure-auth.sh
```

**Вручну (якщо немає токена):**

1. Відкрити https://supabase.com/dashboard/project/zrcqmwlpsggiqgipvxhv/auth/url-configuration
2. Site URL → `https://brand.barpi.ua`
3. Redirect URLs (додати по черзі):
   - `https://brand.barpi.ua/**`
   - `https://brand.barpi.ua/auth-callback/`
   - `https://brand.barpi.ua/dashboard/**`
4. Save changes

### B. (Опціонально) — Додати 6-digit код у email template

За замовчуванням Supabase надсилає тільки magic link. Щоб уможливити alt-flow з кодом:

1. Відкрити https://supabase.com/dashboard/project/zrcqmwlpsggiqgipvxhv/auth/templates
2. Обрати template **Magic Link**
3. Додати в HTML body:
   ```html
   <p>Або введіть код вручну: <strong>{{ .Token }}</strong></p>
   ```
4. Save

---

## 2. Allowlist (хто має доступ)

Список email прописаний у двох місцях (мають бути синхронізовані):

- `assets/bb.js` — `BB.AUTH.ALLOWED` (рядки ~22)
- `auth-callback/index.html` — `ALLOWED` (рядки ~30)

### Поточний список:

```
vg@abrisart.com          # Вадим
office@barpi.com.ua      # Загальний офіс
aksonov@barpi.com.ua     # Олександр (співзасновник, операційний)
pylyp@abrisart.com       # Пилип (співзасновник)
office@abrisart.com      # Абрис офіс (резерв)
vg@dreamcar.ua           # Вадим DC
```

### Додати нового користувача:

1. Відредагувати **обидва** файли — додати email у масив `ALLOWED`/`ALLOWED` (нижній регістр, у лапках, з комою наприкінці)
2. Закомітити обидва файли в `main`
3. GitHub Pages автоматично передеплоїть (~30 секунд)

### Видалити користувача:

1. Видалити email з обох файлів
2. Закомітити
3. Існуюча сесія цього користувача залишиться валідною до експірації (7 днів). Щоб відразу відкликати:
   - У Supabase Dashboard → Auth → Users → знайти юзера → Delete user

---

## 3. Як працює auth-flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Користувач відкриває /dashboard/customer-360/             │
│ 2. bb.js v2.8 одразу прелочує <main>/.bb-topnav/.sidebar     │
│    через inline style { visibility: hidden }                 │
│ 3. BB.AUTH.requireAuth() читає localStorage[bb_auth_session] │
│                                                              │
│    ┌── Якщо session валідна (< 7 днів) + email в allowlist   │
│    │   → unlock visibility, показати badge у topnav          │
│    │                                                         │
│    └── Якщо немає session АБО прострочена:                   │
│        → показати модал з email input                        │
│        → user вводить email → click "Send link"              │
│        → bb.js перевіряє allowlist клієнтсайд                │
│        → POST /auth/v1/otp до Supabase                       │
│        → Supabase надсилає email з magic link                │
│        → "Перевірте пошту" екран                             │
│        → User клікає на link у email                         │
│        → Браузер відкриває /auth-callback/#access_token=...  │
│        → callback.html парсить hash, get user, перевіряє     │
│          allowlist, зберігає session у localStorage          │
│        → location.href = bb_auth_returnTo (= /dashboard/...) │
│        → Page reloads → session знайдено → unlock + badge    │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Безпека — обмеження поточної реалізації

⚠️ Це **soft security** (frontend-only gate). Захищає від випадкового доступу, але:

- Будь-хто з ANON key може напряму викликати Supabase REST endpoints і прочитати view-и (`v_customer_dow`, `v_pnl_monthly`, etc.)
- Локальний стейт можна підробити через DevTools (`localStorage.setItem('bb_auth_session', ...)`)

**Hard security потребуватиме (план на наступний sprint):**

1. **Enable RLS** на всіх `v_*` view-ах + базових таблицях МС
2. **Policy:** `auth.uid() IN (SELECT user_id FROM allowed_users WHERE active = true)`
3. Замінити ANON key на JWT з сесії при API запитах у `BB.api()`
4. Створити таблицю `allowed_users` (з міграцією, RLS)
5. Прибрати hardcoded allowlist з фронтенду — стане server-side

---

## 5. Troubleshooting

### "Невалідний email" → "NOT_ALLOWED"
- Email не у списку. Додай у `bb.js` і `auth-callback/index.html`, закомітити.

### Email прийшов, але клік на link → "redirect not allowed"  
- Site URL не налаштований. Запустити `./supabase/configure-auth.sh`.

### Email не приходить
- Перевірити Supabase Dashboard → Auth → Users — чи створений запис
- Перевірити Dashboard → Logs → Auth — статус відправки
- Default Supabase rate limit: 4 emails/hour per email address
- Перевірити Spam папку

### "Session expired" одразу після input
- localStorage заборонений у браузері (Incognito + strict)
- Toggle Cookies & Site Data → дозволити для brand.barpi.ua

### Logout кнопка не з'являється у topnav
- Topnav інжектиться через bb.js на /dashboard/*. На BB сторінках його немає (по дизайну).

---

## 6. Файли цього шару

- `assets/bb.js` v2.8 — `BB.AUTH` (gate, modal, badge, logout)
- `auth-callback/index.html` — Magic link callback handler
- `supabase/configure-auth.sh` — Setup script
- `AUTH_SETUP.md` — Цей файл

---

*Created 28.05.2026 · Updated as needed*
