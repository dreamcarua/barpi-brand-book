/* ============================================================
   barpi-api Worker — REST API for dashboards reading from D1
   v2026-08-21: + kb_files (R2 attachments) + kb_question_state (чек-лист поля)
   v2026-08-19: + kb_questions/kb_answers (База знань — /dashboard/knowledge/)
   Base = code deployed in production (scheduled backups, alerts, R2),
   synced back to repo to resolve P1-2 "live worker drift".
   NOTE: the 12.06.2026 hardened-auth variant (verified JWT / SENSITIVE gate)
   was never deployed; it is preserved in git history (commit 1ce1786).
   Endpoints:
     GET  /v_*                 — read any view
     GET  /<table>             — generic read (PostgREST-style filters)
     GET  /brand_ideas         — list ideas (?status=new|all)
     POST /brand_ideas         — create idea
     PATCH /brand_ideas/:id    — update (upvote etc.)
     GET  /kb_questions        — knowledge base questions (generic read)
     GET  /kb_answers          — knowledge base answers (generic read)
     POST /kb_answers          — create answer (word_count server-side)
     PATCH /kb_answers/:id     — edit answer (author or admin)
     DELETE /kb_answers/:id    — soft-delete answer (author or admin)
     POST /kb_files            — upload attachment (multipart, R2 barpi-kb-files)
     GET  /kb_files/:id/download — stream attachment (Content-Disposition: attachment)
     DELETE /kb_files/:id      — soft-delete attachment (author or admin; R2 object kept)
     PUT  /kb_state/:qid       — upsert Є/немає · Де зберігається · Відповідальний
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
    'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key, Cf-Access-Jwt-Assertion, X-API-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// Authentication: require either CF Access JWT (when behind CF Access)
// or a valid X-API-Key matching the API_AUTH_KEY secret.
// Returns null if authorized, or a Response if rejected.
// Admin paths require API_AUTH_KEY — Origin alone NOT sufficient
const ADMIN_PATHS = new Set(['/export', '/backups', '/alerts/run', '/tables']);
function isAdminPath(pathname, method) {
  if (ADMIN_PATHS.has(pathname)) return true;
  if (/^\/backups\/\d+$/.test(pathname)) return true;  // download specific backup
  if (pathname === '/backups/r2') return true;
  if (/^\/alerts\/\d+$/.test(pathname) && method !== 'GET') return true;  // modify alerts
  return false;
}

function checkAuth(req, env, headers) {
  const url = new URL(req.url);
  if (url.pathname === '/healthz') return null;
  if (req.method === 'OPTIONS') return null;

  const apiKey = req.headers.get('X-API-Key') || req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const hasValidApiKey = env.API_AUTH_KEY && apiKey === env.API_AUTH_KEY;
  const hasJwt = !!req.headers.get('Cf-Access-Jwt-Assertion');

  // HARDENED: Admin paths require API key (not just Origin/JWT)
  if (isAdminPath(url.pathname, req.method)) {
    if (!hasValidApiKey) {
      return new Response(JSON.stringify({ error: 'forbidden', reason: 'admin endpoint requires X-API-Key' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...headers }
      });
    }
    return null;  // admin authorized
  }

  // Read paths: API key OR CF JWT OR matching Origin
  if (hasValidApiKey) return null;
  if (hasJwt) return null;

  if (env.STRICT_ORIGIN === '1') {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (!allowed.includes(origin)) {
      return new Response(JSON.stringify({ error: 'forbidden', reason: 'origin not allowed', origin }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...headers }
      });
    }
    return null;
  }

  return new Response(JSON.stringify({ error: 'unauthorized', hint: 'missing auth' }), {
    status: 401, headers: { 'Content-Type': 'application/json', ...headers }
  });
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
    // HARDENED: validate filter key is safe identifier (rejects "col) OR 1=1--")
    if (!SAFE_IDENT.test(key)) {
      const e = new Error('invalid filter key: ' + key.slice(0, 30));
      e.code = 400;
      throw e;
    }
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

// === Validators (SECURITY hardening 2026-06-10) ===
const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function validateSelect(raw) {
  if (!raw || raw === '*') return '*';
  // Allow comma-separated identifiers only — no parens, semicolons, SELECT, UNION, etc.
  const cols = raw.split(',').map(c => c.trim());
  for (const c of cols) {
    if (!SAFE_IDENT.test(c)) {
      const e = new Error('invalid select column: ' + c.slice(0, 30));
      e.code = 400;
      throw e;
    }
  }
  return cols.join(', ');
}
function validateOrder(raw) {
  if (!raw) return '';
  const parts = raw.split(',').map(p => {
    const tokens = p.trim().split('.');
    const col = tokens[0];
    const dir = (tokens[1] || 'asc').toLowerCase();
    if (!SAFE_IDENT.test(col)) {
      const e = new Error('invalid order column: ' + col.slice(0, 30));
      e.code = 400;
      throw e;
    }
    const dirSql = dir === 'desc' ? 'DESC' : 'ASC';
    return `${col} ${dirSql}`;
  });
  return `ORDER BY ${parts.join(', ')}`;
}
function validateColumnKey(key) {
  // For filter keys: same rule — must be safe identifier
  if (!SAFE_IDENT.test(key)) {
    const e = new Error('invalid column name: ' + key.slice(0, 30));
    e.code = 400;
    throw e;
  }
  return key;
}

// === Route: read view or table ===
async function readResource(env, name, url) {
  // HARDENED: validate select + order before SQL build
  const selectSafe = validateSelect(url.searchParams.get('select'));
  const orderSql = validateOrder(url.searchParams.get('order'));
  let limit = parseInt(url.searchParams.get('limit') || '500', 10);
  if (isNaN(limit) || limit < 1) limit = 500;
  if (limit > 50000) limit = 50000;
  let offset = parseInt(url.searchParams.get('offset') || '0', 10);
  if (isNaN(offset) || offset < 0) offset = 0;

  const { sql: whereSql, args } = buildWhere(url.searchParams);

  const sql = `SELECT ${selectSafe} FROM ${name} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`;
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
  // Check exists first
  const existing = await env.DB.prepare(`SELECT id FROM brand_ideas WHERE id = ?`).bind(id).first();
  if (!existing) return { _status: 404, error: 'not found', id };

  // Validate status against CHECK constraint
  const VALID_STATUS = ['new','reviewing','accepted','done','rejected'];
  if (patch.status && !VALID_STATUS.includes(patch.status)) {
    return { _status: 400, error: 'invalid status', allowed: VALID_STATUS };
  }

  const setParts = [];
  const args = [];
  for (const [k, v] of Object.entries(patch)) {
    if (['upvotes', 'status', 'title', 'body'].includes(k)) {
      setParts.push(`${k} = ?`);
      args.push(v);
    }
  }
  if (!setParts.length) return { _status: 400, error: 'no valid fields' };
  setParts.push(`updated_at = datetime('now')`);
  args.push(id);
  await env.DB.prepare(
    `UPDATE brand_ideas SET ${setParts.join(', ')} WHERE id = ?`
  ).bind(...args).run();
  const r = await env.DB.prepare(`SELECT * FROM brand_ideas WHERE id = ?`).bind(id).first();
  return r;
}

// === kb_answers handlers (База знань — /dashboard/knowledge/) ===
// Answers are visible to the whole team; edit/delete = author or admin.
// Permission model matches the project's soft-security posture (UI is behind
// CF Access; API trusts the client-supplied editor_email same as brand_ideas).
const KB_ADMIN_EMAIL = 'vg@abrisart.com';
const KB_AUTHOR_EMAILS = new Set([
  'vg@abrisart.com',
  'office@barpi.com.ua',
  'fg@abrisart.com',
  'aksonov@barpi.com.ua',
  'vg@sneco.ua',
  'ai@barpi.ua',            // Claude AI prefill author
]);
const KB_MAX_ANSWER_CHARS = 40000;

function kbCountWords(text) {
  const m = String(text || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’ʼ`-]*/gu);
  return m ? m.length : 0;
}

async function kbCreateAnswer(env, body) {
  const qid = parseInt(body.question_id, 10);
  if (isNaN(qid) || qid < 1) return { _status: 400, error: 'question_id required' };
  const email = String(body.author_email || '').trim().toLowerCase();
  if (!KB_AUTHOR_EMAILS.has(email)) return { _status: 403, error: 'author_email not allowed' };
  const text = String(body.answer_text || '').trim();
  if (!text) return { _status: 400, error: 'answer_text required' };
  if (text.length > KB_MAX_ANSWER_CHARS) return { _status: 400, error: 'answer too long' };
  const q = await env.DB.prepare(`SELECT id FROM kb_questions WHERE id = ?`).bind(qid).first();
  if (!q) return { _status: 404, error: 'question not found' };
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO kb_answers (id, question_id, author_email, author_name, answer_text, word_count, deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
  ).bind(id, qid, email, body.author_name ? String(body.author_name).slice(0, 100) : null, text, kbCountWords(text)).run();
  return await env.DB.prepare(`SELECT * FROM kb_answers WHERE id = ?`).bind(id).first();
}

async function kbUpdateAnswer(env, id, body) {
  const row = await env.DB.prepare(`SELECT * FROM kb_answers WHERE id = ? AND deleted = 0`).bind(id).first();
  if (!row) return { _status: 404, error: 'not found' };
  const editor = String(body.editor_email || '').trim().toLowerCase();
  if (editor !== row.author_email && editor !== KB_ADMIN_EMAIL) {
    return { _status: 403, error: 'only author or admin can edit' };
  }
  const text = String(body.answer_text || '').trim();
  if (!text) return { _status: 400, error: 'answer_text required' };
  if (text.length > KB_MAX_ANSWER_CHARS) return { _status: 400, error: 'answer too long' };
  await env.DB.prepare(
    `UPDATE kb_answers SET answer_text = ?, word_count = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(text, kbCountWords(text), id).run();
  return await env.DB.prepare(`SELECT * FROM kb_answers WHERE id = ?`).bind(id).first();
}

// --- kb_files: attachments per question (R2 bucket barpi-kb-files) ---
const KB_MAX_FILE_BYTES = 20 * 1024 * 1024;      // 20 MB per file
const KB_UPLOADS_PER_HOUR = 60;                   // cheap abuse guard
const KB_ALLOWED_EXT = new Set([
  'pdf', 'doc', 'docx', 'rtf', 'odt', 'txt', 'md',
  'xls', 'xlsx', 'ods', 'csv',
  'ppt', 'pptx', 'odp', 'key',
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'tif', 'tiff',
  'zip', 'json', 'xml', 'eml', 'msg', 'mp4', 'mov', 'ai', 'psd', 'indd',
]);

function kbSafeName(raw) {
  // strip any path prefix, control chars and quotes (Content-Disposition safe)
  let n = String(raw || 'file').split(/[\\/]/).pop();
  n = n.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  if (!n || n === '.' || n === '..') n = 'file';
  return n.slice(0, 180);
}

function kbExtOf(name) {
  const m = String(name).match(/\.([A-Za-z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : '';
}

async function kbUploadFile(env, req) {
  if (!env.KBFILES) return { _status: 500, error: 'file storage not configured' };
  let form;
  try { form = await req.formData(); }
  catch (e) { return { _status: 400, error: 'expected multipart/form-data' }; }

  const file = form.get('file');
  if (!file || typeof file === 'string' || typeof file.stream !== 'function') {
    return { _status: 400, error: 'file field required' };
  }
  const qid = parseInt(form.get('question_id'), 10);
  if (isNaN(qid) || qid < 1) return { _status: 400, error: 'question_id required' };
  const email = String(form.get('author_email') || '').trim().toLowerCase();
  if (!KB_AUTHOR_EMAILS.has(email)) return { _status: 403, error: 'author_email not allowed' };

  const q = await env.DB.prepare(`SELECT id FROM kb_questions WHERE id = ?`).bind(qid).first();
  if (!q) return { _status: 404, error: 'question not found' };

  const filename = kbSafeName(file.name);
  const ext = kbExtOf(filename);
  if (!ext || !KB_ALLOWED_EXT.has(ext)) {
    return { _status: 415, error: 'file type not allowed', ext: ext || null };
  }
  const size = Number(file.size || 0);
  if (size <= 0) return { _status: 400, error: 'empty file' };
  if (size > KB_MAX_FILE_BYTES) return { _status: 413, error: 'file too large', max_bytes: KB_MAX_FILE_BYTES };

  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM kb_files WHERE created_at > datetime('now','-1 hour')`
  ).first();
  if ((recent?.n || 0) >= KB_UPLOADS_PER_HOUR) return { _status: 429, error: 'too many uploads, try later' };

  const id = crypto.randomUUID();
  const key = `kb/q${qid}/${id}.${ext}`;
  const contentType = file.type || 'application/octet-stream';
  await env.KBFILES.put(key, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: { question_id: String(qid), author: email, filename },
  });
  await env.DB.prepare(
    `INSERT INTO kb_files (id, question_id, author_email, author_name, filename, content_type, size_bytes, r2_key, deleted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
  ).bind(id, qid, email, form.get('author_name') ? String(form.get('author_name')).slice(0, 100) : null,
    filename, contentType, size, key).run();
  return await env.DB.prepare(`SELECT * FROM kb_files WHERE id = ?`).bind(id).first();
}

async function kbDeleteFile(env, id, editorRaw) {
  const row = await env.DB.prepare(`SELECT * FROM kb_files WHERE id = ? AND deleted = 0`).bind(id).first();
  if (!row) return { _status: 404, error: 'not found' };
  const editor = String(editorRaw || '').trim().toLowerCase();
  if (editor !== row.author_email && editor !== KB_ADMIN_EMAIL) {
    return { _status: 403, error: 'only author or admin can delete' };
  }
  // Soft-delete the row; the R2 object is kept so an admin can restore it.
  await env.DB.prepare(`UPDATE kb_files SET deleted = 1 WHERE id = ?`).bind(id).run();
  return { ok: true, id };
}

// --- kb_question_state: чек-лист поля «Є/немає · Де зберігається · Відповідальний» ---
const KB_VALID_STATUS = ['todo', 'in_progress', 'done', 'na'];
async function kbSaveState(env, qid, body) {
  const id = parseInt(qid, 10);
  if (isNaN(id) || id < 1) return { _status: 400, error: 'bad question_id' };
  const editor = String(body.editor_email || '').trim().toLowerCase();
  if (!KB_AUTHOR_EMAILS.has(editor)) return { _status: 403, error: 'editor_email not allowed' };
  const q = await env.DB.prepare(`SELECT id FROM kb_questions WHERE id = ?`).bind(id).first();
  if (!q) return { _status: 404, error: 'question not found' };

  const status = body.status === undefined || body.status === null ? 'todo' : String(body.status);
  if (!KB_VALID_STATUS.includes(status)) return { _status: 400, error: 'invalid status', allowed: KB_VALID_STATUS };
  const storage = body.storage_ref === undefined || body.storage_ref === null ? null : String(body.storage_ref).slice(0, 500);
  const ownerRaw = String(body.owner_email || '').trim().toLowerCase();
  if (ownerRaw && !KB_AUTHOR_EMAILS.has(ownerRaw)) return { _status: 400, error: 'owner_email not allowed' };

  await env.DB.prepare(
    `INSERT INTO kb_question_state (question_id, status, storage_ref, owner_email, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(question_id) DO UPDATE SET
       status = excluded.status, storage_ref = excluded.storage_ref,
       owner_email = excluded.owner_email, updated_by = excluded.updated_by,
       updated_at = datetime('now')`
  ).bind(id, status, storage, ownerRaw || null, editor).run();
  return await env.DB.prepare(`SELECT * FROM kb_question_state WHERE question_id = ?`).bind(id).first();
}

async function kbDeleteAnswer(env, id, editorRaw) {
  const row = await env.DB.prepare(`SELECT * FROM kb_answers WHERE id = ? AND deleted = 0`).bind(id).first();
  if (!row) return { _status: 404, error: 'not found' };
  const editor = String(editorRaw || '').trim().toLowerCase();
  if (editor !== row.author_email && editor !== KB_ADMIN_EMAIL) {
    return { _status: 403, error: 'only author or admin can delete' };
  }
  await env.DB.prepare(`UPDATE kb_answers SET deleted = 1, updated_at = datetime('now') WHERE id = ?`).bind(id).run();
  return { ok: true, id };
}

// === Main router ===

// === Helper: regen alerts (called from POST /alerts/run + scheduled() ===
async function regenAlerts(env) {
  const results = {};
  const inserts = [
    // Margin negative (critical)
    ['margin_negative',
      `INSERT INTO alerts (kind, severity, title, body, ref_id)
       SELECT 'margin_negative', 'critical', 'SKU збитковий: ' || sku_id,
              'sku_name=' || sku_name || ' margin_pct=' || gross_margin_pct || '%', sku_id
       FROM v_sku_profitability WHERE gross_margin_pct < 0
       AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.ref_id = v_sku_profitability.sku_id AND a.kind = 'margin_negative' AND a.resolved = 0 AND a.created_at > date('now','-7 days'))`],
    // Margin low (warning)
    ['margin_low',
      `INSERT INTO alerts (kind, severity, title, body, ref_id)
       SELECT 'margin_low', 'warning', 'SKU маржа < 50%: ' || sku_id,
              'sku_name=' || sku_name || ' margin_pct=' || COALESCE(gross_margin_pct, 0) || '% revenue=' || total_revenue, sku_id
       FROM v_sku_profitability WHERE gross_margin_pct < 50 AND gross_margin_pct >= 0 AND total_revenue > 1000
       AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.ref_id = v_sku_profitability.sku_id AND a.kind = 'margin_low' AND a.resolved = 0 AND a.created_at > date('now','-7 days'))`],
    // Low stock
    ['low_stock',
      `INSERT INTO alerts (kind, severity, title, body, ref_id)
       SELECT 'low_stock', CASE WHEN sb.stock_qty < 20 THEN 'critical' ELSE 'warning' END,
              'Низькі залишки: ' || p.sku_id,
              'sku_name=' || p.ms_name || ' qty=' || sb.stock_qty, p.sku_id
       FROM moysklad_stock_by_store sb JOIN moysklad_products p ON p.ms_id = sb.product_ms_id
       WHERE sb.stock_qty < 50 AND sb.stock_qty > 0 AND p.sku_id IS NOT NULL AND p.sku_id LIKE 'B-%'
       AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.ref_id = p.sku_id AND a.kind = 'low_stock' AND a.resolved = 0 AND a.created_at > date('now','-3 days'))`],
    // Sync errors
    ['sync_error',
      `INSERT INTO alerts (kind, severity, title, body, ref_id)
       SELECT 'sync_error', 'critical', 'Sync failure: ' || entity, COALESCE(last_error, 'unknown'), entity
       FROM sync_state WHERE last_error IS NOT NULL AND last_error != ''
       AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.ref_id = sync_state.entity AND a.kind = 'sync_error' AND a.resolved = 0 AND a.created_at > date('now','-1 day'))`],
    // Churn risk
    ['churn_risk',
      `INSERT INTO alerts (kind, severity, title, body, ref_id)
       SELECT 'churn_risk', 'warning', 'Churn risk: ' || agent_ms_id,
              'days_since=' || days_since_last || ' orders=' || total_orders || ' ltv=' || ROUND(lifetime_revenue, 0), agent_ms_id
       FROM v_customer_first_purchase
       WHERE days_since_last BETWEEN 60 AND 90 AND total_orders >= 3 AND lifetime_revenue > 5000
       AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.ref_id = v_customer_first_purchase.agent_ms_id AND a.kind = 'churn_risk' AND a.resolved = 0 AND a.created_at > date('now','-30 days'))`],
  ];
  for (const [kind, sql] of inserts) {
    try {
      const r = await env.DB.prepare(sql).run();
      results[kind] = r.meta?.changes || 0;
    } catch (e) {
      results[kind] = { error: e.message };
    }
  }
  return { ran_at: new Date().toISOString(), results };
}

export default {
  // === CRON: weekly backup of critical non-MS tables ===
  // Triggered by cron `0 4 * * 0` (Sunday 04:00 UTC).
  // Snapshots brand_ideas + sync_state + partner_pipeline + events + sku_catalog
  // + kb_questions + kb_answers → _backups table (keeps last 12 weeks).
  async scheduled(event, env, ctx) {
    const startedAt = new Date().toISOString();
    try {
      const critTables = ['brand_ideas', 'sync_state', 'partner_pipeline', 'events', 'sku_catalog', 'partners', 'kb_questions', 'kb_answers', 'kb_files', 'kb_question_state'];
      const dump = { version: 1, generated_at: startedAt, d1_db: 'barpi-bible', tables: {} };
      for (const t of critTables) {
        try {
          const r = await env.DB.prepare(`SELECT * FROM ${t}`).all();
          dump.tables[t] = r.results || [];
        } catch (e) {
          dump.tables[t] = { _error: e.message };
        }
      }
      const payload = JSON.stringify(dump);

      // 1. Insert snapshot into D1 _backups (12-week retention)
      await env.DB.prepare(
        `INSERT INTO _backups (created_at, snapshot_kind, payload_json, size_bytes) VALUES (?, ?, ?, ?)`
      ).bind(startedAt, 'weekly-critical', payload, payload.length).run();
      await env.DB.prepare(
        `DELETE FROM _backups WHERE id NOT IN (SELECT id FROM _backups ORDER BY created_at DESC LIMIT 12)`
      ).run();

      // 2a. Generate/refresh alerts
      try { await regenAlerts(env); } catch (alertErr) { console.error('regenAlerts failed:', alertErr.message); }

      // 2. Write to R2 if BACKUPS binding present (long-term archive, 90-day lifecycle)
      if (env.BACKUPS) {
        const r2Key = `weekly/${startedAt.slice(0, 10)}-critical.json`;
        try {
          await env.BACKUPS.put(r2Key, payload, {
            httpMetadata: { contentType: 'application/json' },
            customMetadata: { kind: 'weekly-critical', createdAt: startedAt, tablesCount: String(critTables.length) },
          });
        } catch (r2e) {
          console.error('R2 put failed:', r2e.message);
        }

        // Also do a FULL dump (all D1 tables) — for disaster recovery
        try {
          const allTables = await env.DB.prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != '_backups' ORDER BY name`
          ).all();
          const fullDump = { version: 1, generated_at: startedAt, d1_db: 'barpi-bible', tables: {} };
          for (const row of (allTables.results || [])) {
            const tableName = row.name;
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) continue;
            try {
              const r = await env.DB.prepare(`SELECT * FROM ${tableName}`).all();
              fullDump.tables[tableName] = r.results || [];
            } catch (e) {
              fullDump.tables[tableName] = { _error: e.message };
            }
          }
          const fullPayload = JSON.stringify(fullDump);
          const fullKey = `weekly/${startedAt.slice(0, 10)}-full.json`;
          await env.BACKUPS.put(fullKey, fullPayload, {
            httpMetadata: { contentType: 'application/json' },
            customMetadata: { kind: 'weekly-full', createdAt: startedAt, sizeBytes: String(fullPayload.length) },
          });
        } catch (fullErr) {
          console.error('Full R2 backup failed:', fullErr.message);
        }
      }
    } catch (e) {
      // Best-effort; log into sync_state pattern if helpful
      try {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO sync_state (entity, last_synced_at, last_error, updated_at) VALUES (?, ?, ?, ?)`
        ).bind('_backup_cron', startedAt, e.message || String(e), startedAt).run();
      } catch (_) {}
    }
  },

  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env);

    // CORS preflight
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    // === AUTH ===
    const authReject = checkAuth(req, env, headers);
    if (authReject) return authReject;

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

      // === D1 EXPORT (admin backup endpoint) ===
      // GET /export?tables=brand_ideas,sync_state — returns JSON dump
      // GET /export?all=1 — full backup (uses caution: large)
      // Auth: requires X-API-Key (already enforced by checkAuth above)
      // === ALERTS endpoints ===
      // GET /alerts — list active alerts
      if (url.pathname === '/alerts' && req.method === 'GET') {
        const includeResolved = url.searchParams.get('resolved') === '1';
        const q = includeResolved
          ? `SELECT * FROM alerts ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, created_at DESC LIMIT 200`
          : `SELECT * FROM alerts WHERE resolved = 0 ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, created_at DESC LIMIT 200`;
        const r = await env.DB.prepare(q).all();
        return json(r.results || [], 200, headers);
      }
      // PATCH /alerts/:id — mark as resolved
      const alertMatch = url.pathname.match(/^\/alerts\/(\d+)$/);
      if (alertMatch && req.method === 'PATCH') {
        const id = parseInt(alertMatch[1], 10);
        await env.DB.prepare(`UPDATE alerts SET resolved = 1, resolved_at = datetime('now') WHERE id = ?`).bind(id).run();
        return json({ ok: true, id }, 200, headers);
      }
      // POST /alerts/run — manually trigger alert regen (admin)
      if (url.pathname === '/alerts/run' && req.method === 'POST') {
        const result = await regenAlerts(env);
        return json(result, 200, headers);
      }

      // GET /backups/r2 — list R2 objects (admin)
      if (url.pathname === '/backups/r2' && req.method === 'GET' && env.BACKUPS) {
        const listed = await env.BACKUPS.list({ prefix: 'weekly/', limit: 100 });
        return json({
          truncated: listed.truncated,
          objects: (listed.objects || []).map(o => ({
            key: o.key,
            size: o.size,
            uploaded: o.uploaded,
            etag: o.etag,
            customMetadata: o.customMetadata || {},
          })),
        }, 200, headers);
      }
      // GET /backups — list latest snapshots from _backups table (admin)
      if (url.pathname === '/backups' && req.method === 'GET') {
        const r = await env.DB.prepare(
          `SELECT id, created_at, snapshot_kind, size_bytes FROM _backups ORDER BY created_at DESC LIMIT 50`
        ).all();
        return json(r.results || [], 200, headers);
      }
      // GET /backups/:id — download specific snapshot payload (admin)
      const backupMatch = url.pathname.match(/^\/backups\/(\d+)$/);
      if (backupMatch && req.method === 'GET') {
        const id = parseInt(backupMatch[1], 10);
        const r = await env.DB.prepare(`SELECT payload_json, created_at FROM _backups WHERE id = ?`).bind(id).first();
        if (!r) return json({ error: 'not found' }, 404, headers);
        const filename = `barpi-backup-${r.created_at.slice(0,10)}-${id}.json`;
        return new Response(r.payload_json, {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${filename}"` },
        });
      }
      if (url.pathname === '/export' && req.method === 'GET') {
        const onlyParam = url.searchParams.get('tables');
        const all = url.searchParams.get('all') === '1';
        // Safety default: only critical non-MS tables
        const defaultTables = ['brand_ideas', 'sync_state', 'partner_pipeline', 'events', 'inventory_snapshot', 'smm_content_log', 'kb_questions', 'kb_answers', 'kb_files', 'kb_question_state'];
        let tables = defaultTables;
        if (onlyParam) tables = onlyParam.split(',').map(s => s.trim()).filter(Boolean);
        else if (all) {
          const r = await env.DB.prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name`
          ).all();
          tables = (r.results || []).map(x => x.name);
        }
        const dump = {
          version: 1,
          generated_at: new Date().toISOString(),
          d1_db: 'barpi-bible',
          tables: {},
        };
        for (const t of tables) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t)) continue;  // safety
          try {
            const r = await env.DB.prepare(`SELECT * FROM ${t}`).all();
            dump.tables[t] = r.results || [];
          } catch (e) {
            dump.tables[t] = { _error: e.message };
          }
        }
        const filename = `barpi-d1-backup-${new Date().toISOString().slice(0,10)}.json`;
        return new Response(JSON.stringify(dump, null, 2), {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }

      // brand_ideas GET — use generic readResource (supports all PostgREST filters)
      // ===== partner_pipeline CRUD (B2B воронка) — додано 04.09.2026 =====
      // Було задеплоєно повз репо; повернено в репо 06.09.2026 разом з R2-біндингом KBFILES.
      const PP_FIELDS = ['partner_name', 'stage', 'partner_type', 'country', 'contact_date',
        'next_action', 'next_action_date', 'owner', 'probability', 'notes',
        'potential_kg_month', 'potential_uah', 'ms_agent_id'];
      const PP_STAGES = new Set(['contact', 'samples', 'test', 'contract', 'active', 'lost']);

      if (url.pathname === '/partner_pipeline' && req.method === 'POST') {
        let body;
        try { body = await req.json(); }
        catch (e) { return json({ error: 'invalid json', message: e.message }, 400, headers); }
        if (!body.partner_name) return json({ error: 'partner_name required' }, 400, headers);
        const stage = body.stage || 'contact';
        if (!PP_STAGES.has(stage)) {
          return json({ error: 'invalid stage', allowed: [...PP_STAGES] }, 400, headers);
        }
        const cols = [], vals = [];
        for (const f of PP_FIELDS) {
          if (body[f] !== undefined) { cols.push(f); vals.push(body[f]); }
        }
        if (!cols.includes('stage')) { cols.push('stage'); vals.push(stage); }
        cols.push('created_at', 'updated_at');
        const ph = cols.map((c) => (c === 'created_at' || c === 'updated_at') ? "datetime('now')" : '?').join(', ');
        await env.DB.prepare(
          `INSERT INTO partner_pipeline (${cols.join(', ')}) VALUES (${ph})`
        ).bind(...vals).run();
        const row = await env.DB.prepare(
          `SELECT * FROM partner_pipeline ORDER BY id DESC LIMIT 1`
        ).first();
        return json(row, 201, headers);
      }

      const ppMatch = url.pathname.match(/^\/partner_pipeline\/(\d+)$/);
      if (ppMatch && req.method === 'PATCH') {
        let body;
        try { body = await req.json(); }
        catch (e) { return json({ error: 'invalid json', message: e.message }, 400, headers); }
        const id = ppMatch[1];
        const exists = await env.DB.prepare(`SELECT id FROM partner_pipeline WHERE id = ?`).bind(id).first();
        if (!exists) return json({ error: 'not found', id }, 404, headers);
        if (body.stage !== undefined && !PP_STAGES.has(body.stage)) {
          return json({ error: 'invalid stage', allowed: [...PP_STAGES] }, 400, headers);
        }
        const sets = [], vals = [];
        for (const f of PP_FIELDS) {
          if (body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(body[f]); }
        }
        if (!sets.length) return json({ error: 'no updatable fields' }, 400, headers);
        sets.push("updated_at = datetime('now')");
        vals.push(id);
        await env.DB.prepare(
          `UPDATE partner_pipeline SET ${sets.join(', ')} WHERE id = ?`
        ).bind(...vals).run();
        const row = await env.DB.prepare(`SELECT * FROM partner_pipeline WHERE id = ?`).bind(id).first();
        return json(row, 200, headers);
      }

      if (ppMatch && req.method === 'DELETE') {
        const id = ppMatch[1];
        const exists = await env.DB.prepare(`SELECT id FROM partner_pipeline WHERE id = ?`).bind(id).first();
        if (!exists) return json({ error: 'not found', id }, 404, headers);
        await env.DB.prepare(`DELETE FROM partner_pipeline WHERE id = ?`).bind(id).run();
        return json({ deleted: id }, 200, headers);
      }

      if (url.pathname === '/brand_ideas' && req.method === 'GET') {
        // Default order if not specified
        if (!url.searchParams.get('order')) {
          url.searchParams.set('order', 'created_at.desc');
        }
        return json(await readResource(env, 'brand_ideas', url), 200, headers);
      }
      if (url.pathname === '/brand_ideas' && req.method === 'POST') {
        let body;
        try { body = await req.json(); }
        catch (e) { return json({ error: 'invalid json', message: e.message }, 400, headers); }
        if (!body.title) return json({ error: 'title required' }, 400, headers);
        return json(await createIdea(env, body), 201, headers);
      }
      const ideaMatch = url.pathname.match(/^\/brand_ideas\/([a-f0-9-]+)$/);
      if (ideaMatch && req.method === 'PATCH') {
        let body;
        try { body = await req.json(); }
        catch (e) { return json({ error: 'invalid json', message: e.message }, 400, headers); }
        const result = await updateIdea(env, ideaMatch[1], body);
        if (result._status) { const { _status, ...rest } = result; return json(rest, _status, headers); }
        return json(result, 200, headers);
      }

      // === kb_answers (База знань — write endpoints) ===
      if (url.pathname === '/kb_answers' && req.method === 'POST') {
        let body;
        try { body = await req.json(); }
        catch (e) { return json({ error: 'invalid json' }, 400, headers); }
        const result = await kbCreateAnswer(env, body);
        if (result && result._status) { const { _status, ...rest } = result; return json(rest, _status, headers); }
        return json(result, 201, headers);
      }
      const kbMatch = url.pathname.match(/^\/kb_answers\/([a-f0-9-]+)$/);
      if (kbMatch && req.method === 'PATCH') {
        let body;
        try { body = await req.json(); }
        catch (e) { return json({ error: 'invalid json' }, 400, headers); }
        const result = await kbUpdateAnswer(env, kbMatch[1], body);
        if (result && result._status) { const { _status, ...rest } = result; return json(rest, _status, headers); }
        return json(result, 200, headers);
      }
      if (kbMatch && req.method === 'DELETE') {
        const editor = url.searchParams.get('editor') || '';
        const result = await kbDeleteAnswer(env, kbMatch[1], editor);
        if (result && result._status) { const { _status, ...rest } = result; return json(rest, _status, headers); }
        return json(result, 200, headers);
      }

      // === kb_files (attachments) ===
      // Download must be matched BEFORE the generic table reader.
      const kbDl = url.pathname.match(/^\/kb_files\/([a-f0-9-]+)\/download$/);
      if (kbDl && req.method === 'GET') {
        const row = await env.DB.prepare(`SELECT * FROM kb_files WHERE id = ? AND deleted = 0`).bind(kbDl[1]).first();
        if (!row) return json({ error: 'not found' }, 404, headers);
        if (!env.KBFILES) return json({ error: 'file storage not configured' }, 500, headers);
        const obj = await env.KBFILES.get(row.r2_key);
        if (!obj) return json({ error: 'file missing in storage' }, 404, headers);
        return new Response(obj.body, {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': row.content_type || 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, max-age=60',
          },
        });
      }
      if (url.pathname === '/kb_files' && req.method === 'POST') {
        const result = await kbUploadFile(env, req);
        if (result && result._status) { const { _status, ...rest } = result; return json(rest, _status, headers); }
        return json(result, 201, headers);
      }
      const kbFileMatch = url.pathname.match(/^\/kb_files\/([a-f0-9-]+)$/);
      if (kbFileMatch && req.method === 'DELETE') {
        const result = await kbDeleteFile(env, kbFileMatch[1], url.searchParams.get('editor') || '');
        if (result && result._status) { const { _status, ...rest } = result; return json(rest, _status, headers); }
        return json(result, 200, headers);
      }

      // === kb_question_state (Є/немає · Де зберігається · Відповідальний) ===
      const kbStateMatch = url.pathname.match(/^\/kb_state\/(\d+)$/);
      if (kbStateMatch && (req.method === 'PUT' || req.method === 'POST')) {
        let body;
        try { body = await req.json(); }
        catch (e) { return json({ error: 'invalid json' }, 400, headers); }
        const result = await kbSaveState(env, kbStateMatch[1], body);
        if (result && result._status) { const { _status, ...rest } = result; return json(rest, _status, headers); }
        return json(result, 200, headers);
      }

      // Generic view/table read — auto-discover from sqlite_master
      const name = url.pathname.replace(/^\//, '');
      // HARDENED: blacklist system + admin tables
      const BLACKLIST = new Set(['sqlite_master', 'sqlite_sequence', '_backups', '_cf_KV']);
      if (BLACKLIST.has(name) || name.startsWith('sqlite_') || name.startsWith('_cf_')) {
        return json({ error: 'forbidden', reason: 'reserved table' }, 403, headers);
      }
      if (req.method === 'GET' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        // Check if table/view exists
        // Check existence — exclude system tables (sqlite_*, _cf_*, _backups)
        // by relying on substr check rather than ESCAPE clause (which had compatibility issues).
        const meta = await env.DB.prepare(
          `SELECT type FROM sqlite_master WHERE name = ? AND type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND substr(name, 1, 1) != '_'`
        ).bind(name).first();
        if (meta) {
          try {
            return json(await readResource(env, name, url), 200, headers);
          } catch (e) {
            // graceful: return [] так як dashboard валиться на Promise.all
            return json([], 200, { ...headers, 'X-Query-Failed': e.message ? e.message.slice(0, 200) : 'error', 'X-Table': name });
          }
        }
        // Missing table/view — return empty array (dashboards handle gracefully)
        return json([], 200, { ...headers, 'X-Resource-Missing': name });
      }

      return json({ error: 'not found', path: url.pathname }, 404, headers);
    } catch (e) {
      const status = e.code === 400 ? 400 : 500;
      const errBody = status === 400
        ? { error: 'bad_request', message: e.message }
        : { error: 'internal', message: 'see worker logs' };  // don't leak SQL errors
      return json(errBody, status, headers);
    }
  },
};
