// ═══════════════════════════════════════════════════════════════════════════
// barpi-hr · найм і кар'єра Barpi (рішення Вадима 17.10.2026: «повтори повністю
// функціонал» розділів кар'єри snEco і Abris Art).
//   brand.barpi.ua/dashboard/api/hr/*         API дашборда /dashboard/careers/ (за Cloudflare Access;
//                                             воркер додатково перевіряє підпис JWT Access)
//   brand.barpi.ua/hr-api/public/careers*     публічний API для barpi.com.ua/kariera/ (CORS лише barpi.com.ua)
// D1 barpi-bible (таблиці hr_*, migrations/0001_hr_hiring.sql), R2 barpi-hr-files (резюме),
// KV barpi-bible-acl (ліміти частоти). Логіка — src/hr.js і src/careers.js (копія Abris Art).
// ═══════════════════════════════════════════════════════════════════════════
import { EmailMessage } from 'cloudflare:email';
import { handleHrApi } from './hr.js';
import { handlePublicCareers } from './careers.js';
import { getBearer, wrapWhitelist } from './access.js';

const VERSION = '1.0.0';

const normaliseEmail = (e) => String(e || '').trim().toLowerCase();

function jsonResp(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
async function readJson(request) {
  try { return await request.json(); } catch (e) { return null; }
}
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/hr-api/healthz') return jsonResp({ ok: true, service: 'barpi-hr', version: VERSION });
      if (path === '/hr-api/public/careers' || path.startsWith('/hr-api/public/careers/')) {
        const inner = new Request(new URL(path.replace(/^\/hr-api/, '/api') + url.search, url.origin), request);
        return await handlePublicCareers(inner, env, ctx, { escapeHtml, fetch, EmailMessage });
      }
      if (path.startsWith('/dashboard/api/hr/')) {
        const apiPath = path.replace(/^\/dashboard/, '');
        const p = await getBearer(request, env);
        const deps = {
          getBearer: async () => p,
          getWhitelist: wrapWhitelist(p ? p.email : ''),
          jsonResp, readJson, normaliseEmail,
        };
        return await handleHrApi(apiPath, request, env, ctx, deps);
      }
      return jsonResp({ error: 'not_found' }, 404);
    } catch (e) {
      const reqId = (crypto.randomUUID?.() || String(Date.now())).slice(0, 8);
      console.error(`[barpi-hr:${reqId}]`, e.message, e.stack?.slice(0, 400));
      return jsonResp({ error: 'internal', request_id: reqId }, 500);
    }
  },
};
