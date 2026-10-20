// barpi-mkt · правила «Потребує уваги», конфлікти, ICS, текст дайджесту. Чисті функції.
import { addDays, daysIncl } from './econ.js';

export const STATUSES = ['idea', 'planned', 'approval', 'approved', 'prep', 'ready', 'active', 'done', 'postponed', 'cancelled'];
export const DIRECTIONS = ['partners', 'ecom', 'pr'];
export const PRIORITIES = ['P1', 'P2', 'P3'];
export const PRICE_TYPES = ['Знижка', 'Black Friday', 'Набір', '1+1', 'Подарунок', 'Промокод', 'Promo Barpi.ua'];
export const TYPES = ['Знижка', 'Black Friday', 'Набір', '1+1', 'Подарунок', 'Промокод', 'Розіграш', 'Огляд', 'Collab', 'Banner',
  'Category placement', 'Email', 'Push', 'POS', 'Sampling', 'Festival', 'Event', 'PR', 'Meta Ads', 'Google Ads', 'Promo Barpi.ua',
  'Запуск продукту', 'Благодійність', 'Інше'];
export const CHECK_ITEMS = ['approval', 'file', 'creatives', 'budget'];
const CLOSED = ['cancelled', 'postponed', 'done'];
const UNAPPROVED = ['idea', 'planned', 'approval'];

const isPrice = (a) => PRICE_TYPES.includes(a.activity_type);
const checklist = (a) => { try { return JSON.parse(a.checklist || '{}') || {}; } catch (e) { return {}; } };
const dd = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

// Повертає [{code, level, id, title, start_date, missing?}] — і для дашборду, і для дайджесту
export function attention(acts, today) {
  const out = [];
  for (const a of acts) {
    if (a.deleted || a.status === 'cancelled' || a.status === 'postponed') continue;
    const toStart = dd(today, a.start_date);
    const ck = checklist(a);
    const base = { id: a.id, title: a.title, start_date: a.start_date, end_date: a.end_date, owner: a.owner };
    if (toStart < 0 && a.end_date >= today && UNAPPROVED.includes(a.status)) out.push({ ...base, code: 'started_unapproved', level: 'bad' });
    if (toStart >= 0 && toStart <= 14 && (a.status === 'idea' || a.status === 'approval')) out.push({ ...base, code: 't14_not_approved', level: toStart <= 7 ? 'bad' : 'warn', days: toStart });
    if (toStart >= 0 && toStart <= 7 && !CLOSED.includes(a.status)) {
      const missing = [];
      if (!a.owner) missing.push('owner');
      if (!a.file_url && isPrice(a)) missing.push('file');
      if (!ck.creatives && a.direction !== 'partners') missing.push('creatives');
      if (!ck.approval && UNAPPROVED.includes(a.status)) missing.push('approval');
      if (!(+a.budget_plan > 0) && !ck.budget) missing.push('budget');
      if (missing.length) out.push({ ...base, code: 't7_not_ready', level: toStart <= 3 ? 'bad' : 'warn', days: toStart, missing });
    }
    if (toStart >= 0 && toStart <= 3 && isPrice(a) && !a.file_url) out.push({ ...base, code: 't3_no_file', level: 'bad', days: toStart });
    if (toStart === 1) out.push({ ...base, code: 't1_tomorrow', level: 'info', days: 1 });
    if (a.end_date < today && dd(a.end_date, today) <= 60 && a.status !== 'cancelled') {
      const missing = [];
      if (!a.result) missing.push('result');
      if (isPrice(a) && a.direction !== 'pr' && a.kpi_fact === null) missing.push('kpi_fact');
      if (+a.budget_plan > 0 && !(+a.cost_fact > 0)) missing.push('cost_fact');
      if (missing.length) out.push({ ...base, code: 'ended_no_results', level: 'warn', missing, days: dd(a.end_date, today) });
    }
    if (!a.owner && toStart > 7 && toStart <= 30) out.push({ ...base, code: 'no_owner', level: 'info', days: toStart });
  }
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((x, y) => rank[x.level] - rank[y.level] || x.start_date.localeCompare(y.start_date));
}

// Конфлікти: цінові акції, що перетинаються в часі; різні знижки на той самий SKU; перевантажені дні
export function conflicts(acts, from, to, maxPerDay = 6) {
  const live = acts.filter((a) => !a.deleted && !['cancelled', 'postponed', 'idea'].includes(a.status) && a.end_date >= from && a.start_date <= to);
  const price = live.filter((a) => isPrice(a) && (a.direction === 'partners' || a.direction === 'ecom'));
  const out = [];
  // кластери цінових акцій, що перетинаються, між різними партнерами
  const seen = new Set();
  for (const a of price) {
    if (seen.has(a.id)) continue;
    const group = price.filter((b) => b.start_date <= a.end_date && b.end_date >= a.start_date);
    const partners = new Set(group.map((g) => g.partner_id || 0));
    if (group.length > 1 && partners.size > 1) {
      group.forEach((g) => seen.add(g.id));
      const s = group.reduce((m, g) => (g.start_date > m ? g.start_date : m), group[0].start_date);
      const e = group.reduce((m, g) => (g.end_date < m ? g.end_date : m), group[0].end_date);
      const discs = group.map((g) => g.discount_pct).filter((x) => x !== null && x !== undefined && x !== '');
      out.push({ code: 'promo_overlap', level: new Set(discs).size > 1 ? 'bad' : 'warn', ids: group.map((g) => g.id),
        items: group.map((g) => ({ id: g.id, title: g.title, discount_pct: g.discount_pct, start_date: g.start_date, end_date: g.end_date })), from: s, to: e });
    }
  }
  // однаковий SKU — різні знижки одночасно
  const skuOf = (a) => { try { const v = JSON.parse(a.skus || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  for (let i = 0; i < price.length; i++) for (let j = i + 1; j < price.length; j++) {
    const a = price[i], b = price[j];
    if (a.partner_id === b.partner_id || a.start_date > b.end_date || b.start_date > a.end_date) continue;
    if (a.discount_pct === null || b.discount_pct === null || +a.discount_pct === +b.discount_pct) continue;
    const common = skuOf(a).filter((x) => skuOf(b).includes(x));
    if (common.length) out.push({ code: 'sku_price_conflict', level: 'bad', ids: [a.id, b.id], skus: common, items: [a, b].map((g) => ({ id: g.id, title: g.title, discount_pct: g.discount_pct })) });
  }
  // перевантажені дні
  let d = from;
  let guard = 0;
  while (d <= to && guard++ < 400) {
    const n = live.filter((a) => a.start_date <= d && a.end_date >= d).length;
    if (n > maxPerDay) out.push({ code: 'busy_day', level: 'info', day: d, n });
    d = addDays(d, 1);
  }
  return out;
}

// ── ICS (RFC 5545): UID = activity id, тому зміна дати оновлює подію, а не дублює ──
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line) => {
  const out = [];
  let s = line;
  while (new TextEncoder().encode(s).length > 73) {
    let n = 60;
    while (new TextEncoder().encode(s.slice(0, n)).length > 73) n--;
    out.push(s.slice(0, n));
    s = ' ' + s.slice(n);
  }
  out.push(s);
  return out.join('\r\n');
};
export function buildIcs(acts, partners, nowIso, baseUrl, labels) {
  const pn = Object.fromEntries((partners || []).map((p) => [p.id, p.name]));
  const st = (x) => (labels && labels[x]) || x;
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Barpi//Marketing Calendar//UK', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Barpi Marketing Calendar', 'X-WR-TIMEZONE:Europe/Kyiv', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const stamp = nowIso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  for (const a of acts) {
    if (a.deleted) continue;
    const partner = a.partner_id ? pn[a.partner_id] : '';
    const summary = (partner && !a.title.includes(partner) ? partner + ' — ' : '') + a.title + (a.status === 'cancelled' ? ' (скасовано)' : '');
    const desc = [a.mechanic && 'Механіка: ' + a.mechanic, a.channel && 'Канал: ' + a.channel, 'Статус: ' + st(a.status),
      a.owner && 'Відповідальний: ' + a.owner, `${baseUrl}#act=${a.id}`].filter(Boolean).join('\n');
    const upd = String(a.updated_at || nowIso).replace(/[-: ]/g, (c) => (c === ' ' ? 'T' : '')).replace(/\.\d+/, '').replace(/Z?$/, 'Z');
    L.push('BEGIN:VEVENT', `UID:barpi-mkt-${a.id}@brand.barpi.ua`, `DTSTAMP:${stamp}`, `LAST-MODIFIED:${upd}`,
      `DTSTART;VALUE=DATE:${a.start_date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(a.end_date, 1).replace(/-/g, '')}`,
      fold('SUMMARY:' + icsEsc(summary)), fold('DESCRIPTION:' + icsEsc(desc)), `URL:${baseUrl}#act=${a.id}`,
      `STATUS:${a.status === 'cancelled' ? 'CANCELLED' : ['idea', 'planned', 'approval'].includes(a.status) ? 'TENTATIVE' : 'CONFIRMED'}`,
      `TRANSP:TRANSPARENT`, `SEQUENCE:${Math.floor(Date.parse(String(a.updated_at || nowIso).replace(' ', 'T') + (String(a.updated_at || '').endsWith('Z') ? '' : 'Z')) / 1000) || 0}`, 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

// ── Текст щоденного дайджесту (Telegram HTML) ───────────────────────────────
const MSG = {
  started_unapproved: 'стартувала без погодження',
  t14_not_approved: (x) => `через ${x.days} дн., ще не погоджено`,
  t7_not_ready: (x) => `через ${x.days} дн., бракує: ${x.missing.map((m) => ({ owner: 'відповідального', file: 'promo-файлу', creatives: 'креативів', approval: 'погодження', budget: 'бюджету' }[m] || m)).join(', ')}`,
  t3_no_file: (x) => `через ${x.days} дн., не завантажено promo-файл`,
  t1_tomorrow: 'завтра старт',
  ended_no_results: (x) => `завершилась ${x.days} дн. тому, не внесено: ${x.missing.map((m) => ({ result: 'результат', kpi_fact: 'факт KPI', cost_fact: 'факт витрат' }[m] || m)).join(', ')}`,
  no_owner: (x) => `через ${x.days} дн., немає відповідального`,
};
export function digestText(att, conf, startingToday, esc, url) {
  const fmt = (d) => d.slice(8, 10) + '.' + d.slice(5, 7);
  const L = ['📅 <b>Маркетинговий календар Barpi</b>'];
  if (startingToday.length) {
    L.push('', '🚀 <b>Сьогодні стартують</b>');
    for (const a of startingToday) L.push(`• ${esc(a.title)} (${fmt(a.start_date)}–${fmt(a.end_date)})`);
  }
  const bad = att.filter((x) => x.level !== 'info' || x.code === 't1_tomorrow');
  if (bad.length) {
    L.push('', '⚠️ <b>Потребує уваги</b>');
    for (const x of bad.slice(0, 15)) {
      const m = MSG[x.code];
      L.push(`${x.level === 'bad' ? '🔴' : x.level === 'warn' ? '🟡' : '🔵'} ${esc(x.title)} — ${esc(typeof m === 'function' ? m(x) : m || x.code)}${x.owner ? ' · ' + esc(x.owner.split('@')[0]) : ''}`);
    }
    if (bad.length > 15) L.push(`… і ще ${bad.length - 15}`);
  }
  const c = conf.filter((x) => x.code !== 'busy_day');
  if (c.length) {
    L.push('', '⚡ <b>Перетини акцій</b>');
    for (const x of c.slice(0, 5)) L.push('• ' + x.items.map((i) => esc(i.title) + (i.discount_pct ? ` −${i.discount_pct}%` : '')).join(' / '));
  }
  if (L.length === 1) return null;
  L.push('', url);
  return L.join('\n');
}
export { daysIncl };
