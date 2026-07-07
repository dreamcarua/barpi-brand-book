# Barpi Brand Bible — Prioritized Backlog

> Матриця impact × effort. ✅ = зроблено. 🔧 = потребує дії VG (hard constraint: CF token / DNS / BFG).
> Оновлено 07.07.2026 (аудит #2).

## 🔧 ЗАБЛОКОВАНО на CF secrets — розблокує 3 пункти одразу
Постав 3 GitHub-секрети → workflows `deploy-cf-headers` і `deploy-workers` (вже активні, workflow_dispatch) задеплоять headers і свіжий воркер:
```
gh secret set CF_API_TOKEN  -R dreamcarua/barpi-brand-book   # Zone.Rulesets:Edit + Account.Workers Scripts:Edit
gh secret set CF_ZONE_ID    -R dreamcarua/barpi-brand-book   # zone barpi.ua
gh secret set CF_ACCOUNT_ID -R dreamcarua/barpi-brand-book   # ab63a85bdfbf5894c28efe7076acbd82
```
Далі: `gh workflow run deploy-cf-headers.yml -R dreamcarua/barpi-brand-book` і `deploy-workers.yml`.

## P0 — критично
| # | Проблема | Статус |
|---|---|---|
| P0-1 | PII-витік через Origin-spoof | ✅ код / origin-check живий (403 без origin) |
| P0-2 | Вразлива версія воркера в репо | ✅ замінено (код у repo чистий) |

## P1 — до публічного релізу
| # | Проблема | Статус |
|---|---|---|
| P1-1 | Немає security-заголовків (CSP/HSTS/X-Frame/nosniff) | 🔧 ruleset готовий + workflow активний → треба CF_API_TOKEN |
| P1-2 | /healthz leak row counts | ✅ у repo / 🔧 **live воркер = стара версія (`demand_rows:2110`), треба redeploy** |
| P1-3 | X-Query-Failed header leak | ✅ у repo / 🔧 redeploy разом з воркером |
| P1-4 | Немає CI/secret-scan | ✅ **ci.yml активовано** (gitleaks fetch-depth:1 + htmlhint + lychee + node --check) |
| P1-5 | SYNC_API_KEY у git history | 🔧 ключ ротовано; історію чистити BFG (руйнівно, рішення VG) |
| P1-6 | CF Access allowlist drift | 🔧 звірити 5 email (VG) |

## P2 — gap
| # | Проблема | Статус |
|---|---|---|
| P2-1 | Rubik @import render-blocking | 🟡 7→5 ваг; self-host = backlog |
| P2-2 | Контраст muted/dim < AA | ✅ **виправлено у bb.css: muted 6.1:1, dim 4.6:1** |
| P2-3 | Logo base64 inline у bb.js | 🟡 backlog (binary commit via UI) |
| P2-4 | og-image.png 404 | ✅ **згенеровано workflow (200 OK, 93 KB)** |
| P2-5 | barpi-sync GET / публічний | 🟡 backlog (key-gate) |
| P2-6 | barpi-api без rate-limit | 🟡 backlog (CF rule) |
| P2-7 | Дашборди empty/error/stale UX | 🟡 backlog |
| P2-8 | Lighthouse budget gate в CI | 🟢 backlog |
| P2-9 | Supabase barpi-hq — мертвий контур | 🔧 **підтверджено: у списку проектів лише dreamcar-hq; barpi-hq зник/paused. Data-контур = D1. Прибрати згадки Supabase з CLAUDE.md або реактивувати** |

## P3 — polish
| # | Проблема | Статус |
|---|---|---|
| P3-1 | focus-visible / reduced-motion | ✅ |
| P3-2 | «космічними технологіями» в og/manifest | ✅ **виправлено (аудит #1)** |
| P3-3 | favicon крос-доменний | 🟢 backlog (favicon.ico) |
| P3-4 | Підсторінки: бідний `<head>` | 🟢 backlog |
| P3-5 | EN-повнота для ЄС-партнерів | 🟢 backlog (standalone EN-landing) |
| P3-6 | downloads/logo/fonts/packaging — .gitkeep | 🟢 backlog (майстер-файли) |

## Контент-беклог (аудит #1, 07.07.2026)
- P1 /photo/ + /digital/ — розширити з Doc 05/08/09
- P2 Google Drive файли → repo/R2; Qanelas ліцензія; favicon.ico
- P3 /logo/ майстер-файли; антиприклади у /visual/
