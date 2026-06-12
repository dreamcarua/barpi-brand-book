# 🔍 Super-Audit Report — Barpi Brand Bible
**Дата:** 12.06.2026 · **Аудитор:** автономний агент (рівень studio/staff) · **Scope:** brand.barpi.ua — концепція, система, безпека, UI, швидкість

---

## EXECUTIVE SUMMARY

Знайдено **23 проблеми**. Найкритичніша — **P0 витік клієнтської PII через публічний API**.

| Pri | К-сть | Статус |
|---|---|---|
| **P0 blocker** | 2 | 1 виправлено (код), 1 потребує деплою VG |
| **P1 wrong** | 6 | 4 виправлено/закомічено, 2 потребують VG |
| **P2 gap** | 9 | частково виправлено, решта в backlog |
| **P3 polish** | 6 | backlog |

**Scorecard (0–100):** Security 48 → (після деплою) 88 · Архітектура 72 · Швидкість 70 → 78 · UI/a11y 74 → 82 · SEO/Концепція 80

---

## 🔴 P0 — BLOCKER

### P0-1. Витік клієнтської PII через публічний API (Origin-spoof) — НАЙВИЩИЙ ПРІОРИТЕТ
**Вектор:** воркер `barpi-api` (URL публічний у `bb.js` на негейтованих сторінках) приймає підроблюваний заголовок `Origin` як «доказ» автентичності для читання БУДЬ-ЯКОЇ таблиці.

**PoC (підтверджено live):**
```
curl -H "Origin: https://brand.barpi.ua" \
  https://barpi-api.vg-ab6.workers.dev/moysklad_counterparties
→ 200 OK, повертає ПІБ, телефони, email
```
**Масштаб:** 312 контрагентів, **260 з телефоном/email**, + фінансові таблиці (demand, payments, payments_out). GDPR-релевантний інцидент.

**Чому Origin — не автентифікація:** заголовок `Origin` тривіально підробляється будь-яким не-браузерним клієнтом (curl/script). Реальний захист дають лише: верифікований CF Access JWT АБО секретний API-key.

**Зроблено (код, у репо):** переписано `barpi-api` (`cf-migration/workers/barpi-api/src/index.js`):
- Реальна верифікація CF Access JWT (JWKS/RS256, перевірка `aud`+`exp`), а не presence-check.
- `SENSITIVE_RESOURCES` (PII/фінанси/customer-views) — вимагають verified-JWT або API-key; Origin для них НЕ приймається.
- Origin лишається лише для неперсональних агрегатів (KPI, P&L) як defense-in-depth.

**⚠️ ПОТРІБНО ВІД VG щоб фікс став LIVE (інакше витік триває):** див. блок «ПОТРІБНО ВІД VG» — пункти 1–3 (новий CF token → route api.barpi.ua за CF Access → deploy воркера).

### P0-2. IaC-дрейф: у репо лежала ВРАЗЛИВА версія воркера
**Знахідка:** live `barpi-api` (оновлений 10.06) — захищений (SAFE_IDENT, admin-gate, blacklist), але **репо-копія** (`cf-migration/workers/barpi-api/src/index.js`) була СТАРА вразлива (SQLi через `select`, без admin-auth). Будь-який redeploy з репо повертав би SQLi (C3/C4/C5).
**Виправлено:** репо-копію замінено на захищену+посилену версію (та сама, що P0-1). Додано `deploy-workers.yml` — деплой тільки з версіонованого коду.

---

## 🟠 P1

### P1-1. Відсутні всі security-заголовки ✅ (config готовий, потребує VG-деплою)
`brand.barpi.ua` не віддає CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
**Зроблено:** `cloudflare/response-headers-ruleset.json` (CSP locked на self+jsDelivr+Google Fonts+worker, HSTS, X-Frame SAMEORIGIN, nosniff, Referrer-Policy, Permissions-Policy, COOP) + workflow `deploy-cf-headers.yml`. Потрібен `CF_API_TOKEN`+`CF_ZONE_ID` (VG).

### P1-2. /healthz витікав внутрішні лічильники ✅
`/healthz` повертав `demand_rows: 2000`. **Виправлено:** liveness-only `{status:'ok'}` у новому воркері.

### P1-3. Витік помилок через `X-Query-Failed` header ✅
Старий воркер на failed-query повертав `X-Query-Failed: <SQL error>`. **Виправлено:** прибрано, graceful `[]` без leak.

### P1-4. Немає CI / secret-scan / lint ✅
**Зроблено:** `ci-templates/ci.yml` — gitleaks secret-scan, HTMLHint, lychee link-check, `node --check` воркера. (Перенести у `.github/workflows/` — токен MCP не має workflow-scope.)

### P1-5. Git history містив SYNC_API_KEY (історична) — потребує VG
CHANGELOG фіксує leak до `7c226cca`; ключ ротовано. **Рекомендація:** `bfg --replace-text` для очистки history (VG, опційно).

### P1-6. CF Access allowlist — звірити drift — потребує VG
`cf-access-policy.json` (5 emails) звірити з реальною Access app.

---

## 🟡 P2 (вибране, решта в BACKLOG)

- **P2-1. Шрифт Rubik через `@import` (7 ваг, render-blocking)** ✅ скорочено до 5 ваг (у `bb.css.improved`, в папці аудиту); preconnect/self-host — backlog.
- **P2-2. Контраст muted/dim тексту нижче AA** ✅ alpha 0.65→0.74 / 0.45→0.60 (`bb.css.improved`).
- **P2-3. Логотип base64 (~4.5KB) inline у `bb.js`** — backlog (екстракція у файл; binary-commit через GitHub UI).
- **P2-4. `og-image.png` не існує** — підсторінки посилаються на 404. Backlog: залити PNG 1200×630 або перевести og:image на наявний og.svg.
- **P2-5. `barpi-sync` GET / публічно віддає sync_state + last_error** — backlog (key-gate).
- **P2-6. `barpi-api` без rate-limiting** — backlog (CF rate-limit rule).
- **P2-7. Дашборди: empty/error/stale-state UX** — backlog.

## ⚪ P3 (polish)

- **focus-visible / reduced-motion / touch-targets** ✅ додано в `bb.css.improved` (застосувати після рев'ю — щоб не ризикувати спільним стилем без візуальної перевірки).
- og:description містить «космічними технологіями» — потенційний конфлікт із бренд-правилом «❌ космічний візуал». На РЕВ'Ю (маніфест захищений, не змінював сам).
- favicon крос-доменний (barpi.com.ua) — backlog (локальний favicon.svg).
- Підсторінки мають мінімальний `<head>` — backlog.

---

## ✅ Задеплоєно в репо цим аудитом
- `cf-migration/workers/barpi-api/{src/index.js, wrangler.toml}`: захищений воркер (IaC) + Access-bindings.
- `cloudflare/response-headers-ruleset.json`: повний набір security-заголовків.
- `ci-templates/*` (workflow-шаблони — перенести у `.github/workflows/`).
- `AUDIT_REPORT_2026-06-12.md`, `PRIORITIZED_BACKLOG.md`.

Готові, але не закомічені (у папці `audit-2026-06-12/` через ризик/scope): `bb.css.improved` (a11y+шрифт).

## 🔧 ПОТРІБНО ВІД VG (щоб закрити P0 повністю)
1. **Новий CF API token** (старий expired 10.06): dash.cloudflare.com → My Profile → API Tokens. Scopes: `Workers Scripts:Edit`, `Account Settings:Read`, Zone barpi.ua → `Workers Routes:Edit`, `DNS:Edit`, `Transform Rules:Edit`. → GitHub Secrets: `CF_API_TOKEN`, `CF_ACCOUNT_ID=ab63a85bdfbf5894c28efe7076acbd82`, `CF_ZONE_ID=<zone barpi.ua>`.
2. **Route + Access для API:** створити `api.barpi.ua` (DNS → worker) + CF Access self-hosted app з тими ж 5 emails. Розкоментувати `routes` у wrangler.toml + встановити `ACCESS_AUD`.
3. **Перепідключити дашборди** на `https://api.barpi.ua`. Запустити `deploy-workers` + `deploy-cf-headers`.
4. Перенести `ci-templates/*` у `.github/workflows/` (через GitHub UI або token з workflow-scope).
5. (опц.) `bfg --replace-text` для git-history sanitization.

Після кроків 1–3 P0 закрито: Origin-spoof більше не дає PII.
