// ═══════════════════════════════════════════════════════════════════════════
// barpi-mkt · маркетинговий календар і калькулятор промо Barpi (рішення Вадима 20.10.2026).
//   brand.barpi.ua/dashboard/api/mkt/*   API сторінки /dashboard/marketing/ (за Cloudflare Access;
//                                        воркер додатково перевіряє підпис JWT Access)
//   brand.barpi.ua/mkt-ics/<token>.ics   ICS-підписка для Google/Apple Calendar (токен — секрет ICS_TOKEN)
// D1 barpi-bible: таблиці mkt_* (migrations/), читає moysklad_*, sales_sku, sync_state; пише дзеркало
// акцій Barpi.ua у ad_events для ad-director (рішення 20.10.2026: календар — єдине джерело акцій).
// Формули — dashboard/marketing/lib/econ.js і rules.js (той самий код виконує сторінка в браузері).
// ═══════════════════════════════════════════════════════════════════════════
import { EmailMessage } from 'cloudflare:email';
import { accessUser } from './access.js';
import * as E from '../../../../dashboard/marketing/lib/econ.js';
import * as R from '../../../../dashboard/marketing/lib/rules.js';

const VERSION = '1.0.0';
const PAGE_URL = 'https://brand.barpi.ua/dashboard/marketing/';
const STATUS_UK = { idea: 'Ідея', planned: 'Заплановано', approval: 'На погодженні', approved: 'Погоджено', prep: 'У підготовці',
  ready: 'Готово до запуску', active: 'Активно', done: 'Завершено', postponed: 'Відкладено', cancelled: 'Скасовано' };

// ── утиліти ─────────────────────────────────────────────────────────────────
const J = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', ...extra },
});
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const str = (v, max = 300) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const numOrNull = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(+v) ? null : +v);
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const nowIso = () => new Date().toISOString();
const parseJson = (s, d) => { try { const v = JSON.parse(s); return v ?? d; } catch (e) { return d; } };
async function body(req) { try { return await req.json(); } catch (e) { return null; } }
const all = async (env, sql, ...b) => (await env.DB.prepare(sql).bind(...b).all()).results || [];
const first = (env, sql, ...b) => env.DB.prepare(sql).bind(...b).first();
const run = (env, sql, ...b) => env.DB.prepare(sql).bind(...b).run();

async function settings(env) {
  const rows = await all(env, 'SELECT k, v FROM mkt_settings');
  return Object.fromEntries(rows.map((r) => [r.k, r.v]));
}
async function audit(env, actor, action, entity, id, before, after) {
  try {
    await run(env, 'INSERT INTO mkt_audit (actor, action, entity, entity_id, before, after) VALUES (?,?,?,?,?,?)',
      actor, action, entity, String(id ?? ''), before ? JSON.stringify(before).slice(0, 8000) : null, after ? JSON.stringify(after).slice(0, 8000) : null);
  } catch (e) { console.error('[mkt/audit]', e.message); }
}

// ── партнери → контрагенти МойСклад ────────────────────────────────────────
async function partnersAll(env) {
  const rows = await all(env, 'SELECT * FROM mkt_partners ORDER BY active DESC, name');
  return rows.map((p) => ({ ...p, cp_ids: parseJson(p.cp_ids, []) }));
}
// ms_id контрагентів партнера; 'fop' = усі ФОП, не закріплені за іншими партнерами
async function partnerCpIds(env, partner, partners) {
  const ids = new Set(partner.cp_ids || []);
  if (partner.cp_rule === 'fop') {
    const taken = new Set(partners.filter((p) => p.id !== partner.id).flatMap((p) => p.cp_ids || []));
    const fops = await all(env, "SELECT ms_id FROM moysklad_counterparties WHERE ms_name LIKE 'ФОП%'");
    fops.forEach((f) => { if (!taken.has(f.ms_id)) ids.add(f.ms_id); });
  }
  return [...ids];
}
// Денні рядки продажів (sell-in) по контрагентах: виручка без ПДВ
async function salesRows(env, cpIds, from, to, st) {
  if (!cpIds.length) return [];
  const vat = 1 + E.num(st, 'vat_rate', 20) / 100;
  const out = [];
  for (let i = 0; i < cpIds.length; i += 80) {
    const chunk = cpIds.slice(i, i + 80);
    const rows = await all(env,
      `SELECT substr(moment,1,10) d, product_ms_id pid, SUM(qty) q, SUM(sum_uah) gross, COUNT(DISTINCT demand_ms_id) docs
         FROM sales_sku WHERE agent_ms_id IN (${chunk.map(() => '?').join(',')}) AND moment >= ? AND moment < ?
        GROUP BY d, pid`, ...chunk, from, E.addDays(to, 1));
    rows.forEach((r) => out.push({ d: r.d, pid: r.pid, q: +r.q || 0, net: (+r.gross || 0) / vat, docs: r.docs }));
  }
  return out;
}
async function returnsSum(env, cpIds, from, to, st) {
  if (!cpIds.length) return 0;
  const vat = 1 + E.num(st, 'vat_rate', 20) / 100;
  let s = 0;
  for (let i = 0; i < cpIds.length; i += 80) {
    const chunk = cpIds.slice(i, i + 80);
    const r = await first(env, `SELECT COALESCE(SUM(sum_uah),0) s FROM moysklad_returns WHERE agent_ms_id IN (${chunk.map(() => '?').join(',')}) AND moment >= ? AND moment < ?`,
      ...chunk, from, E.addDays(to, 1));
    s += +r.s || 0;
  }
  return s / vat;
}
let prodCache = { at: 0, map: null };
async function products(env) {
  if (prodCache.map && Date.now() - prodCache.at < 10 * 60 * 1000) return prodCache.map;
  const rows = await all(env, `SELECT ms_id, ms_name, sku_id, ms_path, ms_archived, unit_price,
      json_extract(raw_json,'$.salePrices[0].value') p0, json_extract(raw_json,'$.salePrices[1].value') p1,
      (SELECT SUM(stock_qty) FROM moysklad_stock_by_store s WHERE s.product_ms_id = p.ms_id) stock
    FROM moysklad_products p`);
  const map = {};
  rows.forEach((r) => {
    map[r.ms_id] = { pid: r.ms_id, name: r.ms_name, sku: r.sku_id, path: r.ms_path || '', archived: !!r.ms_archived,
      price_opt: r.p0 ? r.p0 / 100 : r.unit_price, price_net: r.p1 ? r.p1 / 100 : null, stock: Math.max(0, +r.stock || 0) };
  });
  prodCache = { at: Date.now(), map };
  return map;
}
async function freshness(env) {
  const r = await first(env, "SELECT MAX(moment) last_doc, (SELECT last_synced_at FROM sync_state WHERE entity='demand') synced FROM moysklad_demand");
  return r || {};
}

// ── активності ──────────────────────────────────────────────────────────────
const ACT_FIELDS = ['title', 'campaign', 'start_date', 'end_date', 'prep_date', 'direction', 'partner_id', 'activity_type', 'mechanic',
  'discount_pct', 'supplier_discount_pct', 'channel', 'owner', 'priority', 'status', 'budget_plan', 'cost_fact', 'file_url', 'post_url',
  'skus', 'kpi_name', 'kpi_plan', 'kpi_fact', 'result', 'decision', 'comment', 'checklist', 'promo_code', 'landing_url', 'calc_id',
  'sellout_units', 'sellout_revenue'];
const NUMS = new Set(['partner_id', 'discount_pct', 'supplier_discount_pct', 'budget_plan', 'cost_fact', 'kpi_plan', 'kpi_fact', 'calc_id', 'sellout_units', 'sellout_revenue']);
function cleanAct(b, cur) {
  const a = { ...(cur || {}) };
  for (const k of ACT_FIELDS) {
    if (b[k] === undefined) continue;
    if (NUMS.has(k)) a[k] = numOrNull(b[k]);
    else if (k === 'skus' || k === 'checklist') a[k] = b[k] == null ? null : (typeof b[k] === 'string' ? b[k] : JSON.stringify(b[k])).slice(0, 4000);
    else a[k] = str(b[k], ['comment', 'mechanic'].includes(k) ? 3000 : k.endsWith('url') ? 1000 : 200);
  }
  if (a.budget_plan == null) a.budget_plan = 0;
  if (a.cost_fact == null) a.cost_fact = 0;
  if (!a.priority) a.priority = 'P2';
  if (!a.status) a.status = 'planned';
  if (!a.end_date && a.start_date) a.end_date = a.start_date;
  if (a.owner) a.owner = a.owner.toLowerCase();
  if (!a.title) return { err: 'title' };
  if (!isDay(a.start_date) || !isDay(a.end_date) || a.end_date < a.start_date) return { err: 'dates' };
  if (a.prep_date && !isDay(a.prep_date)) return { err: 'prep_date' };
  if (!R.DIRECTIONS.includes(a.direction)) return { err: 'direction' };
  if (!R.STATUSES.includes(a.status)) return { err: 'status' };
  if (!R.PRIORITIES.includes(a.priority)) return { err: 'priority' };
  for (const k of ['discount_pct', 'supplier_discount_pct']) if (a[k] != null && (a[k] < 0 || a[k] > 100)) return { err: k };
  for (const k of ['budget_plan', 'cost_fact']) if (a[k] < 0) return { err: k };
  return { a };
}
async function activities(env, from = '2000-01-01', to = '2999-12-31') {
  return all(env, 'SELECT * FROM mkt_activities WHERE deleted=0 AND end_date >= ? AND start_date <= ? ORDER BY start_date, id', from, to);
}

// Kyiv-день → UTC ISO початку дня (для ad_events, вікно half-open)
function kyivMidnightUtc(day) {
  const guess = new Date(day + 'T00:00:00Z');
  const off = (d) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kyiv', hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - d.getTime();
  };
  return new Date(guess.getTime() - off(guess)).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
// Дзеркало акцій Barpi.ua в ad_events: ad-director вмикає рекламу акції лише у її вікні
async function mirrorAdEvent(env, a, partners, who) {
  const own = partners.find((p) => p.ptype === 'own');
  const isSite = a.direction === 'ecom' && (a.channel === 'Barpi.ua' || (own && a.partner_id === own.id));
  const isPromo = R.PRICE_TYPES.includes(a.activity_type);
  if (!a.ad_event_id && !(isSite && isPromo)) return null;
  const id = a.ad_event_id || `mkt-${a.id}`;
  const today = E.kyivToday();
  const dead = a.deleted || ['cancelled', 'postponed', 'idea'].includes(a.status) || !(isSite && isPromo);
  const status = dead ? 'cancelled' : (a.start_date <= today && a.end_date >= today ? 'live' : 'planned');
  const mech = a.mechanic || (a.discount_pct ? `−${a.discount_pct} %` : a.title);
  await run(env, `INSERT INTO ad_events (id, project, kind, title, mechanic, promo_code, landing_url, client_text, starts_at, ends_at, status, note, updated_by, updated_at)
      VALUES (?, 'barpi', 'promo', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, mechanic=excluded.mechanic, promo_code=excluded.promo_code,
        landing_url=excluded.landing_url, starts_at=excluded.starts_at, ends_at=excluded.ends_at, status=excluded.status,
        note=excluded.note, updated_by=excluded.updated_by, updated_at=excluded.updated_at`,
  a.title.slice(0, 120), mech.slice(0, 500), a.promo_code, a.landing_url, kyivMidnightUtc(a.start_date), kyivMidnightUtc(E.addDays(a.end_date, 1)),
  status, `з маркетингового календаря, активність #${a.id}`, who || 'barpi-mkt');
  if (!a.ad_event_id) await run(env, 'UPDATE mkt_activities SET ad_event_id=? WHERE id=?', id, a.id);
  return id;
}

// ── аналітика контрагента / партнера ──────────────────────────────────────────
async function partnerAnalytics(env, partnerId, from, to) {
  const st = await settings(env);
  const partners = await partnersAll(env);
  const p = partners.find((x) => x.id === +partnerId);
  if (!p) return { error: 'partner' };
  const cp = await partnerCpIds(env, p, partners);
  const [rows, prods, ret] = await Promise.all([salesRows(env, cp, from, to, st), products(env), returnsSum(env, cp, from, to, st)]);
  const bySku = {}, byMonth = {};
  let units = 0, rev = 0, cogs = 0;
  const docs = new Set();
  for (const r of rows) {
    const pr = prods[r.pid];
    if (!pr || !E.isFinished(pr)) continue;
    const c = E.unitCost(pr, r.d, st) * r.q;
    const s = bySku[r.pid] || (bySku[r.pid] = { pid: r.pid, sku: pr.sku, name: pr.name, units: 0, revenue: 0, cogs: 0, stock: pr.stock });
    s.units += r.q; s.revenue += r.net; s.cogs += c;
    const m = byMonth[r.d.slice(0, 7)] || (byMonth[r.d.slice(0, 7)] = { ym: r.d.slice(0, 7), units: 0, revenue: 0, cogs: 0 });
    m.units += r.q; m.revenue += r.net; m.cogs += c;
    units += r.q; rev += r.net; cogs += c; docs.add(r.d);
  }
  const skus = Object.values(bySku);
  const abc = E.abcClasses(skus, st);
  const gpTot = rev - cogs;
  skus.forEach((s) => { s.gp = s.revenue - s.cogs; s.margin = s.revenue ? s.gp / s.revenue : null; s.share = rev ? s.revenue / rev : 0; s.gp_share = gpTot ? s.gp / gpTot : 0; s.abc = abc[s.pid]; });
  skus.sort((a, b) => b.revenue - a.revenue);
  const months = Object.values(byMonth).sort((a, b) => a.ym.localeCompare(b.ym)).map((m) => ({ ...m, gp: m.revenue - m.cogs, margin: m.revenue ? (m.revenue - m.cogs) / m.revenue : null }));
  const nMonths = Math.max(1, E.daysIncl(from, to) / 30.44);
  const last = await first(env, `SELECT MAX(moment) m FROM sales_sku WHERE agent_ms_id IN (${cp.map(() => '?').join(',') || "''"})`, ...cp);
  return {
    partner: { id: p.id, name: p.name, ptype: p.ptype, counterparties: cp.length }, from, to,
    kpi: { units, revenue: rev, cogs, gp: gpTot, margin: rev ? gpTot / rev : null, returns: ret, ship_days: docs.size, active_skus: skus.filter((s) => s.units > 0).length,
      avg_month_revenue: rev / nMonths, avg_month_gp: gpTot / nMonths, last_sale: last && last.m },
    months, skus,
  };
}

// ── post-analysis активності ──────────────────────────────────────────────────
async function analyseActivity(env, a, ctx) {
  const st = ctx.st, today = E.kyivToday();
  const p = ctx.partners.find((x) => x.id === a.partner_id);
  if (!p || p.ptype === 'event') return { activity_id: a.id, skipped: 'no_sales_partner' };
  const cp = await partnerCpIds(env, p, ctx.partners);
  if (!cp.length) return { activity_id: a.id, skipped: 'no_counterparty' };
  const preload = E.num(st, 'preload_days', 7), bN = E.num(st, 'baseline_days', 56), postN = E.num(st, 'post_days', 28);
  const from = E.addDays(a.start_date, -(preload + bN + 200)), to = E.minDate(E.addDays(a.end_date, postN), today);
  const rows = await salesRows(env, cp, from, to, st);
  const exclude = ctx.acts.filter((x) => x.id !== a.id && x.partner_id === a.partner_id && R.PRICE_TYPES.includes(x.activity_type) && x.status !== 'cancelled')
    .map((x) => ({ start: x.start_date, end: x.end_date }));
  const res = E.analysePromo({ rows, prods: ctx.prods, start: a.start_date, end: a.end_date, today, st, promoCost: +a.cost_fact || +a.budget_plan || 0, exclude });
  res.activity_id = a.id; res.partner_id = a.partner_id; res.partner = p.name; res.title = a.title;
  res.start_date = a.start_date; res.end_date = a.end_date; res.discount_pct = a.discount_pct; res.supplier_discount_pct = a.supplier_discount_pct;
  res.kpi_plan = a.kpi_plan; res.kpi_name = a.kpi_name;
  res.returns = await returnsSum(env, cp, E.addDays(a.start_date, -preload), E.minDate(E.addDays(a.end_date, postN), today), st);
  if (a.sellout_units != null) res.sellout = { units: a.sellout_units, revenue: a.sellout_revenue };
  return res;
}
async function analysisCtx(env) {
  const [st, partners, prods, acts] = await Promise.all([settings(env), partnersAll(env), products(env), activities(env)]);
  return { st, partners, prods, acts };
}
async function analyseAndStore(env, a, ctx) {
  const res = await analyseActivity(env, a, ctx);
  await run(env, 'INSERT INTO mkt_analysis (activity_id, computed_at, data) VALUES (?,?,?) ON CONFLICT(activity_id) DO UPDATE SET computed_at=excluded.computed_at, data=excluded.data',
    a.id, nowIso(), JSON.stringify(res));
  return res;
}
// Усі цінові партнерські акції, що вже стартували: перерахунок аналізу
async function analyseAll(env, onlyStale = false) {
  const ctx = await analysisCtx(env);
  const today = E.kyivToday();
  const postN = E.num(ctx.st, 'post_days', 28);
  const targets = ctx.acts.filter((a) => (a.direction === 'partners' || a.direction === 'ecom') && R.PRICE_TYPES.includes(a.activity_type)
    && a.status !== 'cancelled' && a.status !== 'idea' && a.partner_id && E.addDays(a.start_date, -E.num(ctx.st, 'preload_days', 7)) <= today);
  const cached = Object.fromEntries((await all(env, 'SELECT activity_id, computed_at FROM mkt_analysis')).map((r) => [r.activity_id, r.computed_at]));
  let n = 0;
  for (const a of targets) {
    // завершений аналіз (вікно провалу закрите) не перераховуємо щоночі
    if (onlyStale && cached[a.id] && E.addDays(a.end_date, postN + 2) < today && cached[a.id].slice(0, 10) > E.addDays(a.end_date, postN)) continue;
    try { await analyseAndStore(env, a, ctx); n++; } catch (e) { console.error('[mkt/analyse]', a.id, e.message); }
  }
  return n;
}
async function insights(env) {
  const ctx = await analysisCtx(env);
  const rows = await all(env, 'SELECT activity_id, data FROM mkt_analysis');
  const an = rows.map((r) => parseJson(r.data, null)).filter((x) => x && !x.skipped);
  const today = E.kyivToday(), bN = E.num(ctx.st, 'baseline_days', 56);
  const byPartner = {};
  an.forEach((x) => { (byPartner[x.partner_id] || (byPartner[x.partner_id] = [])).push(x); });
  const out = [];
  for (const [pid, list] of Object.entries(byPartner)) {
    list.sort((a, b) => a.start_date.localeCompare(b.start_date));
    const p = ctx.partners.find((x) => x.id === +pid);
    if (!p) continue;
    const cur = await currentRates(env, p, ctx, E.addDays(today, -bN), today);
    const rec = E.recommendNext(list.filter((x) => x.verdict), cur, ctx.st);
    const share = E.promoShare(ctx.acts.filter((a) => a.partner_id === +pid && R.PRICE_TYPES.includes(a.activity_type) && a.status !== 'cancelled'), today, 90);
    if (share * 100 >= E.num(ctx.st, 'promo_share_warn', 50)) rec.tips.unshift({ code: 'promo_is_norm', level: 'bad', share });
    const done = list.filter((x) => x.verdict);
    out.push({
      partner_id: +pid, partner: p.name, n: list.length, current: cur, rec,
      success: done.filter((x) => x.verdict === 'success').length, partial: done.filter((x) => x.verdict === 'partial').length,
      fail: done.filter((x) => x.verdict === 'fail').length,
      avg_uplift: avg(done.map((x) => x.upliftUnits)), avg_disc: avg(done.map((x) => x.realizedDisc)),
      sum_contribution: done.reduce((s, x) => s + (x.contribution || 0), 0), avg_roi: avg(done.map((x) => x.roi)),
      promo_share_90d: share,
      list: list.map((x) => ({ activity_id: x.activity_id, title: x.title, start_date: x.start_date, end_date: x.end_date, verdict: x.verdict,
        upliftUnits: x.upliftUnits, realizedDisc: x.realizedDisc, contribution: x.contribution, roi: x.roi, pullForward: x.pullForward, flags: x.flags })),
    });
  }
  out.sort((a, b) => b.n - a.n);
  return { partners: out, computed: rows.length };
}
const avg = (a) => { const v = a.filter((x) => x !== null && x !== undefined && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
// Поточний темп партнера: пачок/день, середня ціна без ПДВ, валовий прибуток з пачки
async function currentRates(env, p, ctx, from, to) {
  const cp = await partnerCpIds(env, p, ctx.partners);
  const rows = await salesRows(env, cp, from, to, ctx.st);
  let q = 0, net = 0, cost = 0;
  rows.forEach((r) => { const pr = ctx.prods[r.pid]; if (!pr || !E.isFinished(pr)) return; q += r.q; net += r.net; cost += E.unitCost(pr, r.d, ctx.st) * r.q; });
  const days = E.daysIncl(from, to);
  return { rateQ: q / days, price: q ? net / q : 0, gpu: q ? (net - cost) / q : 0, units: q, days };
}

// ── baseline для калькулятора ──────────────────────────────────────────────────
// method: d28 | w4 | prev_month | avg3m | last_year | custom
function baselineWindow(method, start, end, bf, bt) {
  const s = start;
  if (method === 'custom' && isDay(bf) && isDay(bt) && bt >= bf) return [bf, bt];
  if (method === 'w4') { // 4 повні тижні пн–нд до старту
    const d = new Date(s + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; const lastSun = E.addDays(s, -dow - 1);
    return [E.addDays(lastSun, -27), lastSun];
  }
  if (method === 'prev_month') { const m0 = s.slice(0, 7) + '-01'; const pe = E.addDays(m0, -1); return [pe.slice(0, 7) + '-01', pe]; }
  if (method === 'avg3m') { const m0 = s.slice(0, 7) + '-01'; const pe = E.addDays(m0, -1); const d = new Date(m0 + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 3); return [E.ymd(d), pe]; }
  if (method === 'last_year') { const y = (x) => (+x.slice(0, 4) - 1) + x.slice(4); return [y(s), y(end)]; }
  return [E.addDays(s, -28), E.addDays(s, -1)];
}
async function calcBase(env, q) {
  const st = await settings(env);
  const partners = await partnersAll(env);
  const p = partners.find((x) => x.id === +q.get('partner_id'));
  if (!p) return { error: 'partner' };
  const start = q.get('start'), end = q.get('end');
  if (!isDay(start) || !isDay(end) || end < start) return { error: 'dates' };
  const method = q.get('method') || 'd28';
  const today = E.kyivToday();
  let [bf, bt] = baselineWindow(method, start, end, q.get('bfrom'), q.get('bto'));
  if (bt >= today) bt = E.addDays(today, -1);
  const cp = await partnerCpIds(env, p, partners);
  const [rows, prods] = await Promise.all([salesRows(env, cp, bf, bt, st), products(env)]);
  const bDays = Math.max(1, E.daysIncl(bf, bt)), pDays = E.daysIncl(start, end);
  const k = pDays / bDays;
  const agg = {};
  rows.forEach((r) => { const x = agg[r.pid] || (agg[r.pid] = { q: 0, net: 0 }); x.q += r.q; x.net += r.net; });
  const vat = 1 + E.num(st, 'vat_rate', 20) / 100;
  const lines = [];
  for (const pr of Object.values(prods)) {
    if (!E.isFinished(pr) || pr.archived && !agg[pr.pid]) continue;
    const a = agg[pr.pid] || { q: 0, net: 0 };
    const price = a.q > 0 ? a.net / a.q : (pr.price_opt ? pr.price_opt / vat : 0);
    const cost = E.unitCost(pr, start, st);
    lines.push({ pid: pr.pid, sku: pr.sku, name: pr.name, kind: E.skuKind(pr), base_units_period: a.q, base_revenue_period: a.net,
      u: a.q * k, p: price, c: cost, stock: pr.stock, price_source: a.q > 0 ? 'fact' : 'price_list', revenue: a.net });
  }
  const abc = E.abcClasses(lines.map((l) => ({ pid: l.pid, revenue: l.revenue })), st);
  lines.forEach((l) => { l.abc = l.revenue > 0 ? abc[l.pid] : null; l.gpu = l.p - l.c; l.margin = l.p ? (l.p - l.c) / l.p : null; });
  lines.sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
  // історія відгуку партнера на знижку — для прогнозу
  const ctx = { st, partners, prods, acts: await activities(env) };
  const hist = (await all(env, 'SELECT data FROM mkt_analysis')).map((r) => parseJson(r.data, null)).filter((x) => x && x.partner_id === p.id && x.verdict);
  const cur = await currentRates(env, p, ctx, E.addDays(today, -E.num(st, 'baseline_days', 56)), today);
  const rec = E.recommendNext(hist, cur, st);
  return { partner: { id: p.id, name: p.name }, start, end, method, baseline: { from: bf, to: bt, days: bDays }, promo_days: pDays, factor: k,
    lines, settings: st, history: { n: hist.length, k: rec.k, pullForward: rec.pullForward, assumedK: rec.assumedK, tips: rec.tips, grid: rec.grid } };
}

// ── сповіщення ──────────────────────────────────────────────────────────────
const listOf = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
async function tg(env, text) {
  let n = 0;
  if (!env.TG_TOKEN) return 0;
  for (const chat of listOf(env.MKT_TG_CHATS)) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }) });
      if (r.ok) n++; else console.error('[mkt/tg]', r.status);
    } catch (e) { console.error('[mkt/tg]', e.message); }
  }
  return n;
}
const b64utf8 = (s) => { const b = new TextEncoder().encode(s); let x = ''; for (let i = 0; i < b.length; i++) x += String.fromCharCode(b[i]); return btoa(x); };
function mailRaw(from, to, subject, html) {
  const id = `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}@barpi.com.ua>`;
  return [`From: =?UTF-8?B?${b64utf8('Barpi Маркетинг')}?= <${from}>`, `To: ${to}`, `Subject: =?UTF-8?B?${b64utf8(subject)}?=`,
    `Date: ${new Date().toUTCString()}`, `Message-ID: ${id}`, 'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '', b64utf8(html).replace(/.{1,76}/g, (m) => m + '\r\n')].join('\r\n');
}
async function mail(env, tos, subject, html) {
  const sent = [], failed = [];
  if (!env.MKT_MAIL || !env.MKT_MAIL_FROM) return { sent, failed: ['no_binding'] };
  for (const to of [...new Set(tos.map((x) => x.toLowerCase()))]) {
    try { await env.MKT_MAIL.send(new EmailMessage(env.MKT_MAIL_FROM, to, mailRaw(env.MKT_MAIL_FROM, to, subject, html))); sent.push(to); }
    catch (e) { failed.push(to + ': ' + String(e.message || e).slice(0, 100)); }
  }
  return { sent, failed };
}
// Щоденний дайджест о digest_hour_kyiv: Telegram + лист; персональний лист відповідальному лише про його активності
async function digest(env, force = false) {
  const st = await settings(env);
  const today = E.kyivToday();
  if (!force && E.kyivHour() !== E.num(st, 'digest_hour_kyiv', 9)) return { skipped: 'hour' };
  if (!force) {
    const done = await first(env, "SELECT 1 x FROM mkt_notify WHERE day=? AND kind='digest' AND ref='all'", today);
    if (done) return { skipped: 'done' };
  }
  const acts = await activities(env, E.addDays(today, -90), E.addDays(today, 60));
  const att = R.attention(acts, today);
  const conf = R.conflicts(acts, today, E.addDays(today, 30));
  const startingToday = acts.filter((a) => a.start_date === today && !['cancelled', 'postponed', 'idea'].includes(a.status));
  const text = R.digestText(att, conf, startingToday, esc, PAGE_URL);
  const out = { tg: 0, mail: null, items: att.length };
  if (text) {
    out.tg = await tg(env, text);
    const html = '<div style="font-family:Arial,sans-serif;color:#001154;font-size:14px;line-height:1.6">' +
      text.split('\n').map((l) => (l.startsWith('http') ? `<p><a href="${l}" style="display:inline-block;background:#001154;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Відкрити календар</a></p>` : l || '<br>')).join('<br>') + '</div>';
    const owners = [...new Set(att.filter((x) => x.level !== 'info' || x.code === 't1_tomorrow').map((x) => x.owner).filter(Boolean))];
    out.mail = await mail(env, [...listOf(env.MKT_NOTIFY_EMAIL), ...owners.filter((o) => listOf(env.MKT_OWNER_MAIL_OK || '*').some((w) => w === '*' || w === o))],
      `Маркетинговий календар Barpi · ${today.slice(8, 10)}.${today.slice(5, 7)}`, html);
  }
  await run(env, "INSERT OR REPLACE INTO mkt_notify (day, kind, ref) VALUES (?, 'digest', 'all')", today);
  return out;
}

// ── роутер API ────────────────────────────────────────────────────────────────
async function api(req, env, path, url, who) {
  const m = req.method;
  const q = url.searchParams;

  if (path === 'bootstrap' && m === 'GET') {
    const today = E.kyivToday();
    const [st, partners, acts, budget, fresh] = await Promise.all([settings(env), partnersAll(env), activities(env), all(env, 'SELECT * FROM mkt_budget ORDER BY ym'), freshness(env)]);
    const an = Object.fromEntries((await all(env, 'SELECT activity_id, data FROM mkt_analysis')).map((r) => {
      const d = parseJson(r.data, {});
      return [r.activity_id, { verdict: d.verdict, upliftUnits: d.upliftUnits, contribution: d.contribution, roi: d.roi, realizedDisc: d.realizedDisc, skipped: d.skipped, flags: d.flags }];
    }));
    const users = await all(env, "SELECT DISTINCT owner FROM mkt_activities WHERE owner IS NOT NULL AND deleted=0");
    return J({ me: who, today, version: VERSION, settings: st, partners, activities: acts, budget, analysis: an, freshness: fresh,
      attention: R.attention(acts, today), conflicts: R.conflicts(acts, E.addDays(today, -7), E.addDays(today, 90), E.num(st, 'max_per_day', 6)),
      owners: [...new Set([...listOf(env.MKT_TEAM), ...users.map((u) => u.owner)])], dicts: { types: R.TYPES, price_types: R.PRICE_TYPES, statuses: R.STATUSES } });
  }

  if (path === 'activities' && m === 'POST') {
    const b = await body(req); if (!b) return J({ error: 'json' }, 400);
    const { a, err } = cleanAct(b);
    if (err) return J({ error: 'invalid', field: err }, 400);
    const cols = ACT_FIELDS.filter((k) => a[k] !== undefined);
    const r = await run(env, `INSERT INTO mkt_activities (${cols.join(',')}, source, created_by, updated_by) VALUES (${cols.map(() => '?').join(',')}, ?, ?, ?)`,
      ...cols.map((k) => a[k]), str(b.source, 40) || 'manual', who, who);
    const id = r.meta.last_row_id;
    const row = await first(env, 'SELECT * FROM mkt_activities WHERE id=?', id);
    await audit(env, who, 'create', 'activity', id, null, row);
    await mirrorAdEvent(env, row, await partnersAll(env), who);
    return J({ ok: true, activity: await first(env, 'SELECT * FROM mkt_activities WHERE id=?', id) });
  }
  let mm = path.match(/^activities\/(\d+)$/);
  if (mm && (m === 'PUT' || m === 'PATCH')) {
    const cur = await first(env, 'SELECT * FROM mkt_activities WHERE id=? AND deleted=0', +mm[1]);
    if (!cur) return J({ error: 'not_found' }, 404);
    if (b_ver(req) && cur.updated_at !== b_ver(req)) return J({ error: 'conflict', current: cur }, 409);
    const b = await body(req); if (!b) return J({ error: 'json' }, 400);
    const { a, err } = cleanAct(b, cur);
    if (err) return J({ error: 'invalid', field: err }, 400);
    await run(env, `UPDATE mkt_activities SET ${ACT_FIELDS.map((k) => k + '=?').join(',')}, updated_at=strftime('%Y-%m-%d %H:%M:%f','now'), updated_by=? WHERE id=?`,
      ...ACT_FIELDS.map((k) => (a[k] === undefined ? null : a[k])), who, cur.id);
    const row = await first(env, 'SELECT * FROM mkt_activities WHERE id=?', cur.id);
    await audit(env, who, 'update', 'activity', cur.id, cur, row);
    await mirrorAdEvent(env, row, await partnersAll(env), who);
    return J({ ok: true, activity: row });
  }
  if (mm && m === 'DELETE') {
    const cur = await first(env, 'SELECT * FROM mkt_activities WHERE id=? AND deleted=0', +mm[1]);
    if (!cur) return J({ error: 'not_found' }, 404);
    await run(env, "UPDATE mkt_activities SET deleted=1, updated_at=strftime('%Y-%m-%d %H:%M:%f','now'), updated_by=? WHERE id=?", who, cur.id);
    await audit(env, who, 'delete', 'activity', cur.id, cur, null);
    await mirrorAdEvent(env, { ...cur, deleted: 1 }, await partnersAll(env), who);
    return J({ ok: true });
  }
  if (mm && m === 'GET') {
    const a = await first(env, 'SELECT * FROM mkt_activities WHERE id=?', +mm[1]);
    if (!a) return J({ error: 'not_found' }, 404);
    const hist = await all(env, "SELECT at, actor, action FROM mkt_audit WHERE entity='activity' AND entity_id=? ORDER BY id DESC LIMIT 30", String(a.id));
    const an = await first(env, 'SELECT computed_at, data FROM mkt_analysis WHERE activity_id=?', a.id);
    const calc = a.calc_id ? await first(env, 'SELECT * FROM mkt_calcs WHERE id=?', a.calc_id) : null;
    return J({ activity: a, history: hist, analysis: an ? { computed_at: an.computed_at, ...parseJson(an.data, {}) } : null, calc });
  }
  mm = path.match(/^activities\/(\d+)\/analyse$/);
  if (mm && m === 'POST') {
    const ctx = await analysisCtx(env);
    const a = ctx.acts.find((x) => x.id === +mm[1]);
    if (!a) return J({ error: 'not_found' }, 404);
    return J({ ok: true, analysis: await analyseAndStore(env, a, ctx) });
  }
  if (path === 'analyse-all' && m === 'POST') return J({ ok: true, n: await analyseAll(env, false) });
  if (path === 'insights' && m === 'GET') return J(await insights(env));

  if (path === 'partners' && m === 'POST') {
    const b = await body(req); if (!b || !str(b.name, 120)) return J({ error: 'name' }, 400);
    try {
      const r = await run(env, 'INSERT INTO mkt_partners (name, ptype, cp_ids, cp_rule, note, active) VALUES (?,?,?,?,?,1)',
        str(b.name, 120), str(b.ptype, 30) || 'other', JSON.stringify(Array.isArray(b.cp_ids) ? b.cp_ids.slice(0, 50) : []), b.cp_rule === 'fop' ? 'fop' : null, str(b.note, 500));
      await audit(env, who, 'create', 'partner', r.meta.last_row_id, null, b);
      return J({ ok: true, id: r.meta.last_row_id });
    } catch (e) { return J({ error: 'duplicate' }, 409); }
  }
  mm = path.match(/^partners\/(\d+)$/);
  if (mm && m === 'PUT') {
    const cur = await first(env, 'SELECT * FROM mkt_partners WHERE id=?', +mm[1]);
    if (!cur) return J({ error: 'not_found' }, 404);
    const b = await body(req) || {};
    await run(env, "UPDATE mkt_partners SET name=?, ptype=?, cp_ids=?, cp_rule=?, note=?, active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      str(b.name, 120) || cur.name, str(b.ptype, 30) || cur.ptype, Array.isArray(b.cp_ids) ? JSON.stringify(b.cp_ids.slice(0, 50)) : cur.cp_ids,
      b.cp_rule === undefined ? cur.cp_rule : (b.cp_rule === 'fop' ? 'fop' : null), b.note === undefined ? cur.note : str(b.note, 500), b.active === undefined ? cur.active : (b.active ? 1 : 0), cur.id);
    await audit(env, who, 'update', 'partner', cur.id, cur, b);
    return J({ ok: true });
  }
  if (path === 'counterparties' && m === 'GET') {
    const from = isDay(q.get('from')) ? q.get('from') : E.addDays(E.kyivToday(), -180);
    const rows = await all(env, `SELECT c.ms_id, c.ms_name, COALESCE(SUM(s.sum_uah),0) revenue, MAX(s.moment) last_sale, COUNT(DISTINCT s.demand_ms_id) docs
        FROM moysklad_counterparties c LEFT JOIN sales_sku s ON s.agent_ms_id=c.ms_id AND s.moment >= ?
       WHERE c.ms_name LIKE ? GROUP BY c.ms_id ORDER BY revenue DESC LIMIT 60`, from, '%' + (q.get('q') || '') + '%');
    return J({ from, rows });
  }
  mm = path.match(/^partners\/(\d+)\/analytics$/);
  if (mm && m === 'GET') {
    const to = isDay(q.get('to')) ? q.get('to') : E.kyivToday();
    const from = isDay(q.get('from')) ? q.get('from') : E.addDays(to, -179);
    return J(await partnerAnalytics(env, +mm[1], from, to));
  }

  mm = path.match(/^budget\/(\d{4}-\d{2})$/);
  if (mm && m === 'PUT') {
    const b = await body(req) || {};
    const v = numOrNull(b.plan_uah);
    if (v === null || v < 0) return J({ error: 'plan_uah' }, 400);
    await run(env, "INSERT INTO mkt_budget (ym, plan_uah, note, updated_by, updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(ym) DO UPDATE SET plan_uah=excluded.plan_uah, note=excluded.note, updated_by=excluded.updated_by, updated_at=excluded.updated_at",
      mm[1], v, str(b.note, 300), who);
    await audit(env, who, 'update', 'budget', mm[1], null, b);
    return J({ ok: true });
  }
  if (path === 'settings' && m === 'PUT') {
    const b = await body(req) || {};
    const allowed = ['cost_per_kg', 'pack_small', 'pack_large', 'pack_jar', 'appetizer_g', 'spec_change_date', 'vat_rate', 'preload_days', 'post_days',
      'baseline_days', 'abc_a', 'abc_b', 'green_max_growth', 'red_min_growth', 'promo_share_warn', 'digest_hour_kyiv', 'max_per_day'];
    const before = await settings(env);
    for (const [k, v] of Object.entries(b)) {
      if (!allowed.includes(k)) continue;
      if (k === 'spec_change_date' ? !isDay(v) : !Number.isFinite(+v)) return J({ error: 'invalid', field: k }, 400);
      await run(env, 'INSERT INTO mkt_settings (k, v, updated_by, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_by=excluded.updated_by, updated_at=excluded.updated_at', k, String(v), who);
    }
    await audit(env, who, 'update', 'settings', 'all', before, b);
    return J({ ok: true, settings: await settings(env) });
  }

  // калькулятор
  if (path === 'calc/base' && m === 'GET') return J(await calcBase(env, q));
  if (path === 'calcs' && m === 'GET') return J({ rows: await all(env, 'SELECT id, activity_id, partner_id, title, start_date, end_date, status, verdict, created_at, created_by, updated_at, result FROM mkt_calcs ORDER BY id DESC LIMIT 200') });
  if (path === 'calcs' && m === 'POST') {
    const b = await body(req); if (!b || !str(b.title, 160)) return J({ error: 'title' }, 400);
    if (!isDay(b.start_date) || !isDay(b.end_date)) return J({ error: 'dates' }, 400);
    const r = await run(env, 'INSERT INTO mkt_calcs (activity_id, partner_id, title, start_date, end_date, status, inputs, snapshot, result, verdict, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      numOrNull(b.activity_id), numOrNull(b.partner_id), str(b.title, 160), b.start_date, b.end_date, str(b.status, 20) || 'draft',
      JSON.stringify(b.inputs || {}).slice(0, 200000), JSON.stringify(b.snapshot || {}).slice(0, 400000), JSON.stringify(b.result || {}).slice(0, 100000), str(b.verdict, 10), who, who);
    const id = r.meta.last_row_id;
    await audit(env, who, 'create', 'calc', id, null, { title: b.title });
    let act = null;
    if (b.create_activity || b.activity_id) act = await linkCalcToActivity(env, id, b, who);
    return J({ ok: true, id, activity: act });
  }
  mm = path.match(/^calcs\/(\d+)$/);
  if (mm && m === 'GET') {
    const c = await first(env, 'SELECT * FROM mkt_calcs WHERE id=?', +mm[1]);
    return c ? J({ calc: { ...c, inputs: parseJson(c.inputs, {}), snapshot: parseJson(c.snapshot, {}), result: parseJson(c.result, {}) } }) : J({ error: 'not_found' }, 404);
  }
  if (mm && m === 'PUT') {
    const c = await first(env, 'SELECT * FROM mkt_calcs WHERE id=?', +mm[1]);
    if (!c) return J({ error: 'not_found' }, 404);
    const b = await body(req) || {};
    await run(env, "UPDATE mkt_calcs SET title=?, start_date=?, end_date=?, status=?, inputs=?, snapshot=?, result=?, verdict=?, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      str(b.title, 160) || c.title, isDay(b.start_date) ? b.start_date : c.start_date, isDay(b.end_date) ? b.end_date : c.end_date, str(b.status, 20) || c.status,
      b.inputs ? JSON.stringify(b.inputs).slice(0, 200000) : c.inputs, b.snapshot ? JSON.stringify(b.snapshot).slice(0, 400000) : c.snapshot,
      b.result ? JSON.stringify(b.result).slice(0, 100000) : c.result, b.verdict === undefined ? c.verdict : str(b.verdict, 10), who, c.id);
    await audit(env, who, 'update', 'calc', c.id, null, { title: b.title });
    let act = null;
    if (b.create_activity || b.activity_id || c.activity_id) act = await linkCalcToActivity(env, c.id, { ...b, activity_id: b.activity_id || c.activity_id, partner_id: b.partner_id || c.partner_id }, who);
    return J({ ok: true, activity: act });
  }
  if (path === 'audit' && m === 'GET') return J({ rows: await all(env, 'SELECT id, at, actor, action, entity, entity_id FROM mkt_audit ORDER BY id DESC LIMIT 200') });
  if (path === 'digest' && m === 'POST') return J(await digest(env, true));
  return J({ error: 'not_found' }, 404);
}
const b_ver = (req) => req.headers.get('If-Match');

// Розрахунок → KPI активності: мінімум пачок (break-even), цільовий оборот, інкрементальний прибуток
async function linkCalcToActivity(env, calcId, b, who) {
  const k = b.kpi || {};
  const kpi = { kpi_name: 'Пачок sell-in (мін. break-even)', kpi_plan: numOrNull(k.be_units) };
  const extra = `Калькулятор #${calcId}: break-even ${k.be_units != null ? Math.round(k.be_units) : '—'} пачок (+${k.growth != null ? Math.round(k.growth * 100) : '—'} %), `
    + `оборот ≥ ${k.be_revenue != null ? Math.round(k.be_revenue) : '—'} грн без ПДВ; прогноз приросту прибутку ${k.inc_profit != null ? Math.round(k.inc_profit) : '—'} грн.`;
  let id = numOrNull(b.activity_id);
  if (id) {
    const cur = await first(env, 'SELECT * FROM mkt_activities WHERE id=? AND deleted=0', id);
    if (!cur) return null;
    const comment = [String(cur.comment || '').replace(/Калькулятор #\d+:[^\n]*\n?/g, '').trim(), extra].filter(Boolean).join('\n');
    await run(env, "UPDATE mkt_activities SET calc_id=?, kpi_name=?, kpi_plan=?, supplier_discount_pct=COALESCE(?, supplier_discount_pct), discount_pct=COALESCE(?, discount_pct), budget_plan=CASE WHEN ? IS NOT NULL AND budget_plan=0 THEN ? ELSE budget_plan END, comment=?, updated_at=strftime('%Y-%m-%d %H:%M:%f','now'), updated_by=? WHERE id=?",
      calcId, kpi.kpi_name, kpi.kpi_plan, numOrNull(b.supplier_discount_pct), numOrNull(b.customer_discount_pct), numOrNull(k.costs), numOrNull(k.costs), comment, who, id);
  } else {
    const r = await run(env, `INSERT INTO mkt_activities (title, start_date, end_date, direction, partner_id, activity_type, mechanic, discount_pct, supplier_discount_pct,
        status, budget_plan, kpi_name, kpi_plan, comment, calc_id, source, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,'planned',?,?,?,?,?,'calc',?,?)`,
    str(b.title, 160), b.start_date, b.end_date, b.direction || 'partners', numOrNull(b.partner_id), str(b.activity_type, 40) || 'Знижка',
    str(b.mechanic, 500), numOrNull(b.customer_discount_pct), numOrNull(b.supplier_discount_pct), numOrNull(k.costs) || 0, kpi.kpi_name, kpi.kpi_plan, extra, calcId, who, who);
    id = r.meta.last_row_id;
    await audit(env, who, 'create', 'activity', id, null, { from_calc: calcId });
  }
  await run(env, 'UPDATE mkt_calcs SET activity_id=? WHERE id=?', id, calcId);
  const row = await first(env, 'SELECT * FROM mkt_activities WHERE id=?', id);
  await mirrorAdEvent(env, row, await partnersAll(env), who);
  return row;
}

// ── ICS ──────────────────────────────────────────────────────────────────────
async function ics(env, token) {
  if (!env.ICS_TOKEN || token !== env.ICS_TOKEN) return new Response('not found', { status: 404 });
  const today = E.kyivToday();
  const [acts, partners] = await Promise.all([activities(env, E.addDays(today, -120), E.addDays(today, 400)), partnersAll(env)]);
  const body = R.buildIcs(acts.filter((a) => a.status !== 'idea'), partners, nowIso(), PAGE_URL, STATUS_UK);
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=900', 'Content-Disposition': 'inline; filename="barpi-marketing.ics"' } });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p === '/dashboard/api/mkt/healthz') return J({ ok: true, service: 'barpi-mkt', version: VERSION });
      const im = p.match(/^\/mkt-ics\/([A-Za-z0-9_-]{16,80})\.ics$/);
      if (im && req.method === 'GET') return await ics(env, im[1]);
      if (p.startsWith('/dashboard/api/mkt/')) {
        const who = await accessUser(req, env);
        if (!who) return J({ error: 'access required' }, 401);
        if (p === '/dashboard/api/mkt/ics-url' && req.method === 'GET') return J({ url: env.ICS_TOKEN ? `https://brand.barpi.ua/mkt-ics/${env.ICS_TOKEN}.ics` : null });
        return await api(req, env, p.slice('/dashboard/api/mkt/'.length), url, who);
      }
      return J({ error: 'not_found' }, 404);
    } catch (e) {
      const id = (crypto.randomUUID?.() || String(Date.now())).slice(0, 8);
      console.error(`[barpi-mkt:${id}]`, e.message, e.stack?.slice(0, 500));
      return J({ error: 'internal', request_id: id, detail: String(e.message || e).slice(0, 200) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try { await digest(env, false); } catch (e) { console.error('[mkt/cron digest]', e.message); }
      // дзеркало ad_events: статус live/planned змінюється з датою
      try {
        const today = E.kyivToday();
        const partners = await partnersAll(env);
        for (const a of await all(env, 'SELECT * FROM mkt_activities WHERE ad_event_id IS NOT NULL AND deleted=0 AND end_date >= ?', E.addDays(today, -2))) await mirrorAdEvent(env, a, partners, 'barpi-mkt');
      } catch (e) { console.error('[mkt/cron mirror]', e.message); }
      // нічний перерахунок аналізу акцій (03:00 Київ): лише свіжі, щоб не палити ліміт D1
      if (E.kyivHour() === 3) { try { await analyseAll(env, true); } catch (e) { console.error('[mkt/cron analyse]', e.message); } }
    })());
  },
};
