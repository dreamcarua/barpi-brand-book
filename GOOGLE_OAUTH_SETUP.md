# 🔑 Google OAuth Setup — Barpi Brand Bible

**Дата:** 02.06.2026
**Maintainer:** vg@abrisart.com

Інструкція як налаштувати «Увійти через Google» на `/dashboard/*`. Це **backup auth** додатково до Magic Link — щоб обійти rate-limit Supabase email.

---

## TL;DR (5 хв роботи)

1. Створити OAuth Client у Google Cloud Console
2. Скопіювати **Client ID** + **Client Secret**
3. Вставити у Supabase Dashboard → Auth → Providers → Google → Enable
4. Готово — кнопка «Увійти через Google» вже у gate-модалі (bb.js v3.3)

---

## Крок 1. Google Cloud Console — створити OAuth Client

### 1.1 Зайти у Google Cloud Console

Відкрий → https://console.cloud.google.com/

Якщо це перший раз — створи новий project, назви наприклад **«Barpi Brand Bible Auth»**.

### 1.2 OAuth consent screen

Меню зліва → **APIs & Services** → **OAuth consent screen**

Заповни:
- **User type:** `External` (для роботи з усіма Google-акаунтами)
- **App name:** `Barpi Brand Bible`
- **User support email:** `office@barpi.com.ua`
- **App logo:** (опціонально) — завантаж лого Barpi
- **Application home page:** `https://brand.barpi.ua`
- **Authorized domains:**
  - `barpi.ua`
  - `supabase.co`
- **Developer contact info:** `vg@abrisart.com`

**Save and continue**.

На наступному екрані **Scopes** — пропусти, нічого не додавай (за замовчуванням Google дасть `email`, `profile`, `openid` — це все що потрібно).

**Test users** — додай свій email (на випадок якщо app у Testing mode). Краще — натиснути **PUBLISH APP** щоб не обмежуватись test users.

### 1.3 Створити OAuth Client ID

Меню зліва → **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth client ID**

- **Application type:** `Web application`
- **Name:** `Barpi BB — Supabase Auth`
- **Authorized JavaScript origins:**
  ```
  https://brand.barpi.ua
  https://zrcqmwlpsggiqgipvxhv.supabase.co
  ```
- **Authorized redirect URIs:** ⚠️ КРИТИЧНО — ОДИН ТОЧНИЙ URL
  ```
  https://zrcqmwlpsggiqgipvxhv.supabase.co/auth/v1/callback
  ```

**Create**.

Google покаже модал з **Client ID** і **Client secret** — скопіюй обидва зараз, через пів години вже не побачиш secret.

```
Client ID:     1234567890-xxxxxxxxxx.apps.googleusercontent.com
Client secret: GOCSPX-xxxxxxxxxxxxxxx
```

---

## Крок 2. Supabase — увімкнути Google provider

### 2.1 Зайти в Auth → Providers

Відкрий → https://supabase.com/dashboard/project/zrcqmwlpsggiqgipvxhv/auth/providers

Знайди **Google** у списку → клацни щоб розгорнути.

### 2.2 Налаштувати

- Toggle **Enable Sign in with Google** → ON
- **Client ID (for OAuth):** встав скопійований Client ID
- **Client Secret (for OAuth):** встав Client Secret
- **Skip nonce checks:** не треба, залиш OFF

Внизу буде показано:
```
Callback URL (for OAuth): https://zrcqmwlpsggiqgipvxhv.supabase.co/auth/v1/callback
```

Це той самий URL що ти ввів у Google Cloud Console у крок 1.3. Збігається — добре.

**Save**.

### 2.3 Перевір що Site URL вже налаштований

Меню зліва → **Authentication** → **URL Configuration**

Має бути:
- **Site URL:** `https://brand.barpi.ua`
- **Redirect URLs:** містить `https://brand.barpi.ua/auth-callback/**`

Якщо ні — налаштуй (це вже мало бути зроблено для magic link).

---

## Крок 3. Перевірка (1 хв)

1. Відкрий https://brand.barpi.ua/dashboard/ у новій incognito-вкладці
2. Має з'явитись модал з кнопками:
   - **«Увійти через Google»** (зверху, з Google G-логотипом)
   - **«Надіслати посилання на email»** (нижче, після розділювача «або»)
3. Клацни на Google → редірект на Google consent screen
4. Обери свій акаунт `vg@abrisart.com`
5. Дозволь доступ
6. Google → Supabase → редірект на `/auth-callback/` → автологін
7. Сесія збережена на 7 днів

---

## Як це працює технічно

```
[User] → brand.barpi.ua/dashboard/
   ↓ click "Увійти через Google"
[BB.AUTH.signInWithGoogle()]
   ↓ location.href = supabase.co/auth/v1/authorize?provider=google
[Supabase Auth]
   ↓ redirect to Google consent
[Google]
   ↓ user authorizes
   ↓ callback to supabase.co/auth/v1/callback?code=...
[Supabase]
   ↓ exchange code for access_token via Google API
   ↓ redirect to brand.barpi.ua/auth-callback/#access_token=...
[/auth-callback/]
   ↓ parse hash tokens
   ↓ fetch /auth/v1/user (get email)
   ↓ check ALLOWED list (email allowlist у callback)
   ↓ save session to localStorage
   ↓ redirect to original /dashboard/...
[Dashboard unlocked]
```

**Allowlist enforcement** все одно працює — навіть якщо хтось залогінився через Google з рандомним email, callback відхилить його як `NOT_ALLOWED`.

---

## Часті проблеми

### "redirect_uri_mismatch" від Google
- Перевір що у Google Cloud Console → Credentials → редагуй OAuth client → **Authorized redirect URIs** містить ТОЧНО:
  `https://zrcqmwlpsggiqgipvxhv.supabase.co/auth/v1/callback`
- Без trailing slash, без додаткових слешів

### "Email not in allowlist" після Google логіну
- Користувач залогінився через Google з email якого немає у allowlist
- Додай email у `assets/bb.js` (`BB.AUTH.ALLOWED`) і `auth-callback/index.html` (`ALLOWED`)

### "Access blocked: This app's request is invalid"
- OAuth consent screen не повністю налаштований
- Зайди у Google Cloud Console → OAuth consent screen → переконайся що app у режимі **In production** (або хоча б Test users містять тебе)

### Google показує «Made with Supabase» замість «Barpi»
- Це нормально для тестів. Щоб прибрати: у Google Cloud Console → OAuth consent screen → встав свій App name + logo
- Для production-якісного UI можна налаштувати **custom domain** для Supabase Auth (платний feature)

---

## Безпека — як це порівнюється з Magic Link

| Аспект | Magic Link | Google OAuth |
|---|---|---|
| Швидкість логіну | 30 сек (email + клік) | 2 кліки |
| Залежність від пошти | ✅ потрібна | ❌ не потрібна |
| Rate-limit Supabase | 4 листи/год free tier | без ліміту |
| Сторонній провайдер | ні | Google |
| Phishing-стійкість | середня | висока (Google sandbox) |
| Mobile UX | страждає (переключення app) | гладко (Google вже залогінений) |

**Рекомендація:** залиш ОБА варіанти. Google OAuth — основний (швидше), Magic Link — backup (для тих хто не хоче через Google).

---

## Файли

- `assets/bb.js` v3.3 — `BB.AUTH.signInWithGoogle()` + Google button у gate UI
- `auth-callback/index.html` — обробляє і magic link і OAuth callback (один формат hash tokens)
- `AUTH_SETUP.md` — Magic Link setup
- `GOOGLE_OAUTH_SETUP.md` — цей файл

---

*Якщо щось пішло не так — пиши на vg@abrisart.com.*
