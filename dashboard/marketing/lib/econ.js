// barpi-mkt · економіка промо. Чисті функції без D1: один файл для воркера (імпорт), сторінки (браузер) і тестів (Node).
// Собівартість: КАНОН v4 (barpi-memory/docs/canon-v4-final.md) — 620 грн/кг × вага нетто + пакування.
// МойСклад не має придатної собівартості готової пачки (sales_sku.cost_per_unit порожній, v_sku_cost рахує лише матеріали акту).

export const DAY = 86400000;
const toDate = (s) => new Date(s + 'T00:00:00Z');
export const ymd = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => ymd(new Date(toDate(s).getTime() + n * DAY));
export const daysIncl = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY) + 1;
export const minDate = (a, b) => (a < b ? a : b);
export const maxDate = (a, b) => (a > b ? a : b);
export function kyivToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function kyivHour(now = new Date()) {
  return +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hour: '2-digit', hourCycle: 'h23' }).format(now);
}
export const num = (st, k, def) => (st && st[k] !== undefined && st[k] !== '' && Number.isFinite(+st[k]) ? +st[k] : def);
const r2 = (x) => Math.round(x * 100) / 100;
const median = (a) => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// ── Тип і вага пачки ───────────────────────────────────────────────────────
export function skuKind(p) {
  const name = String(p.name || ''), path = String(p.path || '');
  if (/зразок/i.test(name) || !/^Готова продукція/.test(path)) return 'other';
  if (/Апетайзер/i.test(path) || /^Апетайзер/i.test(name)) return 'jar';
  if (/20\/15/.test(path)) return 'small';
  if (/50.60.70/.test(path)) return 'large';
  return 'other';
}
export const isFinished = (p) => skuKind(p) !== 'other';

// Вага нетто на дату: з 14.09.2026 великі пачки 100 → 70 г, зефір великий 60 → 50 г, крекер 60 г без змін.
export function netWeightG(p, date, st) {
  const kind = skuKind(p);
  const name = String(p.name || '');
  if (kind === 'jar') return num(st, 'appetizer_g', 80);
  if (kind === 'small') {
    const m = name.match(/(\d{2})\s*г/);
    return m ? +m[1] : 20;
  }
  if (kind === 'large') {
    const after = String(date || '9999') >= String((st && st.spec_change_date) || '2026-09-14');
    if (/крекер/i.test(name)) return 60;
    if (/зефір/i.test(name)) return after ? 50 : 60;
    return after ? 70 : 100;
  }
  return 0;
}
export function unitCost(p, date, st) {
  const kind = skuKind(p);
  if (kind === 'other') return 0;
  const pack = kind === 'jar' ? num(st, 'pack_jar', 22.65) : kind === 'small' ? num(st, 'pack_small', 6.5) : num(st, 'pack_large', 10.5);
  return r2(num(st, 'cost_per_kg', 620) * netWeightG(p, date, st) / 1000 + pack);
}

// ── ABC за виручкою ─────────────────────────────────────────────────────────
export function abcClasses(items, st) {
  const a = num(st, 'abc_a', 80) / 100, b = num(st, 'abc_b', 95) / 100;
  const tot = items.reduce((s, x) => s + Math.max(0, x.revenue || 0), 0) || 1;
  let cum = 0;
  const out = {};
  [...items].sort((x, y) => (y.revenue || 0) - (x.revenue || 0)).forEach((x) => {
    const before = cum;
    cum += Math.max(0, x.revenue || 0) / tot;
    out[x.pid] = before < a ? 'A' : before < b ? 'B' : 'C';
  });
  return out;
}

// ── Агрегація денних рядків продажів ─────────────────────────────────────────
// rows: [{d:'YYYY-MM-DD', pid, q, net}] — net = виручка без ПДВ. inDay: Set днів або [from, to].
export function aggregate(rows, from, to, daySet) {
  const by = {};
  let q = 0, net = 0;
  const ship = new Set();
  for (const r of rows) {
    if (daySet ? !daySet.has(r.d) : (r.d < from || r.d > to)) continue;
    const x = by[r.pid] || (by[r.pid] = { q: 0, net: 0 });
    x.q += +r.q || 0; x.net += +r.net || 0;
    q += +r.q || 0; net += +r.net || 0;
    ship.add(r.d);
  }
  return { by, q, net, shipDays: ship.size };
}

// Чистий baseline: N днів перед вікном, але без днів інших цінових акцій цього партнера
// (інакше акція порівнюється з акцією). Шукає назад до maxBack днів.
export function cleanDays(endDay, n, exclude = [], maxBack = 182) {
  const out = new Set();
  let d = endDay, back = 0;
  while (out.size < n && back < maxBack) {
    if (!exclude.some((x) => d >= x.start && d <= x.end)) out.add(d);
    d = addDays(d, -1); back++;
  }
  return out;
}

// ── Post-analysis акції за відвантаженнями (sell-in) ────────────────────────
// Вікно ефекту = [старт − preload; кінець]: мережа закуповує ДО старту акції.
// Baseline = baseline_days днів перед вікном. Провал після = post_days днів після кінця.
// plannedDisc — наша знижка в ціні відвантаження за планом (0..1); compPct — компенсація партнеру поза накладною (0..1),
// рахується від виручки sell-in у вікні як наближення до sell-out; mixed — у партнера кілька контрагентів з різними прайсами.
export function analysePromo({ rows, prods, start, end, today, st, promoCost = 0, exclude = [], plannedDisc = 0, compPct = 0, mixed = false, priceType = true }) {
  const preload = num(st, 'preload_days', 7), postN = num(st, 'post_days', 28), bN = num(st, 'baseline_days', 56);
  const winFrom = addDays(start, -preload);
  const winTo = minDate(end, today);
  const baseTo = addDays(winFrom, -1);
  // інші акції партнера (з їхнім preload і post-вікном) у baseline не беремо
  const ex = exclude.map((x) => ({ start: addDays(x.start, -preload), end: addDays(x.end, Math.min(14, postN)) }));
  const bDays = cleanDays(baseTo, bN, ex);
  const baseFrom = [...bDays].sort()[0] || baseTo;
  const bLen = bDays.size || 1;
  const postFrom = addDays(end, 1), postEnd = addDays(end, postN);
  // наступна акція партнера обрізає вікно «провалу після», щоб не плутати провал з новим піком
  const nextStart = exclude.filter((x) => x.start > end).map((x) => addDays(x.start, -preload - 1)).sort()[0];
  const postTo = minDate(minDate(postEnd, today), nextStart || postEnd);
  const started = winFrom <= today;
  const winDays = started ? daysIncl(winFrom, winTo) : 0;
  const postDays = postFrom <= today && postFrom <= postTo ? daysIncl(postFrom, postTo) : 0;
  const refPrice = {};
  {
    const acc = {};
    const lastDays = [...bDays].sort().reverse();
    const byDay = {};
    rows.forEach((r) => { if (bDays.has(r.d)) (byDay[r.d] || (byDay[r.d] = [])).push(r); });
    for (const d of lastDays) for (const r of byDay[d] || []) {
      const x = acc[r.pid] || (acc[r.pid] = { q: 0, net: 0, days: 0 });
      if (x.q >= 3 && x.days >= 1) continue;
      x.q += +r.q || 0; x.net += +r.net || 0; x.days++;
    }
    for (const [k, x] of Object.entries(acc)) if (x.q > 0) refPrice[k] = x.net / x.q;
  }
  const B = aggregate(rows, null, null, bDays), W = aggregate(rows, winFrom, winTo), P = aggregate(rows, postFrom, postTo);
  const mid = (a, b) => addDays(a, Math.floor(daysIncl(a, b) / 2));
  const skus = [];
  let baseGp = 0, winGp = 0, postGp = 0, discInv = 0, discW = 0, discQ = 0;
  const pids = new Set([...Object.keys(B.by), ...Object.keys(W.by), ...Object.keys(P.by)]);
  for (const pid of pids) {
    const p = prods[pid];
    if (!p || !isFinished(p)) continue;
    const b = B.by[pid] || { q: 0, net: 0 }, w = W.by[pid] || { q: 0, net: 0 }, po = P.by[pid] || { q: 0, net: 0 };
    const cB = unitCost(p, mid(baseFrom, baseTo), st), cW = unitCost(p, mid(winFrom, end), st), cP = unitCost(p, postFrom, st);
    // опорна ціна — останні відвантаження перед вікном (ціни змінювались протягом року), а не середнє за весь baseline
    const rp = refPrice[pid];
    const bp = rp || (b.q > 0 ? b.net / b.q : null), wp = w.q > 0 ? w.net / w.q : null;
    const g = { b: b.net - b.q * cB, w: w.net - w.q * cW, p: po.net - po.q * cP };
    baseGp += g.b; winGp += g.w; postGp += g.p;
    let disc = null;
    if (bp && wp && b.q >= 3) {
      disc = 1 - wp / bp;
      discW += disc * w.q; discQ += w.q;
      if (disc > 0) discInv += (bp - wp) * w.q;
    }
    const expW = winDays ? (b.q / bLen) * winDays : 0;
    skus.push({
      pid, sku: p.sku, name: p.name, base_q: b.q, win_q: w.q, post_q: po.q,
      base_price: bp && r2(bp), win_price: wp && r2(wp), cost: cW,
      uplift: expW > 0 ? w.q / expW - 1 : null, realized_disc: disc,
      win_gp: r2(g.w),
    });
  }
  skus.sort((a, b) => b.win_q - a.win_q);
  // Два baseline. «Чистий» (дні без інших акцій) — верхня межа ефекту. «Run-rate» — середній темп за 90 днів
  // до вікна разом з іншими акціями — нижня межа. Якщо партнер ≥40 % часу під акціями, «чисті» дні — це провали
  // між акціями, і висновок робимо за консервативним run-rate.
  const look = 120;
  let busyDays = 0;
  for (let i = 1; i <= look; i++) { const d = addDays(winFrom, -i); if (ex.some((x) => d >= x.start && d <= x.end)) busyDays++; }
  const heavy = busyDays / look >= 0.4;
  const rrFrom = addDays(winFrom, -90);
  const RR = aggregate(rows, rrFrom, baseTo);
  let rrGp = 0;
  for (const [pid, x] of Object.entries(RR.by)) { const p = prods[pid]; if (p && isFinished(p)) rrGp += x.net - x.q * unitCost(p, mid(rrFrom, baseTo), st); }
  const finQ = (A) => Object.entries(A.by).reduce((sum, [pid, x]) => sum + (prods[pid] && isFinished(prods[pid]) ? x.q : 0), 0);
  const rr = { q: finQ(RR) / 90, gp: rrGp / 90 };
  const clean = { q: B.q / bLen, net: B.net / bLen, gp: baseGp / bLen };
  const useRR = heavy && rr.q > 0;
  const rateQ = useRR ? rr.q : clean.q, rateNet = useRR ? (RR.net / 90) : clean.net, rateGp = useRR ? rr.gp : clean.gp;
  const expWinQ = rateQ * winDays, expPostQ = rateQ * postDays;
  const upliftUnits = expWinQ > 0 ? W.q / expWinQ - 1 : null;
  const upliftClean = clean.q * winDays > 0 ? W.q / (clean.q * winDays) - 1 : null;
  const upliftRR = rr.q * winDays > 0 ? W.q / (rr.q * winDays) - 1 : null;
  const upliftRev = rateNet * winDays > 0 ? W.net / (rateNet * winDays) - 1 : null;
  const incQwin = W.q - expWinQ;
  const dipQ = postDays ? Math.max(0, expPostQ - P.q) : 0;
  const pullForward = incQwin > 0 && postDays ? Math.min(1, dipQ / incQwin) : null;
  const incGpWin = winGp - rateGp * winDays;
  const incGpNet = winGp + postGp - rateGp * (winDays + postDays);
  const postComplete = postEnd <= today || (nextStart && nextStart <= today);
  const cost = +promoCost || 0;
  const flags = [];
  const specCross = baseFrom < (st.spec_change_date || '2026-09-14') && end >= (st.spec_change_date || '2026-09-14');
  const realizedDisc = discQ > 0 ? discW / discQ : null;
  // фактична знижка з накладних надійна лише без зміни специфікації і без змішаних прайсів
  const invoiceOk = realizedDisc !== null && !specCross && !mixed;
  // знижка є в специфікації, але не видна в накладних МойСклад → її оформили окремо (коригування/компенсація): рахуємо як витрату
  const notSeen = (+plannedDisc || 0) > 0 && invoiceOk && (realizedDisc === null || realizedDisc < (+plannedDisc) * 0.4);
  const compCost = Math.max(0, +compPct || 0) * W.net + (notSeen ? (+plannedDisc) * W.net : 0);
  const contribution = B.q > 0 || useRR ? (postDays ? incGpNet : incGpWin) - cost - compCost : null;
  const fundDisc = invoiceOk && realizedDisc >= 0.02 ? realizedDisc : ((+plannedDisc || 0) + (+compPct || 0)) || null;
  // знижка в накладних, яку не видно напряму (зміна специфікації, змішані прайси): інвестиція = план × виручка за повною ціною
  const plannedInv = !invoiceOk && !notSeen && (+plannedDisc || 0) > 0 && plannedDisc < 1 ? (plannedDisc / (1 - plannedDisc)) * W.net : 0;
  const invest = Math.max(0, invoiceOk ? discInv : 0) + plannedInv + cost + compCost;
  const roi = invest > 0 && contribution !== null ? contribution / invest : null;
  if (B.shipDays < 4 || bDays.size < bN * 0.6) flags.push('thin_baseline');
  if (bDays.size < daysIncl(baseFrom, baseTo)) flags.push('baseline_cleaned');
  if (specCross) flags.push('spec_change');
  if (mixed) flags.push('mixed_prices');
  if (heavy) flags.push('promo_heavy');
  if (useRR) flags.push('runrate_baseline');
  if (compCost > 0) flags.push('comp_estimated');
  if (notSeen) flags.push('invoice_disc_not_seen');
  if (B.q <= 0 && !useRR) flags.push('no_baseline');
  const costUnknown = priceType && !(invoiceOk && realizedDisc >= 0.02) && !(+compPct > 0) && !(+plannedDisc > 0) && cost <= 0;
  if (costUnknown) flags.push('cost_unknown');
  if (!postComplete && end < today) flags.push('post_incomplete');
  if (end >= today) flags.push('running');
  if (nextStart && nextStart < postEnd) flags.push('post_cut_by_next');
  let verdict = null;
  if (started && end < today && contribution !== null) {
    // невідома вартість або зміна специфікації 14.09 у вікні (інша вага і ціна пачки) — порівняння некоректне
    if (costUnknown || specCross) verdict = 'unknown';
    else verdict = contribution > 0 ? 'success' : upliftUnits !== null && upliftUnits > 0.1 ? 'partial' : 'fail';
  }
  return {
    windows: { baseFrom, baseTo, winFrom, winTo, postFrom, postTo: postDays ? postTo : null, postComplete },
    base: { q: B.q, net: r2(B.net), gp: r2(baseGp), days: bDays.size, shipDays: B.shipDays, rateQ: r2(rateQ), rateNet: r2(rateNet), rateGp: r2(rateGp), kind: useRR ? 'runrate' : 'clean' },
    win: { q: W.q, net: r2(W.net), gp: r2(winGp), days: winDays, expQ: r2(expWinQ) },
    post: { q: P.q, net: r2(P.net), gp: r2(postGp), days: postDays, expQ: r2(expPostQ) },
    upliftUnits, upliftRev, pullForward, realizedDisc, upliftClean, upliftRR, promoShareBefore: busyDays / look,
    incGpWin: r2(incGpWin), incGpNet: r2(incGpNet), promoCost: cost, compCost: r2(compCost), contribution: contribution === null ? null : r2(contribution),
    discountInvestment: r2(Math.max(0, invoiceOk ? discInv : 0) + plannedInv + compCost), roi, verdict, flags, skus, fundDisc, invoiceOk,
    response: upliftUnits !== null && fundDisc && fundDisc >= 0.03 && !costUnknown ? upliftUnits / fundDisc : null,
  };
}

// ── Підказки на наступну акцію партнера ───────────────────────────────────────
// hist: post-analysis минулих цінових акцій партнера; cur: {rateQ, price, gpu} за останні baseline_days.
export function recommendNext(hist, cur, st) {
  const unknown = hist.filter((h) => h && (h.flags || []).includes('cost_unknown')).length;
  const ok = hist.filter((h) => h && h.verdict && h.verdict !== 'unknown' && !h.flags.includes('thin_baseline'));
  const k = median(ok.map((h) => h.response).filter((x) => x !== null && x > -5 && x < 30));
  const pf = median(ok.map((h) => h.pullForward).filter((x) => x !== null));
  const out = { k, pullForward: pf, n: ok.length, tips: [], best: null, grid: [] };
  if (cur && cur.rateQ > 0 && cur.price > 0) {
    const kk = k !== null ? k : 1.5;   // без історії — обережне припущення: −10% ціни → +15% пачок
    const days = 14;
    for (const d of [0.05, 0.07, 0.1, 0.12, 0.15, 0.2, 0.25]) {
      const lift = Math.max(0, kk * d * (1 - (pf || 0)));
      const units = cur.rateQ * days * (1 + lift);
      const inc = units * (cur.gpu - cur.price * d) - cur.rateQ * days * cur.gpu;
      const need = cur.gpu - cur.price * d > 0 ? cur.gpu / (cur.gpu - cur.price * d) - 1 : null;
      out.grid.push({ d, lift, inc: r2(inc), need });
    }
    const best = out.grid.reduce((a, b) => (b.inc > a.inc ? b : a), out.grid[0]);
    out.best = best && best.inc > 0 ? best : null;
    out.assumedK = k === null;
  }
  const last = ok[ok.length - 1];
  if (unknown) out.tips.push({ code: 'enter_costs', level: 'warn', n: unknown });
  if (!ok.length) out.tips.push({ code: 'no_history', level: 'info' });
  if (out.best) out.tips.push({ code: 'best_depth', level: 'good', d: out.best.d, inc: out.best.inc });
  else if (cur && cur.rateQ > 0) out.tips.push({ code: 'no_price_promo', level: 'warn', assumed: k === null });
  if (pf !== null && pf >= 0.5) out.tips.push({ code: 'pull_forward', level: 'warn', pf });
  if (last && last.verdict === 'partial') out.tips.push({ code: 'volume_not_profit', level: 'warn' });
  const ld = last ? last.fundDisc : null;
  if (last && ld && last.upliftUnits !== null && ld > 0.03) {
    const need = cur && cur.gpu > 0 && cur.gpu - cur.price * ld > 0 ? cur.gpu / (cur.gpu - cur.price * ld) - 1 : null;
    if (need !== null && last.upliftUnits < need) out.tips.push({ code: 'below_breakeven', level: 'bad', need, got: last.upliftUnits, d: ld });
  }
  if (last) {
    const losers = (last.skus || []).filter((s) => s.uplift !== null && s.uplift < 0 && s.base_q >= 5).slice(0, 3).map((s) => s.name);
    const winners = (last.skus || []).filter((s) => s.uplift !== null && s.uplift > 0.3 && s.win_gp > 0).slice(0, 3).map((s) => s.name);
    if (losers.length) out.tips.push({ code: 'drop_skus', level: 'warn', skus: losers });
    if (winners.length) out.tips.push({ code: 'hero_skus', level: 'good', skus: winners });
  }
  return out;
}

// Частка днів під акцією за останні N днів — сигнал «знижка стала нормою»
export function promoShare(acts, today, days = 90) {
  const from = addDays(today, -(days - 1));
  const set = new Set();
  for (const a of acts) {
    let d = maxDate(a.start_date, from);
    const to = minDate(a.end_date, today);
    while (d <= to) { set.add(d); d = addDays(d, 1); }
  }
  return set.size / days;
}

// ── Калькулятор: break-even для портфеля SKU ───────────────────────────────────
// lines: [{u, p, c, sd, stock}] — u: baseline-пачок за тривалість промо, p: ціна без ПДВ, c: собівартість, sd: знижка постачальника (0..1)
export function breakEven(lines, costs = 0) {
  let U = 0, R = 0, Bc = 0, Pu = 0, Pr = 0;
  for (const l of lines) {
    const pp = l.p * (1 - (l.sd || 0));
    U += l.u; R += l.u * l.p; Bc += l.u * (l.p - l.c); Pu += l.u * (pp - l.c); Pr += l.u * pp;
  }
  if (U <= 0) return { ok: false, reason: 'no_baseline' };
  if (Pu <= 0) return { ok: false, reason: 'negative_margin', baseContribution: Bc, promoGpAtBase: Pu };
  const f = (Bc + costs) / Pu;   // 1 + g*
  return {
    ok: true, baseUnits: U, baseRevenue: R, baseContribution: Bc, promoGpAtBase: Pu,
    growth: f - 1, beUnits: U * f, beRevenue: Pr * f, revenueGrowth: R > 0 ? (Pr * f) / R - 1 : null,
  };
}
export function scenario(lines, g, costs = 0) {
  let units = 0, rev = 0, cogs = 0, disc = 0, bGp = 0, bRev = 0;
  for (const l of lines) {
    const pp = l.p * (1 - (l.sd || 0)), q = l.u * (1 + g);
    units += q; rev += q * pp; cogs += q * l.c; disc += q * (l.p - pp); bGp += l.u * (l.p - l.c); bRev += l.u * l.p;
  }
  const gp = rev - cogs, contribution = gp - costs;
  return {
    g, units, revenue: rev, cogs, gp, margin: rev > 0 ? gp / rev : null, costs, contribution,
    incRevenue: rev - bRev, incProfit: contribution - bGp, discountInvestment: disc,
    roi: disc + costs > 0 ? (contribution - bGp) / (disc + costs) : null,
  };
}
