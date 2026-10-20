// barpi-mkt · доступ до /dashboard/api/mkt/*: Cloudflare Access JWT (та сама перевірка, що в barpi-hr/src/access.js).
// Окремий модуль без 'cloudflare:email', щоб тестувався в Node (tests/).
const listOf = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const normaliseEmail = (e) => String(e || '').trim().toLowerCase();

// ── Cloudflare Access: перевірка JWT, який edge додає після входу ────────────
// Той самий код, що в barpi-ads. Origin і cookie не довіряємо (docs/traps.md «Заголовок Origin»).
let jwksCache = { at: 0, keys: [] };
const b64u = (x) => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((x.length + 3) % 4)), (c) => c.charCodeAt(0));
export async function accessUser(req, env) {
  // Локальна розробка (wrangler dev): DEV_ACCESS_EMAIL задається лише в .dev.vars, у проді його немає
  if (env.DEV_ACCESS_EMAIL && env.ACCESS_TEAM_DOMAIN === 'dev') return env.DEV_ACCESS_EMAIL;
  const tok = req.headers.get('Cf-Access-Jwt-Assertion');
  if (!tok) return null;
  const [h, p, sig] = tok.split('.');
  if (!h || !p || !sig) return null;
  let head, pay;
  try {
    head = JSON.parse(new TextDecoder().decode(b64u(h)));
    pay = JSON.parse(new TextDecoder().decode(b64u(p)));
  } catch (e) { return null; }
  const team = env.ACCESS_TEAM_DOMAIN;
  if (!team || pay.iss !== team) return null;
  if (!pay.exp || pay.exp * 1000 < Date.now()) return null;
  if (env.ACCESS_AUD && !(Array.isArray(pay.aud) ? pay.aud : [pay.aud]).includes(env.ACCESS_AUD)) return null;
  if (Date.now() - jwksCache.at > 3600 * 1000 || !jwksCache.keys.find((k) => k.kid === head.kid)) {
    const r = await fetch(`${team}/cdn-cgi/access/certs`);
    jwksCache = { at: Date.now(), keys: (await r.json()).keys || [] };
  }
  const jwk = jwksCache.keys.find((k) => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(`${h}.${p}`));
  return ok && pay.email ? normaliseEmail(pay.email) : null;
}

