# МойСклад API → Mapping для Barpi

**Дата:** 28.05.2026 · **Версія API:** remap/1.2 · **Документація:** https://github.com/moysklad/api-remap-1.2-doc

---

## 0. Архітектура МС: документи vs довідники vs звіти

МС API має **3 базові групи**:

| Група | Endpoint | Що це |
|---|---|---|
| **Сутності (Dictionaries)** | `/entity/{type}` без операцій | Довідники: товари, контрагенти, склади, ціни, договори |
| **Документи (Documents)** | `/entity/{docType}` з positions | Операції: відвантаження, оплати, виробництво — мають дати, рахунки |
| **Звіти (Reports)** | `/report/{type}` | Pre-aggregated: P&L, stock, money, turnover |

---

## 1. Документи (3 категорії)

### 1.1 ВІДВАНТАЖЕННЯ / ПРОДАЖІ (шт + ₴)

| Endpoint | Назва | Що містить | Статус Barpi |
|---|---|---|---|
| `/entity/demand` | **Отгрузка** | Відвантаження клієнту: positions (sku, qty, price), agent (клієнт) | ✅ **9203 синканих** з 06.01.2025 |
| `/entity/customerorder` | Замовлення покупця | Замовлення (ще не відвантажене), payedSum, shippedSum | ❌ НЕ синкаю — корисно для funnel |
| `/entity/retaildemand` | Роздрібний продаж | Демонстрація через касовий апарат | ❌ НЕ використовується в Барпі |
| `/entity/retailshift` | Касова зміна | Зміни кас (RetailDemand агрегати) | ❌ — |
| `/entity/salesreturn` | **Повернення від клієнта** | Повернення товарів | ✅ **28 синканих** |
| `/entity/commissionreportout` | Звіт комісіонера | Маркетплейси/комісійний продаж | ❌ — |

### 1.2 ГРОШІ / ОПЛАТИ (₴ окремо від товарів)

| Endpoint | Назва | Що містить | Статус Barpi |
|---|---|---|---|
| `/entity/paymentin` | **Вхідна оплата** | Оплати від клієнтів на рахунок | ✅ **1109 синканих** на 5.72 M ₴ |
| `/entity/paymentout` | Вихідна оплата | Виплати постачальникам/зарплати | ❌ НЕ синкаю — корисно для cash flow |
| `/entity/cashin` | Прихідний ордер | Готівка у касу (фізично) | ❌ — Барпі не використовує |
| `/entity/cashout` | Видатковий ордер | Готівка з каси | ❌ — |
| `/entity/prepayment` | Передоплата | Аванс від клієнта до відвантаження | ❌ — |
| `/entity/prepayment_return` | Повернення передоплати | — | ❌ — |
| `/entity/invoicein` | **Вхідний рахунок** (від постачальника) | Рахунки за товари/послуги що Барпі купує | ❌ НЕ синкаю — потрібно для P&L |
| `/entity/invoiceout` | **Вихідний рахунок** (клієнту) | Рахунки які Барпі виставляє | ✅ **1516 синканих** на 4.64 M ₴ |
| `/entity/facturein` | Вхідна фактура | Бухгалтерська фактура | ❌ — |
| `/entity/factureout` | Вихідна фактура | — | ❌ — |
| `/entity/counterpartyadjustment` | Коригування взаєморозрахунків | Сальдо між нами і клієнтом | ❌ — корисно для AR |

### 1.3 СКЛАД / ВИРОБНИЦТВО (шт)

| Endpoint | Назва | Що містить | Статус Barpi |
|---|---|---|---|
| `/entity/supply` | **Приходна (від постачальника)** | Що ми купили — сировина, упаковка, готовий товар | ❌ НЕ синкаю — критично для cost! |
| `/entity/purchaseorder` | Замовлення постачальнику | Що замовили купити | ❌ — для procurement-планування |
| `/entity/purchasereturn` | Повернення постачальнику | — | ❌ — |
| `/entity/enter` | **Оприбуткування** | Внесення товару без supply (виробнича приходка) | ❌ — критично для виробництва Барпі! |
| `/entity/loss` | **Списання** | Списання браку, псування | ❌ — корисно для виробничих втрат |
| `/entity/move` | Переміщення | Між складами | ❌ — Мукачево ↔ Гуменне |
| `/entity/inventory` | Інвентаризація | Залишки на дату | ❌ — корисно квартально |

### 1.4 ВИРОБНИЦТВО (окрема група)

| Endpoint | Назва | Що містить | Статус Barpi |
|---|---|---|---|
| `/entity/processingplan` | **Тех. карта** | Рецепт: сировина → готовий продукт (формула виробництва) | ❌ — критично для маржинальності |
| `/entity/processingprocess` | Виробничий процес | Запуск виробництва по тех. карті | ❌ — |
| `/entity/processingstage` | Стадія виробництва | Етапи (сушка / упаковка / тестування) | ❌ — |
| `/entity/processingorder` | Замовлення на виробництво | Що треба виробити | ❌ — |
| `/entity/processing` | **Технологічна операція** (legacy) | Виробничий акт: сировина списана → готовий продукт оприбуткований | ❌ — старий формат |
| `/entity/productionTask` | **Виробниче завдання** | Сучасний формат планування виробництва | ❌ — Олександр використовує? |
| `/entity/productionStageCompletion` | Завершення стадії | Закриття стадії з відмітками часу і браку | ❌ — |

### 1.5 ВНУТРІШНІ ДОКУМЕНТИ

| Endpoint | Назва | Що містить | Статус Barpi |
|---|---|---|---|
| `/entity/internalorder` | Внутрішнє замовлення | Заявка між підрозділами | ❌ — |
| `/entity/payroll` | **Зарплата** | Нарахування зарплати співробітникам | ❌ — критично для P&L |
| `/entity/emissionorder` | Замовлення емісії | Маркування товарів (МДЛП/Чесний знак) | ❌ — для УА не критично |

---

## 2. Довідники (master data)

### 2.1 ТОВАРИ І АСОРТИМЕНТ

| Endpoint | Що дає | Статус |
|---|---|---|
| `/entity/product` | Прості товари (сировина, готова продукція) | ✅ **117** |
| `/entity/variant` | Варіанти (розмір/колір) | ❌ — Барпі не використовує |
| `/entity/bundle` | **Комплекти / набори** (наприклад: набір 5 SKU = 1 коробка) | ✅ Частково (Barpi набори) |
| `/entity/service` | Послуги (доставка, маркетинг) | ❌ — |
| `/entity/assortment` | Все одразу: product + variant + bundle + service | ⚠ Через нього все є |
| `/entity/productFolder` | Папки/категорії товарів | ❌ — корисно для категоризації |
| `/entity/uom` | Одиниці виміру (шт, кг, упак) | ❌ — |
| `/entity/characteristic` | Характеристики варіантів | ❌ — |
| `/entity/consignment` | Серії товарів (партії) | ❌ — для трекування свіжості! |
| `/entity/discount` | Знижки і акції | ❌ — корисно для promo |

### 2.2 КОНТРАГЕНТИ І ВЗАЄМОДІЇ

| Endpoint | Що дає | Статус |
|---|---|---|
| `/entity/counterparty` | Клієнти + постачальники | ✅ **307** (з адресами + phone) |
| `/entity/counterparty/{id}/contactpersons` | Контактні особи клієнтів | ⚠ Запит даний, 0 повернуто (Барпі не веде) |
| `/entity/group` | Групи клієнтів | ⚠ Частково (через counterparty.meta) |
| `/entity/contract` | **Договори** з клієнтами/постачальниками | ❌ — корисно для умов оплати |

### 2.3 СКЛАД, ОРГСТРУКТУРА, ЦІНИ

| Endpoint | Що дає | Статус |
|---|---|---|
| `/entity/store` | Склади (Мукачево, Гуменне) | ❌ — потрібно для multi-warehouse |
| `/entity/organization` | Юр. особи (ТОВ ПЕТ КОРП) | ❌ — корисно для exports |
| `/entity/employee` | Співробітники | ❌ — для зарплат і person ownership |
| `/entity/pricetype` | Типи цін (ОПТ, Мережа, Дістр) | ⚠ Через counterparty.priceType |
| `/entity/saleschannel` | Канали продажів | ❌ — порівняти з нашою власною сегментацією |
| `/entity/expenseitem` | **Статті витрат** (для paymentout) | ❌ — критично для P&L |
| `/entity/project` | Проекти | ❌ — |
| `/entity/states` | CRM-стани документів і клієнтів | ⚠ Через counterparty.state |

---

## 3. Звіти (агрегати — швидше, ніж documents)

| Endpoint | Що дає | Дані для | Статус Barpi |
|---|---|---|---|
| `/report/dashboard/day,week,month` | Загальна виручка / прибуток / замовлення | KPI на головну | ❌ |
| `/report/stock/all` | **Поточні залишки по всіх складах** | Inventory dashboard | ✅ Edge function `syncStock` готова |
| `/report/stock/bystore` | Залишки розбиті по складах | Multi-warehouse | ❌ |
| `/report/turnover` | **Оборотність товарів** | ABC + швидкість продажів | ❌ корисно |
| `/report/pnl` | **P&L (прибутки-збитки)** | Financial dashboard | ❌ критично — заміна нашого client-side |
| `/report/money/plotseries` | Графік грошей з періодизацією | Cash flow chart | ❌ |
| `/report/counterparty` | Звіт по клієнтах: lifetime, остання покупка | Customer 360 KPI | ❌ можна замінити наші views |
| `/report/sales/byproduct` | Звіт продажів по товарах | ТОП SKU | ❌ можна замінити наш |
| `/report/byOperations` | Звіт по операціях | — | ❌ |

---

## 4. КОЛИ КОРИСТУВАЧ ПРОСИТЬ → Я ДИВЛЮСЬ СЮДИ

### "Скільки відвантажили / штук продали / на яку суму?"
→ `sales_extended` (через `demand` sync) + Поле `quantity` + `revenue_uah`

### "Скільки отримали грошей від клієнта X?"
→ `moysklad_payments` (через `paymentin` sync) WHERE `counterparty_ms_id=X`

### "Який борг клієнта / прострочена дебіторка?"
→ `v_ar_aging` (через `invoiceout` + `paymentin`): `unpaid_uah` + `aging_bucket`

### "Скільки ми витратили на ___ (постачальник/сировина)?"
→ **ПОТРІБНО додати:** `paymentout` + `supply` sync. Зараз НЕ маємо.

### "Виробництво — який вихід готового з кг сировини? Маржа на собівартість?"
→ **ПОТРІБНО додати:** `processingplan` (тех.карти) + `productionTask` або `processing` (виробничі акти). Зараз НЕ маємо.

### "Витрати по статтях (оренда / зарплата / маркетинг)?"
→ **ПОТРІБНО додати:** `paymentout` + `expenseitem` + `payroll`. Зараз НЕ маємо.

### "Залишки на складах + Out-of-stock прогноз?"
→ Edge function має `syncStock` (через `/report/stock/all`). **Треба запустити + UI**. Готовий backend.

### "Замовлення в роботі (ще не відвантажені)?"
→ **ПОТРІБНО додати:** `customerorder` sync. Зараз НЕ маємо.

### "Що замовили у постачальників (procurement pipeline)?"
→ **ПОТРІБНО додати:** `purchaseorder` sync. Зараз НЕ маємо.

### "Втрати / списання / брак?"
→ **ПОТРІБНО додати:** `loss` sync. Зараз НЕ маємо.

### "Внутрішні переміщення між складами Мукачево ↔ Гуменне?"
→ **ПОТРІБНО додати:** `move` sync. Зараз НЕ маємо.

---

## 5. ПРІОРИТЕТ ДОДАТИ (за впливом на бізнес)

### 🔴 P0 — критично (повна P&L картина):
1. **`paymentout`** — куди йдуть гроші (Барпі витрачає)
2. **`supply`** — закупка сировини і собівартість
3. **`expenseitem`** — статті витрат для категоризації
4. **`payroll`** — зарплати (велика частина витрат)

### 🟡 P1 — для виробництва і прогнозів:
5. **`processingplan`** + **`processing`/`productionTask`** — собівартість і вихід продукції
6. **`stock`** — поточні залишки (готова функція, треба deploy)
7. **`loss`** — облік браку у виробництві
8. **`move`** — переміщення між заводами

### 🟢 P2 — для пайплайну:
9. **`customerorder`** — funnel замовлень (зробив → відвантажив)
10. **`purchaseorder`** — пайплайн закупок
11. **`contract`** — умови договорів (для AR aging кращої точності)

### 🔵 P3 — analytics shortcut (опційно):
12. `/report/pnl` — заміна нашого client-side P&L
13. `/report/turnover` — швидкість продажів
14. `/report/counterparty` — pre-agg клієнтів

---

## 6. ОБМЕЖЕННЯ API

- **Rate limit:** 45 запитів/сек, 200 одночасних запитів на акаунт
- **Pagination:** `limit=100` (max 1000), `offset`
- **Expand depth:** до 3 рівнів (`positions.assortment.product.salePrices`)
- **Дати:** формат `YYYY-MM-DD HH:mm:ss` (`moment>=2025-01-01 00:00:00`)
- **Soft delete:** `archived=true|false` параметр
- **Webhooks:** є для всіх документів — можна real-time замість cron

---

## 7. ПОТОЧНА АРХІТЕКТУРА BARPI SYNC

**Edge function `moysklad-sync` v7** (deployed 28.05.2026):
- Actions: `products` · `variants` · `bundles` · `services` · `counterparties` · `contactpersons` · `demand` · `paymentin` · `invoiceout` · `salesreturn` · `stock`
- Cron: `06:00 UTC щодня` — синкає `demand` за останні 7 днів + `paymentin` + `invoiceout` за тиждень
- Storage: `moysklad_products`, `moysklad_counterparties`, `moysklad_payments`, `moysklad_invoices`, `moysklad_returns`, `customer_contacts`, `sales_daily`, `inventory`
- Views: `sales_extended`, `v_customer_metrics`, `v_ar_aging`, `v_pay_ratio`, `v_returns_rate`, `v_cross_sell`, `v_customer_skus`, `v_customer_timeline`, `v_customer_dow`, `v_movers`, `v_portfolio_trend_12m`, `v_yoy_monthly`, `v_lost_cohorts`, `v_promo_response`, `v_customer_health_history`

---

## 8. POWER COMMANDS ДЛЯ КОРИСТУВАЧА

Коли треба отримати дані з МС яких немає в БД:

```bash
# Раз-разовий sync довільного діапазону
curl -X POST "https://zrcqmwlpsggiqgipvxhv.supabase.co/functions/v1/moysklad-sync?action=demand&date_from=2025-01-01&date_to=2026-05-28" \
  -H "Authorization: Bearer SUPA_KEY"

# Так само з paymentin / invoiceout / salesreturn / counterparties / stock / contactpersons
```

Якщо потрібно додати **нову сутність** (наприклад `supply`, `paymentout`, `processingplan`):
1. Додай таблицю в Supabase (SQL migration)
2. Додай sync-функцію в `moysklad-sync/index.ts` (`syncSupply`, `syncPaymentOut`, тощо)
3. Deploy edge function
4. Запусти sync
5. Створи view для аналітики
6. Додай блок у дашборд

Все автоматизовано через GitHub + Supabase MCP — мовчки.
