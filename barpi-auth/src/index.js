/**
 * Barpi Auth Worker
 * Форк sneco-auth, адаптовано для Barpi-дашбордів.
 *
 * Endpoints:
 *   POST /api/otp/request           { email, block }            → { ok }
 *   POST /api/otp/verify            { email, block, code }      → { token }
 *   POST /api/session/verify        { token, block }            → { ok, email, isAdmin, exp }
 *   POST /api/admin/whitelist/get   header: Authorization Bearer → { blocks: { smm-dashboard:[…] } }
 *   POST /api/admin/whitelist/update {block, emails[]}          → { ok }
 *
 * Bindings (wrangler.toml):
 *   - OTP_KV (KV namespace barpi-bible-acl)
 *   - DB (D1 barpi-bible)
 *
 * Secrets (wrangler secret put):
 *   - JWT_SECRET
 *   - RESEND_API_KEY
 *
 * Vars:
 *   - ADMIN_EMAILS = "vg@abrisart.com,fg@abrisart.com"
 *   - SENDER_EMAIL = "noreply@barpi.ua"
 *   - ALLOWED_ORIGIN = "https://brand.barpi.ua"
 */

const SUPPORTED_BLOCKS = [
  'admin',
  'smm-dashboard',
  'sales-dashboard',
  'inventory-dashboard',
  'partner-dashboard',
  'events-dashboard',
];

const OTP_TTL_MS = 10 * 60 * 1000;           // 10 хв на код
const SESSION_TTL_S = 24 * 60 * 60;          // 24 год сесія
const ENC = new TextEncoder();
const DEC = new TextDecoder();

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '60',
  };
}
function jsonResp(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

// === JWT (HS256) ===
function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', ENC.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function jwtSign(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64url(ENC.encode(JSON.stringify(header)));
  const p = b64url(ENC.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}
async function jwtVerify(token, secret) {
  const [h, p, s] = (token || '').split('.');
  if (!h || !p || !s) throw new Error('malformed');
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(s), ENC.encode(`${h}.${p}`));
  if (!ok) throw new Error('bad signature');
  const payload = JSON.parse(DEC.decode(b64urlDecode(p)));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) throw new Error('expired');
  return payload;
}
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', ENC.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// === Helpers ===
function normaliseEmail(e) { return (e || '').trim().toLowerCase(); }
function generateCode() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, '0');
}
function getAdminList(env) {
  return (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
async function getWhitelist(env, block) {
  if (block === 'admin') return getAdminList(env);
  const raw = await env.OTP_KV.get(`wl:${block}`);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return getAdminList(env);  // default: тільки адміни
}
async function setWhitelist(env, block, emails) {
  const cleaned = [...new Set(emails.map(normaliseEmail).filter(Boolean))];
  await env.OTP_KV.put(`wl:${block}`, JSON.stringify(cleaned));
  return cleaned;
}

// === Email через Resend (брендований шаблон Barpi) ===
function emailTemplate(opts) {
  const brandSite = (opts.env && opts.env.PUBLIC_BASE_URL) || 'https://brand.barpi.ua/';
  const title = opts.title || 'Barpi Brand Bible';
  const intro = opts.intro || '';
  const content = opts.content || '';
  const cta = opts.cta;
  const footnote = opts.footnote || '';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A1A1A">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAFAFA;padding:32px 12px">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#1A1A1A;padding:22px 28px;text-align:left;color:white">
<div style="font-weight:800;font-size:22px;letter-spacing:-0.02em">Barpi<span style="color:#2F6FED">.</span></div>
</td></tr>
<tr><td style="padding:28px 28px 8px"><h1 style="margin:0;font-size:20px;font-weight:800;line-height:1.3;color:#1A1A1A">${title}</h1></td></tr>
${intro ? `<tr><td style="padding:0 28px 12px"><p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280">${intro}</p></td></tr>` : ''}
<tr><td style="padding:8px 28px 18px">${content}</td></tr>
${cta ? `<tr><td style="padding:8px 28px 24px"><a href="${cta.url}" style="display:inline-block;background:#2F6FED;color:white;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;padding:11px 22px;border-radius:8px">${cta.label}</a></td></tr>` : ''}
${footnote ? `<tr><td style="padding:0 28px 24px"><p style="margin:0;font-size:11.5px;color:#9ca3af;line-height:1.5">${footnote}</p></td></tr>` : ''}
<tr><td style="height:4px;line-height:4px;font-size:0;background:#2F6FED">&nbsp;</td></tr>
<tr><td style="padding:18px 28px;background:#f9fafb">
<p style="margin:0 0 6px;font-size:11px;color:#6b7280;line-height:1.5">
<strong style="color:#1A1A1A">Barpi</strong> · ТОВ «ПЕТ КОРП» · Мукачево, Україна<br>
<a href="${brandSite}" style="color:#6b7280;text-decoration:underline">brand.barpi.ua</a> · <a href="https://barpi.com.ua" style="color:#6b7280;text-decoration:underline">barpi.com.ua</a>
</p>
<p style="margin:0;font-size:10.5px;color:#bbb;line-height:1.5">Це автоматичне сповіщення. Не відповідайте на цей лист.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

async function sendBrandedEmail(env, to, subject, opts) {
  const html = emailTemplate({ ...opts, env });
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.SENDER_EMAIL || 'noreply@barpi.ua',
      to: Array.isArray(to) ? to : [to],
      subject, html,
    }),
  });
  if (!r.ok) { const err = await r.text(); throw new Error(`Resend ${r.status}: ${err.slice(0, 200)}`); }
}

async function sendOtpEmail(env, email, code, block) {
  const blockNice = {
    'admin': 'Адмін',
    'smm-dashboard': 'SMM Dashboard',
    'sales-dashboard': 'Sales Dashboard',
    'inventory-dashboard': 'Inventory Dashboard',
    'partner-dashboard': 'Partner Pipeline',
    'events-dashboard': 'Events Dashboard',
  }[block] || block.toUpperCase();
  const subject = `Код доступу · ${blockNice} · Barpi`;
  const codeBlock = `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 18px">
<tr><td style="background:#2F6FED;border-radius:10px;padding:22px 18px;text-align:center">
<div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:white;opacity:0.85;margin-bottom:8px">Ваш код</div>
<div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:white">${code}</div>
</td></tr>
</table>
<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0">⏱ Код дійсний <strong>10 хв</strong> · Сесія — <strong>24 год</strong>.</p>`;
  await sendBrandedEmail(env, email, subject, {
    title: `Код доступу · ${blockNice}`,
    intro: `Запитано вхід у захищений розділ <strong>${blockNice}</strong>.`,
    content: codeBlock,
    footnote: '🔒 Якщо ви не запитували — проігноруйте цей лист.',
  });
}

async function readJson(req) { try { return await req.json(); } catch (e) { return null; } }
async function getBearer(req, env) {
  const h = req.headers.get('Authorization') || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return null;
  try { return await jwtVerify(m[1], env.JWT_SECRET); } catch (e) { return null; }
}

// === ROUTES ===
async function handleOtpRequest(req, env) {
  const body = await readJson(req);
  if (!body || !body.email || !body.block) return jsonResp({ error: 'email and block required' }, 400, env);
  const email = normaliseEmail(body.email);
  const block = String(body.block).toLowerCase();
  if (!SUPPORTED_BLOCKS.includes(block)) return jsonResp({ error: 'unknown block' }, 400, env);
  const wl = await getWhitelist(env, block);
  if (!wl.includes(email)) {
    await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
    return jsonResp({ error: 'not_in_whitelist', message: 'Цього email немає у whitelist для цього розділу.', block }, 403, env);
  }
  const code = generateCode();
  const codeHash = await sha256Hex(code);
  await env.OTP_KV.put(`otp:${email}:${block}`, JSON.stringify({ hash: codeHash, exp: Date.now() + OTP_TTL_MS }), { expirationTtl: 700 });
  try { await sendOtpEmail(env, email, code, block); }
  catch (e) { return jsonResp({ error: 'mail send failed', detail: String(e).slice(0, 200) }, 500, env); }
  return jsonResp({ ok: true, message: 'Code sent if authorized.' }, 200, env);
}

async function handleOtpVerify(req, env) {
  const body = await readJson(req);
  if (!body || !body.email || !body.block || !body.code) return jsonResp({ error: 'email, block, code required' }, 400, env);
  const email = normaliseEmail(body.email);
  const block = String(body.block).toLowerCase();
  if (!SUPPORTED_BLOCKS.includes(block)) return jsonResp({ error: 'unknown block' }, 400, env);
  const wl = await getWhitelist(env, block);
  if (!wl.includes(email)) return jsonResp({ error: 'invalid code' }, 401, env);
  const raw = await env.OTP_KV.get(`otp:${email}:${block}`);
  if (!raw) return jsonResp({ error: 'invalid code' }, 401, env);
  let stored; try { stored = JSON.parse(raw); } catch (e) { return jsonResp({ error: 'invalid code' }, 401, env); }
  if (Date.now() > stored.exp) { await env.OTP_KV.delete(`otp:${email}:${block}`); return jsonResp({ error: 'expired' }, 401, env); }
  const codeHash = await sha256Hex(String(body.code).trim());
  if (codeHash !== stored.hash) return jsonResp({ error: 'invalid code' }, 401, env);
  await env.OTP_KV.delete(`otp:${email}:${block}`);
  const isAdmin = getAdminList(env).includes(email);
  const now = Math.floor(Date.now() / 1000);
  const token = await jwtSign({ iss: 'barpi-auth', email, block, isAdmin, iat: now, exp: now + SESSION_TTL_S }, env.JWT_SECRET);
  return jsonResp({ token, email, isAdmin, exp: now + SESSION_TTL_S }, 200, env);
}

async function handleSessionVerify(req, env) {
  const body = await readJson(req);
  if (!body || !body.token) return jsonResp({ error: 'token required' }, 400, env);
  try {
    const payload = await jwtVerify(body.token, env.JWT_SECRET);
    if (body.block && payload.block !== body.block && !payload.isAdmin) return jsonResp({ error: 'wrong block' }, 403, env);
    return jsonResp({ ok: true, email: payload.email, isAdmin: payload.isAdmin, exp: payload.exp }, 200, env);
  } catch (e) { return jsonResp({ error: 'invalid token' }, 401, env); }
}

async function handleAdminWhitelistGet(req, env) {
  const payload = await getBearer(req, env);
  if (!payload || !payload.isAdmin) return jsonResp({ error: 'admin required' }, 403, env);
  const blocks = {};
  for (const b of SUPPORTED_BLOCKS) {
    if (b === 'admin') continue;
    blocks[b] = await getWhitelist(env, b);
  }
  return jsonResp({ blocks, admins: getAdminList(env) }, 200, env);
}

async function handleAdminWhitelistUpdate(req, env) {
  const payload = await getBearer(req, env);
  if (!payload || !payload.isAdmin) return jsonResp({ error: 'admin required' }, 403, env);
  const body = await readJson(req);
  if (!body || !body.block || !Array.isArray(body.emails)) return jsonResp({ error: 'block + emails[] required' }, 400, env);
  const block = String(body.block).toLowerCase();
  if (!SUPPORTED_BLOCKS.includes(block) || block === 'admin') return jsonResp({ error: 'invalid block' }, 400, env);
  const cleaned = await setWhitelist(env, block, body.emails);
  return jsonResp({ ok: true, block, emails: cleaned }, 200, env);
}

// === MAIN ===
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env) });
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'POST') {
      if (p === '/api/otp/request') return handleOtpRequest(req, env);
      if (p === '/api/otp/verify') return handleOtpVerify(req, env);
      if (p === '/api/session/verify') return handleSessionVerify(req, env);
      if (p === '/api/admin/whitelist/get') return handleAdminWhitelistGet(req, env);
      if (p === '/api/admin/whitelist/update') return handleAdminWhitelistUpdate(req, env);
    }
    if (p === '/' || p === '/api') return jsonResp({ ok: true, service: 'barpi-auth', version: '1.0' }, 200, env);
    return jsonResp({ error: 'not found' }, 404, env);
  },
};
