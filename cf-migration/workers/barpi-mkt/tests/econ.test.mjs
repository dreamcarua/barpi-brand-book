// node --test tests/  — формули калькулятора і post-analysis
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../../../../dashboard/marketing/lib/econ.js';
import * as R from '../../../../dashboard/marketing/lib/rules.js';

const st = { cost_per_kg: '620', pack_small: '6.5', pack_large: '10.5', pack_jar: '22.65', appetizer_g: '80', spec_change_date: '2026-09-14',
  preload_days: '7', post_days: '28', baseline_days: '56', abc_a: '80', abc_b: '95' };
const big = { name: 'Хрусткі смаколики Barpі «Печінка яловича»100г.', path: 'Готова продукція/Сушені ласощі 50\\60\\70 гр.' };
const small = { name: 'Хрусткі смаколики Barpі «Сир кульки»20г.', path: 'Готова продукція/Сушені Ласощі 20/15 гр.' };
const zef = { name: 'Хрусткі смаколики Barpі «Зефір яловичий» (легені)60г.', path: 'Готова продукція/Сушені ласощі 50\\60\\70 гр.' };
const jar = { name: 'Апетайзер Barpi «Печінка яловича» сушений подрібнений, 280 мл', path: 'Готова продукція/Апетайзери' };

test('собівартість пачки за каноном v4', () => {
  assert.equal(E.unitCost(small, '2026-10-01', st), 18.9);            // 620×0,02 + 6,5
  assert.equal(E.unitCost(big, '2026-09-13', st), 72.5);              // 100 г до 14.09
  assert.equal(E.unitCost(big, '2026-09-14', st), 53.9);              // 70 г з 14.09
  assert.equal(E.unitCost(zef, '2026-10-01', st), 41.5);              // зефір 50 г
  assert.equal(E.unitCost(jar, '2026-10-01', st), 72.25);             // 80 г + банка
  assert.equal(E.unitCost({ name: 'Зразок_Barpi_ЗЕФІР', path: 'Росхідні матеріали' }, '2026-10-01', st), 0);
});

test('break-even одного SKU: класична формула', () => {
  // ціна 100, собівартість 60 → GP 40; знижка 10 % → GP 30; потрібно 40/30 = +33,3 %
  const be = E.breakEven([{ u: 300, p: 100, c: 60, sd: 0.1 }], 0);
  assert.ok(be.ok);
  assert.ok(Math.abs(be.growth - 1 / 3) < 1e-9);
  assert.ok(Math.abs(be.beUnits - 400) < 1e-9);
  assert.ok(Math.abs(be.beRevenue - 400 * 90) < 1e-6);
});

test('break-even портфеля з витратами = один коефіцієнт росту', () => {
  const lines = [{ u: 100, p: 100, c: 60, sd: 0.1 }, { u: 50, p: 50, c: 20, sd: 0.1 }];
  const be = E.breakEven(lines, 500);
  const sc = E.scenario(lines, be.growth, 500);
  // у точці беззбитковості внесок промо дорівнює baseline-внеску
  assert.ok(Math.abs(sc.contribution - be.baseContribution) < 1e-6);
  assert.ok(Math.abs(sc.incProfit) < 1e-6);
});

test('знижка зʼїдає всю маржу → немає break-even', () => {
  const be = E.breakEven([{ u: 10, p: 100, c: 80, sd: 0.25 }]);
  assert.equal(be.ok, false);
  assert.equal(be.reason, 'negative_margin');
});

test('чистий baseline пропускає дні інших акцій', () => {
  const d = E.cleanDays('2026-03-31', 10, [{ start: '2026-03-25', end: '2026-03-28' }]);
  assert.equal(d.size, 10);
  assert.ok(!d.has('2026-03-26'));
  assert.ok(d.has('2026-03-24') && d.has('2026-03-31'));
});

test('post-analysis: подвоєння продажів при знижці 10 % дає прибуток, провал після зменшує ефект', () => {
  const pid = 'p1';
  const prods = { [pid]: { ...small, sku: 'B-1' } };
  const rows = [];
  const add = (d, q, price) => rows.push({ d, pid, q, net: q * price });
  // baseline: 2 пачки/день по 50 грн, 56 днів до вікна
  let d = '2026-01-01';
  while (d <= '2026-03-31') { add(d, 2, 50); d = E.addDays(d, 1); }
  // вікно: preload 7 днів + акція 14 днів — 4 пачки/день по 45 грн
  d = '2026-04-01';
  while (d <= '2026-04-21') { add(d, 4, 45); d = E.addDays(d, 1); }
  // після: 1 пачка/день 28 днів (провал)
  d = '2026-04-22';
  while (d <= '2026-05-19') { add(d, 1, 50); d = E.addDays(d, 1); }
  const r = E.analysePromo({ rows, prods, start: '2026-04-08', end: '2026-04-21', today: '2026-06-30', st, promoCost: 0 });
  assert.equal(r.windows.winFrom, '2026-04-01');
  assert.ok(Math.abs(r.upliftUnits - 1) < 1e-9);          // +100 %
  assert.ok(Math.abs(r.realizedDisc - 0.1) < 1e-9);       // фактична знижка 10 %
  assert.ok(Math.abs(r.pullForward - 28 / 42) < 1e-9);    // провал 28 пачок з 42 додаткових
  // GP/пачка: акція 45−18,9=26,1; база 50−18,9=31,1
  const incWin = 84 * 26.1 - 42 * 31.1, incPost = 28 * 31.1 - 56 * 31.1;
  assert.ok(Math.abs(r.incGpNet - (incWin + incPost)) < 0.05);
  assert.equal(r.verdict, r.contribution > 0 ? 'success' : 'partial');
});

test('увага і конфлікти', () => {
  const acts = [
    { id: 1, title: 'Pethouse −20%', start_date: '2026-11-05', end_date: '2026-11-20', status: 'approval', direction: 'partners', partner_id: 2, activity_type: 'Знижка', discount_pct: 20, skus: '["B-1"]', budget_plan: 0 },
    { id: 2, title: 'Barpi.ua −15%', start_date: '2026-11-10', end_date: '2026-11-15', status: 'approved', direction: 'ecom', partner_id: 5, activity_type: 'Promo Barpi.ua', discount_pct: 15, skus: '["B-1"]', owner: 'a@b.c', file_url: 'x', budget_plan: 100 },
  ];
  const att = R.attention(acts, '2026-11-01');
  assert.ok(att.find((x) => x.id === 1 && x.code === 't14_not_approved'));
  assert.ok(att.find((x) => x.id === 1 && x.code === 't7_not_ready' && x.missing.includes('owner')));
  const c = R.conflicts(acts, '2026-11-01', '2026-11-30');
  assert.ok(c.find((x) => x.code === 'promo_overlap' && x.level === 'bad'));
  assert.ok(c.find((x) => x.code === 'sku_price_conflict'));
});

test('ICS: стабільний UID і дата кінця не включно', () => {
  const s = R.buildIcs([{ id: 7, title: 'Black Friday', start_date: '2026-11-23', end_date: '2026-11-30', status: 'approved', updated_at: '2026-10-20 10:00:00' }], [], '2026-10-20T10:00:00.000Z', 'https://x/', {});
  assert.match(s, /UID:barpi-mkt-7@brand\.barpi\.ua/);
  assert.match(s, /DTSTART;VALUE=DATE:20261123/);
  assert.match(s, /DTEND;VALUE=DATE:20261201/);
  assert.ok(s.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));
});
