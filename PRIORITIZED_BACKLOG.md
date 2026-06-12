# Barpi Brand Bible — Prioritized Backlog (audit 12.06.2026)

Матриця impact × effort. ✅ = зроблено цим аудитом. 🔧 = потребує дії VG (hard constraint).

## P0 — критично
| # | Проблема | Impact | Effort | Статус |
|---|---|---|---|---|
| P0-1 | PII-витік через Origin-spoof | 🔴 крит | M | ✅ код / 🔧 deploy (VG #1–3) |
| P0-2 | Вразлива версія воркера в репо (IaC drift) | 🔴 крит | S | ✅ замінено |

## P1 — виправити до публічного релізу
| # | Проблема | Impact | Effort | Статус |
|---|---|---|---|---|
| P1-1 | Немає security-заголовків | 🟠 вис | S | ✅ ruleset / 🔧 apply (VG #1) |
| P1-2 | /healthz leak row counts | 🟠 сер | S | ✅ |
| P1-3 | X-Query-Failed header leak | 🟠 сер | S | ✅ |
| P1-4 | Немає CI/secret-scan | 🟠 вис | S | ✅ (ci-templates → .github/workflows) |
| P1-5 | SYNC_API_KEY у git history | 🟠 сер | M | 🔧 bfg (VG) |
| P1-6 | CF Access allowlist drift | 🟠 сер | S | 🔧 звірити (VG) |

## P2 — gap
| # | Проблема | Impact | Effort | Статус |
|---|---|---|---|---|
| P2-1 | Rubik @import render-blocking | 🟡 | S | ✅ 7→5 ваг (bb.css.improved); self-host = backlog |
| P2-2 | Контраст muted/dim < AA | 🟡 | S | ✅ (bb.css.improved) |
| P2-3 | Logo base64 inline у bb.js | 🟡 | S | backlog (binary commit via UI) |
| P2-4 | og-image.png 404 на підсторінках | 🟡 | S | backlog |
| P2-5 | barpi-sync GET / публічний | 🟡 | S | backlog (key-gate) |
| P2-6 | barpi-api без rate-limit | 🟡 | M | backlog (CF rule) |
| P2-7 | Дашборди empty/error/stale UX | 🟡 | M | backlog |
| P2-8 | Немає Lighthouse budget gate в CI | 🟢 | M | backlog |
| P2-9 | Supabase barpi-hq (paused) — мертвий контур? | 🟡 | S | backlog (вирішити) |

## P3 — polish
| # | Проблема | Impact | Effort | Статус |
|---|---|---|---|---|
| P3-1 | focus-visible / reduced-motion | 🟢 | S | ✅ (bb.css.improved) |
| P3-2 | «космічними технологіями» в og/manifest | 🟢 | S | на рев'ю (бренд-правило) |
| P3-3 | favicon крос-доменний | 🟢 | S | backlog |
| P3-4 | Підсторінки: бідний `<head>` | 🟢 | M | backlog |
| P3-5 | EN-повнота для ЄС-партнерів | 🟢 | M | backlog |
| P3-6 | downloads/logo/fonts/packaging — .gitkeep | 🟢 | M | backlog |

## Архітектурні рекомендації (ФАЗА 2)
- Визначити канонічний data-контур: **D1** (як README) — Supabase `barpi-hq` (paused) виглядає мертвим; рішення видалити чи реактивувати.
- Перенести воркер-код у версіонований `deploy-workers` pipeline (зроблено) — більше жодних out-of-band деплоїв.
- Health-dashboard для sync_state + alerts (16 active alerts, є loss-making SKU).
