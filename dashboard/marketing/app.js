// Barpi · маркетинговий календар і калькулятор промо (рішення Вадима 20.10.2026).
// Дані: воркер barpi-mkt (/dashboard/api/mkt/*, за Cloudflare Access). Формули: ./lib/econ.js, ./lib/rules.js — ті самі, що у воркері.
import * as E from './lib/econ.js?v=8';
import * as R from './lib/rules.js?v=8';

const API = '/dashboard/api/mkt/';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
let lang = 'uk';
try { lang = localStorage.getItem('bb-mkt-lang') || 'uk'; } catch (e) { /* приватний режим */ }
const T = (uk, en) => (lang === 'en' && en !== undefined ? en : uk);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtN = (x, d = 0) => (x === null || x === undefined || !Number.isFinite(+x) ? '—' : (Math.abs(+x) < 0.5 * 10 ** -d ? 0 : +x).toLocaleString('uk-UA', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, ' '));
const uah = (x, d = 0) => (x === null || x === undefined || !Number.isFinite(+x) ? '—' : fmtN(x, d) + ' ₴');
const pct = (x, d = 0, sign = false) => (x === null || x === undefined || !Number.isFinite(+x) ? '—' : (sign && x > 0 ? '+' : '') + fmtN(x * 100, d) + ' %');
const dm = (s) => (s ? s.slice(8, 10) + '.' + s.slice(5, 7) : '');
const dmy = (s) => (s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '');
const range = (a, b) => (a === b ? dm(a) : dm(a) + '–' + dm(b));
const MONTHS_UK = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (ym) => (lang === 'en' ? MONTHS_EN : MONTHS_UK)[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
const DOW = () => (lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']);

// ── довідники з підписами ────────────────────────────────────────────────────
const L_STATUS = {
  idea: ['Ідея', 'Idea'], planned: ['Заплановано', 'Planned'], approval: ['На погодженні', 'In approval'], approved: ['Погоджено', 'Approved'],
  prep: ['У підготовці', 'In preparation'], ready: ['Готово до запуску', 'Ready to launch'], active: ['Активно', 'Live'], done: ['Завершено', 'Done'],
  postponed: ['Відкладено', 'Postponed'], cancelled: ['Скасовано', 'Cancelled'],
};
const L_DIR = { partners: ['Партнери', 'Partners'], ecom: ['E-commerce', 'E-commerce'], pr: ['PR / Events', 'PR / Events'] };
const L_PTYPE = { network: ['мережа', 'chain'], online: ['онлайн', 'online'], shop: ['магазин', 'shop'], distributor: ['дистриб’ютор', 'distributor'],
  marketplace: ['маркетплейс', 'marketplace'], horeca: ['HoReCa', 'HoReCa'], grooming: ['грумінг', 'grooming'], event: ['подія', 'event'],
  own: ['власний канал', 'own channel'], wholesale: ['дрібний опт', 'wholesale'], other: ['інше', 'other'] };
const CHANNELS = { [T('Партнерські', 'Partner')]: ['Сайт партнера', 'Instagram партнера', 'Facebook партнера', 'Email партнера', 'Push партнера', 'Офлайн-магазин', 'Полиця / POS', 'Офлайн+онлайн'],
  Barpi: ['Barpi.ua', 'Meta Ads', 'Google Ads', 'Email / CRM', 'Instagram Barpi (підтримка кампанії)'], Offline: ['Festival', 'Event', 'Exhibition', 'Інше'] };
const RESULTS = { success: ['Успішне', 'Successful'], partial: ['Частково успішне', 'Partly successful'], fail: ['Неефективне', 'Ineffective'] };
const VERDICTS = { ...RESULTS, unknown: ['Не оцінено', 'Not assessable'] };
const DECISIONS = { repeat: ['Повторити', 'Repeat'], repeat_changed: ['Повторити зі змінами', 'Repeat with changes'], change_discount: ['Змінити знижку', 'Change discount'],
  change_sku: ['Змінити SKU', 'Change SKUs'], change_mechanic: ['Змінити механіку', 'Change mechanic'], change_support: ['Змінити маркетингову підтримку', 'Change marketing support'],
  stop: ['Не повторювати', 'Do not repeat'], test: ['Потрібен додатковий тест', 'Needs another test'] };
const PROMO_TYPES = { regular: ['Регулярне промо', 'Regular promo'], seasonal: ['Сезонне', 'Seasonal'], bf: ['Black Friday', 'Black Friday'], launch: ['Запуск продукту', 'Product launch'],
  category: ['Розвиток категорії', 'Category development'], stock: ['Зменшення залишків', 'Stock reduction'], growth: ['Ріст продажів', 'Sales growth'], trial: ['Trial', 'Trial'], other: ['Інше', 'Other'] };
const PROMO_GOALS = { revenue: ['Збільшити оборот', 'Grow revenue'], profit: ['Збільшити абсолютний прибуток', 'Grow absolute profit'], units: ['Збільшити кількість продажів', 'Grow units'],
  sku: ['Розвинути конкретні SKU', 'Develop specific SKUs'], category: ['Розвинути категорію', 'Develop category'], launch: ['Запустити новинку', 'Launch new product'],
  stock: ['Зменшити залишки', 'Reduce stock'], buyers: ['Залучити нових покупців', 'Win new buyers'], other: ['Інше', 'Other'] };
const L = (map, k) => (map[k] ? map[k][lang === 'en' ? 1 : 0] : (k ?? ''));
const statusTag = (s) => `<span class="tag ${({ active: 'good', ready: 'good', approved: 'info', prep: 'info', approval: 'warn', idea: '', planned: 'navy', done: '', cancelled: 'bad', postponed: 'warn' })[s] || ''}">${esc(L(L_STATUS, s))}</span>`;
const verdictTag = (v) => (v ? `<span class="tag ${v === 'success' ? 'good' : v === 'partial' ? 'warn' : v === 'unknown' ? 'info' : 'bad'}">${esc(L(VERDICTS, v))}</span>` : '<span class="tag">—</span>');

// ── стан ─────────────────────────────────────────────────────────────────────
const S = {
  data: null, tab: 'overview', calView: 'month', cursor: null, flt: { dir: '', partner: '', ptype: '', type: '', channel: '', owner: '', status: '', priority: '', q: '' },
  listMonth: '', sort: { k: 'start_date', d: 1 }, calc: null, results: null, partnerSel: null,
};
try { Object.assign(S.flt, JSON.parse(localStorage.getItem('bb-mkt-flt') || '{}')); S.tab = localStorage.getItem('bb-mkt-tab') || 'overview'; S.calView = localStorage.getItem('bb-mkt-view') || 'month'; } catch (e) { /* без збережених фільтрів */ }
const save = () => { try { localStorage.setItem('bb-mkt-flt', JSON.stringify(S.flt)); localStorage.setItem('bb-mkt-tab', S.tab); localStorage.setItem('bb-mkt-view', S.calView); } catch (e) { /* ок */ } };

async function api(path, opt = {}) {
  const r = await fetch(API + path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opt, body: opt.body ? JSON.stringify(opt.body) : undefined });
  let j = {};
  try { j = await r.json(); } catch (e) { /* не JSON */ }
  if (r.status === 401) throw new Error(T('Сесія Cloudflare Access завершилась — оновіть сторінку', 'Cloudflare Access session expired — reload the page'));
  if (!r.ok) throw new Error(j.field ? T('Перевірте поле: ', 'Check field: ') + j.field : (j.error || 'HTTP ' + r.status));
  return j;
}
let toastT;
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast on' + (err ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast' + (err ? ' err' : ''); }, err ? 5000 : 2600);
}

async function load() {
  S.data = await api('bootstrap');
  const d = S.data;
  d.pmap = Object.fromEntries(d.partners.map((p) => [p.id, p]));
  if (!S.cursor) S.cursor = d.today;
  if (!S.listMonth) S.listMonth = d.today.slice(0, 7);
  const f = d.freshness || {};
  const sy = f.synced ? new Date(f.synced.replace(' ', 'T') + 'Z') : null;
  $('#fresh').innerHTML = sy && !isNaN(sy) ? `${T('МойСклад синхронізовано', 'MoySklad synced')}<br>${esc(sy.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}` : '';
}

// ── фільтри ─────────────────────────────────────────────────────────────────
function filtered(acts = S.data.activities) {
  const f = S.flt, q = f.q.trim().toLowerCase();
  return acts.filter((a) => (!f.dir || a.direction === f.dir) && (!f.partner || String(a.partner_id) === f.partner)
    && (!f.ptype || (S.data.pmap[a.partner_id] || {}).ptype === f.ptype) && (!f.type || a.activity_type === f.type)
    && (!f.channel || a.channel === f.channel) && (!f.owner || (f.owner === '-' ? !a.owner : a.owner === f.owner))
    && (!f.status || a.status === f.status) && (!f.priority || a.priority === f.priority)
    && (!q || [a.title, a.mechanic, a.comment, a.campaign, (S.data.pmap[a.partner_id] || {}).name].join(' ').toLowerCase().includes(q)));
}
const opt = (v, label, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(label)}</option>`;
function renderFilters() {
  const box = $('#filters');
  if (!['overview', 'calendar', 'list', 'budget', 'year'].includes(S.tab)) { box.innerHTML = ''; return; }
  const d = S.data, f = S.flt;
  const chans = [...new Set([...Object.values(CHANNELS).flat(), ...d.activities.map((a) => a.channel).filter(Boolean)])];
  const n = Object.entries(f).filter(([k, v]) => v && k !== 'q').length + (f.q ? 1 : 0);
  box.innerHTML = `
    <span class="f"><select data-f="dir">${opt('', T('Усі напрями', 'All directions'), f.dir)}${Object.keys(L_DIR).map((k) => opt(k, L(L_DIR, k), f.dir)).join('')}</select></span>
    <span class="f"><select data-f="partner">${opt('', T('Усі партнери', 'All partners'), f.partner)}${d.partners.filter((p) => p.active).map((p) => opt(p.id, p.name, f.partner)).join('')}</select></span>
    <span class="f"><select data-f="ptype">${opt('', T('Тип партнера', 'Partner type'), f.ptype)}${Object.keys(L_PTYPE).map((k) => opt(k, L(L_PTYPE, k), f.ptype)).join('')}</select></span>
    <span class="f"><select data-f="type">${opt('', T('Тип активності', 'Activity type'), f.type)}${d.dicts.types.map((t) => opt(t, t, f.type)).join('')}</select></span>
    <span class="f"><select data-f="channel">${opt('', T('Канал', 'Channel'), f.channel)}${chans.map((c) => opt(c, c, f.channel)).join('')}</select></span>
    <span class="f"><select data-f="owner">${opt('', T('Відповідальний', 'Owner'), f.owner)}${opt('-', T('— без відповідального', '— no owner'), f.owner)}${d.owners.map((o) => opt(o, o, f.owner)).join('')}</select></span>
    <span class="f"><select data-f="status">${opt('', T('Статус', 'Status'), f.status)}${R.STATUSES.map((s) => opt(s, L(L_STATUS, s), f.status)).join('')}</select></span>
    <span class="f"><select data-f="priority">${opt('', T('Пріоритет', 'Priority'), f.priority)}${R.PRIORITIES.map((s) => opt(s, s, f.priority)).join('')}</select></span>
    <span class="f"><input type="search" data-f="q" value="${esc(f.q)}" placeholder="${esc(T('Пошук: назва, механіка, коментар', 'Search: title, mechanic, note'))}"></span>
    ${n ? `<button class="chip" id="fReset">✕ ${T('Скинути фільтри', 'Reset filters')} (${n})</button>` : ''}`;
  $$('[data-f]', box).forEach((el) => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => { S.flt[el.dataset.f] = el.value; save(); renderMain(); if (el.tagName !== 'INPUT') renderFilters(); }));
  const rs = $('#fReset', box);
  if (rs) rs.onclick = () => { Object.keys(S.flt).forEach((k) => { S.flt[k] = ''; }); save(); render(); };
}

// ── спільні обчислення ───────────────────────────────────────────────────────
const overlaps = (a, from, to) => a.start_date <= to && a.end_date >= from;
const monthBounds = (ym) => { const from = ym + '-01'; const d = new Date(from + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return [from, E.addDays(E.ymd(d), -1)]; };
const weekBounds = (day) => { const d = new Date(day + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; const from = E.addDays(day, -dow); return [from, E.addDays(from, 6)]; };
const isOverdue = (a, today) => (a.end_date < today && !['done', 'cancelled', 'postponed'].includes(a.status)) || (a.start_date <= today && ['idea', 'planned', 'approval'].includes(a.status) && a.end_date >= today);
const live = (a) => !['cancelled', 'postponed'].includes(a.status);
const pName = (a) => (S.data.pmap[a.partner_id] || {}).name || '';
function sumBy(acts, keyFn, valFn) {
  const m = {};
  acts.forEach((a) => { const k = keyFn(a) || T('— не вказано', '— not set'); m[k] = (m[k] || 0) + valFn(a); });
  return Object.entries(m).sort((x, y) => y[1] - x[1]);
}
function hbars(rows, fmt = uah, max = 8) {
  if (!rows.length) return `<div class="empty small">${T('Немає даних', 'No data')}</div>`;
  const top = Math.max(...rows.map((r) => Math.abs(r[1]))) || 1;
  return rows.slice(0, max).map(([k, v]) => `<div class="hbar"><div class="lb" title="${esc(k)}">${esc(k)}</div><div class="tr"><div class="fl" style="width:${Math.max(2, (Math.abs(v) / top) * 100)}%"></div></div><div class="vl">${fmt(v)}</div></div>`).join('')
    + (rows.length > max ? `<div class="tiny muted">${T('і ще', 'and')} ${rows.length - max}…</div>` : '');
}
const spendOf = (a) => (a.status === 'done' || a.status === 'active' ? (+a.cost_fact || 0) : 0);
const planOf = (a) => (live(a) ? +a.budget_plan || 0 : 0);
// частка бюджету, що припадає на місяць (активність на кілька місяців ділиться пропорційно дням)
function monthShare(a, from, to) {
  if (!overlaps(a, from, to)) return 0;
  const tot = E.daysIncl(a.start_date, a.end_date);
  return E.daysIncl(E.maxDate(a.start_date, from), E.minDate(a.end_date, to)) / tot;
}

// ── огляд ───────────────────────────────────────────────────────────────────
const ATT_TXT = {
  started_unapproved: () => T('стартувала без погодження', 'started without approval'),
  t14_not_approved: (x) => T(`через ${x.days} дн., ще не погоджено`, `in ${x.days} d, not approved yet`),
  t7_not_ready: (x) => T(`через ${x.days} дн., бракує: `, `in ${x.days} d, missing: `) + x.missing.map((m) => ({ owner: T('відповідального', 'owner'), file: T('promo-файлу', 'promo file'), creatives: T('креативів', 'creatives'), approval: T('погодження', 'approval'), budget: T('бюджету', 'budget') }[m] || m)).join(', '),
  t3_no_file: (x) => T(`через ${x.days} дн., не завантажено promo-файл`, `in ${x.days} d, no promo file`),
  t1_tomorrow: () => T('завтра старт', 'starts tomorrow'),
  ended_no_results: (x) => T(`завершилась ${x.days} дн. тому, не внесено: `, `ended ${x.days} d ago, missing: `) + x.missing.map((m) => ({ result: T('результат', 'result'), kpi_fact: T('факт KPI', 'KPI actual'), cost_fact: T('факт витрат', 'actual cost') }[m] || m)).join(', '),
  no_owner: (x) => T(`через ${x.days} дн., немає відповідального`, `in ${x.days} d, no owner`),
};
function attentionHtml(list) {
  if (!list.length) return `<div class="empty">✓ ${T('Усе під контролем', 'All good')}</div>`;
  return `<ul class="alist">${list.slice(0, 14).map((x) => `<li data-act="${x.id}"><span class="ic">${x.level === 'bad' ? '🔴' : x.level === 'warn' ? '🟡' : '🔵'}</span><div><div class="t">${esc(x.title)}</div><div class="m">${esc(range(x.start_date, x.end_date))} · ${esc(ATT_TXT[x.code] ? ATT_TXT[x.code](x) : x.code)}${x.owner ? ' · ' + esc(x.owner.split('@')[0]) : ''}</div></div></li>`).join('')}</ul>`
    + (list.length > 14 ? `<div class="tiny muted">${T('і ще', 'and')} ${list.length - 14}</div>` : '');
}
function conflictsHtml(list) {
  const c = list.filter((x) => x.code !== 'busy_day');
  const busy = list.filter((x) => x.code === 'busy_day');
  if (!c.length && !busy.length) return `<div class="empty">✓ ${T('Перетинів цінових акцій немає', 'No overlapping price promos')}</div>`;
  return `<ul class="alist">${c.slice(0, 8).map((x) => `<li data-act="${x.ids[0]}"><span class="ic">${x.level === 'bad' ? '⚡' : '⚠️'}</span><div><div class="t">${x.code === 'sku_price_conflict' ? T('Різні знижки на той самий SKU', 'Different discounts on the same SKU') : T('Є перетин акцій у цей період', 'Promos overlap in this period')}${x.from ? ' · ' + esc(range(x.from, x.to)) : ''}</div><div class="m">${x.items.map((i) => esc(i.title) + (i.discount_pct ? ` −${fmtN(i.discount_pct)}%` : '')).join(' · ')}${x.skus ? ' · SKU: ' + esc(x.skus.join(', ')) : ''}</div></div></li>`).join('')}
    ${busy.slice(0, 3).map((x) => `<li><span class="ic">🗓</span><div><div class="t">${T('Забагато активностей одного дня', 'Too many activities on one day')}: ${esc(dmy(x.day))}</div><div class="m">${x.n} ${T('активностей', 'activities')}</div></div></li>`).join('')}</ul>`;
}
function actRow(a, extra = '') {
  return `<li data-act="${a.id}"><span class="ic"><span class="dot d-${a.direction}"></span></span><div><div class="t">${esc(a.title)}</div><div class="m">${esc(range(a.start_date, a.end_date))}${pName(a) ? ' · ' + esc(pName(a)) : ''}${a.channel ? ' · ' + esc(a.channel) : ''} · ${esc(L(L_STATUS, a.status))}${extra}</div></div></li>`;
}
function renderOverview() {
  const d = S.data, today = d.today, acts = filtered();
  const [mf, mt] = monthBounds(today.slice(0, 7)), [wf, wt] = weekBounds(today);
  const inM = acts.filter((a) => overlaps(a, mf, mt) && live(a)), inW = acts.filter((a) => overlaps(a, wf, wt) && live(a)), inD = acts.filter((a) => overlaps(a, today, today) && live(a));
  const cnt = (s) => acts.filter((a) => a.status === s && overlaps(a, mf, mt)).length;
  const overdue = acts.filter((a) => isOverdue(a, today));
  const ym = today.slice(0, 7);
  const bplan = (d.budget.find((b) => b.ym === ym) || {}).plan_uah;
  const plan = inM.reduce((s, a) => s + planOf(a) * monthShare(a, mf, mt), 0);
  const fact = acts.reduce((s, a) => s + spendOf(a) * monthShare(a, mf, mt), 0);
  const limit = bplan || plan;
  const ids = new Set(acts.map((a) => a.id));
  const att = d.attention.filter((x) => ids.has(x.id));
  const conf = d.conflicts.filter((x) => !x.ids || x.ids.some((i) => ids.has(i)));
  const now = acts.filter((a) => a.start_date <= today && a.end_date >= today && live(a));
  const next = acts.filter((a) => a.start_date > today && a.start_date <= E.addDays(today, 21) && live(a)).sort((x, y) => x.start_date.localeCompare(y.start_date));
  const k = (l, v, cls = '', go = '', s = '') => `<div class="kpi ${cls}" ${go ? `data-go="${go}"` : ''}><div class="l">${l}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  $('#main').innerHTML = `
  <div class="kpis" style="margin-bottom:16px">
    ${k(T('Цього місяця', 'This month'), inM.length, '', 'list')}
    ${k(T('Цього тижня', 'This week'), inW.length, '', 'week')}
    ${k(T('Сьогодні', 'Today'), inD.length, '', 'day')}
    ${k(T('Активних кампаній', 'Live campaigns'), acts.filter((a) => a.status === 'active').length, 'good', 'status:active')}
    ${k(T('На погодженні', 'In approval'), acts.filter((a) => a.status === 'approval').length, 'warn', 'status:approval')}
    ${k(T('Готові до запуску', 'Ready to launch'), acts.filter((a) => a.status === 'ready').length, '', 'status:ready')}
    ${k(T('Завершено (міс.)', 'Done (month)'), cnt('done'))}
    ${k(T('Скасовано (міс.)', 'Cancelled (month)'), cnt('cancelled'))}
    ${k(T('Прострочені', 'Overdue'), overdue.length, overdue.length ? 'bad' : '', 'overdue')}
  </div>
  <div class="grid g3">
    <div class="card"><h2>💰 ${T('Бюджет', 'Budget')} · ${esc(monthName(ym))}</h2>
      <div class="kv"><dt>${T('План місяця', 'Monthly plan')}</dt><dd class="num">${uah(limit)}${bplan ? '' : ` <span class="tiny muted">(${T('сума планів активностей', 'sum of activity plans')})</span>`}</dd>
      <dt>${T('Факт', 'Actual')}</dt><dd class="num">${uah(fact)}</dd><dt>${T('Залишок', 'Remaining')}</dt><dd class="num">${uah(limit - fact)}</dd>
      <dt>${T('Використано', 'Used')}</dt><dd class="num">${limit ? pct(fact / limit) : '—'}</dd></div>
      <div class="hbar" style="margin-top:10px"><div class="tr"><div class="fl" style="width:${limit ? Math.min(100, (fact / limit) * 100) : 0}%;background:${fact > limit ? 'var(--bad)' : 'var(--navy)'}"></div></div></div>
      <div class="hr"></div>
      <div class="small muted" style="margin-bottom:4px">${T('План за каналами', 'Plan by channel')}</div>${hbars(sumBy(inM, (a) => a.channel, (a) => planOf(a) * monthShare(a, mf, mt)), uah, 5)}
      <div class="small muted" style="margin:8px 0 4px">${T('За партнерами', 'By partner')}</div>${hbars(sumBy(inM, pName, (a) => planOf(a) * monthShare(a, mf, mt)), uah, 5)}
      <div class="small muted" style="margin:8px 0 4px">${T('За типами', 'By type')}</div>${hbars(sumBy(inM, (a) => a.activity_type, (a) => planOf(a) * monthShare(a, mf, mt)), uah, 5)}
    </div>
    <div class="card"><h2>⚠️ ${T('Потребує уваги', 'Needs attention')} <span class="tag ${att.some((x) => x.level === 'bad') ? 'bad' : att.length ? 'warn' : 'good'}">${att.length}</span></h2>${attentionHtml(att)}</div>
    <div class="card"><h2>⚡ ${T('Перетини і ризики', 'Overlaps & risks')}</h2>${conflictsHtml(conf)}</div>
  </div>
  <div class="grid g2">
    <div class="card"><h2>🟢 ${T('Зараз іде', 'Live now')} <span class="tag">${now.length}</span></h2>${now.length ? `<ul class="alist">${now.map((a) => actRow(a)).join('')}</ul>` : `<div class="empty">${T('Немає активностей', 'Nothing live')}</div>`}</div>
    <div class="card"><h2>⏭ ${T('Запускається в наступні 3 тижні', 'Launching in the next 3 weeks')} <span class="tag">${next.length}</span></h2>${next.length ? `<ul class="alist">${next.map((a) => actRow(a, ` · ${T('через', 'in')} ${E.daysIncl(today, a.start_date) - 1} ${T('дн.', 'd')}`)).join('')}</ul>` : `<div class="empty">${T('Нічого не заплановано', 'Nothing planned')}</div>`}</div>
  </div>`;
  $$('[data-go]').forEach((el) => el.addEventListener('click', () => {
    const g = el.dataset.go;
    if (g === 'week' || g === 'day') { S.tab = 'calendar'; S.calView = g; S.cursor = today; }
    else if (g === 'list') { S.tab = 'list'; S.listMonth = ym; }
    else if (g.startsWith('status:')) { S.flt.status = g.slice(7); S.tab = 'list'; S.listMonth = 'all'; }
    else if (g === 'overdue') { S.tab = 'list'; S.listMonth = 'overdue'; }
    save(); render();
  }));
}

// ── календар: місяць / тиждень / день ─────────────────────────────────────────
function barCls(a) {
  return `bar d-${a.direction}${['idea', 'planned', 'approval'].includes(a.status) ? ' tent' : ''}${a.status === 'cancelled' || a.status === 'postponed' ? ' cancel' : ''}${a.status === 'done' ? ' done' : ''}`;
}
function weekRow(from, acts, maxLanes, ym, today) {
  const to = E.addDays(from, 6);
  const segs = acts.filter((a) => overlaps(a, from, to)).map((a) => {
    const s = E.maxDate(a.start_date, from), e = E.minDate(a.end_date, to);
    return { a, c0: E.daysIncl(from, s) - 1, len: E.daysIncl(s, e), cl: a.start_date < from, cr: a.end_date > to };
  }).sort((x, y) => x.c0 - y.c0 || y.len - x.len || (x.a.priority || '').localeCompare(y.a.priority || ''));
  const lanes = [];
  const hidden = Array(7).fill(0);
  for (const s of segs) {
    let li = lanes.findIndex((end) => end < s.c0);
    if (li === -1) { li = lanes.length; lanes.push(-1); }
    lanes[li] = s.c0 + s.len - 1;
    s.lane = li;
    if (li >= maxLanes) for (let i = s.c0; i < s.c0 + s.len; i++) hidden[i]++;
  }
  const shown = segs.filter((s) => s.lane < maxLanes);
  const nLanes = Math.min(maxLanes, lanes.length);
  const days = [...Array(7)].map((_, i) => {
    const d = E.addDays(from, i);
    const cls = [ym && d.slice(0, 7) !== ym ? 'out' : '', d === today ? 'today' : '', i >= 5 ? 'we' : ''].join(' ');
    return `<div class="${cls}" data-day="${d}"><b>${+d.slice(8, 10)}</b></div>`;
  }).join('');
  const bars = shown.map((s) => `<div class="${barCls(s.a)}${s.cl ? ' cl' : ''}${s.cr ? ' cr' : ''}" style="grid-column:${s.c0 + 1}/span ${s.len};grid-row:${s.lane + 1}" data-act="${s.a.id}" title="${esc(s.a.title + ' · ' + range(s.a.start_date, s.a.end_date) + ' · ' + L(L_STATUS, s.a.status))}">${esc(s.a.title)}</div>`).join('');
  const more = hidden.some((x) => x) ? hidden.map((n, i) => (n ? `<div class="more" style="grid-column:${i + 1};grid-row:${nLanes + 1}" data-day="${E.addDays(from, i)}">+${n}</div>` : '')).join('') : '';
  const rows = nLanes + (more ? 1 : 0);
  return `<div class="week" style="min-height:${Math.max(96, 30 + rows * 25)}px"><div class="days">${days}</div><div class="lanes">${bars}${more}</div></div>`;
}
function renderCalendar() {
  const d = S.data, today = d.today, acts = filtered();
  const cur = S.cursor || today;
  let title, body;
  if (S.calView === 'month') {
    const ym = cur.slice(0, 7);
    const [mf, mt] = monthBounds(ym);
    let w = weekBounds(mf)[0];
    const weeks = [];
    while (w <= mt) { weeks.push(weekRow(w, acts, 6, ym, today)); w = E.addDays(w, 7); }
    title = monthName(ym);
    body = `<div class="month"><div class="mgrid-h">${DOW().map((x) => `<div>${x}</div>`).join('')}</div>${weeks.join('')}</div>`;
  } else if (S.calView === 'week') {
    const [wf, wt] = weekBounds(cur);
    title = `${dmy(wf)} – ${dmy(wt)}`;
    const list = acts.filter((a) => overlaps(a, wf, wt));
    body = `<div class="month"><div class="mgrid-h">${DOW().map((x, i) => `<div>${x} ${dm(E.addDays(wf, i))}</div>`).join('')}</div>${weekRow(wf, acts, 60, null, today)}</div>
      <div class="card" style="margin-top:16px"><h2>${T('Активності тижня', 'Activities this week')} <span class="tag">${list.length}</span></h2>${list.length ? `<ul class="alist">${list.map((a) => actRow(a)).join('')}</ul>` : `<div class="empty">${T('Порожньо', 'Empty')}</div>`}</div>`;
  } else {
    title = dmy(cur) + ' · ' + DOW()[(new Date(cur + 'T00:00:00Z').getUTCDay() + 6) % 7];
    const list = acts.filter((a) => overlaps(a, cur, cur));
    body = `<div class="grid g3 dayview">${Object.keys(L_DIR).map((dir) => {
      const l = list.filter((a) => a.direction === dir);
      return `<div class="card"><h2><span class="dot d-${dir}"></span>${esc(L(L_DIR, dir))} <span class="tag">${l.length}</span></h2>${l.length ? `<ul class="alist">${l.map((a) => actRow(a)).join('')}</ul>` : `<div class="empty small">—</div>`}</div>`;
    }).join('')}</div>`;
  }
  const step = { month: 'm', week: 7, day: 1 }[S.calView];
  $('#main').innerHTML = `
    <div class="cal-head">
      <div class="seg">${['month', 'week', 'day'].map((v) => `<button data-v="${v}" class="${S.calView === v ? 'on' : ''}">${({ month: T('Місяць', 'Month'), week: T('Тиждень', 'Week'), day: T('День', 'Day') })[v]}</button>`).join('')}</div>
      <button class="btn ghost sm" data-nav="-1">‹</button><button class="btn ghost sm" data-nav="0">${T('Сьогодні', 'Today')}</button><button class="btn ghost sm" data-nav="1">›</button>
      <div class="ttl">${esc(title)}</div>
    </div>
    ${body}
    <div class="legend">${Object.keys(L_DIR).map((k) => `<span><span class="dot d-${k}"></span>${esc(L(L_DIR, k))}</span>`).join('')}
      <span><span class="bar tent d-partners" style="display:inline-block;width:28px;height:12px;line-height:12px"></span>${T('ідея / план / погодження', 'idea / planned / approval')}</span>
      <span><span class="bar cancel" style="display:inline-block;width:28px;height:12px;line-height:12px"></span>${T('скасовано / відкладено', 'cancelled / postponed')}</span></div>`;
  $$('[data-v]').forEach((b) => b.onclick = () => { S.calView = b.dataset.v; save(); renderCalendar(); });
  $$('[data-nav]').forEach((b) => b.onclick = () => {
    const n = +b.dataset.nav;
    if (!n) S.cursor = today;
    else if (step === 'm') { const x = new Date(cur.slice(0, 7) + '-01T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() + n); S.cursor = E.ymd(x); }
    else S.cursor = E.addDays(cur, n * step);
    renderCalendar();
  });
  $$('[data-day]').forEach((el) => el.addEventListener('click', (e) => { if (e.target.closest('[data-act]')) return; S.cursor = el.dataset.day; S.calView = 'day'; save(); renderCalendar(); }));
}

// ── база і місячні зрізи ──────────────────────────────────────────────────────
function renderList() {
  const d = S.data, today = d.today;
  const yr = today.slice(0, 4);
  let acts = filtered();
  let from = null, to = null;
  if (/^\d{4}-\d{2}$/.test(S.listMonth)) { [from, to] = monthBounds(S.listMonth); acts = acts.filter((a) => overlaps(a, from, to)); }
  else if (S.listMonth === 'overdue') acts = acts.filter((a) => isOverdue(a, today));
  const k = S.sort.k, dir = S.sort.d;
  const val = (a) => (k === 'partner' ? pName(a) : a[k] ?? '');
  acts = [...acts].sort((x, y) => { const a = val(x), b = val(y); return (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))) * dir; });
  const months = [...Array(12)].map((_, i) => `${yr}-${String(i + 1).padStart(2, '0')}`);
  const share = (a) => (from ? monthShare(a, from, to) : 1);
  const plan = acts.reduce((s, a) => s + planOf(a) * share(a), 0), fact = acts.reduce((s, a) => s + spendOf(a) * share(a), 0);
  const c = (s) => acts.filter((a) => a.status === s).length;
  const an = d.analysis;
  const th = (key, label, n) => `<th data-sort="${key}" class="${n ? 'n' : ''}">${label}${k === key ? (dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
  $('#main').innerHTML = `
  <div class="row" style="margin-bottom:12px">
    <button class="chip ${S.listMonth === 'all' ? 'on' : ''}" data-m="all">${T('Усі', 'All')}</button>
    ${months.map((m) => `<button class="chip ${S.listMonth === m ? 'on' : ''}" data-m="${m}">${esc(monthName(m).split(' ')[0].slice(0, 3))}</button>`).join('')}
    <button class="chip ${S.listMonth === 'overdue' ? 'on' : ''}" data-m="overdue">${T('Прострочені', 'Overdue')}</button>
    <span class="sp"></span>
    <button class="btn ghost sm" id="csv">⬇ CSV</button>
  </div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="kpi"><div class="l">${T('Бюджет (план)', 'Budget (plan)')}</div><div class="v">${uah(plan)}</div>${from ? `<div class="s">${T('ліміт місяця', 'monthly limit')}: ${uah((d.budget.find((b) => b.ym === S.listMonth) || {}).plan_uah)}</div>` : ''}</div>
    <div class="kpi"><div class="l">${T('Фактичні витрати', 'Actual spend')}</div><div class="v">${uah(fact)}</div></div>
    <div class="kpi"><div class="l">${T('Активностей', 'Activities')}</div><div class="v">${acts.length}</div></div>
    <div class="kpi good"><div class="l">${T('Завершено', 'Done')}</div><div class="v">${c('done')}</div></div>
    <div class="kpi"><div class="l">${T('Активні', 'Live')}</div><div class="v">${c('active')}</div></div>
    <div class="kpi warn"><div class="l">${T('На погодженні', 'In approval')}</div><div class="v">${c('approval')}</div></div>
    <div class="kpi"><div class="l">${T('Скасовано', 'Cancelled')}</div><div class="v">${c('cancelled')}</div></div>
  </div>
  <div class="card" style="padding:6px 8px"><div class="tw"><table>
    <thead><tr>${th('id', 'ID')}${th('title', T('Активність', 'Activity'))}${th('start_date', T('Період', 'Period'))}${th('direction', T('Напрям', 'Direction'))}${th('partner', T('Партнер', 'Partner'))}${th('activity_type', T('Тип', 'Type'))}${th('channel', T('Канал', 'Channel'))}${th('owner', T('Відповідальний', 'Owner'))}${th('priority', 'P')}${th('status', T('Статус', 'Status'))}${th('budget_plan', T('План, ₴', 'Plan, ₴'), 1)}${th('cost_fact', T('Факт, ₴', 'Actual, ₴'), 1)}<th>${T('Ефект', 'Effect')}</th></tr></thead>
    <tbody>${acts.map((a) => `<tr class="click" data-act="${a.id}"><td class="muted">${a.id}</td><td><b>${esc(a.title)}</b>${a.mechanic ? `<div class="tiny muted">${esc(a.mechanic.slice(0, 90))}</div>` : ''}</td><td class="num" style="white-space:nowrap">${esc(range(a.start_date, a.end_date))}</td>
      <td><span class="dot d-${a.direction}"></span> ${esc(L(L_DIR, a.direction))}</td><td>${esc(pName(a))}</td><td>${esc(a.activity_type || '')}</td><td>${esc(a.channel || '')}</td><td>${esc((a.owner || '').split('@')[0])}</td><td>${esc(a.priority)}</td><td>${statusTag(a.status)}</td>
      <td class="n">${fmtN(a.budget_plan)}</td><td class="n">${fmtN(a.cost_fact)}</td><td>${an[a.id] && an[a.id].verdict ? verdictTag(an[a.id].verdict) : ''}</td></tr>`).join('') || `<tr><td colspan="13" class="empty">${T('Немає активностей за цими фільтрами', 'No activities for these filters')}</td></tr>`}</tbody>
  </table></div></div>`;
  $$('[data-m]').forEach((b) => b.onclick = () => { S.listMonth = b.dataset.m; renderList(); });
  $$('[data-sort]').forEach((t) => t.onclick = () => { const kk = t.dataset.sort; S.sort = { k: kk, d: S.sort.k === kk ? -S.sort.d : 1 }; renderList(); });
  $('#csv').onclick = () => {
    const cols = ['id', 'title', 'campaign', 'start_date', 'end_date', 'direction', 'partner', 'activity_type', 'mechanic', 'discount_pct', 'supplier_discount_pct', 'channel', 'owner', 'priority', 'status', 'budget_plan', 'cost_fact', 'kpi_name', 'kpi_plan', 'kpi_fact', 'result', 'decision', 'file_url', 'post_url', 'comment'];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿' + cols.join(';') + '\n' + acts.map((a) => cols.map((c2) => q(c2 === 'partner' ? pName(a) : a[c2])).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: `barpi-marketing-${S.listMonth}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
}

// ── редактор активності (шухляда) ─────────────────────────────────────────────
function openDrawer(html) {
  $('#drawerBody').innerHTML = html;
  const dr = $('#drawer');
  dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  const dr = $('#drawer');
  dr.classList.remove('open'); dr.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* ок */ }
}
const fld = (label, inner, cls = '', hint = '') => `<div class="fld ${cls}"><label>${label}</label>${inner}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
const inp = (name, v, type = 'text', extra = '') => `<input name="${name}" type="${type}" value="${esc(v ?? '')}" ${extra}>`;
function sel(name, v, options, empty) {
  return `<select name="${name}">${empty !== undefined ? opt('', empty, v ?? '') : ''}${options.map(([k, l]) => opt(k, l, v ?? '')).join('')}</select>`;
}
async function openActivity(id, preset = {}) {
  const d = S.data;
  let a = { title: '', start_date: d.today, end_date: d.today, direction: 'partners', status: 'planned', priority: 'P2', budget_plan: 0, cost_fact: 0, ...preset };
  let extra = { history: [], analysis: null, calc: null };
  if (id) {
    try { extra = await api('activities/' + id); a = extra.activity; } catch (e) { toast(e.message, true); return; }
  }
  const ck = (() => { try { return JSON.parse(a.checklist || '{}') || {}; } catch (e) { return {}; } })();
  const skus = (() => { try { const v = JSON.parse(a.skus || '[]'); return Array.isArray(v) ? v.join(', ') : String(a.skus || ''); } catch (e) { return a.skus || ''; } })();
  const chanOpts = Object.entries(CHANNELS).map(([g, l]) => `<optgroup label="${esc(g)}">${l.map((c) => opt(c, c, a.channel || '')).join('')}</optgroup>`).join('');
  const isPrice = d.dicts.price_types.includes(a.activity_type);
  const an = extra.analysis;
  openDrawer(`
    <div class="dh"><h2>${id ? esc(a.title) : T('Нова активність', 'New activity')}</h2>${id ? `<span class="tag">#${a.id}</span>` : ''}<button class="x" data-close aria-label="close">✕</button></div>
    <form id="actForm" class="form" autocomplete="off">
      ${fld(T('Назва активності', 'Activity name') + ' *', inp('title', a.title, 'text', 'required maxlength="160" placeholder="Black Friday Pethouse"'), 'full')}
      ${fld(T('Дата початку', 'Start date') + ' *', inp('start_date', a.start_date, 'date', 'required'))}
      ${fld(T('Дата завершення', 'End date') + ' *', inp('end_date', a.end_date, 'date', 'required'))}
      ${fld(T('Напрям', 'Direction') + ' *', sel('direction', a.direction, Object.keys(L_DIR).map((k) => [k, L(L_DIR, k)])))}
      ${fld(T('Партнер', 'Partner'), sel('partner_id', a.partner_id, d.partners.filter((p) => p.active || p.id === a.partner_id).map((p) => [p.id, `${p.name} · ${L(L_PTYPE, p.ptype)}`]), '—'))}
      ${fld(T('Тип активності', 'Activity type'), sel('activity_type', a.activity_type, d.dicts.types.map((t) => [t, t]), '—'))}
      ${fld(T('Канал', 'Channel'), `<select name="channel">${opt('', '—', a.channel || '')}${chanOpts}${a.channel && !Object.values(CHANNELS).flat().includes(a.channel) ? opt(a.channel, a.channel, a.channel) : ''}</select>`)}
      ${fld(T('Бюджет план, ₴', 'Planned budget, ₴'), inp('budget_plan', a.budget_plan, 'number', 'min="0" step="1"'))}
      ${fld(T('Відповідальний', 'Owner'), `<input name="owner" list="owners" value="${esc(a.owner || '')}" placeholder="email"><datalist id="owners">${d.owners.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>`)}
      ${fld(T('Статус', 'Status'), sel('status', a.status, R.STATUSES.map((s) => [s, L(L_STATUS, s)])))}
      ${fld(T('Пріоритет', 'Priority'), sel('priority', a.priority, R.PRIORITIES.map((p) => [p, p])))}
      ${fld(T('Посилання на promo-файл', 'Promo file link'), inp('file_url', a.file_url, 'url', 'placeholder="https://drive.google.com/…"'), 'full')}
      <div class="sect">${T('Механіка і умови', 'Mechanic & terms')}</div>
      ${fld(T('Механіка', 'Mechanic'), inp('mechanic', a.mechanic, 'text', 'maxlength="500" placeholder="−15 % на SKU 70 г; 1+1; подарунок"'), 'full', T('Для акцій Barpi.ua текст іде в рекламу дослівно', 'For Barpi.ua promos this text goes into ads verbatim'))}
      ${fld(T('Знижка покупцю, %', 'Shopper discount, %'), inp('discount_pct', a.discount_pct, 'number', 'min="0" max="100" step="0.1"'))}
      ${fld(T('Наша знижка на відвантаження, %', 'Our shipment discount, %'), inp('supplier_discount_pct', a.supplier_discount_pct, 'number', 'min="0" max="100" step="0.1"'))}
      ${fld(T('Компенсація партнеру поза накладною, %', 'Off-invoice compensation to partner, %'), inp('comp_pct', a.comp_pct, 'number', 'min="0" max="100" step="0.1"'), '', T('як у специфікаціях MasterZoo / Pethouse: ціна відвантаження та сама, знижку покупцю компенсуємо', 'as in MasterZoo / Pethouse specs: same shipment price, we compensate the shopper discount'))}
      ${fld(T('Кампанія (парасолька)', 'Campaign (umbrella)'), inp('campaign', a.campaign, 'text', 'placeholder="Black Friday 2026"'))}
      ${fld(T('Дедлайн підготовки', 'Prep deadline'), inp('prep_date', a.prep_date, 'date'))}
      ${fld('SKU / ' + T('асортимент', 'assortment'), inp('skus', skus, 'text', 'placeholder="B-0011, B-0035"'), 'full', T('Артикули через кому — потрібні для виявлення різних цін на той самий SKU', 'SKUs comma-separated — used to detect different prices on the same SKU'))}
      ${fld(T('Промокод', 'Promo code'), inp('promo_code', a.promo_code, 'text', 'maxlength="40"'))}
      ${fld(T('Лендинг', 'Landing'), inp('landing_url', a.landing_url, 'url'))}
      <div class="fld full"><label>${T('Готовність', 'Readiness')}</label><div class="checks">
        ${[['approval', T('погоджено', 'approved')], ['file', T('promo-файл', 'promo file')], ['creatives', T('креативи', 'creatives')], ['budget', T('бюджет підтверджено', 'budget confirmed')]].map(([k, l]) => `<label><input type="checkbox" name="ck_${k}" ${ck[k] ? 'checked' : ''}> ${l}</label>`).join('')}
      </div></div>
      <div class="sect">KPI ${T('і результат', '& result')}</div>
      ${fld('KPI', inp('kpi_name', a.kpi_name, 'text', 'placeholder="Пачок sell-in"'))}
      ${fld(T('План KPI', 'KPI plan'), inp('kpi_plan', a.kpi_plan, 'number', 'step="any"'))}
      ${fld(T('Факт KPI', 'KPI actual'), inp('kpi_fact', a.kpi_fact, 'number', 'step="any"'))}
      ${fld(T('Фактичні витрати, ₴', 'Actual spend, ₴'), inp('cost_fact', a.cost_fact, 'number', 'min="0" step="1"'))}
      ${fld(T('Sell-out партнера, пачок', 'Partner sell-out, packs'), inp('sellout_units', a.sellout_units, 'number', 'step="any"'), '', T('якщо партнер дав звіт продажів на полиці', 'if the partner shared shelf sales'))}
      ${fld(T('Sell-out партнера, ₴', 'Partner sell-out, ₴'), inp('sellout_revenue', a.sellout_revenue, 'number', 'step="any"'))}
      ${fld(T('Результат', 'Result'), sel('result', a.result, Object.keys(RESULTS).map((k) => [k, L(RESULTS, k)]), '—'))}
      ${fld(T('Рішення після акції', 'Decision after promo'), sel('decision', a.decision, Object.keys(DECISIONS).map((k) => [k, L(DECISIONS, k)]), '—'))}
      ${fld(T('Посилання на публікацію', 'Publication link'), inp('post_url', a.post_url, 'url'), 'full')}
      ${fld(T('Коментар', 'Note'), `<textarea name="comment" maxlength="3000">${esc(a.comment || '')}</textarea>`, 'full')}
    </form>
    ${id && (isPrice || an) ? `<div class="card" style="margin-top:16px"><h2>📈 ${T('Ефект за МойСклад', 'Effect from MoySklad')}<span class="sp"></span><button class="btn ghost sm" id="anRun">${T('Порахувати', 'Recalculate')}</button></h2><div id="anBox">${an ? analysisHtml(an, extra.calc) : `<div class="muted small">${T('Ще не пораховано', 'Not computed yet')}</div>`}</div></div>` : ''}
    ${a.calc_id ? `<div class="small muted" style="margin-top:8px">${T('Розрахунок калькулятора', 'Calculator run')} #${a.calc_id} · <button class="link" id="openCalc">${T('відкрити', 'open')}</button></div>` : ''}
    ${extra.history && extra.history.length ? `<details style="margin-top:14px"><summary>${T('Історія змін', 'Change history')} (${extra.history.length})</summary><div class="small muted" style="margin-top:6px">${extra.history.map((h) => `${esc(h.at)} · ${esc(h.actor || '')} · ${esc(h.action)}`).join('<br>')}</div></details>` : ''}
    <div class="sticky-actions">
      <button class="btn" id="actSave">${T('Зберегти', 'Save')}</button>
      ${id ? `<button class="btn ghost" id="actDup">${T('Дублювати', 'Duplicate')}</button>` : ''}
      ${id && isPrice ? `<button class="btn ghost" id="actCalc">${T('У калькулятор', 'Open in calculator')}</button>` : ''}
      <span class="sp"></span>
      ${id ? `<button class="btn red" id="actDel">${T('Видалити', 'Delete')}</button>` : ''}
    </div>`);
  try { if (id) history.replaceState(null, '', '#act=' + id); } catch (e) { /* ок */ }
  const f = $('#actForm');
  $('#actSave').onclick = async () => {
    if (!f.reportValidity()) return;
    const fd = Object.fromEntries(new FormData(f));
    const b = { ...fd };
    ['approval', 'file', 'creatives', 'budget'].forEach((k) => { delete b['ck_' + k]; });
    b.checklist = Object.fromEntries(['approval', 'file', 'creatives', 'budget'].filter((k) => fd['ck_' + k]).map((k) => [k, 1]));
    b.skus = fd.skus ? fd.skus.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean) : null;
    if (b.end_date < b.start_date) { toast(T('Кінець раніше за початок', 'End is before start'), true); return; }
    try {
      $('#actSave').disabled = true;
      if (id) await api('activities/' + id, { method: 'PUT', body: b }); else await api('activities', { method: 'POST', body: b });
      toast(T('Збережено', 'Saved'));
      closeDrawer(); await load(); render();
    } catch (e) { toast(e.message, true); $('#actSave').disabled = false; }
  };
  if ($('#actDel')) $('#actDel').onclick = async () => {
    if (!confirm(T(`Видалити «${a.title}»? Запис зникне з календаря (в журналі змін лишиться).`, `Delete "${a.title}"? It disappears from the calendar (kept in the audit log).`))) return;
    try { await api('activities/' + id, { method: 'DELETE' }); toast(T('Видалено', 'Deleted')); closeDrawer(); await load(); render(); } catch (e) { toast(e.message, true); }
  };
  if ($('#actDup')) $('#actDup').onclick = () => { const c = { ...a }; delete c.id; c.title += T(' (копія)', ' (copy)'); c.status = 'planned'; c.cost_fact = 0; c.kpi_fact = null; c.result = null; c.decision = null; c.ad_event_id = null; c.calc_id = null; openActivity(null, c); };
  if ($('#actCalc')) $('#actCalc').onclick = () => { closeDrawer(); S.tab = 'calc'; S.calc = { preset: a }; save(); render(); };
  if ($('#openCalc')) $('#openCalc').onclick = () => { closeDrawer(); S.tab = 'calc'; S.calc = { loadId: a.calc_id }; save(); render(); };
  if ($('#anRun')) $('#anRun').onclick = async () => {
    $('#anRun').disabled = true;
    try { const r = await api(`activities/${id}/analyse`, { method: 'POST' }); $('#anBox').innerHTML = analysisHtml(r.analysis, extra.calc); S.data.analysis[id] = r.analysis; } catch (e) { toast(e.message, true); }
    $('#anRun').disabled = false;
  };
}

// ── post-analysis: Baseline → Forecast → Fact ─────────────────────────────────
const FLAG_TXT = {
  thin_baseline: () => T('мало даних у baseline — висновок орієнтовний', 'thin baseline — indicative only'),
  baseline_cleaned: () => T('з baseline прибрано дні інших акцій партнера', 'other partner promos removed from the baseline'),
  spec_change: () => T('у вікно потрапила зміна специфікації 14.09 (нова вага і ціни)', 'the 14.09 spec change (new weights and prices) falls into the window'),
  post_incomplete: () => T('вікно «після» ще не закрите — провал після акції пораховано частково', 'post window still open — post-promo dip is partial'),
  running: () => T('акція ще триває', 'promo still running'),
  post_cut_by_next: () => T('вікно «після» обрізане наступною акцією партнера', 'post window cut by the next partner promo'),
  mixed_prices: () => T('у партнера кілька контрагентів з різними прайсами — знижку з накладних не рахуємо', 'several counterparties with different price lists — invoice discount ignored'),
  comp_actual: () => T('компенсацію взято фактичну — з платежу/взаємозаліку партнеру в МойСклад', 'actual compensation taken from the MoySklad payment/offset to the partner'),
  comp_estimated: () => T('компенсацію пораховано від виручки sell-in у вікні (наближення до sell-out)', 'compensation estimated on window sell-in revenue (proxy for sell-out)'),
  no_baseline: () => T('до акції продажів не було — приріст не рахується', 'no sales before the promo — uplift not computed'),
  cost_unknown: () => T('знижки в накладних немає, а компенсація / наша знижка / витрати не внесені — прибуток акції завищений, внесіть умови', 'no invoice discount and no compensation / our discount / costs entered — profit is overstated, enter the terms'),
  promo_heavy: () => T('партнер ≥40 % часу під акціями: «чисті» дні — це провали між акціями, тому висновок за консервативним run-rate (темп 90 днів разом з акціями)', 'partner is on promo ≥40 % of the time: "clean" days are dips between promos, so the verdict uses the conservative run-rate (90-day pace incl. promos)'),
  shared_effect: () => T('у цей період у партнера була ще одна акція — ефект спільний і в сумі рахується один раз', 'another promo of this partner ran at the same time — the effect is shared and counted once in totals'),
  runrate_baseline: () => T('baseline = run-rate 90 днів', 'baseline = 90-day run-rate'),
  invoice_disc_not_seen: () => T('знижки зі специфікації немає в накладних МойСклад — рахуємо її як компенсацію поза накладною', 'the spec discount is not in MoySklad invoices — counted as off-invoice compensation'),
};
function tipHtml(t) {
  const n = (x) => fmtN(x * 100);
  const txt = {
    no_history: () => T('Історії акцій цього партнера ще немає — прогноз на обережному припущенні: −10 % ціни дає +15 % пачок. Після першої акції система підставить реальний відгук.', 'No promo history for this partner yet — the forecast uses a cautious assumption: −10 % price gives +15 % packs. After the first promo the real response is used.'),
    best_depth: () => T(`Найвигідніша глибина знижки за історією партнера: <b>−${n(t.d)} %</b>, очікуваний приріст прибутку <b>${uah(t.inc)}</b> за 14 днів (з поправкою на закупку наперед).`, `Most profitable depth from partner history: <b>−${n(t.d)} %</b>, expected profit gain <b>${uah(t.inc)}</b> over 14 days (net of forward buying).`),
    no_price_promo: () => (t.assumed ? T('Історії відгуку ще немає; за обережним припущенням (−10 % ціни → +15 % пачок) цінова знижка не окупається на маржі цього партнера. Почніть з нецінової механіки (подарунок, набір, семплінг) або з короткого тесту −5…7 %.', 'No response history yet; under a cautious assumption (−10 % price → +15 % packs) a price discount does not pay back on this partner\'s margin. Start with a non-price mechanic (gift, bundle, sampling) or a short −5…7 % test.')
      : T('За історією відгуку партнера жодна цінова знижка не окупається. Краще нецінова механіка: подарунок до покупки, набір, викладка/category placement, семплінг.', 'From this partner\'s response history no price discount pays back. Prefer non-price mechanics: gift with purchase, bundle, placement, sampling.')),
    pull_forward: () => T(`<b>${n(t.pf)} %</b> додаткових пачок — закупка наперед: після акції відвантаження просідають. Обмежуйте обсяг відвантаження під акцію, коротшайте акцію або давайте знижку на sell-out (компенсацією за звітом), а не на відвантаження.`, `<b>${n(t.pf)} %</b> of extra packs are forward buying: shipments dip after the promo. Cap promo shipments, shorten the promo, or fund the discount on sell-out (compensation against report) instead of on shipments.`),
    volume_not_profit: () => T('Остання акція дала обсяг, але не прибуток — зменшіть знижку або звузьте асортимент до SKU-героїв.', 'The last promo brought volume but not profit — reduce the discount or narrow the range to hero SKUs.'),
    below_breakeven: () => T(`Остання акція: приріст <b>${pct(t.got, 0, true)}</b> при потрібних <b>${pct(t.need, 0, true)}</b> для знижки ${n(t.d)} % — знижка не окупилась.`, `Last promo: uplift <b>${pct(t.got, 0, true)}</b> vs <b>${pct(t.need, 0, true)}</b> needed for a ${n(t.d)} % discount — it did not pay back.`),
    drop_skus: () => T(`Не реагують на знижку: ${esc(t.skus.join('; '))} — прибрати з наступної акції.`, `Do not respond to the discount: ${esc(t.skus.join('; '))} — drop them next time.`),
    hero_skus: () => T(`Тягнуть акцію: ${esc(t.skus.join('; '))} — робити їх героями наступної.`, `Drive the promo: ${esc(t.skus.join('; '))} — make them heroes next time.`),
    enter_costs: () => T(`${t.n} акцій без вартості: знижки в цінах відвантаження немає, отже її компенсуєте окремо. Внесіть «Компенсацію партнеру поза накладною, %» зі специфікації промо — інакше висновки про прибуток неповні.`, `${t.n} promos without cost: no discount in shipment prices, so it is compensated separately. Enter "Off-invoice compensation, %" from the promo spec — otherwise profit conclusions are incomplete.`),
    promo_is_norm: () => T(`<b>${n(t.share)} %</b> днів за останні 90 партнер працює під знижкою — знижка стала нормою, покупець звикає купувати лише в акцію. Рідше і коротше.`, `<b>${n(t.share)} %</b> of the last 90 days this partner ran a discount — discounting has become the norm. Fewer and shorter promos.`),
  }[t.code];
  return `<div class="tip ${t.level === 'good' ? 'good' : t.level === 'bad' ? 'bad' : t.level === 'warn' ? 'warn' : 'info'}"><span>${t.level === 'good' ? '✅' : t.level === 'bad' ? '⛔' : t.level === 'warn' ? '⚠️' : '💡'}</span><div>${txt ? txt() : esc(t.code)}</div></div>`;
}
function analysisHtml(an, calc) {
  if (!an) return '';
  if (an.skipped) return `<div class="muted small">${an.skipped === 'no_counterparty' ? T('Партнер не привʼязаний до контрагента МойСклад — привʼяжіть у Налаштуваннях → Партнери.', 'Partner is not linked to a MoySklad counterparty — link it in Settings → Partners.') : T('Для подій і PR ефект у продажах не рахується.', 'Sales effect is not computed for events and PR.')}</div>`;
  const w = an.windows, b = an.base, win = an.win;
  const days = win.days || 0;
  const base = { units: b.rateQ * days, revenue: (b.rateNet ?? (b.days ? b.net / b.days : 0)) * days, gp: (b.rateGp ?? (b.days ? b.gp / b.days : 0)) * days };
  base.margin = base.revenue ? base.gp / base.revenue : null; base.contribution = base.gp;
  const fact = { units: win.q, revenue: win.net, gp: win.gp, margin: win.net ? win.gp / win.net : null, contribution: win.gp - (an.promoCost || 0) };
  const cr = calc && calc.result ? (typeof calc.result === 'string' ? JSON.parse(calc.result) : calc.result) : null;
  const fc = cr && cr.forecast ? { units: cr.forecast.units, revenue: cr.forecast.revenue, gp: cr.forecast.gp, margin: cr.forecast.margin, contribution: cr.forecast.contribution } : null;
  const rowK = (label, k, f = uah) => `<tr><td>${label}</td><td class="n">${f(base[k])}</td><td class="n">${fc ? f(fc[k]) : '—'}</td><td class="n"><b>${f(fact[k])}</b></td>
    <td class="n">${k === 'margin' ? (fact[k] !== null && base[k] !== null ? fmtN((fact[k] - base[k]) * 100, 1) + ' п.п.' : '—') : base[k] ? pct(fact[k] / base[k] - 1, 0, true) : '—'}</td>
    <td class="n">${fc && fc[k] ? (k === 'margin' ? fmtN((fact[k] - fc[k]) * 100, 1) + ' п.п.' : pct(fact[k] / fc[k] - 1, 0, true)) : '—'}</td></tr>`;
  return `
    <div class="row" style="margin-bottom:10px">${verdictTag(an.verdict)}<span class="small muted">${T('вікно', 'window')} ${esc(range(w.winFrom, w.winTo))} (${T('з закупкою наперед', 'incl. pre-load')}) · baseline ${b.kind === 'runrate' ? T('run-rate 90 дн. (з акціями)', 'run-rate 90 d (incl. promos)') : `${b.days} ${T('чистих дн.', 'clean d')}`} ${T('до', 'before')} ${esc(dm(w.baseTo))}${w.postTo ? ` · ${T('після', 'after')} ${esc(range(w.postFrom, w.postTo))}` : ''}</span></div>
    <div class="kpis" style="margin-bottom:12px">
      <div class="kpi"><div class="l">${T('Приріст пачок', 'Units uplift')}</div><div class="v">${pct(an.upliftUnits, 0, true)}</div>${an.upliftClean !== undefined ? `<div class="s">${T('діапазон', 'range')}: ${pct(an.upliftRR, 0, true)} … ${pct(an.upliftClean, 0, true)}</div>` : ''}</div>
      <div class="kpi"><div class="l">${T('Наше фінансування знижки', 'Our discount funding')}</div><div class="v">${pct(an.fundDisc, 1)}</div><div class="s">${T('у накладних', 'in invoices')}: ${pct(an.realizedDisc, 1)}${an.invoiceOk ? '' : ' (' + T('не показово', 'not reliable') + ')'}${an.compCost ? ' · ' + T('компенсація', 'compensation') + ' ' + uah(an.compCost) : ''}</div></div>
      <div class="kpi"><div class="l">${T('Закупка наперед', 'Forward buying')}</div><div class="v">${pct(an.pullForward)}</div><div class="s">${T('частка приросту, що «зʼїв» провал після', 'share of uplift eaten by post dip')}</div></div>
      <div class="kpi ${an.contribution === null ? '' : an.contribution > 0 ? 'good' : 'bad'}"><div class="l">${T('Інкрементальний прибуток', 'Incremental profit')}</div><div class="v">${uah(an.contribution)}</div><div class="s">${T('з урахуванням провалу після і витрат', 'net of post dip and costs')}</div></div>
      <div class="kpi"><div class="l">ROI</div><div class="v">${an.roi === null ? '—' : pct(an.roi)}</div><div class="s">${T('інвестиція у знижку', 'discount investment')} ${uah(an.discountInvestment)}</div></div>
    </div>
    <div class="tw"><table><thead><tr><th>KPI</th><th class="n">Baseline</th><th class="n">${T('Прогноз', 'Forecast')}</th><th class="n">${T('Факт', 'Actual')}</th><th class="n">${T('Факт vs baseline', 'Actual vs baseline')}</th><th class="n">${T('Факт vs прогноз', 'Actual vs forecast')}</th></tr></thead><tbody>
      ${rowK(T('Пачки', 'Packs'), 'units', (x) => fmtN(x))}${rowK(T('Виручка без ПДВ', 'Revenue ex VAT'), 'revenue')}${rowK(T('Валовий прибуток', 'Gross profit'), 'gp')}${rowK(T('Маржа', 'Margin'), 'margin', (x) => pct(x, 1))}${rowK('Contribution', 'contribution')}
    </tbody></table></div>
    ${an.kpi_plan ? `<div class="small" style="margin-top:8px">KPI «${esc(an.kpi_name || '')}»: ${T('план', 'plan')} <b>${fmtN(an.kpi_plan)}</b> · ${T('факт sell-in', 'actual sell-in')} <b>${fmtN(win.q)}</b> ${win.q >= an.kpi_plan ? '✅' : '❌'}</div>` : ''}
    ${an.sellout ? `<div class="small muted">Sell-out ${T('партнера', 'partner')}: ${fmtN(an.sellout.units)} ${T('пачок', 'packs')} · ${uah(an.sellout.revenue)}</div>` : ''}
    ${an.returns ? `<div class="small muted">${T('Повернення за період', 'Returns in period')}: ${uah(an.returns)}</div>` : ''}
    ${(an.flags || []).length ? `<div class="small muted" style="margin-top:6px">ⓘ ${(an.flags || []).map((f) => esc(FLAG_TXT[f] ? FLAG_TXT[f]() : f)).join(' · ')}</div>` : ''}
    <details style="margin-top:10px"><summary>${T('По SKU', 'By SKU')} (${an.skus.length})</summary><div class="tw"><table><thead><tr><th>SKU</th><th class="n">${T('Baseline, шт', 'Baseline, pcs')}</th><th class="n">${T('Вікно, шт', 'Window, pcs')}</th><th class="n">${T('Приріст', 'Uplift')}</th><th class="n">${T('Знижка факт', 'Disc. actual')}</th><th class="n">${T('Ціна до → в акції', 'Price before → promo')}</th><th class="n">GP ${T('вікна', 'window')}</th></tr></thead><tbody>
      ${an.skus.slice(0, 40).map((s) => `<tr><td>${esc(s.name)}</td><td class="n">${fmtN(s.base_q)}</td><td class="n">${fmtN(s.win_q)}</td><td class="n">${pct(s.uplift, 0, true)}</td><td class="n">${pct(s.realized_disc, 1)}</td><td class="n">${fmtN(s.base_price, 2)} → ${fmtN(s.win_price, 2)}</td><td class="n">${uah(s.win_gp)}</td></tr>`).join('')}
    </tbody></table></div></details>
    <div class="tiny muted" style="margin-top:8px">${T('Sell-in = відвантаження Barpi партнеру з МойСклад; собівартість — канон v4 (620 ₴/кг × вага + пакування), без праці.', 'Sell-in = Barpi shipments to the partner from MoySklad; cost — canon v4 (620 ₴/kg × weight + packaging), labour excluded.')}</div>`;
}

// ── партнери ─────────────────────────────────────────────────────────────────
function renderPartners() {
  const d = S.data, today = d.today, yr = today.slice(0, 4);
  const acts = d.activities;
  const cards = d.partners.filter((p) => p.active).map((p) => {
    const l = acts.filter((a) => a.partner_id === p.id && a.start_date.slice(0, 4) <= yr && a.end_date.slice(0, 4) >= yr);
    if (!l.length && !(p.cp_ids || []).length && !p.cp_rule) return null;
    const promos = l.filter((a) => d.dicts.price_types.includes(a.activity_type));
    const cur = l.filter((a) => a.start_date <= today && a.end_date >= today && live(a));
    const next = l.filter((a) => a.start_date > today && live(a)).sort((x, y) => x.start_date.localeCompare(y.start_date))[0];
    const last = l.filter((a) => a.end_date < today && a.status === 'done').sort((x, y) => y.end_date.localeCompare(x.end_date))[0];
    const an = l.map((a) => d.analysis[a.id]).filter((x) => x && x.verdict);
    return { p, l, promos, cur, next, last, an, budget: l.reduce((s, a) => s + planOf(a), 0), fact: l.reduce((s, a) => s + spendOf(a), 0) };
  }).filter(Boolean).sort((a, b) => b.l.length - a.l.length);
  $('#main').innerHTML = `<div class="grid g3">${cards.map((c) => `
    <div class="card pcard" data-partner="${c.p.id}">
      <div class="pt"><h3>${esc(c.p.name)}</h3><span class="tag navy">${esc(L(L_PTYPE, c.p.ptype))}</span></div>
      <dl class="kv">
        <dt>${T('Активностей за рік', 'Activities this year')}</dt><dd>${c.l.length}</dd>
        <dt>${T('Промо (цінові)', 'Price promos')}</dt><dd>${c.promos.length}</dd>
        <dt>${T('Бюджет / факт', 'Budget / actual')}</dt><dd class="num">${uah(c.budget)} / ${uah(c.fact)}</dd>
        <dt>${T('Зараз', 'Now')}</dt><dd>${c.cur.length ? esc(c.cur.map((a) => a.title).join('; ')) : '—'}</dd>
        <dt>${T('Наступне', 'Next')}</dt><dd>${c.next ? esc(c.next.title) + ' · ' + esc(range(c.next.start_date, c.next.end_date)) : '—'}</dd>
        <dt>${T('Останнє завершене', 'Last done')}</dt><dd>${c.last ? esc(c.last.title) + ' · ' + esc(dm(c.last.end_date)) : '—'}</dd>
        <dt>${T('Завершено / скасовано', 'Done / cancelled')}</dt><dd>${c.l.filter((a) => a.status === 'done').length} / ${c.l.filter((a) => a.status === 'cancelled').length}</dd>
        <dt>${T('Ефективність промо', 'Promo results')}</dt><dd>${c.an.length ? `✅ ${c.an.filter((x) => x.verdict === 'success').length} · 🟡 ${c.an.filter((x) => x.verdict === 'partial').length} · ⛔ ${c.an.filter((x) => x.verdict === 'fail').length}` : '—'}</dd>
      </dl>
    </div>`).join('')}</div>`;
  $$('[data-partner]').forEach((el) => el.onclick = () => openPartner(+el.dataset.partner));
}
async function openPartner(id) {
  const p = S.data.pmap[id];
  const to = S.data.today, from = E.addDays(to, -179);
  openDrawer(`<div class="dh"><h2>${esc(p.name)}</h2><button class="x" data-close>✕</button></div>
    <div class="row" style="margin-bottom:12px"><span class="f"><input type="date" id="paFrom" value="${from}"></span>—<span class="f"><input type="date" id="paTo" value="${to}"></span><button class="btn sm" id="paGo">${T('Показати', 'Show')}</button><button class="btn ghost sm" id="paCalc">${T('Нове промо в калькуляторі', 'New promo in calculator')}</button></div>
    <div id="paBox"><div class="loading">…</div></div>`);
  const go = async () => {
    $('#paBox').innerHTML = '<div class="loading">…</div>';
    try {
      const r = await api(`partners/${id}/analytics?from=${$('#paFrom').value}&to=${$('#paTo').value}`);
      const ins = (S.results && S.results.partners || []).find((x) => x.partner_id === id);
      $('#paBox').innerHTML = partnerAnalyticsHtml(r, ins);
    } catch (e) { $('#paBox').innerHTML = `<div class="tip bad">${esc(e.message)}</div>`; }
  };
  $('#paGo').onclick = go;
  $('#paCalc').onclick = () => { closeDrawer(); S.tab = 'calc'; S.calc = { preset: { partner_id: id } }; save(); render(); };
  if (!S.results) { try { S.results = await api('insights'); } catch (e) { /* без підказок */ } }
  go();
}
function partnerAnalyticsHtml(r, ins) {
  if (r.error) return `<div class="tip bad">${esc(r.error)}</div>`;
  const k = r.kpi;
  if (!r.partner.counterparties) return `<div class="tip warn">${T('Партнер не привʼязаний до контрагентів МойСклад. Привʼяжіть у Налаштуваннях → Партнери.', 'Partner is not linked to MoySklad counterparties. Link it in Settings → Partners.')}</div>`;
  const mx = Math.max(1, ...r.months.map((m) => m.revenue));
  return `
    <div class="kpis" style="margin-bottom:14px">
      <div class="kpi"><div class="l">${T('Виручка без ПДВ', 'Revenue ex VAT')}</div><div class="v">${uah(k.revenue)}</div></div>
      <div class="kpi"><div class="l">${T('Пачок', 'Packs')}</div><div class="v">${fmtN(k.units)}</div></div>
      <div class="kpi"><div class="l">COGS</div><div class="v">${uah(k.cogs)}</div></div>
      <div class="kpi"><div class="l">${T('Валовий прибуток', 'Gross profit')}</div><div class="v">${uah(k.gp)}</div></div>
      <div class="kpi"><div class="l">${T('Маржа', 'Margin')}</div><div class="v">${pct(k.margin, 1)}</div></div>
      <div class="kpi"><div class="l">${T('Повернення', 'Returns')}</div><div class="v">${uah(k.returns)}</div></div>
      <div class="kpi"><div class="l">${T('Днів з відвантаженнями', 'Shipping days')}</div><div class="v">${k.ship_days}</div></div>
      <div class="kpi"><div class="l">${T('Активних SKU', 'Active SKUs')}</div><div class="v">${k.active_skus}</div></div>
      <div class="kpi"><div class="l">${T('Сер. оборот / міс', 'Avg revenue / mo')}</div><div class="v">${uah(k.avg_month_revenue)}</div></div>
      <div class="kpi"><div class="l">${T('Сер. GP / міс', 'Avg GP / mo')}</div><div class="v">${uah(k.avg_month_gp)}</div><div class="s">${T('останній продаж', 'last sale')} ${esc(dmy((k.last_sale || '').slice(0, 10)))}</div></div>
    </div>
    ${ins ? `<div class="card"><h2>💡 ${T('Підказки на наступну акцію', 'Tips for the next promo')}</h2>${ins.rec.tips.map(tipHtml).join('') || `<div class="muted small">—</div>`}</div>` : ''}
    <div class="card"><h2>${T('Динаміка по місяцях', 'Monthly trend')}</h2><div class="tw"><table><thead><tr><th>${T('Місяць', 'Month')}</th><th>${T('Виручка', 'Revenue')}</th><th class="n">${T('Пачок', 'Packs')}</th><th class="n">GP</th><th class="n">${T('Маржа', 'Margin')}</th></tr></thead><tbody>
      ${r.months.map((m) => `<tr><td>${esc(monthName(m.ym))}</td><td style="min-width:160px"><div class="hbar" style="margin:0"><div class="tr"><div class="fl" style="width:${(m.revenue / mx) * 100}%"></div></div><div class="vl">${uah(m.revenue)}</div></div></td><td class="n">${fmtN(m.units)}</td><td class="n">${uah(m.gp)}</td><td class="n">${pct(m.margin, 1)}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card"><h2>${T('SKU і ABC', 'SKUs & ABC')}</h2><div class="tw"><table><thead><tr><th>SKU</th><th class="n">${T('Пачок', 'Packs')}</th><th class="n">${T('Виручка', 'Revenue')}</th><th class="n">COGS</th><th class="n">GP</th><th class="n">${T('Маржа', 'Margin')}</th><th class="n">${T('Частка обороту', 'Rev. share')}</th><th class="n">${T('Частка GP', 'GP share')}</th><th>ABC</th><th class="n">${T('Залишок', 'Stock')}</th></tr></thead><tbody>
      ${r.skus.map((s) => `<tr><td>${esc(s.name)}</td><td class="n">${fmtN(s.units)}</td><td class="n">${uah(s.revenue)}</td><td class="n">${uah(s.cogs)}</td><td class="n">${uah(s.gp)}</td><td class="n">${pct(s.margin, 1)}</td><td class="n">${pct(s.share, 1)}</td><td class="n">${pct(s.gp_share, 1)}</td><td><span class="tag ${s.abc === 'A' ? 'good' : s.abc === 'B' ? 'info' : ''}">${s.abc || '—'}</span></td><td class="n">${fmtN(s.stock)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

// ── ефективність промо ────────────────────────────────────────────────────────
async function renderResults() {
  $('#main').innerHTML = '<div class="loading">…</div>';
  try { S.results = await api('insights'); } catch (e) { $('#main').innerHTML = `<div class="tip bad">${esc(e.message)}</div>`; return; }
  const r = S.results;
  const all = r.partners.flatMap((p) => p.list.map((x) => ({ ...x, partner: p.partner })));
  const done = all.filter((x) => x.verdict);
  $('#main').innerHTML = `
    <div class="card"><h2>${T('Як рахується', 'How it is computed')}<span class="sp"></span><button class="btn ghost sm" id="reRun">${T('Перерахувати всі акції', 'Recompute all promos')}</button></h2>
      <div class="small muted">${T('Для кожної цінової акції партнера: sell-in з МойСклад у вікні «старт − закупка наперед … кінець» проти baseline, мінус провал після акції (закупка наперед), мінус наша компенсація і витрати. Baseline: «чисті» дні без інших акцій партнера; якщо партнер ≥40 % часу під акціями — консервативний run-rate за 90 днів разом з акціями (діапазон показано в деталях акції). Знижка в накладних — з фактичних цін відвантаження; компенсація поза накладною — зі специфікації промо, від виручки sell-in у вікні. Собівартість — канон v4 (620 ₴/кг × вага + пакування). Це оцінка sell-in: продажі на полиці партнера (sell-out) видно лише, якщо внести його звіт.', 'For each partner price promo: MoySklad sell-in in the window "start − pre-load … end" vs baseline, minus the post-promo dip (forward buying), minus our compensation and costs. Baseline: clean days without other partner promos; if the partner is on promo ≥40 % of the time — a conservative 90-day run-rate incl. promos (range shown in promo details). Invoice discount — from actual shipment prices; off-invoice compensation — from the promo spec, on window sell-in revenue. Cost — canon v4. This is a sell-in estimate: shelf sales (sell-out) are visible only if the partner report is entered.')}</div></div>
    <div class="kpis" style="margin-bottom:16px">
      <div class="kpi"><div class="l">${T('Проаналізовано акцій', 'Promos analysed')}</div><div class="v">${done.length}</div></div>
      <div class="kpi good"><div class="l">${T('Успішні', 'Successful')}</div><div class="v">${done.filter((x) => x.verdict === 'success').length}</div></div>
      <div class="kpi warn"><div class="l">${T('Частково', 'Partly')}</div><div class="v">${done.filter((x) => x.verdict === 'partial').length}</div></div>
      <div class="kpi bad"><div class="l">${T('Неефективні', 'Ineffective')}</div><div class="v">${done.filter((x) => x.verdict === 'fail').length}</div></div>
      <div class="kpi"><div class="l">${T('Не оцінено', 'Not assessable')}</div><div class="v">${done.filter((x) => x.verdict === 'unknown').length}</div><div class="s">${T('немає умов або зміна специфікації', 'no terms or spec change')}</div></div>
      <div class="kpi"><div class="l">${T('Сумарний інкрем. прибуток', 'Total incremental profit')}</div><div class="v">${uah(done.filter((x) => x.verdict !== 'unknown').reduce((s, x) => s + (x.contribution || 0), 0))}</div><div class="s">${T('лише оцінені акції', 'assessed promos only')}</div></div>
    </div>
    ${r.partners.filter((p) => p.n).map((p) => `
      <div class="card"><h2>${esc(p.partner)} <span class="tag">${p.n}</span><span class="sp"></span><span class="small muted" style="text-transform:none;letter-spacing:0">${T('сер. приріст', 'avg uplift')} ${pct(p.avg_uplift, 0, true)} · ${T('сер. знижка', 'avg discount')} ${pct(p.avg_disc, 1)} · ${T('сумарно', 'total')} ${uah(p.sum_contribution)} · ${T('під знижкою 90 дн.', 'on discount 90d')} ${pct(p.promo_share_90d)}</span></h2>
        <div class="grid g2"><div>${p.rec.tips.map(tipHtml).join('') || ''}</div>
        <div>${p.rec.grid && p.rec.grid.length ? `<div class="small muted" style="margin-bottom:4px">${T('Прогноз на 14 днів за поточним темпом і відгуком партнера', '14-day forecast at the current pace and partner response')}${p.rec.assumedK ? ' · ' + T('припущення', 'assumption') : ` · k=${fmtN(p.rec.k, 2)}`}</div>
          <table><thead><tr><th>${T('Знижка', 'Discount')}</th><th class="n">${T('Очік. приріст', 'Exp. uplift')}</th><th class="n">${T('Потрібно для BE', 'Needed for BE')}</th><th class="n">Δ ${T('прибутку', 'profit')}</th></tr></thead><tbody>
          ${p.rec.grid.map((g) => `<tr class="${p.rec.best && p.rec.best.d === g.d ? 'hl' : ''}"><td>−${fmtN(g.d * 100)} %</td><td class="n">${pct(g.lift, 0, true)}</td><td class="n">${g.need === null ? '∞' : pct(g.need, 0, true)}</td><td class="n">${uah(g.inc)}</td></tr>`).join('')}</tbody></table>` : ''}</div></div>
        <div class="tw" style="margin-top:10px"><table><thead><tr><th>${T('Акція', 'Promo')}</th><th>${T('Період', 'Period')}</th><th>${T('Оцінка', 'Verdict')}</th><th class="n">${T('Приріст', 'Uplift')}</th><th class="n">${T('Наша знижка', 'Our discount')}</th><th class="n">${T('Закупка наперед', 'Fwd buying')}</th><th class="n">${T('Інкрем. прибуток', 'Incr. profit')}</th><th class="n">ROI</th></tr></thead><tbody>
          ${p.list.slice().reverse().map((x) => `<tr class="click" data-act="${x.activity_id}"><td>${esc(x.title)}${(x.flags || []).includes('thin_baseline') ? ' <span class="tag warn">baseline</span>' : ''}${(x.flags || []).includes('promo_heavy') ? ` <span class="tag warn" title="${esc(FLAG_TXT.promo_heavy())}">${T('акції підряд', 'back-to-back')}</span>` : ''}</td><td class="num">${esc(range(x.start_date, x.end_date))}</td><td>${verdictTag(x.verdict)}</td><td class="n">${pct(x.upliftUnits, 0, true)}</td><td class="n">${pct(x.fundDisc, 1)}</td><td class="n">${pct(x.pullForward)}</td><td class="n">${uah(x.contribution)}</td><td class="n">${x.roi === null ? '—' : pct(x.roi)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>`).join('') || `<div class="empty">${T('Ще немає проаналізованих акцій — натисніть «Перерахувати всі акції»', 'No analysed promos yet — press "Recompute all promos"')}</div>`}`;
  $('#reRun').onclick = async () => {
    $('#reRun').disabled = true; $('#reRun').textContent = T('Рахую…', 'Computing…');
    try { const x = await api('analyse-all', { method: 'POST' }); toast(T(`Пораховано ${x.n} акцій`, `${x.n} promos computed`)); await load(); renderResults(); } catch (e) { toast(e.message, true); $('#reRun').disabled = false; }
  };
}

// ── калькулятор промо ─────────────────────────────────────────────────────────
const COST_CATS = [['placement', T('Рекламне розміщення', 'Ad placement')], ['banner', T('Банер', 'Banner')], ['email', 'Email'], ['digital', T('Digital-реклама', 'Digital ads')],
  ['pos', 'POS'], ['sampling', T('Семплінг', 'Sampling')], ['gifts', T('Продукція для подарунків', 'Gift product')], ['logistics', T('Логістика', 'Logistics')], ['comp', T('Додаткова компенсація', 'Extra compensation')], ['other', T('Інше', 'Other')]];
function newCalc(preset = {}) {
  const t = S.data.today;
  const p = preset.partner_id ? S.data.pmap[preset.partner_id] : null;
  return { partner_id: preset.partner_id || '', title: preset.title || (p ? `${p.name} — промо` : ''), start: preset.start_date || E.addDays(t, 14), end: preset.end_date || E.addDays(t, 27),
    ptype: 'regular', goal: 'profit', note: '', method: 'd28', bfrom: '', bto: '', base: null, sel: new Set(), sd: preset.supplier_discount_pct ?? 10, pd: 0, cd: preset.discount_pct ?? '',
    perSku: {}, costs: [], q: '', abc: '', onlyStock: false, fcOverride: '', customD: 12, customG: 40, calcId: null, activityId: preset.id || null,
    mode: preset.comp_pct ? 'comp' : (p && p.ptype === 'network' ? 'comp' : 'invoice') };
}
function calcLines(c) {
  if (!c.base) return [];
  return c.base.lines.filter((l) => c.sel.has(l.pid)).map((l) => ({ ...l, sd: (c.perSku[l.pid] !== undefined && c.perSku[l.pid] !== '' ? +c.perSku[l.pid] : +c.sd || 0) / 100 }));
}
const withSd = (lines, sd) => lines.map((l) => ({ ...l, sd }));
function compute(c) {
  const st = S.data.settings;
  const lines = calcLines(c);
  const costs = c.costs.reduce((s, x) => s + (+x.sum || 0), 0);
  const be = E.breakEven(lines, costs);
  const U = lines.reduce((s, l) => s + l.u, 0), Rv = lines.reduce((s, l) => s + l.u * l.p, 0);
  const effSd = Rv ? lines.reduce((s, l) => s + l.u * l.p * l.sd, 0) / Rv : 0;
  const h = c.base ? c.base.history : {};
  const k = h && h.k !== null && h.k !== undefined ? h.k : 1.5;
  const pf = h && h.pullForward ? h.pullForward : 0;
  const lift = c.fcOverride !== '' && Number.isFinite(+c.fcOverride) ? +c.fcOverride / 100 : Math.max(0, k * effSd * (1 - pf));
  const fc = E.scenario(lines, lift, costs);
  const stock = lines.reduce((s, l) => s + (l.stock || 0), 0);
  // максимум при продажу всього залишку (кожен SKU — не більше свого залишку)
  let mx = { units: 0, revenue: 0, gp: 0 };
  lines.forEach((l) => { const pp = l.p * (1 - l.sd); const q = l.stock || 0; mx.units += q; mx.revenue += q * pp; mx.gp += q * (pp - l.c); });
  mx.contribution = mx.gp - costs;
  const gMax = E.num(st, 'green_max_growth', 30) / 100, rMin = E.num(st, 'red_min_growth', 60) / 100;
  let verdict = 'yellow';
  const reasons = [];
  if (!lines.length || !be.ok) { verdict = 'red'; reasons.push(be.reason === 'negative_margin' ? T('знижка більша за маржу — кожна пачка в мінус', 'discount exceeds margin — every pack loses money') : T('немає baseline-продажів по вибраних SKU', 'no baseline sales for the selected SKUs')); }
  else {
    if (be.growth > rMin) reasons.push(T(`потрібен приріст ${pct(be.growth, 0, true)} — більше порогу ${pct(rMin, 0, true)}`, `needs ${pct(be.growth, 0, true)} growth — above the ${pct(rMin, 0, true)} threshold`));
    if (stock < be.beUnits) reasons.push(T(`залишку ${fmtN(stock)} шт. не вистачає до break-even ${fmtN(be.beUnits)} шт.`, `stock ${fmtN(stock)} pcs is below break-even ${fmtN(be.beUnits)} pcs`));
    if (fc.incProfit < 0) reasons.push(T(`за прогнозом (${pct(lift, 0, true)}) прибуток нижче baseline на ${uah(-fc.incProfit)}`, `forecast (${pct(lift, 0, true)}) is ${uah(-fc.incProfit)} below baseline profit`));
    if (be.growth > rMin || stock < be.beUnits || (fc.incProfit < 0 && be.growth > lift * 1.5)) verdict = 'red';
    else if (fc.incProfit > 0 && be.growth <= gMax) verdict = 'green';
  }
  return { lines, costs, be, effSd, k, pf, lift, assumedK: !h || h.k === null || h.k === undefined, fc, stock, mx, verdict, reasons, U, Rv };
}
function svgChart(lines, costs, be, lift) {
  const W = 640, H = 220, P = { l: 64, r: 16, t: 14, b: 28 };
  const gs = [...Array(41)].map((_, i) => i * 0.05);
  const pts = gs.map((g) => [g, E.scenario(lines, g, costs).contribution]);
  const base = be.baseContribution || 0;
  const ys = pts.map((p) => p[1]).concat([base]);
  const y0 = Math.min(...ys, 0), y1 = Math.max(...ys);
  const X = (g) => P.l + (g / 2) * (W - P.l - P.r), Y = (v) => P.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - P.t - P.b);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
  const ticks = [0, 0.5, 1, 1.5, 2];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="contribution vs growth">
    <line x1="${P.l}" x2="${W - P.r}" y1="${Y(base)}" y2="${Y(base)}" stroke="#B5BAD0" stroke-dasharray="4 4"/>
    <text x="${W - P.r}" y="${Y(base) - 5}" text-anchor="end">baseline ${uah(base)}</text>
    ${y0 < 0 ? `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#E6E9F2"/>` : ''}
    <path d="${path}" fill="none" stroke="#001154" stroke-width="2.5"/>
    ${be.ok && be.growth <= 2 ? `<circle cx="${X(be.growth)}" cy="${Y(base)}" r="5" fill="#C93636"/><text x="${X(be.growth) + 8}" y="${Y(base) + 16}" fill="#C93636">break-even ${pct(be.growth, 0, true)}</text>` : ''}
    ${lift <= 2 ? `<circle cx="${X(lift)}" cy="${Y(E.scenario(lines, lift, costs).contribution)}" r="5" fill="#1E8E4E"/>` : ''}
    ${ticks.map((g) => `<text x="${X(g)}" y="${H - 8}" text-anchor="middle">${pct(g, 0, true)}</text>`).join('')}
    <text x="${P.l - 6}" y="${Y(y1) + 4}" text-anchor="end">${fmtN(y1 / 1000, 0)}k</text><text x="${P.l - 6}" y="${Y(y0) + 4}" text-anchor="end">${fmtN(y0 / 1000, 0)}k</text>
  </svg><div class="legend"><span><span class="dot" style="background:#001154"></span>Contribution ${T('при рості продажів', 'vs sales growth')}</span><span><span class="dot" style="background:#C93636"></span>break-even</span><span><span class="dot" style="background:#1E8E4E"></span>${T('прогноз', 'forecast')}</span></div>`;
}
async function renderCalc() {
  const d = S.data;
  if (!S.calc || S.calc.preset || S.calc.loadId) {
    const pre = S.calc && S.calc.preset, lid = S.calc && S.calc.loadId;
    S.calc = newCalc(pre || {});
    if (lid) await loadCalc(lid);
    else if (pre && pre.partner_id) await fetchBase();
  }
  const c = S.calc;
  const calcs = (await api('calcs').catch(() => ({ rows: [] }))).rows;
  const r = c.base ? compute(c) : null;
  const pOpts = d.partners.filter((p) => p.active && ((p.cp_ids || []).length || p.cp_rule)).map((p) => [p.id, p.name]);
  const shown = c.base ? c.base.lines.filter((l) => (!c.q || (l.name + ' ' + l.sku).toLowerCase().includes(c.q.toLowerCase())) && (!c.abc || l.abc === c.abc) && (!c.onlyStock || l.stock > 0)) : [];
  $('#main').innerHTML = `
  <div class="steps">${[T('1. Загальне', '1. General'), T('2. Baseline', '2. Baseline'), T('3. SKU', '3. SKUs'), T('4. Умови і витрати', '4. Terms & costs'), T('5. Результат', '5. Result')].map((s, i) => `<span class="${(!c.base && i < 2) || (c.base && (i < 4 || (r && r.lines.length))) ? 'on' : ''}">${s}</span>`).join('')}</div>
  <div class="grid g2">
    <div class="card"><h2>${T('Загальна інформація', 'General')}${c.calcId ? ` <span class="tag">#${c.calcId}</span>` : ''}<span class="sp"></span><button class="btn ghost sm" id="cNew">${T('Новий розрахунок', 'New calculation')}</button></h2>
      <div class="form" id="cForm">
        ${fld(T('Назва промо', 'Promo name'), inp('title', c.title, 'text', 'maxlength="160"'), 'full')}
        ${fld(T('Контрагент / партнер', 'Counterparty / partner'), sel('partner_id', c.partner_id, pOpts, T('— оберіть —', '— choose —')), 'full', T('Партнер = один або кілька контрагентів МойСклад (Налаштування → Партнери)', 'Partner = one or more MoySklad counterparties (Settings → Partners)'))}
        ${fld(T('Дата початку', 'Start'), inp('start', c.start, 'date'))}${fld(T('Дата завершення', 'End'), inp('end', c.end, 'date'))}
        ${fld(T('Тип промо', 'Promo type'), sel('ptype', c.ptype, Object.keys(PROMO_TYPES).map((k) => [k, L(PROMO_TYPES, k)])))}
        ${fld(T('Мета промо', 'Promo goal'), sel('goal', c.goal, Object.keys(PROMO_GOALS).map((k) => [k, L(PROMO_GOALS, k)])))}
        ${fld('Baseline', sel('method', c.method, [['d28', T('попередні 28 днів', 'previous 28 days')], ['w4', T('попередні 4 повні тижні', 'previous 4 full weeks')], ['prev_month', T('попередній календарний місяць', 'previous calendar month')], ['avg3m', T('середнє за 3 місяці', 'average of 3 months')], ['last_year', T('аналогічний період минулого року', 'same period last year')], ['custom', T('свій період', 'custom period')]]), 'full')}
        ${c.method === 'custom' ? fld(T('Baseline з', 'Baseline from'), inp('bfrom', c.bfrom, 'date')) + fld(T('Baseline по', 'Baseline to'), inp('bto', c.bto, 'date')) : ''}
        ${fld(T('Коментар', 'Note'), `<textarea name="note">${esc(c.note)}</textarea>`, 'full')}
      </div>
      <div class="row" style="margin-top:12px"><button class="btn" id="cBase">${c.base ? T('Оновити baseline', 'Refresh baseline') : T('Отримати baseline з МойСклад', 'Get baseline from MoySklad')}</button>
      ${c.base ? `<span class="small muted">${T('baseline', 'baseline')} ${esc(dmy(c.base.baseline.from))}–${esc(dmy(c.base.baseline.to))} (${c.base.baseline.days} ${T('дн.', 'd')}) → ${T('нормалізовано на', 'normalised to')} ${c.base.promo_days} ${T('дн. промо', 'promo days')}</span>` : ''}</div>
    </div>
    <div class="card"><h2>${T('Збережені розрахунки', 'Saved calculations')} <span class="tag">${calcs.length}</span></h2>
      ${calcs.length ? `<div class="tw" style="max-height:360px;overflow:auto"><table><thead><tr><th>${T('Промо', 'Promo')}</th><th>${T('Період', 'Period')}</th><th>${T('Оцінка', 'Verdict')}</th><th>${T('Статус', 'Status')}</th></tr></thead><tbody>
      ${calcs.map((x) => `<tr class="click" data-calc="${x.id}"><td>${esc(x.title)}<div class="tiny muted">#${x.id} · ${esc((x.created_by || '').split('@')[0])}</div></td><td class="num">${esc(range(x.start_date, x.end_date))}</td><td>${x.verdict ? `<span class="tag ${x.verdict === 'green' ? 'good' : x.verdict === 'yellow' ? 'warn' : 'bad'}">${x.verdict === 'green' ? T('вигідне', 'profitable') : x.verdict === 'yellow' ? T('коригувати', 'adjust') : T('невигідне', 'unprofitable')}</span>` : ''}</td><td>${esc(x.status)}${x.activity_id ? ` · <button class="link" data-act="${x.activity_id}">#${x.activity_id}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty small">${T('Ще немає', 'None yet')}</div>`}
      ${c.base && c.base.history ? `<div class="hr"></div><div class="small muted" style="margin-bottom:6px">💡 ${T('Історія партнера', 'Partner history')}: ${c.base.history.n} ${T('акцій', 'promos')}${c.base.history.k !== null && c.base.history.k !== undefined ? ` · ${T('відгук', 'response')} k = ${fmtN(c.base.history.k, 2)} (${T('−1 % ціни →', '−1 % price →')} ${pct(c.base.history.k / 100, 1, true)} ${T('пачок', 'packs')})` : ''}${c.base.history.pullForward ? ` · ${T('закупка наперед', 'forward buying')} ${pct(c.base.history.pullForward)}` : ''}</div>${(c.base.history.tips || []).map(tipHtml).join('')}` : ''}
    </div>
  </div>
  ${c.base ? calcBody(c, r, shown) : `<div class="card"><div class="empty">${T('Оберіть партнера, період і метод baseline, потім «Отримати baseline».', 'Choose a partner, period and baseline method, then "Get baseline".')}</div></div>`}`;
  bindCalc();
}
function calcBody(c, r, shown) {
  const allSel = shown.length && shown.every((l) => c.sel.has(l.pid));
  const be = r.be, fc = r.fc;
  const grid = [0.05, 0.1, 0.15, 0.2, 0.25, (+c.customD || 0) / 100];
  const scen = [0, 0.1, 0.25, 0.5, 0.75, 1, (+c.customG || 0) / 100];
  if (be.ok) scen.push(be.growth);
  const uniq = [...new Set(scen.map((x) => Math.round(x * 10000) / 10000))].sort((a, b) => a - b);
  const vcls = { green: 'green', yellow: 'yellow', red: 'red' }[r.verdict];
  const vtxt = { green: T('🟢 Економічно вигідне', '🟢 Profitable'), yellow: T('🟡 Потребує коригування', '🟡 Needs adjustment'), red: T('🔴 Економічно невигідне', '🔴 Unprofitable') }[r.verdict];
  return `
  <div class="card"><h2>${T('SKU в акції', 'SKUs in promo')} <span class="tag">${r.lines.length} / ${c.base.lines.length}</span></h2>
    <div class="row" style="margin-bottom:10px">
      <span class="f"><input type="search" id="cQ" value="${esc(c.q)}" placeholder="${esc(T('Пошук SKU', 'Search SKU'))}"></span>
      ${['', 'A', 'B', 'C'].map((x) => `<button class="chip ${c.abc === x ? 'on' : ''}" data-abc="${x}">${x || T('Усі', 'All')}</button>`).join('')}
      <label class="chip ${c.onlyStock ? 'on' : ''}"><input type="checkbox" id="cStock" ${c.onlyStock ? 'checked' : ''} style="display:none"> ${T('лише з залишком', 'with stock only')}</label>
      <span class="sp"></span><span class="small muted">${T('Ціна — фактична середня ціна відвантаження цьому партнеру без ПДВ; якщо продажів не було — прайс ОПТ', 'Price — actual average shipment price to this partner ex VAT; list price if no sales')}</span>
    </div>
    <div class="tw" style="max-height:420px;overflow:auto"><table><thead><tr><th><input type="checkbox" id="cAll" ${allSel ? 'checked' : ''}></th><th>SKU</th><th>ABC</th><th class="n">${T('Baseline, шт', 'Baseline, pcs')}</th><th class="n">${T('Baseline, ₴', 'Baseline, ₴')}</th><th class="n">${T('Ціна', 'Price')}</th><th class="n">${T('Собів.', 'Cost')}</th><th class="n">GP/${T('шт', 'pc')}</th><th class="n">${T('Маржа', 'Margin')}</th><th class="n">${T('Залишок', 'Stock')}</th><th class="n">${T('Знижка, %', 'Disc., %')}</th></tr></thead><tbody>
      ${shown.map((l) => `<tr class="${c.sel.has(l.pid) ? '' : 'muted'}"><td><input type="checkbox" data-sku="${l.pid}" ${c.sel.has(l.pid) ? 'checked' : ''}></td><td>${esc(l.name)}<div class="tiny muted">${esc(l.sku || '')}${l.price_source === 'price_list' ? ' · ' + T('прайс', 'list price') : l.price_source === 'partner_price' ? ' · ' + T('прайс партнера з ', 'partner price from ') + esc(l.partner_price_from || '') : ''}</div></td><td>${l.abc ? `<span class="tag ${l.abc === 'A' ? 'good' : l.abc === 'B' ? 'info' : ''}">${l.abc}</span>` : '—'}</td>
        <td class="n">${fmtN(l.u, 1)}</td><td class="n">${uah(l.u * l.p)}</td><td class="n">${fmtN(l.p, 2)}</td><td class="n">${fmtN(l.c, 2)}</td><td class="n">${fmtN(l.gpu, 2)}</td><td class="n">${pct(l.margin, 0)}</td><td class="n ${l.stock < l.u ? 'bad' : ''}">${fmtN(l.stock)}</td>
        <td class="n"><input class="mini" data-psd="${l.pid}" type="number" min="0" max="100" step="0.5" value="${esc(c.perSku[l.pid] ?? '')}" placeholder="${esc(c.sd)}"></td></tr>`).join('')}
    </tbody></table></div>
  </div>
  <div class="grid g2">
    <div class="card"><h2>${T('Умови промо', 'Promo terms')}</h2><div class="form">
      <div class="fld full"><label>${T('Як фінансуємо знижку', 'How we fund the discount')}</label><div class="seg">${[['invoice', T('знижка в ціні відвантаження', 'discount in shipment price')], ['comp', T('компенсація поза накладною', 'off-invoice compensation')]].map(([k, l]) => `<button type="button" data-mode="${k}" class="${c.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="hint">${T('Для прибутку однаково: кожна пачка коштує нам ціна × %. Різниця — коли платимо: одразу в накладній чи актом компенсації за продажі (MasterZoo, Pethouse).', 'Same for profit: each pack costs us price × %. The difference is when we pay: in the invoice or via a compensation act on sales (MasterZoo, Pethouse).')}</div></div>
      ${fld(T('Наша знижка / компенсація, %', 'Our discount / compensation, %'), `<input id="cSd" type="number" min="0" max="100" step="0.5" value="${esc(c.sd)}">`, '', T('впливає на нашу маржу', 'affects our margin'))}
      ${fld(T('Знижка контрагента, %', 'Partner discount, %'), `<input id="cPd" type="number" min="0" max="100" step="0.5" value="${esc(c.pd)}">`, '', T('за рахунок партнера, нашу маржу не чіпає', 'funded by the partner, does not touch our margin'))}
      ${fld(T('Кінцева знижка покупцю, %', 'Final shopper discount, %'), `<input id="cCd" type="number" min="0" max="100" step="0.5" value="${esc(c.cd === '' ? (+c.sd || 0) + (+c.pd || 0) : c.cd)}">`, '', T('сила пропозиції на полиці', 'offer strength on the shelf'))}
      ${fld(T('Прогноз приросту, %', 'Forecast growth, %'), `<input id="cFc" type="number" step="1" value="${esc(c.fcOverride)}" placeholder="${esc(fmtN(r.lift * 100))}">`, '', r.assumedK ? T('порожньо = припущення без історії партнера', 'empty = assumption without partner history') : T(`порожньо = з історії партнера: k ${fmtN(r.k, 2)} × знижка × (1 − закупка наперед ${pct(r.pf)})`, `empty = from partner history: k ${fmtN(r.k, 2)} × discount × (1 − fwd buying ${pct(r.pf)})`))}
    </div></div>
    <div class="card"><h2>${T('Додаткові витрати на промо', 'Additional promo costs')} <span class="sp"></span><button class="btn ghost sm" id="cAddCost">+ ${T('Витрата', 'Cost')}</button></h2>
      ${c.costs.length ? c.costs.map((x, i) => `<div class="row" style="margin-bottom:6px"><span class="f"><select data-cc="${i}" data-k="cat">${COST_CATS.map(([k, l]) => opt(k, l, x.cat)).join('')}</select></span><span class="f"><input data-cc="${i}" data-k="sum" type="number" min="0" step="1" value="${esc(x.sum)}" placeholder="₴" style="width:110px"></span><span class="f" style="flex:1"><input data-cc="${i}" data-k="comment" value="${esc(x.comment || '')}" placeholder="${esc(T('коментар', 'note'))}" style="max-width:none;width:100%"></span><button class="x" data-ccdel="${i}">✕</button></div>`).join('') : `<div class="muted small">${T('Банер, розміщення, POS, семпли, подарунки, логістика…', 'Banner, placement, POS, samples, gifts, logistics…')}</div>`}
      <div class="hr"></div>
      <dl class="kv"><dt>Discount investment</dt><dd class="num">${uah(fc.discountInvestment)} <span class="tiny muted">(${T('за прогнозом', 'at forecast')})</span></dd><dt>Marketing + other</dt><dd class="num">${uah(r.costs)}</dd><dt><b>Total promo investment</b></dt><dd class="num"><b>${uah(fc.discountInvestment + r.costs)}</b></dd></dl>
    </div>
  </div>
  ${r.lines.length ? `
  <div class="calc-hero">
    <div class="row"><div class="l" style="flex:1">${T('Для збереження поточного рівня прибутку', 'To keep the current profit level')}</div><span class="verdict ${vcls}">${vtxt}</span></div>
    ${be.ok ? `<div class="lines">
      <div><div class="v">${fmtN(be.beUnits)} ${T('шт', 'pcs')}</div><div class="d">${T('продати мінімум', 'sell at least')} · baseline ${fmtN(be.baseUnits)}</div></div>
      <div><div class="v">${pct(be.growth, 0, true)}</div><div class="d">${T('продажі мають зрости на', 'units must grow by')} · +${fmtN(be.beUnits - be.baseUnits)} ${T('шт', 'pcs')}</div></div>
      <div><div class="v">${uah(be.beRevenue)}</div><div class="d">${T('оборот без ПДВ мінімум', 'revenue ex VAT at least')} · baseline ${uah(be.baseRevenue)}</div></div>
      <div><div class="v">${pct(be.revenueGrowth, 0, true)}</div><div class="d">${T('оборот має зрости на', 'revenue must grow by')}</div></div>
    </div>` : `<div class="v" style="margin-top:10px">${T('Break-even недосяжний', 'Break-even is unreachable')}</div>`}
    ${r.reasons.length ? `<div class="d" style="margin-top:12px">${r.reasons.map(esc).join(' · ')}</div>` : ''}
    <div class="row" style="margin-top:14px">
      <button class="btn light" id="cSaveAct">${c.activityId ? T('Зберегти і оновити KPI активності', 'Save and update activity KPI') : T('Зберегти і створити активність з KPI', 'Save and create activity with KPI')}</button>
      <button class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.35)" id="cSave">${T('Зберегти чернетку', 'Save draft')}</button>
    </div>
  </div>
  <div class="grid g2">
    <div class="card"><h2>Baseline · ${T('без промо за', 'no promo over')} ${c.base.promo_days} ${T('дн.', 'd')}</h2><dl class="kv">
      <dt>Units</dt><dd class="num">${fmtN(r.U, 1)}</dd><dt>Revenue</dt><dd class="num">${uah(r.Rv)}</dd><dt>COGS</dt><dd class="num">${uah(r.lines.reduce((s, l) => s + l.u * l.c, 0))}</dd>
      <dt>Gross profit = Contribution</dt><dd class="num">${uah(be.baseContribution)}</dd><dt>Margin</dt><dd class="num">${pct(r.Rv ? (be.baseContribution || 0) / r.Rv : null, 1)}</dd></dl></div>
    <div class="card"><h2>${T('Прогноз', 'Forecast')} · ${pct(r.lift, 0, true)}</h2><dl class="kv">
      <dt>Units</dt><dd class="num">${fmtN(fc.units, 1)}</dd><dt>Revenue</dt><dd class="num">${uah(fc.revenue)}</dd><dt>Gross profit</dt><dd class="num">${uah(fc.gp)}</dd><dt>Contribution</dt><dd class="num">${uah(fc.contribution)}</dd>
      <dt>Incremental profit</dt><dd class="num" style="color:${fc.incProfit >= 0 ? 'var(--good)' : 'var(--bad)'}"><b>${uah(fc.incProfit)}</b> (${be.baseContribution ? pct(fc.incProfit / be.baseContribution, 0, true) : '—'})</dd>
      <dt>Promo ROI</dt><dd class="num">${fc.roi === null ? '—' : pct(fc.roi)}</dd></dl></div>
  </div>
  <div class="card"><h2>${T('Економіка промо по SKU', 'Promo economics by SKU')}</h2><div class="tw"><table><thead><tr><th>SKU</th><th class="n">${T('Ціна', 'Price')}</th><th class="n">${c.mode === 'comp' ? T('Нетто після компенсації', 'Net after compensation') : 'Promo price'}</th><th class="n">GP/${T('шт до', 'pc before')}</th><th class="n">GP/${T('шт в акції', 'pc promo')}</th><th class="n">Δ ₴/${T('шт', 'pc')}</th><th class="n">Δ ${T('маржі', 'margin')}</th><th class="n">BE ${T('шт', 'pcs')}</th><th class="n">${T('Залишок', 'Stock')}</th></tr></thead><tbody>
    ${r.lines.map((l) => { const pp = l.p * (1 - l.sd), g0 = l.p - l.c, g1 = pp - l.c, b1 = E.breakEven([l]); return `<tr><td>${esc(l.name)}</td><td class="n">${fmtN(l.p, 2)}</td><td class="n">${fmtN(pp, 2)}</td><td class="n">${fmtN(g0, 2)}</td><td class="n ${g1 <= 0 ? 'bad' : ''}">${fmtN(g1, 2)}</td><td class="n">${fmtN(g1 - g0, 2)}</td><td class="n">${fmtN(((pp ? g1 / pp : 0) - (l.p ? g0 / l.p : 0)) * 100, 1)} п.п.</td><td class="n">${b1.ok ? fmtN(b1.beUnits, 1) : '∞'}</td><td class="n ${b1.ok && l.stock < b1.beUnits ? 'bad' : ''}">${fmtN(l.stock)}</td></tr>`; }).join('')}
  </tbody></table></div><div class="tiny muted" style="margin-top:6px">${T('Break-even портфеля рахується одним коефіцієнтом росту для всього міксу (структура продажів SKU як у baseline), а не сумою окремих SKU.', 'Portfolio break-even uses one growth factor for the whole mix (SKU structure as in baseline), not a sum of single SKUs.')}</div></div>
  <div class="card"><h2>${T('Порівняння рівнів знижки', 'Discount comparison')}<span class="sp"></span><span class="small" style="text-transform:none;letter-spacing:0">custom <input class="mini" id="cCustD" type="number" step="0.5" value="${esc(c.customD)}"> %</span></h2><div class="tw"><table><thead><tr><th>${T('Знижка', 'Discount')}</th><th class="n">Promo margin</th><th class="n">Break-even units</th><th class="n">Units growth</th><th class="n">Break-even revenue</th><th class="n">Revenue growth</th><th class="n">${T('Прогноз Δ прибутку', 'Forecast Δ profit')}</th></tr></thead><tbody>
    ${grid.map((dd) => { const ls = withSd(r.lines, dd), b = E.breakEven(ls, r.costs), lift = c.fcOverride !== '' ? r.lift : Math.max(0, r.k * dd * (1 - r.pf)), s = E.scenario(ls, lift, r.costs); const rv = ls.reduce((a, l) => a + l.u * l.p * (1 - dd), 0), gp = ls.reduce((a, l) => a + l.u * (l.p * (1 - dd) - l.c), 0);
      return `<tr class="${Math.abs(dd - r.effSd) < 0.001 ? 'hl' : ''}"><td>−${fmtN(dd * 100, 1)} %</td><td class="n">${pct(rv ? gp / rv : null, 1)}</td><td class="n">${b.ok ? fmtN(b.beUnits) : '∞'}</td><td class="n">${b.ok ? pct(b.growth, 0, true) : '∞'}</td><td class="n">${b.ok ? uah(b.beRevenue) : '—'}</td><td class="n">${b.ok ? pct(b.revenueGrowth, 0, true) : '—'}</td><td class="n" style="color:${s.incProfit >= 0 ? 'var(--good)' : 'var(--bad)'}">${uah(s.incProfit)}</td></tr>`; }).join('')}
  </tbody></table></div><div class="tiny muted" style="margin-top:6px">${T('Прогноз Δ прибутку — за відгуком партнера на знижку з історії його акцій (або обережним припущенням, якщо історії немає).', 'Forecast Δ profit — from the partner\'s historical response to discounts (or a cautious assumption without history).')}</div></div>
  <div class="card"><h2>${T('Сценарії росту продажів', 'Sales growth scenarios')} · −${fmtN(r.effSd * 100, 1)} %<span class="sp"></span><span class="small" style="text-transform:none;letter-spacing:0">custom <input class="mini" id="cCustG" type="number" step="5" value="${esc(c.customG)}"> %</span></h2>
    <div class="tw"><table><thead><tr><th>Sales growth</th><th class="n">Units</th><th class="n">Revenue</th><th class="n">COGS</th><th class="n">Gross profit</th><th class="n">Margin</th><th class="n">Promo costs</th><th class="n">Contribution</th><th class="n">Incr. revenue</th><th class="n">Δ Profit</th></tr></thead><tbody>
    <tr><td><b>${T('Без промо', 'No promo')}</b></td><td class="n">${fmtN(r.U)}</td><td class="n">${uah(r.Rv)}</td><td class="n">${uah(r.lines.reduce((a, l) => a + l.u * l.c, 0))}</td><td class="n">${uah(be.baseContribution)}</td><td class="n">${pct(r.Rv ? (be.baseContribution || 0) / r.Rv : null, 1)}</td><td class="n">—</td><td class="n">${uah(be.baseContribution)}</td><td class="n">—</td><td class="n">—</td></tr>
    ${uniq.map((g) => { const s = E.scenario(r.lines, g, r.costs); const isBe = be.ok && Math.abs(g - Math.round(be.growth * 10000) / 10000) < 1e-9; return `<tr class="${isBe ? 'hl' : ''}"><td>${g === 0 ? T('+0 % (обсяг як без промо)', '+0 % (no-promo volume)') : pct(g, 0, true)}${isBe ? ' · <b>break-even</b>' : ''}</td><td class="n">${fmtN(s.units)}</td><td class="n">${uah(s.revenue)}</td><td class="n">${uah(s.cogs)}</td><td class="n">${uah(s.gp)}</td><td class="n">${pct(s.margin, 1)}</td><td class="n">${uah(s.costs)}</td><td class="n">${uah(s.contribution)}</td><td class="n">${uah(s.incRevenue)}</td><td class="n" style="color:${s.incProfit >= -0.5 ? 'var(--good)' : 'var(--bad)'}">${uah(s.incProfit)}</td></tr>`; }).join('')}
    </tbody></table></div>
    ${svgChart(r.lines, r.costs, be, r.lift)}
  </div>
  <div class="card"><h2>${T('Товарний запас', 'Stock')}</h2>
    ${be.ok && r.stock < be.beUnits ? `<div class="tip bad">⛔ <div><b>${T('Недостатній запас для досягнення break-even', 'Not enough stock to reach break-even')}</b>: ${T('необхідно', 'needed')} ${fmtN(be.beUnits)} ${T('шт., доступно', 'pcs, available')} ${fmtN(r.stock)} ${T('шт.', 'pcs')}</div></div>` : ''}
    <dl class="kv"><dt>Current stock</dt><dd class="num">${fmtN(r.stock)}</dd><dt>Baseline units</dt><dd class="num">${fmtN(r.U)}</dd><dt>Break-even units</dt><dd class="num">${be.ok ? fmtN(be.beUnits) : '∞'}</dd><dt>Forecast units</dt><dd class="num">${fmtN(fc.units)}</dd>
    <dt>Stock coverage</dt><dd class="num">${fc.units ? pct(r.stock / fc.units) + ' ' + T('від прогнозу', 'of forecast') : '—'}</dd>
    <dt>Maximum possible result</dt><dd class="num">${fmtN(r.mx.units)} ${T('шт', 'pcs')} · ${uah(r.mx.revenue)} · GP ${uah(r.mx.gp)} · contribution ${uah(r.mx.contribution)} ${be.ok ? (r.mx.contribution >= be.baseContribution ? '✅' : '⛔ ' + T('навіть увесь залишок не дає baseline-прибутку', 'even all stock does not reach baseline profit')) : ''}</dd></dl>
    <div class="tiny muted" style="margin-top:6px">${T('Залишок — склади МойСклад станом на останню синхронізацію; виробництво під акцію треба планувати окремо.', 'Stock — MoySklad warehouses as of the last sync; production for the promo is planned separately.')}</div>
  </div>` : `<div class="card"><div class="empty">${T('Позначте SKU, які беруть участь в акції.', 'Tick the SKUs taking part in the promo.')}</div></div>`}`;
}
async function fetchBase() {
  const c = S.calc;
  if (!c.partner_id) { toast(T('Оберіть партнера', 'Choose a partner'), true); return; }
  if (!c.start || !c.end || c.end < c.start) { toast(T('Перевірте дати промо', 'Check promo dates'), true); return; }
  const q = new URLSearchParams({ partner_id: c.partner_id, start: c.start, end: c.end, method: c.method });
  if (c.method === 'custom') { q.set('bfrom', c.bfrom); q.set('bto', c.bto); }
  const keepSel = c.base ? new Set(c.sel) : null;
  c.base = await api('calc/base?' + q);
  if (c.base.error) { const e = c.base.error; c.base = null; throw new Error(e); }
  c.sel = keepSel && keepSel.size ? keepSel : new Set(c.base.lines.filter((l) => l.base_units_period > 0).map((l) => l.pid));
}
async function loadCalc(id) {
  const x = (await api('calcs/' + id)).calc;
  const i = x.inputs || {};
  S.calc = { ...newCalc(), ...i, sel: new Set(i.sel || []), calcId: x.id, activityId: x.activity_id, title: x.title, start: x.start_date, end: x.end_date };
  S.calc.base = x.snapshot && x.snapshot.lines ? x.snapshot : null;
  if (S.calc.base) toast(T('Відкрито знімок на дату збереження. «Оновити baseline» — перерахувати на свіжих даних.', 'Opened the snapshot as saved. "Refresh baseline" recomputes on fresh data.'));
}
function bindCalc() {
  const c = S.calc;
  const re = () => renderCalc();
  $$('#cForm [name]').forEach((el) => el.addEventListener('change', () => { c[el.name] = el.value; if (el.name === 'partner_id' && !c.title) c.title = (S.data.pmap[el.value] || {}).name + ' — промо'; if (['method', 'partner_id'].includes(el.name)) re(); }));
  $('#cBase').onclick = async () => { $$('#cForm [name]').forEach((el) => { c[el.name] = el.value; }); $('#cBase').disabled = true; try { await fetchBase(); re(); } catch (e) { toast(e.message, true); $('#cBase').disabled = false; } };
  $('#cNew').onclick = () => { S.calc = newCalc(); re(); };
  $$('[data-calc]').forEach((el) => el.addEventListener('click', async (e) => { if (e.target.closest('[data-act]')) return; try { await loadCalc(+el.dataset.calc); re(); } catch (er) { toast(er.message, true); } }));
  if (!c.base) return;
  const q = $('#cQ'); if (q) q.oninput = () => { c.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { re().then(() => { const n = $('#cQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 250); };
  $$('[data-abc]').forEach((b) => b.onclick = () => { c.abc = b.dataset.abc; re(); });
  const so = $('#cStock'); if (so) so.onchange = () => { c.onlyStock = so.checked; re(); };
  const all = $('#cAll'); if (all) all.onchange = () => { const shown = $$('[data-sku]').map((x) => x.dataset.sku); shown.forEach((p) => (all.checked ? c.sel.add(p) : c.sel.delete(p))); re(); };
  $$('[data-sku]').forEach((x) => x.onchange = () => { x.checked ? c.sel.add(x.dataset.sku) : c.sel.delete(x.dataset.sku); re(); });
  $$('[data-psd]').forEach((x) => x.onchange = () => { c.perSku[x.dataset.psd] = x.value; re(); });
  const num = (id, k) => { const el = $(id); if (el) el.onchange = () => { c[k] = el.value; re(); }; };
  $$('[data-mode]').forEach((b) => b.onclick = () => { c.mode = b.dataset.mode; re(); });
  num('#cSd', 'sd'); num('#cPd', 'pd'); num('#cCd', 'cd'); num('#cFc', 'fcOverride'); num('#cCustD', 'customD'); num('#cCustG', 'customG');
  const add = $('#cAddCost'); if (add) add.onclick = () => { c.costs.push({ cat: 'placement', sum: '', comment: '' }); re(); };
  $$('[data-cc]').forEach((el) => el.onchange = () => { c.costs[+el.dataset.cc][el.dataset.k] = el.value; re(); });
  $$('[data-ccdel]').forEach((b) => b.onclick = () => { c.costs.splice(+b.dataset.ccdel, 1); re(); });
  const doSave = async (link) => {
    const r = compute(c);
    const sel = [...c.sel];
    const lines = c.base.lines.filter((l) => c.sel.has(l.pid));
    const body = {
      title: c.title || 'Промо', partner_id: +c.partner_id, start_date: c.start, end_date: c.end, status: link ? 'planned' : 'draft', verdict: r.verdict,
      inputs: { mode: c.mode, partner_id: c.partner_id, ptype: c.ptype, goal: c.goal, note: c.note, method: c.method, bfrom: c.bfrom, bto: c.bto, sd: c.sd, pd: c.pd, cd: c.cd, perSku: c.perSku, costs: c.costs, sel, fcOverride: c.fcOverride, customD: c.customD, customG: c.customG },
      snapshot: { ...c.base, lines: c.base.lines, saved_at: new Date().toISOString(), selected: lines.map((l) => l.pid) },
      result: { be: r.be, effSd: r.effSd, lift: r.lift, k: r.k, pf: r.pf, costs: r.costs, stock: r.stock, max: r.mx, reasons: r.reasons, forecast: { units: r.fc.units, revenue: r.fc.revenue, gp: r.fc.gp, margin: r.fc.margin, contribution: r.fc.contribution, incProfit: r.fc.incProfit, roi: r.fc.roi, discountInvestment: r.fc.discountInvestment } },
      kpi: { be_units: r.be.ok ? r.be.beUnits : null, growth: r.be.ok ? r.be.growth : null, be_revenue: r.be.ok ? r.be.beRevenue : null, inc_profit: r.fc.incProfit, costs: r.costs },
      supplier_discount_pct: c.mode === 'comp' ? 0 : Math.round(r.effSd * 1000) / 10, comp_pct: c.mode === 'comp' ? Math.round(r.effSd * 1000) / 10 : 0, customer_discount_pct: c.cd === '' ? (+c.sd || 0) + (+c.pd || 0) : +c.cd,
      mechanic: `${T('Знижка', 'Discount')} −${fmtN(c.cd === '' ? (+c.sd || 0) + (+c.pd || 0) : +c.cd, 1)} % ${T('покупцю', 'to shopper')} (${T('наша', 'ours')} ${fmtN(r.effSd * 100, 1)} % ${c.mode === 'comp' ? T('компенсацією', 'as compensation') : T('у ціні відвантаження', 'in shipment price')}, ${T('партнера', 'partner')} ${fmtN(+c.pd || 0, 1)} %); ${lines.length} SKU`,
      activity_type: c.ptype === 'bf' ? 'Black Friday' : 'Знижка', direction: (S.data.pmap[c.partner_id] || {}).ptype === 'own' ? 'ecom' : 'partners',
    };
    if (link) { if (c.activityId) body.activity_id = c.activityId; else body.create_activity = true; }
    try {
      let res;
      if (c.calcId) res = await api('calcs/' + c.calcId, { method: 'PUT', body }); else { res = await api('calcs', { method: 'POST', body }); c.calcId = res.id; }
      if (res.activity) { c.activityId = res.activity.id; toast(T(`Збережено. Активність #${res.activity.id}: KPI = ${fmtN(body.kpi.be_units)} пачок`, `Saved. Activity #${res.activity.id}: KPI = ${fmtN(body.kpi.be_units)} packs`)); await load(); }
      else toast(T('Чернетку збережено', 'Draft saved'));
      re();
    } catch (e) { toast(e.message, true); }
  };
  const s1 = $('#cSave'); if (s1) s1.onclick = () => doSave(false);
  const s2 = $('#cSaveAct'); if (s2) s2.onclick = () => doSave(true);
}

// ── бюджет ───────────────────────────────────────────────────────────────────
function renderBudget() {
  const d = S.data, yr = (S.cursor || d.today).slice(0, 4);
  const acts = filtered();
  const months = [...Array(12)].map((_, i) => `${yr}-${String(i + 1).padStart(2, '0')}`);
  const rows = months.map((ym) => {
    const [f, t] = monthBounds(ym);
    const l = acts.filter((a) => overlaps(a, f, t));
    return { ym, limit: (d.budget.find((b) => b.ym === ym) || {}).plan_uah, plan: l.reduce((s, a) => s + planOf(a) * monthShare(a, f, t), 0), fact: l.reduce((s, a) => s + spendOf(a) * monthShare(a, f, t), 0), n: l.filter(live).length };
  });
  const tot = rows.reduce((s, r) => ({ limit: s.limit + (+r.limit || 0), plan: s.plan + r.plan, fact: s.fact + r.fact, n: s.n + r.n }), { limit: 0, plan: 0, fact: 0, n: 0 });
  const ya = acts.filter((a) => a.start_date.slice(0, 4) <= yr && a.end_date.slice(0, 4) >= yr);
  $('#main').innerHTML = `
  <div class="card"><h2>${T('Бюджет по місяцях', 'Budget by month')} · ${yr}<span class="sp"></span><button class="btn ghost sm" data-yr="-1">‹ ${+yr - 1}</button><button class="btn ghost sm" data-yr="1">${+yr + 1} ›</button></h2>
    <div class="tw"><table><thead><tr><th>${T('Місяць', 'Month')}</th><th class="n">${T('Ліміт місяця, ₴', 'Monthly limit, ₴')}</th><th class="n">${T('План активностей', 'Activities plan')}</th><th class="n">${T('Факт', 'Actual')}</th><th class="n">${T('Залишок', 'Remaining')}</th><th class="n">% ${T('використання', 'used')}</th><th class="n">${T('Активностей', 'Activities')}</th></tr></thead><tbody>
    ${rows.map((r) => { const lim = +r.limit || r.plan; return `<tr><td>${esc(monthName(r.ym))}</td><td class="n"><input class="mini" style="width:110px" type="number" min="0" step="100" data-bud="${r.ym}" value="${r.limit ?? ''}" placeholder="—"></td><td class="n">${uah(r.plan)}</td><td class="n">${uah(r.fact)}</td><td class="n ${lim - r.fact < 0 ? 'bad' : ''}">${uah(lim - r.fact)}</td><td class="n">${lim ? pct(r.fact / lim) : '—'}</td><td class="n">${r.n}</td></tr>`; }).join('')}
    <tr class="sum"><td>${T('Разом', 'Total')}</td><td class="n">${uah(tot.limit)}</td><td class="n">${uah(tot.plan)}</td><td class="n">${uah(tot.fact)}</td><td class="n">${uah((tot.limit || tot.plan) - tot.fact)}</td><td class="n">${(tot.limit || tot.plan) ? pct(tot.fact / (tot.limit || tot.plan)) : '—'}</td><td class="n">${tot.n}</td></tr></tbody></table></div>
    <div class="tiny muted" style="margin-top:6px">${T('Ліміт місяця вводиться тут. Активність на кілька місяців ділиться між ними пропорційно дням. Факт — «Фактичні витрати» завершених і активних активностей; знижки партнерам сюди не входять (вони у «Ефективність промо» як Discount investment).', 'Monthly limit is entered here. A multi-month activity is split by days. Actual = actual cost of done and live activities; partner discounts are not here (see Promo results → discount investment).')}</div>
  </div>
  <div class="grid g3">
    <div class="card"><h2>${T('По каналах', 'By channel')}</h2>${hbars(sumBy(ya, (a) => a.channel, spendOf), uah, 10)}</div>
    <div class="card"><h2>${T('По партнерах', 'By partner')}</h2>${hbars(sumBy(ya, pName, spendOf), uah, 10)}</div>
    <div class="card"><h2>${T('По типах активностей', 'By activity type')}</h2>${hbars(sumBy(ya, (a) => a.activity_type, spendOf), uah, 10)}</div>
  </div>`;
  $$('[data-bud]').forEach((el) => el.onchange = async () => {
    try { await api('budget/' + el.dataset.bud, { method: 'PUT', body: { plan_uah: +el.value || 0 } }); const b = d.budget.find((x) => x.ym === el.dataset.bud); if (b) b.plan_uah = +el.value || 0; else d.budget.push({ ym: el.dataset.bud, plan_uah: +el.value || 0 }); toast(T('Ліміт збережено', 'Limit saved')); renderBudget(); } catch (e) { toast(e.message, true); }
  });
  $$('[data-yr]').forEach((b) => b.onclick = () => { S.cursor = `${+yr + +b.dataset.yr}-01-01`; renderBudget(); });
}

// ── рік ──────────────────────────────────────────────────────────────────────
function vbars(rows, fmt) {
  const W = 640, H = 200, P = { l: 8, r: 8, t: 18, b: 22 };
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  const bw = (W - P.l - P.r) / rows.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${rows.map((r, i) => { const h = (r[1] / mx) * (H - P.t - P.b); const x = P.l + i * bw; return `<rect x="${x + bw * 0.18}" y="${H - P.b - h}" width="${bw * 0.64}" height="${h}" rx="3" fill="#001154"><title>${esc(r[0])}: ${esc(fmt(r[1]))}</title></rect>${r[1] ? `<text x="${x + bw / 2}" y="${H - P.b - h - 4}" text-anchor="middle">${esc(fmt(r[1]).replace(' ₴', ''))}</text>` : ''}<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(r[0])}</text>`; }).join('')}</svg>`;
}
function renderYear() {
  const d = S.data, yr = (S.cursor || d.today).slice(0, 4);
  const acts = filtered().filter((a) => a.start_date.slice(0, 4) <= yr && a.end_date.slice(0, 4) >= yr);
  const months = [...Array(12)].map((_, i) => `${yr}-${String(i + 1).padStart(2, '0')}`);
  const short = (ym) => (lang === 'en' ? MONTHS_EN : MONTHS_UK)[+ym.slice(5) - 1].slice(0, 3);
  const spendM = months.map((ym) => { const [f, t] = monthBounds(ym); return [short(ym), acts.reduce((s, a) => s + spendOf(a) * monthShare(a, f, t), 0)]; });
  const actM = months.map((ym) => { const [f, t] = monthBounds(ym); return [short(ym), acts.filter((a) => overlaps(a, f, t) && live(a)).length]; });
  const price = d.dicts.price_types;
  const k = (l, v, cls = '') => `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v">${v}</div></div>`;
  $('#main').innerHTML = `
  <div class="row" style="margin-bottom:12px"><button class="btn ghost sm" data-yr="-1">‹ ${+yr - 1}</button><b style="font-size:18px">${yr}</b><button class="btn ghost sm" data-yr="1">${+yr + 1} ›</button></div>
  <div class="kpis" style="margin-bottom:16px">
    ${k(T('Маркетингові витрати', 'Marketing spend'), uah(acts.reduce((s, a) => s + spendOf(a), 0)))}
    ${k(T('Активностей', 'Activities'), acts.filter(live).length)}
    ${k(T('Партнерських акцій', 'Partner promos'), acts.filter((a) => a.direction === 'partners' && price.includes(a.activity_type) && live(a)).length)}
    ${k('Events', acts.filter((a) => a.direction === 'pr' && live(a)).length)}
    ${k('Promo Barpi.ua', acts.filter((a) => a.direction === 'ecom' && price.includes(a.activity_type) && live(a)).length)}
    ${k(T('Рекламних кампаній', 'Ad campaigns'), acts.filter((a) => ['Meta Ads', 'Google Ads'].includes(a.activity_type) || ['Meta Ads', 'Google Ads'].includes(a.channel)).length)}
    ${k(T('Завершено', 'Done'), acts.filter((a) => a.status === 'done').length, 'good')}
    ${k(T('Скасовано', 'Cancelled'), acts.filter((a) => a.status === 'cancelled').length)}
  </div>
  <div class="grid g2">
    <div class="card"><h2>Marketing spend by month</h2>${vbars(spendM, (x) => fmtN(x / 1000, 1) + 'k')}</div>
    <div class="card"><h2>Activities by month</h2>${vbars(actM, (x) => fmtN(x))}</div>
    <div class="card"><h2>Spend by partner</h2>${hbars(sumBy(acts, pName, spendOf), uah, 10)}</div>
    <div class="card"><h2>Spend by channel</h2>${hbars(sumBy(acts, (a) => a.channel, spendOf), uah, 10)}</div>
    <div class="card"><h2>Activities by type</h2>${hbars(sumBy(acts.filter(live), (a) => a.activity_type, () => 1), (x) => fmtN(x), 12)}</div>
    <div class="card"><h2>Activities by direction</h2>${hbars(sumBy(acts.filter(live), (a) => L(L_DIR, a.direction), () => 1), (x) => fmtN(x), 3)}</div>
  </div>`;
  $$('[data-yr]').forEach((b) => b.onclick = () => { S.cursor = `${+yr + +b.dataset.yr}-01-01`; renderYear(); });
}

// ── налаштування ─────────────────────────────────────────────────────────────
async function renderSettings() {
  const d = S.data, st = d.settings;
  let ics = null;
  try { ics = (await api('ics-url')).url; } catch (e) { /* без ICS */ }
  const sf = (k, label, hint = '', type = 'number') => fld(label, `<input name="${k}" type="${type}" step="any" value="${esc(st[k] ?? '')}">`, '', hint);
  $('#main').innerHTML = `
  <div class="grid g2">
    <div class="card"><h2>📅 ${T('Підписка в Google / Apple Calendar', 'Subscribe in Google / Apple Calendar')}</h2>
      ${ics ? `<div class="small" style="margin-bottom:8px">${T('Google Calendar → «Інші календарі» → «+» → «З URL» → вставити посилання. Події оновлюються, а не дублюються (UID = ID активності); Google підтягує зміни раз на кілька годин.', 'Google Calendar → "Other calendars" → "+" → "From URL" → paste. Events update instead of duplicating (UID = activity ID); Google refreshes every few hours.')}</div>
      <div class="row"><input id="icsUrl" readonly value="${esc(ics)}" style="flex:1;border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-size:12px"><button class="btn sm" id="icsCopy">${T('Копіювати', 'Copy')}</button></div>
      <div class="tiny muted" style="margin-top:6px">${T('Посилання секретне: хто його має, бачить назви і дати активностей (без бюджетів). Ідеї в календар не потрапляють.', 'The link is secret: anyone with it sees titles and dates (no budgets). Ideas are not exported.')}</div>` : `<div class="tip warn">${T('ICS ще не налаштовано (секрет ICS_TOKEN воркера).', 'ICS not configured yet (worker secret ICS_TOKEN).')}</div>`}
      <div class="hr"></div>
      <h3>${T('Щоденний дайджест', 'Daily digest')}</h3>
      <div class="small muted">${T('О', 'At')} ${esc(st.digest_hour_kyiv)}:00 ${T('за Києвом: Telegram @barpiua_bot + лист. Нагадування T-14 / T-7 / T-3 / T-1 і «внесіть результат» після завершення.', 'Kyiv time: Telegram @barpiua_bot + email. Reminders T-14 / T-7 / T-3 / T-1 and "enter results" after the end.')}</div>
      <button class="btn ghost sm" id="digNow" style="margin-top:8px">${T('Надіслати дайджест зараз', 'Send digest now')}</button>
    </div>
    <div class="card"><h2>⚙️ ${T('Параметри розрахунків', 'Calculation parameters')}</h2>
      <form class="form" id="stForm">
        ${sf('cost_per_kg', T('Змінна собівартість, ₴/кг', 'Variable cost, ₴/kg'), T('канон v4: сировина 340 + енергія 95 + розхідні 85 + логістика 100', 'canon v4: raw 340 + energy 95 + consumables 85 + logistics 100'))}
        ${sf('pack_small', T('Пакування мала, ₴', 'Pack small, ₴'))}${sf('pack_large', T('Пакування велика, ₴', 'Pack large, ₴'))}${sf('pack_jar', T('Банка апетайзера, ₴', 'Appetiser jar, ₴'))}
        ${sf('appetizer_g', T('Вміст апетайзера, г', 'Appetiser content, g'))}${sf('spec_change_date', T('Дата нової специфікації', 'New spec date'), T('до неї великі пачки 100 г, після 70 г', 'before: large packs 100 g, after: 70 g'), 'date')}
        ${sf('vat_rate', T('ПДВ у цінах МойСклад, %', 'VAT in MoySklad prices, %'))}${sf('preload_days', T('Закупка наперед, днів', 'Pre-load, days'), T('вікно акції починається раніше старту', 'promo window starts this many days early'))}
        ${sf('baseline_days', T('Baseline для аналізу, днів', 'Analysis baseline, days'))}${sf('post_days', T('Вікно «після», днів', 'Post window, days'))}
        ${sf('green_max_growth', T('🟢 якщо потрібен приріст ≤, %', '🟢 if required growth ≤, %'))}${sf('red_min_growth', T('🔴 якщо потрібен приріст >, %', '🔴 if required growth >, %'))}
        ${sf('abc_a', T('ABC: межа A, % обороту', 'ABC: A cut-off, % revenue'))}${sf('abc_b', T('ABC: межа B, %', 'ABC: B cut-off, %'))}
        ${sf('promo_share_warn', T('Попередження «знижка стала нормою», % днів', '"Discount is the norm" warning, % days'))}${sf('max_per_day', T('Забагато активностей в день, >', 'Too many activities per day, >'))}
        ${sf('digest_hour_kyiv', T('Година дайджесту (Київ)', 'Digest hour (Kyiv)'))}
      </form>
      <button class="btn" id="stSave" style="margin-top:12px">${T('Зберегти параметри', 'Save parameters')}</button>
    </div>
  </div>
  <div class="card"><h2>🤝 ${T('Партнери і контрагенти МойСклад', 'Partners & MoySklad counterparties')}<span class="sp"></span><button class="btn ghost sm" id="pNew">+ ${T('Партнер', 'Partner')}</button></h2>
    <div class="tw"><table><thead><tr><th>${T('Партнер', 'Partner')}</th><th>${T('Тип', 'Type')}</th><th>${T('Контрагенти МойСклад', 'MoySklad counterparties')}</th><th>${T('Примітка', 'Note')}</th><th></th></tr></thead><tbody>
    ${d.partners.map((p) => `<tr><td><b>${esc(p.name)}</b>${p.active ? '' : ' <span class="tag">off</span>'}</td><td>${esc(L(L_PTYPE, p.ptype))}</td><td class="small">${p.cp_rule === 'fop' ? T('усі ФОП, не закріплені за іншими', 'all sole traders not linked elsewhere') : (p.cp_ids || []).length ? `${(p.cp_ids || []).length} ${T('шт.', 'pcs')}` : `<span class="tag warn">${T('не привʼязано', 'not linked')}</span>`}</td><td class="small muted">${p.retro_pct ? `${T('ретро', 'retro')} ${fmtN(p.retro_pct, 1)} % · ` : ''}${esc(p.note || '')}</td><td><button class="btn ghost sm" data-pedit="${p.id}">${T('Змінити', 'Edit')}</button></td></tr>`).join('')}
    </tbody></table></div>
  </div>
  <div class="card"><h2>📖 ${T('Довідники', 'Dictionaries')}</h2><div class="grid g3">
    <div><h3>${T('Статуси', 'Statuses')}</h3>${R.STATUSES.map(statusTag).join(' ')}</div>
    <div><h3>${T('Типи активностей', 'Activity types')}</h3><div class="small">${d.dicts.types.map(esc).join(' · ')}</div><div class="tiny muted" style="margin-top:6px">${T('Цінові (для промо-аналізу і конфліктів)', 'Price types (promo analysis & conflicts)')}: ${d.dicts.price_types.map(esc).join(', ')}</div></div>
    <div><h3>${T('Канали', 'Channels')}</h3>${Object.entries(CHANNELS).map(([g, l]) => `<div class="small"><b>${esc(g)}:</b> ${l.map(esc).join(' · ')}</div>`).join('')}</div>
  </div><div class="tiny muted" style="margin-top:10px">${T('UGC, амбасадори і регулярний контент Instagram Barpi у календар не входять — вони у UGC/Creator CRM і контент-плані. Instagram тут — лише партнерські й комерційні кампанії.', 'UGC, ambassadors and regular Barpi Instagram content are out of scope — they live in the UGC/Creator CRM and the content plan. Instagram here is only partner and commercial campaigns.')}</div></div>`;
  if ($('#icsCopy')) $('#icsCopy').onclick = () => { navigator.clipboard.writeText(ics).then(() => toast(T('Скопійовано', 'Copied'))); };
  $('#digNow').onclick = async () => { try { const r = await api('digest', { method: 'POST' }); toast(T(`Надіслано: Telegram ${r.tg || 0}, лист ${r.mail && r.mail.sent ? r.mail.sent.length : 0}`, `Sent: Telegram ${r.tg || 0}, email ${r.mail && r.mail.sent ? r.mail.sent.length : 0}`)); } catch (e) { toast(e.message, true); } };
  $('#stSave').onclick = async () => { try { const r = await api('settings', { method: 'PUT', body: Object.fromEntries(new FormData($('#stForm'))) }); d.settings = r.settings; toast(T('Збережено', 'Saved')); } catch (e) { toast(e.message, true); } };
  $('#pNew').onclick = () => editPartner(null);
  $$('[data-pedit]').forEach((b) => b.onclick = () => editPartner(+b.dataset.pedit));
}
async function editPartner(id) {
  const p = id ? S.data.pmap[id] : { name: '', ptype: 'shop', cp_ids: [], cp_rule: null, note: '', active: 1 };
  const chosen = new Set(p.cp_ids || []);
  openDrawer(`<div class="dh"><h2>${id ? esc(p.name) : T('Новий партнер', 'New partner')}</h2><button class="x" data-close>✕</button></div>
    <form class="form" id="pForm">
      ${fld(T('Назва', 'Name'), inp('name', p.name, 'text', 'required maxlength="120"'))}
      ${fld(T('Тип партнера', 'Partner type'), sel('ptype', p.ptype, Object.keys(L_PTYPE).map((k) => [k, L(L_PTYPE, k)])))}
      <div class="fld full checks"><label><input type="checkbox" name="fop" ${p.cp_rule === 'fop' ? 'checked' : ''}> ${T('усі ФОП, не закріплені за іншими партнерами (дрібний опт)', 'all sole traders not linked to other partners (wholesale)')}</label><label><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> ${T('активний', 'active')}</label></div>
      ${fld(T('Ретро-бонус партнеру, % від відвантажень', 'Partner retro bonus, % of shipments'), inp('retro_pct', p.retro_pct, 'number', 'min="0" max="50" step="0.1"'), '', T('взаємозалік за період; зменшує нашу виручку з кожної пачки в аналізі й калькуляторі', 'periodic offset; reduces our revenue per pack in analysis and calculator'))}
      ${fld(T('Примітка', 'Note'), inp('note', p.note), 'full')}
    </form>
    <div class="card" style="margin-top:14px"><h2>${T('Контрагенти МойСклад', 'MoySklad counterparties')} <span class="tag" id="cpN">${chosen.size}</span></h2>
      <input id="cpQ" type="search" placeholder="${esc(T('Пошук контрагента за назвою', 'Search counterparty by name'))}" style="width:100%;border:1px solid var(--line);border-radius:9px;padding:8px 10px;margin-bottom:8px">
      <div id="cpList" class="tw" style="max-height:380px;overflow:auto"></div></div>
    <div class="sticky-actions"><button class="btn" id="pSave">${T('Зберегти', 'Save')}</button></div>`);
  let rows = [];
  const draw = () => {
    $('#cpList').innerHTML = `<table><thead><tr><th></th><th>${T('Контрагент', 'Counterparty')}</th><th class="n">${T('Оборот 180 дн.', 'Revenue 180d')}</th><th>${T('Останній продаж', 'Last sale')}</th></tr></thead><tbody>${rows.map((r) => `<tr><td><input type="checkbox" data-cp="${esc(r.ms_id)}" ${chosen.has(r.ms_id) ? 'checked' : ''}></td><td>${esc(r.ms_name)}</td><td class="n">${uah(r.revenue)}</td><td>${esc(dmy((r.last_sale || '').slice(0, 10)))}</td></tr>`).join('')}</tbody></table>`;
    $$('[data-cp]').forEach((x) => x.onchange = () => { x.checked ? chosen.add(x.dataset.cp) : chosen.delete(x.dataset.cp); $('#cpN').textContent = chosen.size; });
  };
  const search = async () => { try { rows = (await api('counterparties?q=' + encodeURIComponent($('#cpQ').value))).rows; draw(); } catch (e) { toast(e.message, true); } };
  $('#cpQ').oninput = () => { clearTimeout(search._t); search._t = setTimeout(search, 300); };
  search();
  $('#pSave').onclick = async () => {
    const f = $('#pForm');
    if (!f.reportValidity()) return;
    const fd = new FormData(f);
    const b = { name: fd.get('name'), ptype: fd.get('ptype'), note: fd.get('note'), retro_pct: fd.get('retro_pct'), cp_ids: [...chosen], cp_rule: fd.get('fop') ? 'fop' : null, active: !!fd.get('active') };
    try { if (id) await api('partners/' + id, { method: 'PUT', body: b }); else await api('partners', { method: 'POST', body: b }); toast(T('Збережено', 'Saved')); closeDrawer(); await load(); render(); } catch (e) { toast(e.message, true); }
  };
}

// ── каркас ───────────────────────────────────────────────────────────────────
function renderMain() {
  const fn = { overview: renderOverview, calendar: renderCalendar, list: renderList, partners: renderPartners, calc: renderCalc, results: renderResults, budget: renderBudget, year: renderYear, settings: renderSettings }[S.tab] || renderOverview;
  try {
    const p = fn();
    if (p && p.catch) p.catch((e) => { $('#main').innerHTML = `<div class="tip bad">${esc(e.message)}</div>`; });
  } catch (e) { console.error(e); $('#main').innerHTML = `<div class="tip bad">${esc(e.message)}</div>`; }
}
function render() {
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
  renderFilters();
  renderMain();
}
function setLang(l) {
  lang = l; document.documentElement.lang = l;
  $$('.ls button').forEach((b) => b.classList.toggle('on', b.dataset.set === l));
  try { localStorage.setItem('bb-mkt-lang', l); } catch (e) { /* ок */ }
  if (S.data) render();
}
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-close]');
  if (c) { closeDrawer(); return; }
  const a = e.target.closest('[data-act]');
  if (a && !e.target.closest('input,select,textarea')) { e.preventDefault(); openActivity(+a.dataset.act); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#drawer').classList.contains('open')) closeDrawer(); });
$$('#tabs button').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; if (S.tab === 'calc' && S.calc && !S.calc.base && !S.calc.partner_id) S.calc = null; save(); render(); window.scrollTo({ top: 0 }); });
$$('.ls button').forEach((b) => b.onclick = () => setLang(b.dataset.set));
$('#btnNew').onclick = () => openActivity(null, S.tab === 'calendar' && S.cursor ? { start_date: S.cursor, end_date: S.cursor } : {});

(async () => {
  setLang(lang);
  try {
    await load();
    render();
    const m = location.hash.match(/act=(\d+)/);
    if (m) openActivity(+m[1]);
  } catch (e) {
    $('#main').innerHTML = `<div class="card"><div class="tip bad">⛔ <div>${esc(e.message)}</div></div></div>`;
  }
})();
