/**
 * barpi-deck — password gate for the Barpi investor deck.
 *
 * Route: brand.barpi.ua/deck*
 * Content lives in R2 (private bucket `barpi-deck`), never in the public GitHub Pages repo.
 *
 *   GET  /deck            → session? deck HTML : login form
 *   POST /deck            → check password, set signed cookie, redirect
 *   GET  /deck/pdf        → session? PDF inline : redirect to /deck
 *   GET  /deck/exit       → clear session
 */

const COOKIE = 'barpi_deck';
const TTL_S = 60 * 60 * 24 * 30; // 30 days
const MAX_FAILS = 12;            // per IP per 15 min

const enc = new TextEncoder();

/* ---------- session cookie: <exp>.<hmac> ---------- */

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function makeToken(secret) {
  const exp = String(Math.floor(Date.now() / 1000) + TTL_S);
  return `${exp}.${await sign(exp, secret)}`;
}

async function validToken(token, secret) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 1) return false;
  const exp = token.slice(0, i);
  const mac = token.slice(i + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(mac, await sign(exp, secret));
}

function readCookie(req, name) {
  const raw = req.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/* ---------- shared headers ---------- */

const BASE_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

/* ---------- login page ---------- */

function loginPage(error, status = 200) {
  const msg = error
    ? `<p class="err">${error}</p>`
    : '<p class="hint">Сторінка захищена. Пароль надає компанія.</p>';

  const html = `<!doctype html><html lang="uk"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Barpi — доступ до презентації</title>
<style>
:root{--navy:#001154;--sky:#BAD9F4}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
 background:radial-gradient(1200px 700px at 70% -10%,#0B2A7A 0%,#001154 55%,#000B33 100%);
 color:#fff;font-family:'Rubik',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
 padding:28px;-webkit-font-smoothing:antialiased}
.box{width:100%;max-width:412px}
.mark{font-size:30px;font-weight:800;letter-spacing:-.03em;margin:0 0 6px}
.mark span{color:var(--sky)}
.sup{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#7C93C4;font-weight:700;margin:0 0 30px}
.card{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.13);
 border-radius:18px;padding:30px 28px}
h1{font-size:20px;font-weight:800;letter-spacing:-.01em;margin:0 0 6px}
.hint,.err{font-size:13.5px;line-height:1.5;margin:0 0 22px}
.hint{color:#B7C7E4}
.err{color:#FFB4AC}
label{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;
 color:#8FA6D2;font-weight:700;margin:0 0 8px}
input{width:100%;padding:13px 15px;font-size:16px;font-family:inherit;color:#fff;
 background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.19);border-radius:11px;outline:none}
input:focus{border-color:var(--sky);background:rgba(0,0,0,.4)}
button{width:100%;margin-top:16px;padding:14px;font-size:15px;font-weight:800;font-family:inherit;
 color:var(--navy);background:var(--sky);border:0;border-radius:11px;cursor:pointer;letter-spacing:-.01em}
button:hover{background:#D3E7FA}
.foot{margin-top:22px;font-size:11.5px;color:#6E85B6;line-height:1.6}
</style></head><body>
<div class="box">
 <p class="mark">barpi<span>.</span></p>
 <p class="sup">Інвестиційна презентація · 2026</p>
 <div class="card">
  <h1>Доступ за паролем</h1>
  ${msg}
  <form method="POST" action="/deck">
   <label for="p">Пароль</label>
   <input id="p" name="password" type="password" autocomplete="current-password" autofocus required>
   <button type="submit">Відкрити презентацію</button>
  </form>
 </div>
 <p class="foot">Конфіденційно. Матеріал призначений виключно для сторони, яка підписала NDA,
 і не підлягає передачі третім особам.</p>
</div></body></html>`;

  return new Response(html, {
    status,
    headers: { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/* ---------- best-effort brute-force throttle ---------- */

async function failCount(env, ip) {
  if (!env.OTP_KV || !ip) return 0;
  try { return Number(await env.OTP_KV.get(`deckfail:${ip}`)) || 0; } catch { return 0; }
}
async function bumpFail(env, ip, n) {
  if (!env.OTP_KV || !ip) return;
  try { await env.OTP_KV.put(`deckfail:${ip}`, String(n + 1), { expirationTtl: 900 }); } catch {}
}
async function clearFail(env, ip) {
  if (!env.OTP_KV || !ip) return;
  try { await env.OTP_KV.delete(`deckfail:${ip}`); } catch {}
}

/* ---------- R2 ---------- */

async function serveObject(env, key, contentType, filename) {
  const obj = await env.DECK.get(key);
  if (!obj) return new Response('Файл не знайдено', { status: 404, headers: BASE_HEADERS });
  const h = new Headers(BASE_HEADERS);
  h.set('Content-Type', contentType);
  if (filename) h.set('Content-Disposition', `inline; filename="${filename}"`);
  return new Response(obj.body, { headers: h });
}

/* ---------- worker ---------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/deck';
    const secret = env.SESSION_SECRET;
    const ip = request.headers.get('CF-Connecting-IP') || '';

    if (!secret || !env.DECK_PASSWORD) {
      return new Response('Сервіс не налаштований', { status: 503, headers: BASE_HEADERS });
    }

    // --- logout ---
    if (path === '/deck/exit') {
      const h = new Headers(BASE_HEADERS);
      h.set('Location', '/deck');
      h.set('Set-Cookie', `${COOKIE}=; Path=/deck; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
      return new Response(null, { status: 303, headers: h });
    }

    // --- login ---
    if (request.method === 'POST' && path === '/deck') {
      const fails = await failCount(env, ip);
      if (fails >= MAX_FAILS) {
        return loginPage('Забагато спроб. Спробуйте за 15 хвилин.', 429);
      }
      let given = '';
      try {
        const form = await request.formData();
        given = String(form.get('password') || '');
      } catch { /* ignore */ }

      if (!safeEqual(given.trim(), env.DECK_PASSWORD)) {
        await bumpFail(env, ip, fails);
        return loginPage('Невірний пароль. Перевірте розкладку і спробуйте ще раз.', 401);
      }

      await clearFail(env, ip);
      const h = new Headers(BASE_HEADERS);
      h.set('Location', '/deck');
      h.set('Set-Cookie',
        `${COOKIE}=${await makeToken(secret)}; Path=/deck; Max-Age=${TTL_S}; HttpOnly; Secure; SameSite=Lax`);
      return new Response(null, { status: 303, headers: h });
    }

    // --- everything below needs a session ---
    const ok = await validToken(readCookie(request, COOKIE), secret);
    if (!ok) {
      if (path === '/deck') return loginPage(null);
      const h = new Headers(BASE_HEADERS);
      h.set('Location', '/deck');
      return new Response(null, { status: 303, headers: h });
    }

    if (path === '/deck') {
      return serveObject(env, 'index.html', 'text/html; charset=utf-8');
    }
    if (path === '/deck/pdf') {
      return serveObject(env, 'deck.pdf', 'application/pdf', 'Barpi_investor_deck.pdf');
    }

    const h = new Headers(BASE_HEADERS);
    h.set('Location', '/deck');
    return new Response(null, { status: 303, headers: h });
  },
};
