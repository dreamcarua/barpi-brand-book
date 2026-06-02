/* ============================================================
   barpi-api Worker — REST API for dashboards reading from D1
   Endpoints:
     GET  /v_*                 — read any view (10 views available)
     GET  /tables              — list all tables
     GET  /brand_ideas         — list ideas (?status=new|all)
     POST /brand_ideas         — create idea
     PATCH /brand_ideas/:id    — update (upvote etc.)
     GET  /healthz             — health check
   Auth: protected at edge by Cloudflare Access (when bound to barpi.ua route)
   ============================================================ */

// Views allowed for direct GET
const ALLOWED_VIEWS = new Set([
  'v_sales_by_day',
  'v_sales_by_sku',
  'v_customer_metrics',
  'v_customer_dow',
  'v_customer_timeline',
  'v_pnl_monthly',
  'v_cash_flow',
  'v_production_monthly',
  'v_production_efficiency',
  'v_inventory_extended',
  'v_dashboard_kpis',
]);

// Tables exposed for read (no DML via this endpoint except brand_ideas)
const ALLOWED_TABLES = new Set([
  'moysklad_products',
  'moysklad_counterparties',
  'moysklad_stores',
  'moysklad_organizations',
  'moysklad_expense_items',
  'moysklad_demand',
  'moysklad_payments',
  'moysklad_payments_out',
  'moysklad_supplies',
  'moysklad_customer_orders',
  'moysklad_purchase_orders',
  'moysklad_returns',
  'moysklad_losses',
  'moysklad_moves',
  'moysklad_processing_plans',
  'moysklad_processing_acts',
  'moysklad_stock_by_store',
  'moysklad_contracts',
  'sales_sku',
  'sync_state',
]);

// === CORS ===
function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const isAllowed = allowed.includes(origin) || allowed.includes('*');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key, Cf-Access-Jwt-Assertion',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// Build WHERE clause from URL search params (PostgREST-style: ?col=eq.value)
function buildWhere(params) {
  const wheres = [];
  const args = [];
  for (const [key, raw] of params.entries()) {
    if (['select','order','limit','offset'].includes(key)) continue;
    // Format: col=eq.value, col=gte.value, etc.
    const m = raw.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.+)$/);
    if (m) {
      const [, op, val] = m;
      const sqlOp = {
        eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
        like: 'LIKE', ilike: 'LIKE',
        is: val === 'null' ? 'IS NULL' : '=',
        in: 'IN',
      }[op];
      if (op === 'is' && val === 'null') {
        wheres.push(`${key} IS NULL`);
      } else if (op === 'in') {
        const vals = val.replace(/^\(|\)$/g, '').split(',');
        wheres.push(`${key} IN (${vals.map(() => '?').join(',')})`);
        args.push(...vals);
      } else {
        wheres.push(`${key} ${sqlOp} ?`);
        args.push(val);
      }
    } else {
      // Simple equality
      wheres.push(`${key} = ?`);
      args.push(raw);
    }
  }
  return { sql: wheres.length ? `WHERE ${wheres.join(' AND ')}` : '', args };
}

// === Route: read view or table ===
async function readResource(env, name, url) {
  const select = url.searchParams.get('select') || '*';
  const order = url.searchParams.get('order');
  const limit = parseInt(url.searchParams.get('limit') || '500', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const { sql: whereSql, args } = buildWhere(url.searchParams);

  let orderSql = '';
  if (order) {
    const parts = order.split(',').map(p => {
      const [col, dir = 'asc'] = p.split('.');
      return `${col} ${dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    });
    orderSql = `ORDER BY ${parts.join(', ')}`;
  }

  const sql = `SELECT ${select} FROM ${name} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`;
  const result = await env.DB.prepare(sql).bind(...args, limit, offset).all();
  return result.results || [];
}

// === brand_ideas handlers ===
async function listIdeas(env, url) {
  const status = url.searchParams.get('status');
  let sql = 'SELECT * FROM brand_ideas';
  const args = [];
  if (status && status !== 'all') { sql += ' WHERE status = ?'; args.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const r = await env.DB.prepare(sql).bind(...args).all();
  return r.results || [];
}

async function createIdea(env, body) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO brand_ideas (id, title, body, author_name, author_email, section_id, status, upvotes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'new', 0, datetime('now'), datetime('now'))`
  ).bind(
    id,
    body.title || '',
    body.body || '',
    body.author_name || null,
    body.author_email || null,
    body.section_id || null,
  ).run();
  return { id, ...body, status: 'new', upvotes: 0 };
}

async function updateIdea(env, id, patch) {
  const setParts = [];
  const args = [];
  for (const [k, v] of Object.entries(patch)) {
    if (['upvotes', 'status', 'title', 'body'].includes(k)) {
      setParts.push(`${k} = ?`);
      args.push(v);
    }
  }
  if (!setParts.length) return { error: 'no valid fields' };
  setParts.push(`updated_at = datetime('now')`);
  args.push(id);
  await env.DB.prepare(
    `UPDATE brand_ideas SET ${setParts.join(', ')} WHERE id = ?`
  ).bind(...args).run();
  const r = await env.DB.prepare(`SELECT * FROM brand_ideas WHERE id = ?`).bind(id).first();
  return r || { error: 'not found' };
}

// === Main router ===
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env);

    // CORS preflight
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    try {
      // Healthz
      if (url.pathname === '/healthz') {
        const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM moysklad_demand`).first();
        return json({ status: 'ok', d1: 'barpi-bible', demand_rows: r?.n ?? 0 }, 200, headers);
      }

      // List tables
      if (url.pathname === '/tables' && req.method === 'GET') {
        const r = await env.DB.prepare(
          `SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name`
        ).all();
        return json(r.results || [], 200, headers);
      }

      // brand_ideas — special CRUD
      if (url.pathname === '/brand_ideas' && req.method === 'GET') {
        return json(await listIdeas(env, url), 200, headers);
      }
      if (url.pathname === '/brand_ideas' && req.method === 'POST') {
        const body = await req.json();
        if (!body.title) return json({ error: 'title required' }, 400, headers);
        return json(await createIdea(env, body), 201, headers);
      }
      const ideaMatch = url.pathname.match(/^\/brand_ideas\/([a-f0-9-]+)$/);
      if (ideaMatch && req.method === 'PATCH') {
        const body = await req.json();
        return json(await updateIdea(env, ideaMatch[1], body), 200, headers);
      }

      // Generic view/table read
      const name = url.pathname.replace(/^\//, '');
      if (req.method === 'GET' && (ALLOWED_VIEWS.has(name) || ALLOWED_TABLES.has(name))) {
        return json(await readResource(env, name, url), 200, headers);
      }

      return json({ error: 'not found', path: url.pathname }, 404, headers);
    } catch (e) {
      return json({ error: 'internal', message: e.message || String(e) }, 500, headers);
    }
  },
};
