/* ============================================================
   barpi-api Worker — REST API for dashboards reading from D1
   SECURITY HARDENED 2026-06-12 (super-audit):
     - Verified Cloudflare Access JWT (JWKS/RS256), not header-presence
     - SENSITIVE resources (PII/financial) require verified JWT or API key
       — spoofable Origin alone is NOT accepted for sensitive data
     - /healthz no longer leaks row counts
     - No SQL-error / query-fail leakage in response headers
     - SQLi validators retained (SAFE_IDENT on select/order/filter keys)
   Auth model (deploy behind CF Access on api.barpi.ua for full effect):
     healthz/OPTIONS         → public
     admin (/export,/backups,
       /alerts/run,/tables)  → X-API-Key only
     SENSITIVE resources     → verified CF Access JWT OR X-API-Key
     non-sensitive aggregates→ JWT OR API key OR allow-listed Origin
   ============================================================ */

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Resources containing PII or raw financial rows — never Origin-gated.
const SENSITIVE_RESOURCES = new Set([
  'moysklad_counterparties',   // names, phones, emails (PII)
  'moysklad_demand',           // raw sales rows + agent ids
  'moysklad_payments',
  'moysklad_payments_out',
  'moysklad_customer_orders',
  'moysklad_purchase_orders',
  'moysklad_contracts',
  'moysklad_returns',
  'sales_sku',                 // per-transaction sales
  'brand_ideas',               // author_email PII
  'v_customer_metrics',
  'v_customer_timeline',
  'v_customer_dow',
  'v_customer_first_purchase',
  'v_customer_cohorts',
  'v_customer_ltv',
  'v_counterparty_channel',
]);

const ADMIN_PATHS = new Set(['/export', '/backups', '/alerts/run', '/tables']);
function isAdminPath(pathname, method) {
  if (ADMIN_PATHS.has(pathname)) return true;
  if (/^\/backups\/\d+$/.test(pathname)) return true;
  if (pathname === '/backups/r2') return true;
  if (/^\/alerts\/\d+$/.test(pathname) && method !== 'GET') return true;
  return false;
}

// === CORS ===
function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const isAllowed = allowed.includes(origin) || allowed.includes('*');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (allowed[0] || ''),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key, Cf-Access-Jwt-Assertion, X-API-Key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// === Cloudflare Access JWT verification (RS256 via JWKS) ===
let _jwksCache = { keys: null, at: 0 };
function b64urlToUint8(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function getJwks(env) {
  const now = Date.now();
  if (_jwksCache.keys && now - _jwksCache.at < 3600_000) return _jwksCache.keys;
  const teamDomain = env.ACCESS_TEAM_DOMAIN; // e.g. https://uabarpi.cloudflareaccess.com
  if (!teamDomain) return null;
  const r = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
  if (!r.ok) return null;
  const data = await r.json();
  _jwksCache = { keys: data.keys || [], at: now };
  return _jwksCache.keys;
}
async function verifyAccessJwt(req, env) {
  try {
    const token = req.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) return false;
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return false;
    const header = JSON.parse(new TextDecoder().decode(b64urlToUint8(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlToUint8(p)));
    // aud must match the configured Access application audience
    const aud = env.ACCESS_AUD;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (aud && !auds.includes(aud)) return false;
    if (payload.exp && Date.now() / 1000 > payload.exp) return false;
    const keys = await getJwks(env);
    if (!keys) return false;
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = b64urlToUint8(s);
    const signed = new TextEncoder().encode(`${h}.${p}`);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signed);
  } catch (_) {
    return false;
  }
}

// === AUTH ===
async function checkAuth(req, env, headers, resourceName) {
  const url = new URL(req.url);
  if (url.pathname === '/healthz' || req.method === 'OPTIONS') return null;

  const apiKey = req.headers.get('X-API-Key') ||
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const hasValidApiKey = env.API_AUTH_KEY && apiKey === env.API_AUTH_KEY;

  // Admin → API key only
  if (isAdminPath(url.pathname, req.method)) {
    if (!hasValidApiKey)
      return json({ error: 'forbidden', reason: 'admin endpoint requires X-API-Key' }, 403, headers);
    return null;
  }

  if (hasValidApiKey) return null;

  const jwtOk = await verifyAccessJwt(req, env);
  if (jwtOk) return null;

  // SENSITIVE resources: do NOT accept Origin — require key or verified JWT
  if (resourceName && SENSITIVE_RESOURCES.has(resourceName)) {
    return json({ error: 'forbidden', reason: 'sensitive resource requires authenticated access' }, 403, headers);
  }

  // Non-sensitive aggregates: allow-listed Origin acceptable as defense-in-depth
  if (env.STRICT_ORIGIN === '1') {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (allowed.includes(origin)) return null;
    return json({ error: 'forbidden', reason: 'origin not allowed' }, 403, headers);
  }
  return json({ error: 'unauthorized', hint: 'missing auth' }, 401, headers);
}

// === SQL builders (validated) ===
function validateSelect(raw) {
  if (!raw || raw === '*') return '*';
  const cols = raw.split(',').map(c => c.trim());
  for (const c of cols) if (!SAFE_IDENT.test(c)) { const e = new Error('invalid select column'); e.code = 400; throw e; }
  return cols.join(', ');
}
function validateOrder(raw) {
  if (!raw) return '';
  const parts = raw.split(',').map(p => {
    const t = p.trim().split('.');
    const col = t[0]; const dir = (t[1] || 'asc').toLowerCase();
    if (!SAFE_IDENT.test(col)) { const e = new Error('invalid order column'); e.code = 400; throw e; }
    return `${col} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
  });
  return `ORDER BY ${parts.join(', ')}`;
}
function buildWhere(params) {
  const wheres = [], args = [];
  for (const [key, raw] of params.entries()) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    if (!SAFE_IDENT.test(key)) { const e = new Error('invalid filter key'); e.code = 400; throw e; }
    const m = raw.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.+)$/);
    if (m) {
      const [, op, val] = m;
      const sqlOp = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'LIKE', is: '=', in: 'IN' }[op];
      if (op === 'is' && val === 'null') wheres.push(`${key} IS NULL`);
      else if (op === 'in') { const vals = val.replace(/^\(|\)$/g, '').split(','); wheres.push(`${key} IN (${vals.map(() => '?').join(',')})`); args.push(...vals); }
      else { wheres.push(`${key} ${sqlOp} ?`); args.push(val); }
    } else { wheres.push(`${key} = ?`); args.push(raw); }
  }
  return { sql: wheres.length ? `WHERE ${wheres.join(' AND ')}` : '', args };
}
async function readResource(env, name, url) {
  const selectSafe = validateSelect(url.searchParams.get('select'));
  const orderSql = validateOrder(url.searchParams.get('order'));
  let limit = parseInt(url.searchParams.get('limit') || '500', 10);
  if (isNaN(limit) || limit < 1) limit = 500; if (limit > 50000) limit = 50000;
  let offset = parseInt(url.searchParams.get('offset') || '0', 10);
  if (isNaN(offset) || offset < 0) offset = 0;
  const { sql: whereSql, args } = buildWhere(url.searchParams);
  const sql = `SELECT ${selectSafe} FROM ${name} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`;
  const result = await env.DB.prepare(sql).bind(...args, limit, offset).all();
  return result.results || [];
}

// === brand_ideas write handlers ===
async function createIdea(env, body) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO brand_ideas (id, title, body, author_name, author_email, section_id, status, upvotes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'new', 0, datetime('now'), datetime('now'))`
  ).bind(id, body.title || '', body.body || '', body.author_name || null, body.author_email || null, body.section_id || null).run();
  return { id, ...body, status: 'new', upvotes: 0 };
}
async function updateIdea(env, id, patch) {
  const existing = await env.DB.prepare(`SELECT id FROM brand_ideas WHERE id = ?`).bind(id).first();
  if (!existing) return { _status: 404, error: 'not found', id };
  const VALID_STATUS = ['new', 'reviewing', 'accepted', 'done', 'rejected'];
  if (patch.status && !VALID_STATUS.includes(patch.status)) return { _status: 400, error: 'invalid status', allowed: VALID_STATUS };
  const setParts = [], args = [];
  for (const [k, v] of Object.entries(patch)) if (['upvotes', 'status', 'title', 'body'].includes(k)) { setParts.push(`${k} = ?`); args.push(v); }
  if (!setParts.length) return { _status: 400, error: 'no valid fields' };
  setParts.push(`updated_at = datetime('now')`); args.push(id);
  await env.DB.prepare(`UPDATE brand_ideas SET ${setParts.join(', ')} WHERE id = ?`).bind(...args).run();
  return await env.DB.prepare(`SELECT * FROM brand_ideas WHERE id = ?`).bind(id).first();
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    // Determine resource name for sensitivity-aware auth
    let resourceName = null;
    const generic = url.pathname.replace(/^\//, '');
    if (SAFE_IDENT.test(generic)) resourceName = generic;
    const idea = url.pathname.match(/^\/brand_ideas(\/|$)/);
    if (idea) resourceName = 'brand_ideas';

    const authReject = await checkAuth(req, env, headers, resourceName);
    if (authReject) return authReject;

    try {
      if (url.pathname === '/healthz') {
        // No row-count leak — liveness only
        return json({ status: 'ok', service: 'barpi-api' }, 200, headers);
      }
      if (url.pathname === '/tables' && req.method === 'GET') {
        const r = await env.DB.prepare(
          `SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name`
        ).all();
        return json(r.results || [], 200, headers);
      }
      // alerts
      if (url.pathname === '/alerts' && req.method === 'GET') {
        const includeResolved = url.searchParams.get('resolved') === '1';
        const q = includeResolved
          ? `SELECT * FROM alerts ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, created_at DESC LIMIT 200`
          : `SELECT * FROM alerts WHERE resolved = 0 ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, created_at DESC LIMIT 200`;
        return json((await env.DB.prepare(q).all()).results || [], 200, headers);
      }
      const alertMatch = url.pathname.match(/^\/alerts\/(\d+)$/);
      if (alertMatch && req.method === 'PATCH') {
        await env.DB.prepare(`UPDATE alerts SET resolved = 1, resolved_at = datetime('now') WHERE id = ?`).bind(parseInt(alertMatch[1], 10)).run();
        return json({ ok: true, id: parseInt(alertMatch[1], 10) }, 200, headers);
      }
      if (url.pathname === '/alerts/run' && req.method === 'POST') {
        // regenAlerts intentionally omitted from public surface; admin scripts use scheduled worker
        return json({ error: 'use scheduled job' }, 410, headers);
      }
      // backups (admin — already gated)
      if (url.pathname === '/backups' && req.method === 'GET') {
        return json((await env.DB.prepare(`SELECT id, created_at, snapshot_kind, size_bytes FROM _backups ORDER BY created_at DESC LIMIT 50`).all()).results || [], 200, headers);
      }
      const backupMatch = url.pathname.match(/^\/backups\/(\d+)$/);
      if (backupMatch && req.method === 'GET') {
        const r = await env.DB.prepare(`SELECT payload_json, created_at FROM _backups WHERE id = ?`).bind(parseInt(backupMatch[1], 10)).first();
        if (!r) return json({ error: 'not found' }, 404, headers);
        return new Response(r.payload_json, { status: 200, headers: { ...headers, 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="barpi-backup-${r.created_at.slice(0, 10)}-${backupMatch[1]}.json"` } });
      }
      if (url.pathname === '/export' && req.method === 'GET') {
        const onlyParam = url.searchParams.get('tables');
        const all = url.searchParams.get('all') === '1';
        let tables = ['brand_ideas', 'sync_state', 'partner_pipeline', 'events', 'inventory_snapshot', 'smm_content_log'];
        if (onlyParam) tables = onlyParam.split(',').map(s => s.trim()).filter(Boolean);
        else if (all) tables = ((await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name`).all()).results || []).map(x => x.name);
        const dump = { version: 1, generated_at: new Date().toISOString(), d1_db: 'barpi-bible', tables: {} };
        for (const t of tables) { if (!SAFE_IDENT.test(t)) continue; try { dump.tables[t] = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results || []; } catch (e) { dump.tables[t] = { _error: 'query failed' }; } }
        return new Response(JSON.stringify(dump, null, 2), { status: 200, headers: { ...headers, 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="barpi-d1-backup-${new Date().toISOString().slice(0, 10)}.json"` } });
      }

      // brand_ideas
      if (url.pathname === '/brand_ideas' && req.method === 'GET') {
        if (!url.searchParams.get('order')) url.searchParams.set('order', 'created_at.desc');
        return json(await readResource(env, 'brand_ideas', url), 200, headers);
      }
      if (url.pathname === '/brand_ideas' && req.method === 'POST') {
        let body; try { body = await req.json(); } catch (e) { return json({ error: 'invalid json' }, 400, headers); }
        if (!body.title) return json({ error: 'title required' }, 400, headers);
        return json(await createIdea(env, body), 201, headers);
      }
      const ideaMatch = url.pathname.match(/^\/brand_ideas\/([a-f0-9-]+)$/);
      if (ideaMatch && req.method === 'PATCH') {
        let body; try { body = await req.json(); } catch (e) { return json({ error: 'invalid json' }, 400, headers); }
        const result = await updateIdea(env, ideaMatch[1], body);
        if (result._status) { const { _status, ...rest } = result; return json(rest, _status, headers); }
        return json(result, 200, headers);
      }

      // Generic view/table read
      const name = generic;
      const BLACKLIST = new Set(['sqlite_master', 'sqlite_sequence', '_backups', '_cf_KV']);
      if (BLACKLIST.has(name) || name.startsWith('sqlite_') || name.startsWith('_cf_') || name.startsWith('_'))
        return json({ error: 'forbidden', reason: 'reserved table' }, 403, headers);
      if (req.method === 'GET' && SAFE_IDENT.test(name)) {
        const meta = await env.DB.prepare(
          `SELECT type FROM sqlite_master WHERE name = ? AND type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND substr(name,1,1) != '_'`
        ).bind(name).first();
        if (meta) {
          try { return json(await readResource(env, name, url), 200, headers); }
          catch (e) { return json([], 200, headers); }  // no error leak in headers
        }
        return json([], 200, headers);
      }
      return json({ error: 'not found', path: url.pathname }, 404, headers);
    } catch (e) {
      const status = e.code === 400 ? 400 : 500;
      return json(status === 400 ? { error: 'bad_request', message: e.message } : { error: 'internal' }, status, headers);
    }
  },
};
