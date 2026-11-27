// ═══════════════════════════════════════════════════════════════════════════
// barpi-creators · співпраця з блогерами і UGC-авторами Barpi (influencer-director, Вадим 24.11.2026).
// Окремий світ: свій воркер, своя таблиця creators_applications у D1 barpi-bible, свій чат Barpi_Marketing.
// З snEco і Abris Art нічого спільного не використовує.
//   brand.barpi.ua/creators-api/public/apply      POST форми barpi.com.ua/blogeram/ (CORS лише barpi.com.ua)
//   brand.barpi.ua/creators-api/healthz
//   brand.barpi.ua/creators-api/cron/digest        POST з X-Digest-Key (ручний запуск / тест)
//   brand.barpi.ua/dashboard/api/creators/*        дашборд /dashboard/creators/ за Cloudflare Access (JWT перевіряється)
// Крон щогодини о :17: дайджест заявок у статусі «Нова» понад 24 год о 10:17 за Києвом.
// Секрети: TG_TOKEN (@barpi_tech_bot), CREATORS_TG_CHATS (chat_id через кому), DIGEST_KEY.
// Змінна AUTOREPLY=off: лист автору вимкнено, доки Вадим не затвердить тексти.
// ═══════════════════════════════════════════════════════════════════════════
import { accessUser } from './access.js';
import { normalise, score, alertText, digestText, kyivParts, couponsIn, STATUSES, esc } from './logic.js';

const VERSION = '1.1.0'; // 27.11.2026: внутрішній https://internal/notify для інших воркерів Barpi (service binding), тим самим ботом у ті самі чати
const DASH = 'https://brand.barpi.ua/dashboard/creators/';
const ALLOWED_ORIGINS = ['https://barpi.com.ua', 'https://www.barpi.com.ua'];
const EDITABLE = ['status', 'owner', 'offer', 'promo_code', 'fee_uah', 'ship_cost_uah', 'ship_doc', 'ship_ttn', 'content_url', 'notes',
  'name', 'email', 'phone', 'telegram', 'city', 'profile_url', 'platform', 'audience', 'role', 'pets', 'formats', 'sample_url', 'idea'];
const COLS = ['kind', 'created_at', 'updated_at', 'status', 'name', 'email', 'phone', 'telegram', 'city', 'profile_url', 'platform', 'audience',
  'role', 'pets', 'formats', 'sample_url', 'idea', 'age_ok', 'consent', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'referrer',
  'landing', 'score', 'score_why', 'flags', 'history', 'ip_hash'];

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra },
  });
}
function cors(req) {
  const o = req.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(o) ? { 'Access-Control-Allow-Origin': o, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } : {};
}
const listOf = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function tgSend(env, text) {
  const token = env.TG_TOKEN || ''; let sent = 0;
  for (const chat of listOf(env.CREATORS_TG_CHATS)) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      if (r.ok) sent++; else console.error('[creators] telegram HTTP', r.status, (await r.text()).slice(0, 200));
    } catch (e) { console.error('[creators] telegram', e.message); }
  }
  return sent;
}

// ── публічна форма ────────────────────────────────────────────────────────
async function apply(req, env, ctx) {
  const h = cors(req);
  if (!h['Access-Control-Allow-Origin']) return json({ ok: false, error: 'origin' }, 403);
  let body; try { body = await req.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, h); }
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const ipHash = await sha('barpi-creators:' + ip);
  // ліміт: 5 заявок з IP за годину (KV, не D1: D1 платиться за записи)
  if (env.KV) {
    const k = `cr:rl:${ipHash}:${Math.floor(Date.now() / 3600000)}`;
    const n = Number((await env.KV.get(k)) || 0);
    if (n >= 5) return json({ ok: false, error: 'rate_limited' }, 429, h);
    ctx.waitUntil(env.KV.put(k, String(n + 1), { expirationTtl: 3700 }));
  }
  const v = normalise(body);
  if (!v.ok) return json(v, 400, h);
  const row = { ...v.row, ip_hash: ipHash };
  // дубль: той самий профіль за останню добу → не створюємо новий рядок
  const dup = await env.DB.prepare('SELECT id FROM creators_applications WHERE profile_url = ? AND created_at > ? LIMIT 1')
    .bind(row.profile_url, row.created_at - 86400).first();
  if (dup) return json({ ok: true, id: dup.id, duplicate: true }, 200, h);
  const r = await env.DB.prepare(`INSERT INTO creators_applications (${COLS.join(',')}) VALUES (${COLS.map(() => '?').join(',')})`)
    .bind(...COLS.map((c) => row[c] ?? null)).run();
  const id = r.meta.last_row_id;
  ctx.waitUntil(tgSend(env, alertText(row, id, DASH)));
  return json({ ok: true, id }, 200, h);
}

// ── дайджест «чекають понад 24 год» ───────────────────────────────────────
async function digest(env, { force = false, dry = false } = {}) {
  const k = kyivParts();
  if (!force && k.hour !== 10) return { skipped: 'not 10 Kyiv' };
  if (!force && !dry) {
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO creators_digest_sent (day, at) VALUES (?, ?)').bind(k.date, Math.floor(Date.now() / 1000)).run();
    if (ins.meta.changes === 0) return { skipped: 'already sent today' };
  }
  const now = Math.floor(Date.now() / 1000);
  const rows = (await env.DB.prepare("SELECT id, name, score, created_at FROM creators_applications WHERE status = 'new' AND kind = 'application' ORDER BY created_at").all()).results || [];
  const text = digestText(rows, now, DASH);
  if (!text) return { sent: 0, waiting: 0, fresh: rows.length };
  if (dry) return { dry: true, text };
  return { sent: await tgSend(env, text), waiting: rows.filter((r) => now - r.created_at >= 86400).length };
}

// ── API дашборда ──────────────────────────────────────────────────────────
async function dashboard(req, env, path, email) {
  const isAdmin = listOf(env.CREATORS_ADMIN_EMAILS).map((x) => x.toLowerCase()).includes(email);
  const m = req.method;
  if (path === '/dashboard/api/creators/me') return json({ email, isAdmin, statuses: STATUSES });
  if (path === '/dashboard/api/creators/list' && m === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM creators_applications ORDER BY created_at DESC LIMIT 1000').all()).results || [];
    for (const r of rows) delete r.ip_hash;
    return json({ rows, now: Math.floor(Date.now() / 1000) });
  }
  const one = path.match(/^\/dashboard\/api\/creators\/(\d+)$/);
  if (one && m === 'PATCH') {
    const id = Number(one[1]);
    const cur = await env.DB.prepare('SELECT * FROM creators_applications WHERE id = ?').bind(id).first();
    if (!cur) return json({ error: 'not_found' }, 404);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }
    const now = Math.floor(Date.now() / 1000);
    const set = {}; const what = [];
    for (const k of EDITABLE) if (k in b && String(b[k] ?? '') !== String(cur[k] ?? '')) {
      let v = b[k];
      if (k === 'status' && !STATUSES[v]) return json({ error: 'bad_status' }, 400);
      if (['fee_uah', 'ship_cost_uah'].includes(k)) v = v === '' || v == null ? null : Number(v);
      else v = v == null ? null : String(v).slice(0, 2000);
      if (k === 'promo_code' && v) v = v.trim().toLowerCase();
      set[k] = v; what.push(k === 'status' ? `статус: ${STATUSES[cur.status] || cur.status} → ${STATUSES[v]}` : k);
    }
    if (!what.length) return json({ ok: true, unchanged: true });
    if (set.status && cur.status === 'new' && !cur.first_reply_at) set.first_reply_at = now;
    if (set.status === 'shipped' && !cur.shipped_at) set.shipped_at = now;
    if (set.content_url && !cur.content_at) set.content_at = now;
    const merged = { ...cur, ...set };
    const sc = score(merged); set.score = sc.score; set.score_why = sc.why.join(', '); set.flags = sc.flags.join(', ');
    let hist = []; try { hist = JSON.parse(cur.history || '[]'); } catch (e) {}
    hist.push({ at: now, by: email, what: what.join('; ') }); set.history = JSON.stringify(hist.slice(-100)); set.updated_at = now;
    const keys = Object.keys(set);
    await env.DB.prepare(`UPDATE creators_applications SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`).bind(...keys.map((k) => set[k]), id).run();
    return json({ ok: true });
  }
  if (one && m === 'DELETE') {
    if (!isAdmin) return json({ error: 'admin_only' }, 403);
    await env.DB.prepare('DELETE FROM creators_applications WHERE id = ?').bind(Number(one[1])).run();
    return json({ ok: true });
  }
  if (path === '/dashboard/api/creators/manual' && m === 'POST') {   // амбасадор чи автор, якого знайшли самі
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }
    const now = Math.floor(Date.now() / 1000);
    const name = String(b.name || '').trim().slice(0, 120);
    if (!name) return json({ error: 'missing_name' }, 400);
    const row = { kind: b.kind === 'ambassador' ? 'ambassador' : 'application', created_at: now, updated_at: now, status: STATUSES[b.status] ? b.status : 'in_progress',
      name, email: b.email || null, phone: b.phone || null, telegram: b.telegram || null, city: b.city || null, profile_url: b.profile_url || null,
      platform: b.platform || null, audience: b.audience || null, role: b.role || null, pets: b.pets || null, formats: b.formats || null,
      sample_url: b.sample_url || null, idea: b.idea || null, age_ok: 0, consent: 0, utm_source: 'manual', history: JSON.stringify([{ at: now, by: email, what: 'внесено вручну' }]) };
    const sc = score(row); row.score = sc.score; row.score_why = sc.why.join(', '); row.flags = sc.flags.join(', ');
    const r = await env.DB.prepare(`INSERT INTO creators_applications (${COLS.join(',')}) VALUES (${COLS.map(() => '?').join(',')})`).bind(...COLS.map((c) => row[c] ?? null)).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  if (path === '/dashboard/api/creators/codes' && m === 'GET') {
    // продажі за персональними кодами: замовлення сайту в МойСклад (кеш D1), купон в описі чекауту Horoshop
    const codes = (await env.DB.prepare("SELECT id, name, promo_code FROM creators_applications WHERE promo_code IS NOT NULL AND promo_code != ''").all()).results || [];
    const out = {}; for (const c of codes) out[c.promo_code] = { id: c.id, name: c.name, orders: 0, sum_uah: 0, paid_uah: 0, last: null };
    let fresh = null;
    if (codes.length) {
      const q = await env.DB.prepare("SELECT moment, sum_uah, json_extract(raw_json,'$.payedSum') AS paid, json_extract(raw_json,'$.description') AS d FROM moysklad_customer_orders WHERE json_extract(raw_json,'$.description') LIKE '%купоном%'").all();
      for (const o of q.results || []) for (const code of couponsIn(o.d)) if (out[code]) {
        out[code].orders++; out[code].sum_uah += Number(o.sum_uah || 0); out[code].paid_uah += Number(o.paid || 0) / 100;
        if (!out[code].last || o.moment > out[code].last) out[code].last = o.moment;
      }
    }
    const f = await env.DB.prepare('SELECT MAX(moment) AS m FROM moysklad_customer_orders').first(); fresh = f && f.m;
    return json({ codes: out, orders_synced_until: fresh });
  }
  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url); const path = url.pathname;
    try {
      // Лише через service binding: публічні маршрути воркера (brand.barpi.ua/creators-api/*, /dashboard/api/creators/*) цей хост і шлях не покривають.
      // Текст уже підготовлений і екранований відправником (Telegram HTML). Токен бота лишається тільки тут.
      if (url.hostname === 'internal' && path === '/notify' && req.method === 'POST') {
        let b; try { b = await req.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400); }
        const text = String((b && b.text) || '').slice(0, 3900);
        if (!text) return json({ ok: false, error: 'empty' }, 400);
        return json({ ok: true, sent: await tgSend(env, text), chats: listOf(env.CREATORS_TG_CHATS).length });
      }
      if (path === '/creators-api/healthz') return json({ ok: true, service: 'barpi-creators', version: VERSION });
      if (path === '/creators-api/public/apply') {
        if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
        if (req.method === 'POST') return await apply(req, env, ctx);
        return json({ error: 'method' }, 405);
      }
      if (path === '/creators-api/cron/digest' && req.method === 'POST') {
        if (!env.DIGEST_KEY || req.headers.get('X-Digest-Key') !== env.DIGEST_KEY) return json({ error: 'forbidden' }, 403);
        let b = {}; try { b = await req.json(); } catch (e) {}
        if (b.say) return json({ sent: b.dry ? 0 : await tgSend(env, String(b.say)), dry: !!b.dry });
        return json(await digest(env, { force: true, dry: !!b.dry }));
      }
      if (path.startsWith('/dashboard/api/creators/')) {
        const email = await accessUser(req, env);
        if (!email) return json({ error: 'unauthorized' }, 401);
        const allow = listOf(env.CREATORS_EMAILS).map((x) => x.toLowerCase());
        if (allow.length && !allow.includes(email)) return json({ error: 'forbidden' }, 403);
        return await dashboard(req, env, path, email);
      }
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      const rid = (crypto.randomUUID?.() || String(Date.now())).slice(0, 8);
      console.error(`[barpi-creators:${rid}]`, e.message, e.stack?.slice(0, 400));
      return json({ error: 'internal', request_id: rid }, 500);
    }
  },
  async scheduled(ev, env, ctx) {
    ctx.waitUntil(digest(env).then((r) => console.log('[creators-digest]', JSON.stringify(r))).catch((e) => console.error('[creators-digest]', e.message)));
  },
};
export { esc };
