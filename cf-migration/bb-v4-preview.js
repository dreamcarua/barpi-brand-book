/* ============================================================
   Barpi Brand Bible v4.0 PREVIEW — Cloudflare D1 backend
   ⚠️ DO NOT COPY до assets/bb.js поки CF Access не налаштований
       і barpi-api Worker не deployed!

   Зміни vs v3.3:
   - ❌ Прибрано BB.AUTH цілком (Magic Link + Google OAuth)
   - ❌ Прибрано BB.SUPABASE_URL / BB.SUPABASE_ANON
   - ✅ Додано BB.API_URL → CF Worker barpi-api
   - ✅ BB.api() використовує credentials:'include' для CF Access cookie
   - ✅ Дашборди тягнуть з нового endpoint
   - ✅ brand_ideas — POST/PATCH/GET через Worker
   ============================================================ */

const BB = window.BB = window.BB || {};

// ⚠️ Заміни на справжній subdomain після `wrangler deploy`
BB.API_URL = 'https://barpi-api.YOUR-SUBDOMAIN.workers.dev';
// Або custom domain (якщо налаштований DNS):
// BB.API_URL = 'https://api.barpi.ua';

BB.LOGO_DATA = 'data:image/webp;base64,...';  // ← скопіювати з поточної bb.js

/* ============================================================
   BB.api — новий REST proxy до D1 Worker
   ============================================================ */
BB.api = function(path, opts = {}) {
  return fetch(BB.API_URL + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    },
    credentials: 'include',  // CF Access JWT cookie sent automatically
  });
};

/* ============================================================
   BB.AUTH — ВИДАЛЕНО ПОВНІСТЮ
   Тепер auth робить Cloudflare Access на edge
   (Application: brand.barpi.ua/dashboard/*)

   Якщо user на /dashboard/* без CF Access cookie:
   - CF перехоплює запит
   - Показує сторінку логіну CF Access
   - User обирає Google → Google OAuth → CF callback
   - CF перевіряє email allowlist
   - Set CF_Authorization cookie (7 days)
   - Forward request to brand.barpi.ua

   Frontend нічого про auth не знає — все на edge level.
   ============================================================ */

/* ============================================================
   Sidebar / Lang / Mobile Menu — без змін (як у v3.3)
   ============================================================ */
BB.SIDEBAR_HTML = `...`;  // ← скопіювати з v3.3
BB.injectSidebar = function() { /* як у v3.3 */ };
BB.setLang = function(lang) { /* як у v3.3 */ };
BB.initLang = function() { /* як у v3.3 */ };
BB.markActiveNav = function() { /* як у v3.3 */ };
BB.initMobileMenu = function() { /* як у v3.3 */ };
BB.SEARCH_INDEX = [/* як у v3.3 */];
BB.initSearch = function() { /* як у v3.3 */ };

/* ============================================================
   Ideas API — оновлено для нового endpoint
   ============================================================ */
BB.loadIdeas = async function(filter = 'all') {
  const q = filter !== 'all' ? `?status=${filter}` : '';
  try {
    const r = await BB.api('/brand_ideas' + q);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) { console.error('Load ideas:', e); return []; }
};

BB.submitIdea = async function(data) {
  try {
    const r = await BB.api('/brand_ideas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!r.ok) { console.error(await r.text()); return null; }
    return await r.json();
  } catch (e) { return null; }
};

BB.upvoteIdea = async function(id, current) {
  try {
    const r = await BB.api(`/brand_ideas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ upvotes: (current || 0) + 1 }),
    });
    return r.ok;
  } catch (e) { return false; }
};

BB.renderIdeas = async function(filter = 'all') {
  /* без змін — використовує BB.loadIdeas вище */
};

/* ============================================================
   Topnav для дашбордів — без змін
   Auth badge ВИДАЛЕНО (CF Access сам показує user info)
   ============================================================ */
BB.DASHBOARD_LINKS = [/* як у v3.3 */];
BB.injectDashboardTopnav = function() { /* як у v3.3, без injectUserBadge */ };

/* ============================================================
   Init — спрощено
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  if (location.pathname.startsWith('/dashboard/')) {
    // No prelock + requireAuth needed — CF Access handles it
    BB.injectDashboardTopnav();
  }
  BB.injectSidebar();
  BB.initLang();
  BB.markActiveNav();
  BB.initSearch();
  BB.initMobileMenu();
  if (document.getElementById('ideas-list')) {
    BB.renderIdeas();
    BB.initIdeasForm();
  }
});

/* ============================================================
   ПРИМІТКИ для cutover:

   1. Дашборди (/dashboard/customer-360/index.html, etc.) — деякі
      використовують `BB.SUPABASE_URL + '/rest/v1/v_customer_metrics?...'`
      ПРЯМО (не через BB.api). Треба знайти і замінити на BB.API_URL.

      Якщо в дашборді є:
        const URL = 'https://zrcqmwlpsggiqgipvxhv.supabase.co/rest/v1/v_pnl_monthly?...';
        const APIKEY = 'eyJhbGc...';
        fetch(URL, { headers: { apikey: APIKEY, Authorization: ... } })

      → ЗАМІНИТИ на:
        const URL = 'https://barpi-api.YOUR-SUB.workers.dev/v_pnl_monthly?...';
        fetch(URL, { credentials: 'include' })

   2. У PostgREST `?col=eq.value` — Worker підтримує тот же синтаксис
      (написано спеціально для backward-compat). Більшість fetch URL
      будуть працювати з простою заміною домену.

   3. `?limit=100&offset=0&order=col.desc` — також підтримується.

   4. /auth-callback/ і AUTH_SETUP.md і GOOGLE_OAUTH_SETUP.md — можна
      видалити після успішного cutover.
   ============================================================ */
