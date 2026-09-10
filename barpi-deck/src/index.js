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

/**
 * Each gated page: its own path, its own R2 object, its own password and cookie.
 * Adding a page = one entry here + one wrangler secret + one file in R2.
 */
const PAGES = {
  '/deck': {
    key: 'index.html', pdf: 'deck.pdf', pdfName: 'Barpi_investor_deck.pdf',
    cookie: 'barpi_deck', secret: 'DECK_PASSWORD',
    title: 'Інвестиційна презентація · 2026',
    note: 'Матеріал призначений виключно для сторони, яка підписала NDA, і не підлягає передачі третім особам.',
  },
  '/checklist': {
    key: 'checklist.html', pdf: null, pdfName: null,
    cookie: 'barpi_chk', secret: 'CHECKLIST_PASSWORD',
    title: 'Відповіді на чек-лист · 48 пунктів',
    note: 'Робочий документ для консультанта і сторони, яка підписала NDA. Передачі третім особам не підлягає.',
  },
};

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

function loginPage(page, path, error, status = 200) {
  const msg = error
    ? `<p class="err">${error}</p>`
    : '<p class="hint">Сторінка захищена. Пароль надає компанія.</p>';

  const html = `<!doctype html><html lang="uk"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Barpi — доступ за паролем</title>
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
 <p class="sup">${page.title}</p>
 <div class="card">
  <h1>Доступ за паролем</h1>
  ${msg}
  <form method="POST" action="/deck">
   <label for="p">Пароль</label>
   <input id="p" name="password" type="password" autocomplete="current-password" autofocus required>
   <button type="submit">Відкрити</button>
  </form>
 </div>
 <p class="foot">Конфіденційно. ${page.note}</p>
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
    const url  = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const ip   = request.headers.get('CF-Connecting-IP') || '';
    const secret = env.SESSION_SECRET;

    // which gated page does this request belong to?
    const base = Object.keys(PAGES).find(p => path === p || path.startsWith(p + '/'));
    if (!base) return new Response('Не знайдено', { status: 404, headers: BASE_HEADERS });
    const page = PAGES[base];
    const sub  = path.slice(base.length);       // '', '/pdf', '/exit'
    const pass = env[page.secret];

    if (!secret || !pass) {
      return new Response('Сервіс не налаштований', { status: 503, headers: BASE_HEADERS });
    }

    const redirect = (to) => {
      const h = new Headers(BASE_HEADERS); h.set('Location', to);
      return new Response(null, { status: 303, headers: h });
    };

    // --- logout ---
    if (sub === '/exit') {
      const h = new Headers(BASE_HEADERS);
      h.set('Location', base);
      h.set('Set-Cookie', `${page.cookie}=; Path=${base}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
      return new Response(null, { status: 303, headers: h });
    }

    // --- login ---
    if (request.method === 'POST' && sub === '') {
      const fails = await failCount(env, ip + base);
      if (fails >= MAX_FAILS) {
        return loginPage(page, base, 'Забагато спроб. Спробуйте за 15 хвилин.', 429);
      }
      let given = '';
      try { given = String((await request.formData()).get('password') || ''); } catch { /* ignore */ }

      if (!safeEqual(given.trim(), pass)) {
        await bumpFail(env, ip + base, fails);
        return loginPage(page, base, 'Невірний пароль. Перевірте розкладку і спробуйте ще раз.', 401);
      }
      await clearFail(env, ip + base);
      const h = new Headers(BASE_HEADERS);
      h.set('Location', base);
      h.set('Set-Cookie',
        `${page.cookie}=${await makeToken(secret)}; Path=${base}; Max-Age=${TTL_S}; HttpOnly; Secure; SameSite=Lax`);
      return new Response(null, { status: 303, headers: h });
    }

    // --- everything below needs a session for THIS page ---
    const ok = await validToken(readCookie(request, page.cookie), secret);
    if (!ok) return sub === '' ? loginPage(page, base, null) : redirect(base);

    if (sub === '') return serveObject(env, page.key, 'text/html; charset=utf-8');
    if (sub === '/pdf' && page.pdf) {
      return serveObject(env, page.pdf, 'application/pdf', page.pdfName);
    }
    return redirect(base);
  },
};
