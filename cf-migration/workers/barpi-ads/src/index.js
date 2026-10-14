// barpi-ads: data plane of ad-director for Barpi (owner decision 13.10.2026).
//   POST /t/order                 public beacon from barpi.com.ua thank-you page -> ad_orders
//   GET  /t/watch                 public watchdog verdict (no business data); cron */30 sends alerts itself
//   /dashboard/api/ads/*          promo calendar, journal and orders for brand.barpi.ua/dashboard/promo/
//                                 (behind Cloudflare Access; the worker also verifies the Access JWT)
// D1: barpi-bible, tables ad_journal, ad_events, ad_orders (migrations/0001_ad_director.sql).

const SHOP_ORIGINS = ['https://barpi.com.ua', 'https://www.barpi.com.ua'];
const PROJECT = 'barpi';
const H = 3600 * 1000;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const s = (v, max = 300) => (v === undefined || v === null || v === '' ? null : String(v).slice(0, max));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p === '/t/order') return await order(req, env);
      if (p === '/t/watch' && req.method === 'GET') return json(await watch(env));
      if (p.startsWith('/dashboard/api/ads/')) {
        const who = await accessUser(req, env);
        if (!who) return json({ error: 'access required' }, 401);
        return await dashboardApi(req, env, p.slice('/dashboard/api/ads/'.length), url, who);
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'internal', detail: String(e && e.message || e).slice(0, 200) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cronTick(env));
  },
};

// ---------- order beacon ----------
async function order(req, env) {
  const origin = req.headers.get('Origin') || '';
  const cors = SHOP_ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Vary': 'Origin' }
    : {};
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405, cors);
  if (!SHOP_ORIGINS.includes(origin)) return json({ error: 'origin' }, 403);
  const text = await req.text();
  if (text.length > 20000) return json({ error: 'too large' }, 413, cors);
  let b;
  try { b = JSON.parse(text); } catch { return json({ error: 'json' }, 400, cors); }
  const no = s(b.order_no, 40);
  if (!no || !/^[0-9A-Za-z_-]{1,40}$/.test(no)) return json({ error: 'order_no' }, 400, cors);
  const value = Number(b.value);
  const val = Number.isFinite(value) && value >= 0 && value < 1e6 ? value : null;
  const u = b.utm || {};
  await env.DB.prepare(
    `INSERT OR IGNORE INTO ad_orders (order_no, placed_at, value, currency, items, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, touch_at, landing_url, referrer, first_touch, ua, raw, day_kyiv)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    no, nowIso(), val, s(b.currency, 8) || 'UAH', s(JSON.stringify(b.items || null), 4000),
    s(u.utm_source), s(u.utm_medium), s(u.utm_campaign), s(u.utm_content, 500), s(u.utm_term),
    s(b.fbclid, 500), s(b.touch_at, 40), s(b.landing_url, 1000), s(b.referrer, 1000),
    s(JSON.stringify(b.first_touch || null), 2000), s(req.headers.get('User-Agent'), 300), s(text, 8000),
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date())
  ).run();
  return new Response(null, { status: 204, headers: cors });
}

// ---------- watchdog (system/ADDING_A_PROJECT.md -> Watching the system) ----------
// Two independent schedulers (owner decision 14.10.2026, "зроби надійно"):
//  1. This worker's own Cron Trigger (every 30 min) evaluates the checks and sends the Telegram
//     alert itself. State in D1 ad_watch_state: an alert goes out when the set of problems changes,
//     again every 6 h while it lasts, and once more when everything is back to normal.
//  2. The memory-kit Action only checks that (1) is alive (heartbeat fresh, Telegram configured).
// A check starts only after its first run row exists.
const CHECKS = [
  { key: 'express-check', limit_h: 4 },      // express every 3 h + 1 h
  { key: 'daily-diagnostic', limit_h: 26 },
  { key: 'event-stop', limit_h: 26 },
];
const MIRROR_LIMIT_H = 30;                   // mirror Meta -> D1 runs daily at 06:35 Kyiv
const REPEAT_H = 6;
const HEARTBEAT_LIMIT_MIN = 75;              // cron every 30 min; deadman alerts after 75 min

async function getState(env, k) {
  const r = await env.DB.prepare('SELECT v, at FROM ad_watch_state WHERE k=?').bind(k).first();
  return r || null;
}
async function setState(env, k, v) {
  await env.DB.prepare(
    'INSERT INTO ad_watch_state (k, v, at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, at=excluded.at'
  ).bind(k, v, nowIso()).run();
}

async function evaluate(env) {
  const now = Date.now();
  const problems = [];   // { key, text } — key is stable while the problem lasts
  const checks = {};
  const rows = await env.DB.prepare(
    `SELECT CASE WHEN reason LIKE 'express-check%' THEN 'express-check'
                 WHEN reason LIKE 'daily-diagnostic%' THEN 'daily-diagnostic'
                 WHEN reason LIKE 'event-stop%' THEN 'event-stop' ELSE 'other' END AS k, MAX(at) AS last
       FROM ad_journal WHERE project=? AND action='note' AND status='done' GROUP BY k`
  ).bind(PROJECT).all();
  const last = Object.fromEntries((rows.results || []).map(r => [r.k, r.last]));
  for (const c of CHECKS) {
    if (!last[c.key]) { checks[c.key] = { state: 'not started' }; continue; }
    const age_h = (now - Date.parse(last[c.key])) / H;
    const late = age_h > c.limit_h;
    checks[c.key] = { last: last[c.key], age_h: +age_h.toFixed(2), limit_h: c.limit_h, late };
    if (late) problems.push({ key: `late:${c.key}`, text: `${c.key}: останній прогін ${age_h.toFixed(1)} год тому (межа ${c.limit_h} год)` });
  }
  const mir = await env.DB.prepare('SELECT MAX(updated_at) AS last FROM ad_daily').first();
  if (mir && mir.last) {
    const age_h = (now - Date.parse(mir.last)) / H;
    checks['mirror'] = { last: mir.last, age_h: +age_h.toFixed(2), limit_h: MIRROR_LIMIT_H, late: age_h > MIRROR_LIMIT_H };
    if (age_h > MIRROR_LIMIT_H) problems.push({ key: 'late:mirror', text: `mirror Meta → D1: дані ${age_h.toFixed(1)} год тому (межа ${MIRROR_LIMIT_H} год)` });
  } else checks['mirror'] = { state: 'not started' };
  const stuck = await env.DB.prepare(
    `SELECT id, action, entity_id, at FROM ad_journal WHERE project=? AND status='approved' AND at < ? ORDER BY at LIMIT 20`
  ).bind(PROJECT, new Date(now - H).toISOString().replace(/\.\d{3}Z$/, 'Z')).all();
  const st = stuck.results || [];
  checks['unfinished-writes'] = { count: st.length };
  for (const r of st) problems.push({ key: `stuck:${r.id}`, text: `журнал, рядок ${r.id} (${r.action} ${r.entity_id || ''}): approved з ${r.at}, не закрито` });
  return { problems, checks };
}

// Public verdict for the deadman Action and for people. No business data.
async function watch(env) {
  const { problems, checks } = await evaluate(env);
  const hb = await getState(env, 'cron_heartbeat');
  const hb_age_min = hb ? (Date.now() - Date.parse(hb.at)) / 60000 : null;
  const cron = {
    last: hb ? hb.at : null,
    age_min: hb_age_min === null ? null : +hb_age_min.toFixed(1),
    limit_min: HEARTBEAT_LIMIT_MIN,
    alive: hb_age_min !== null && hb_age_min <= HEARTBEAT_LIMIT_MIN,
    telegram: hb ? hb.v : 'unknown',
  };
  return {
    project: PROJECT, at: nowIso(), ok: problems.length === 0,
    problems: problems.map(p => p.text),
    alerts: [],          // alerts are sent by the worker cron itself since 14.10.2026
    cron, checks,
  };
}

async function tg(env, text) {
  if (!env.TG_TOKEN || !env.TG_CHAT) return false;
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TG_CHAT, text, disable_web_page_preview: true }),
  });
  if (!r.ok) return false;
  const j = await r.json().catch(() => ({}));
  return !!j.ok;
}

async function cronTick(env) {
  const tgState = env.TG_TOKEN && env.TG_CHAT ? 'configured' : 'missing';
  const { problems } = await evaluate(env);
  const keys = problems.map(p => p.key).sort().join('|');
  const prev = await getState(env, 'alert');
  const prevKeys = prev ? prev.v : '';
  const sinceH = prev ? (Date.now() - Date.parse(prev.at)) / H : Infinity;
  let send = null;
  if (keys && (keys !== prevKeys || sinceH >= REPEAT_H)) {
    send = `⚠️ Barpi реклама, сторож:\n• ${problems.map(p => p.text).join('\n• ')}\nhttps://brand.barpi.ua/t/watch`;
  } else if (!keys && prevKeys) {
    send = '✅ Barpi реклама, сторож: усе знову в нормі.';
  }
  let sent = null;
  if (send) {
    sent = await tg(env, send);
    if (sent) await setState(env, 'alert', keys);   // not sent: retried on the next tick
  }
  await setState(env, 'cron_heartbeat', sent === false ? 'send-failed' : tgState);
}

// ---------- Cloudflare Access: verify the JWT the edge adds after the Access check ----------
let jwksCache = { at: 0, keys: [] };
const b64u = (x) => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((x.length + 3) % 4)), c => c.charCodeAt(0));
async function accessUser(req, env) {
  const tok = req.headers.get('Cf-Access-Jwt-Assertion');
  if (!tok) return null;
  const [h, p, sig] = tok.split('.');
  if (!h || !p || !sig) return null;
  const head = JSON.parse(new TextDecoder().decode(b64u(h)));
  const pay = JSON.parse(new TextDecoder().decode(b64u(p)));
  const team = env.ACCESS_TEAM_DOMAIN;
  if (pay.iss !== team) return null;
  if (!pay.exp || pay.exp * 1000 < Date.now()) return null;
  if (env.ACCESS_AUD && !(Array.isArray(pay.aud) ? pay.aud : [pay.aud]).includes(env.ACCESS_AUD)) return null;
  if (Date.now() - jwksCache.at > 3600 * 1000 || !jwksCache.keys.find(k => k.kid === head.kid)) {
    const r = await fetch(`${team}/cdn-cgi/access/certs`);
    jwksCache = { at: Date.now(), keys: (await r.json()).keys || [] };
  }
  const jwk = jwksCache.keys.find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(`${h}.${p}`));
  return ok ? (pay.email || pay.sub || 'access-user') : null;
}

// ---------- dashboard API ----------
const isIsoZ = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(v) && !isNaN(Date.parse(v));
const EVENT_FIELDS = ['title', 'mechanic', 'promo_code', 'landing_url', 'client_text', 'starts_at', 'ends_at', 'note', 'status'];
function slug(t) {
  const map = { а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ж:'zh',з:'z',и:'y',і:'i',ї:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'iu',я:'ia' };
  return String(t).toLowerCase().split('').map(c => map[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'promo';
}
function checkEvent(e, partial) {
  for (const f of ['title', 'starts_at', 'ends_at']) if (!partial && !e[f]) return `${f} required`;
  if (e.starts_at !== undefined && !isIsoZ(e.starts_at)) return 'starts_at must be UTC ISO';
  if (e.ends_at !== undefined && !isIsoZ(e.ends_at)) return 'ends_at must be UTC ISO';
  if (e.status !== undefined && !['planned', 'live', 'cancelled'].includes(e.status)) return 'status';
  if (e.landing_url && !/^https:\/\/(www\.)?barpi\.com\.ua\//.test(e.landing_url)) return 'landing_url must be on barpi.com.ua';
  if (e.title && String(e.title).length > 120) return 'title too long';
  return null;
}

async function dashboardApi(req, env, sub, url, who) {
  const m = req.method;
  if (sub === 'me' && m === 'GET') return json({ user: who });
  if (sub === 'events' && m === 'GET') {
    const from = url.searchParams.get('from') || new Date(Date.now() - 60 * 24 * H).toISOString();
    const r = await env.DB.prepare(`SELECT * FROM ad_events WHERE project=? AND ends_at >= ? ORDER BY starts_at DESC LIMIT 200`).bind(PROJECT, from).all();
    return json({ events: r.results || [] });
  }
  if (sub === 'events' && m === 'POST') {
    const e = await req.json();
    const err = checkEvent(e, false);
    if (err) return json({ error: err }, 400);
    if (Date.parse(e.ends_at) <= Date.parse(e.starts_at)) return json({ error: 'ends_at must be after starts_at' }, 400);
    const id = `promo-${e.starts_at.slice(0, 10)}-${slug(e.promo_code || e.title)}`;
    const r = await env.DB.prepare(
      `INSERT INTO ad_events (id, project, kind, title, mechanic, promo_code, landing_url, client_text, starts_at, ends_at, status, note, updated_by)
       VALUES (?,?,'promo',?,?,?,?,?,?,?,'planned',?,?) ON CONFLICT(id) DO NOTHING`
    ).bind(id, PROJECT, s(e.title, 120), s(e.mechanic, 500), s(e.promo_code, 40), s(e.landing_url, 500), s(e.client_text, 1000),
      e.starts_at, e.ends_at, s(e.note, 1000), who).run();
    if (!r.meta.changes) return json({ error: 'an event with this id already exists', id }, 409);
    return json({ ok: true, id }, 201);
  }
  const em = sub.match(/^events\/([a-z0-9-]{3,80})$/);
  if (em && m === 'PATCH') {
    const e = await req.json();
    const err = checkEvent(e, true);
    if (err) return json({ error: err }, 400);
    const cur = await env.DB.prepare(`SELECT * FROM ad_events WHERE id=? AND project=?`).bind(em[1], PROJECT).first();
    if (!cur) return json({ error: 'not found' }, 404);
    const next = { ...cur };
    for (const f of EVENT_FIELDS) if (e[f] !== undefined) next[f] = e[f] === '' ? null : e[f];
    if (!next.title || !next.starts_at || !next.ends_at) return json({ error: 'title, starts_at, ends_at cannot be empty' }, 400);
    if (Date.parse(next.ends_at) <= Date.parse(next.starts_at)) return json({ error: 'ends_at must be after starts_at' }, 400);
    await env.DB.prepare(
      `UPDATE ad_events SET title=?, mechanic=?, promo_code=?, landing_url=?, client_text=?, starts_at=?, ends_at=?, note=?, status=?,
         updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'), updated_by=? WHERE id=? AND project=?`
    ).bind(s(next.title, 120), s(next.mechanic, 500), s(next.promo_code, 40), s(next.landing_url, 500), s(next.client_text, 1000),
      next.starts_at, next.ends_at, s(next.note, 1000), next.status, who, em[1], PROJECT).run();
    return json({ ok: true, id: em[1] });
  }
  if (sub === 'journal' && m === 'GET') {
    const lim = Math.min(200, Math.max(1, +url.searchParams.get('limit') || 50));
    const r = await env.DB.prepare(`SELECT id, at, action, status, entity_type, entity_id, entity_name, reason, hypothesis, review_at, outcome FROM ad_journal WHERE project=? ORDER BY id DESC LIMIT ?`).bind(PROJECT, lim).all();
    return json({ rows: r.results || [] });
  }
  if (sub === 'orders' && m === 'GET') {
    const days = Math.min(120, Math.max(1, +url.searchParams.get('days') || 30));
    const from = new Date(Date.now() - days * 24 * H).toISOString();
    const r = await env.DB.prepare(`SELECT order_no, placed_at, value, utm_source, utm_medium, utm_campaign, utm_content, paid_status FROM ad_orders WHERE placed_at >= ? ORDER BY placed_at DESC LIMIT 500`).bind(from).all();
    return json({ orders: r.results || [] });
  }
  if (sub === 'watch' && m === 'GET') return json(await watch(env));
  return json({ error: 'not found' }, 404);
}
