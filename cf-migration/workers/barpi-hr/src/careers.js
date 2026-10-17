// ═══════════════════════════════════════════════════════════════════════════
// Barpi · Кар'єра на barpi.com.ua: публічний API вакансій і форма відгуку (17.10.2026)
// ───────────────────────────────────────────────────────────────────────────
// Копія Abris Art (abrisart-auth/src/lib/careers.js), та сама система, що в snEco; рішення Вадима 17.10.2026.
// Маршрути воркера barpi-hr: brand.barpi.ua/hr-api/public/careers* (префікс /hr-api знімає index.js).
//   GET  /api/public/careers[?lang=uk|en]   список опублікованих вакансій (без авторизації)
//   GET  /api/public/careers/<slug>         одна вакансія (також ?slug=<slug>, як у snEco)
//   POST /api/public/careers/apply          відгук із сайту (multipart/form-data)
//
// Безпека:
//   • назовні вакансія йде лише через publicVacancy(): БІЛИЙ список полів. notes, manager,
//     priority, source, внутрішні requirements, headcount, created_by тощо не віддаються ніколи,
//     навіть якщо в таблиці зʼявляться нові колонки;
//   • вилка ЗП лише коли show_salary=1 (його змінює тільки доступ hr-payroll);
//   • CORS лише для https://barpi.com.ua і https://www.barpi.com.ua (+ CAREERS_EXTRA_ORIGINS);
//   • антиспам ловить МЕХАНІКУ бота (пастка-поле, час заповнення, частота з IP), не формат імені;
//   • резюме перевіряється за сигнатурою вмісту, не лише за розширенням.
// ═══════════════════════════════════════════════════════════════════════════
import { SITE_SOURCE, isValidSlug, kyivToday } from './hr.js';

export const CAREERS_ORIGINS = ['https://barpi.com.ua', 'https://www.barpi.com.ua'];
export const CAREERS_RATE_MAX = 5;            // відгуків з однієї IP за годину
export const CV_MAX_BYTES = 10 * 1024 * 1024; // 10 МБ
const T_MIN_MS = 3000;                        // людина не заповнить форму швидше за 3 с
const T_MAX_MS = 24 * 3600 * 1000;            // сторінка, відкрита понад добу тому
const T_SKEW_MS = 5000;                       // годинник відвідувача поспішає: див. checkFormTime
const CONSENT_DAYS = 365;
export const HR_DASHBOARD_URL = 'https://brand.barpi.ua/dashboard/careers/';

function isoAddDays(iso, days) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const nowSec = () => Math.floor(Date.now() / 1000);

// ── CORS ────────────────────────────────────────────────────────────────────
export function allowedOrigins(env) {
  const extra = String(env?.CAREERS_EXTRA_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...CAREERS_ORIGINS, ...extra];
}
export function corsFor(request, env) {
  const origin = request.headers.get('Origin') || '';
  const h = {
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  if (origin && allowedOrigins(env).includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '600';
  }
  return h;
}
function json(request, env, body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsFor(request, env), ...extra },
  });
}

// ── Публічне подання вакансії (БІЛИЙ список) ────────────────────────────────
export function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*·–]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}
function salaryOf(v) {
  if (Number(v.show_salary) !== 1) return null;
  const from = Number(v.salary_from_kop) > 0 ? Math.round(Number(v.salary_from_kop) / 100) : null;
  const to = Number(v.salary_to_kop) > 0 ? Math.round(Number(v.salary_to_kop) / 100) : null;
  if (from === null && to === null) return null;
  return { from, to, currency: v.currency || 'UAH' };
}
export function publicVacancy(v) {
  return {
    id: v.id,
    slug: v.slug,
    title: v.public_title || v.title,
    region: v.region || null,
    city: v.city || null,
    work_format: v.work_format || null,
    employment_type: v.employment_type || null,
    department: v.department || null,
    lang: v.lang || 'uk',
    summary: v.summary || '',
    responsibilities: splitLines(v.responsibilities),
    requirements: splitLines(v.public_requirements),
    offer: splitLines(v.offer),
    salary: salaryOf(v),
    published_at: v.published_at ? new Date(Number(v.published_at) * 1000).toISOString() : null,
    valid_through: v.valid_through || null,
  };
}

// Вакансія видна на сайті: відкрита, опублікована, має slug і не прострочена
const LIVE_SQL = "status = 'open' AND publish_site = 1 AND slug IS NOT NULL AND (valid_through IS NULL OR valid_through = '' OR valid_through >= ?)";
export function isLive(v, today) {
  return !!v && v.status === 'open' && Number(v.publish_site) === 1 && !!v.slug && (!v.valid_through || v.valid_through >= today);
}

// ═══════════════════════════════════════════════════════════════════════════
// РОУТЕР /api/public/careers*
// deps = { sendBrandedEmail, escapeHtml, fetch }
// ═══════════════════════════════════════════════════════════════════════════
export async function handlePublicCareers(request, env, ctx, deps = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsFor(request, env) });
  }
  try {
    if (path === '/api/public/careers/apply') {
      if (request.method !== 'POST') return json(request, env, { error: 'method_not_allowed' }, 405);
      return await careersApply(request, env, ctx, deps);
    }
    if (path === '/api/public/careers') {
      if (request.method !== 'GET') return json(request, env, { error: 'method_not_allowed' }, 405);
      const slug = (url.searchParams.get('slug') || '').trim().toLowerCase();
      if (slug) return await careersOne(request, env, slug);
      return await careersList(request, env, url);
    }
    const m = path.match(/^\/api\/public\/careers\/([^/]+)$/);
    if (m) {
      if (request.method !== 'GET') return json(request, env, { error: 'method_not_allowed' }, 405);
      let slug = '';
      try { slug = decodeURIComponent(m[1]).trim().toLowerCase(); } catch (e) { slug = ''; }
      return await careersOne(request, env, slug);
    }
    return json(request, env, { error: 'not_found' }, 404);
  } catch (e) {
    const reqId = (crypto.randomUUID?.() || String(Date.now())).slice(0, 8);
    console.error(`[careers:${reqId}]`, e.message, e.stack?.slice(0, 400));
    return json(request, env, { error: 'internal', request_id: reqId }, 500);
  }
}

const CACHE_5M = { 'Cache-Control': 'public, max-age=300' };

// ── GET /api/public/careers ────────────────────────────────────────────────
async function careersList(request, env, url) {
  const today = kyivToday();
  const lang = (url.searchParams.get('lang') || '').trim().toLowerCase();
  if (lang && lang !== 'uk' && lang !== 'en') return json(request, env, { error: 'bad_lang' }, 400);
  let sql = `SELECT * FROM hr_vacancies WHERE ${LIVE_SQL}`;
  const binds = [today];
  // мова тексту вакансії: старі записи без lang вважаються українськими, як і в publicVacancy
  if (lang === 'uk') sql += " AND (lang = 'uk' OR lang IS NULL OR lang = '')";
  else if (lang === 'en') { sql += ' AND lang = ?'; binds.push('en'); }
  sql += ' ORDER BY published_at DESC, id DESC LIMIT 200';
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return json(request, env, { updated_at: new Date().toISOString(), vacancies: (results || []).map(publicVacancy) }, 200, CACHE_5M);
}

// ── GET /api/public/careers/<slug> ─────────────────────────────────────────
async function careersOne(request, env, slug) {
  if (!isValidSlug(slug)) return json(request, env, { error: 'not_found' }, 404, CACHE_5M);
  const v = await env.DB.prepare(`SELECT * FROM hr_vacancies WHERE slug = ? AND ${LIVE_SQL}`).bind(slug, kyivToday()).first();
  if (!v) return json(request, env, { error: 'not_found' }, 404, CACHE_5M);
  return json(request, env, { updated_at: new Date().toISOString(), vacancy: publicVacancy(v) }, 200, CACHE_5M);
}

// ── Антиспам ───────────────────────────────────────────────────────────────
// bp_t: мітка часу (мс), яку JS сторінки ставить при показі форми. Бот без JS її не має;
// бот, що відправляє одразу, має вік < 3 с. Годинник відвідувача може поспішати: тоді вік
// відʼємний. Явно «з майбутнього» (понад 5 с) приймаємо; бот, що підставляє Date.now(),
// дає вік ≈ 0 і відсікається.
export function checkFormTime(raw, nowMs = Date.now()) {
  const t = Number(String(raw || '').trim());
  if (!Number.isFinite(t) || t <= 0) return false;
  const age = nowMs - t;
  if (age >= T_MIN_MS && age <= T_MAX_MS) return true;
  if (age <= -T_SKEW_MS && age >= -T_MAX_MS) return true;
  return false;
}

async function rateCount(env, key) {
  if (!env.OTP_KV) return 0;
  try { return parseInt((await env.OTP_KV.get(key)) || '0', 10) || 0; } catch (e) { return 0; }
}
async function rateBump(env, ctx, key, current) {
  if (!env.OTP_KV) return;
  const p = Promise.resolve(env.OTP_KV.put(key, String(current + 1), { expirationTtl: 3600 })).catch(() => {});
  if (ctx?.waitUntil) ctx.waitUntil(p); else await p;
}

// ── Резюме: розширення + сигнатура вмісту ──────────────────────────────────
const CV_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
};
function bytesHave(bytes, ascii, from = 0, to = bytes.length) {
  const n = ascii.length;
  const end = Math.min(to, bytes.length) - n;
  outer: for (let i = from; i <= end; i++) {
    for (let j = 0; j < n; j++) if (bytes[i + j] !== ascii.charCodeAt(j)) continue outer;
    return true;
  }
  return false;
}
// mime або null. Розширення має збігатися з тим, що всередині файлу.
export function sniffCv(filename, bytes) {
  const ext = (String(filename || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  if (!CV_TYPES[ext] || !bytes || bytes.length < 8) return null;
  const startsWith = (arr) => arr.every((b, i) => bytes[i] === b);
  const isZip = startsWith([0x50, 0x4b, 0x03, 0x04]);
  switch (ext) {
    case 'pdf': return bytesHave(bytes, '%PDF-', 0, 1024) ? CV_TYPES.pdf : null;
    case 'doc': return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) ? CV_TYPES.doc : null;
    case 'rtf': return bytesHave(bytes, '{\\rtf', 0, 8) ? CV_TYPES.rtf : null;
    case 'docx': return isZip && bytesHave(bytes, 'word/') ? CV_TYPES.docx : null;
    case 'odt': return isZip && bytesHave(bytes, 'application/vnd.oasis.opendocument.text', 0, 200) ? CV_TYPES.odt : null;
    default: return null;
  }
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Перевірка полів форми без БД і файлу (окремо, щоб тестувати).
// get(name) → рядок. Повертає { ok:true, data } або { ok:false, status, error }.
export function validateApplyFields(get, nowMs = Date.now()) {
  if (get('website').trim() !== '' || !checkFormTime(get('bp_t'), nowMs)) return { ok: false, status: 400, error: 'bot_check', bot: true };
  if (get('consent') !== '1') return { ok: false, status: 400, error: 'consent_required' };
  const fullName = str(get('full_name'), 200);
  if (!fullName) return { ok: false, status: 400, error: 'missing_name' };
  const email = str(get('email'), 200).toLowerCase();
  const phone = str(get('phone'), 60);
  if (!email && !phone) return { ok: false, status: 400, error: 'missing_contact' };
  if (email && !RE_EMAIL.test(email)) return { ok: false, status: 400, error: 'bad_email' };
  const message = get('message').trim();
  if (message.length > 2000) return { ok: false, status: 400, error: 'message_too_long' };
  const linkedin = str(get('linkedin'), 300);
  if (linkedin && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(linkedin)) return { ok: false, status: 400, error: 'bad_linkedin' };
  const slug = str(get('vacancy_slug'), 80).toLowerCase();
  if (slug && !isValidSlug(slug)) return { ok: false, status: 404, error: 'vacancy_not_found' };
  return { ok: true, data: { fullName, email, phone, message, linkedin, slug } };
}

// ── POST /api/public/careers/apply ─────────────────────────────────────────
async function careersApply(request, env, ctx, deps) {
  const J = (b, s = 200) => json(request, env, b, s);
  // Чужий сайт не має права слати форму від імені браузера відвідувача
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins(env).includes(origin)) return J({ error: 'origin_not_allowed' }, 403);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `rl:careers:ip:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const used = await rateCount(env, rlKey);
  if (used >= CAREERS_RATE_MAX) return J({ error: 'too_many_requests', retry_after_seconds: 3600 }, 429);

  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > CV_MAX_BYTES + 256 * 1024) return J({ error: 'file_too_large' }, 413);

  let form;
  try { form = await request.formData(); } catch (e) { return J({ error: 'bad_request' }, 400); }
  const get = (k) => { const v = form.get(k); return typeof v === 'string' ? v : ''; };

  // 1–2. Механіка бота і дані. Спроби бота теж рахуються в ліміт.
  const val = validateApplyFields(get);
  if (!val.ok) {
    if (val.bot) await rateBump(env, ctx, rlKey, used);
    return J({ error: val.error }, val.status);
  }
  const { fullName, email, phone, message: messageRaw, linkedin, slug } = val.data;

  // 3. Вакансія
  const today = kyivToday();
  let vac = null;
  if (slug) {
    vac = await env.DB.prepare('SELECT * FROM hr_vacancies WHERE slug = ?').bind(slug).first();
    if (!vac) return J({ error: 'vacancy_not_found' }, 404);
    if (!isLive(vac, today)) return J({ error: 'vacancy_closed' }, 410);
  }

  // 4. Резюме (необовʼязкове)
  let cv = null;
  const file = form.get('cv');
  if (file && typeof file === 'object' && typeof file.arrayBuffer === 'function' && file.size > 0) {
    if (file.size > CV_MAX_BYTES) return J({ error: 'file_too_large' }, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fname = String(file.name || 'cv').slice(0, 120);
    const mime = sniffCv(fname, bytes);
    if (!mime) return J({ error: 'bad_file_type' }, 415);
    if (!env.FILES_BUCKET) return J({ error: 'storage_unavailable' }, 503);
    cv = { bytes, fname, mime };
  }

  // 5. Запис у воронку (є вакансія) або в Talent pool (загальна анкета)
  const now = nowSec();
  const notes = messageRaw ? `Повідомлення з сайту:\n${messageRaw}` : null;
  let kind, rowId, fileTable, fileFk, keyPrefix;
  if (vac) {
    const res = await env.DB.prepare(
      `INSERT INTO hr_candidates (full_name, vacancy_id, position, company, department, source, stage, email, phone, linkedin,
         first_contact_date, notes, consent_at, stage_changed_at, created_at, updated_at, created_by, updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(fullName, vac.id, vac.title, vac.company || null, vac.department || null, SITE_SOURCE, 'new',
      email || null, phone || null, linkedin || null, today, notes, now, now, now, now, 'website', 'website').run();
    rowId = res.meta.last_row_id;
    kind = 'candidate'; fileTable = 'hr_files'; fileFk = 'candidate_id'; keyPrefix = `hr/cv/${rowId}/`;
    await env.DB.prepare('INSERT INTO hr_candidate_events (candidate_id, from_stage, to_stage, at, actor_email, note) VALUES (?,?,?,?,?,?)')
      .bind(rowId, null, 'new', now, 'website', 'Відгук із сайту barpi.com.ua').run();
  } else {
    const res = await env.DB.prepare(
      `INSERT INTO hr_talent_pool (full_name, reason, temperature, status, source, email, phone, linkedin, notes,
         last_contact_date, next_contact_date, consent_until, consent_at, created_at, updated_at, created_by, updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(fullName, 'website', 'warm', 'active', SITE_SOURCE, email || null, phone || null, linkedin || null, notes,
      today, today, isoAddDays(today, CONSENT_DAYS), now, now, now, 'website', 'website').run();
    rowId = res.meta.last_row_id;
    kind = 'talent'; fileTable = 'hr_talent_files'; fileFk = 'talent_id'; keyPrefix = `hr/cv/tp-${rowId}/`;
  }

  if (cv) {
    const safe = cv.fname.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 60);
    const rnd = Math.random().toString(36).slice(2, 10);
    const key = `${keyPrefix}${Date.now().toString(36)}-${rnd}-${safe}`;
    try {
      await env.FILES_BUCKET.put(key, cv.bytes, { httpMetadata: { contentType: cv.mime } });
      await env.DB.prepare(
        `INSERT INTO ${fileTable} (${fileFk}, filename, r2_key, size_bytes, mime, kind, uploaded_by, uploaded_at) VALUES (?,?,?,?,?,?,?,?)`
      ).bind(rowId, cv.fname, key, cv.bytes.length, cv.mime, 'cv', 'website', now).run();
    } catch (e) {
      // Резюме не збереглось: прибираємо запис, щоб людина надіслала ще раз, а не думала, що все дійшло
      console.error('[careers/apply] cv store failed:', e.message);
      try { await env.FILES_BUCKET.delete(key); } catch (e2) { /* нічого */ }
      if (kind === 'candidate') {
        await env.DB.prepare('DELETE FROM hr_candidate_events WHERE candidate_id = ?').bind(rowId).run();
        await env.DB.prepare('DELETE FROM hr_candidates WHERE id = ?').bind(rowId).run();
      } else {
        await env.DB.prepare('DELETE FROM hr_talent_pool WHERE id = ?').bind(rowId).run();
      }
      return J({ error: 'upload_failed' }, 500);
    }
  }

  try {
    await env.DB.prepare('INSERT INTO hr_audit_log (entity, entity_id, action, diff, actor_email, at) VALUES (?,?,?,?,?,?)')
      .bind(kind, rowId, 'create', JSON.stringify({ via: 'website', source: SITE_SOURCE, vacancy_id: vac?.id || null, has_cv: !!cv }), 'website', now).run();
  } catch (e) { /* аудит не має ламати відгук */ }
  await rateBump(env, ctx, rlKey, used);

  const notify = notifyHr(env, deps, {
    kind, id: rowId, vacancyTitle: vac ? (vac.public_title || vac.title) : null,
    fullName, email, phone, linkedin, message: messageRaw, hasCv: !!cv,
  }).then(async (out) => {
    // Слід доставки в журналі: без нього збій листа чи Telegram не видно (send_email мовчить у логах)
    try {
      await env.DB.prepare('INSERT INTO hr_audit_log (entity, entity_id, action, diff, actor_email, at) VALUES (?,?,?,?,?,?)')
        .bind(kind, rowId, 'notify', JSON.stringify(out || {}), 'website', nowSec()).run();
    } catch (e) { /* журнал не має ламати відгук */ }
  }).catch((e) => console.error('[careers/apply] notify failed:', e.message));
  if (ctx?.waitUntil) ctx.waitUntil(notify); else await notify;

  return J({ ok: true }, 200);
}

// ── Сповіщення (рішення Вадима 17.10.2026: Олександр, Вадим, office@) ──────────
// Telegram: усі чати з секрету HR_TG_CHATS (через кому), бот TG_TOKEN (@barpiua_bot).
//   Бот не пише першим: людина має один раз натиснути Start, тоді її chat_id додається в секрет.
// Лист: binding HR_MAIL (Cloudflare Email Routing, send_email) на HR_NOTIFY_EMAIL (office@barpi.ua).
//   Відправник — адреса домену з Email Routing (HR_MAIL_FROM), отримувач має бути
//   підтвердженою адресою Email Routing, інакше send() кидає помилку (логуємо, відгук не ламаємо).
// Обидва канали незалежні: збій одного не скасовує інший.
export function hrNotifyChats(env) {
  return String(env?.HR_TG_CHATS || '').split(',').map((s) => s.trim()).filter(Boolean);
}
export function buildHrTelegramText(a, esc) {
  const L = [
    `🐾 <b>Новий відгук із сайту barpi.com.ua</b>`,
    a.vacancyTitle ? `📌 ${esc(a.vacancyTitle)}` : `💎 Загальна анкета · додано в Talent pool`,
    `👤 ${esc(a.fullName)}`,
  ];
  if (a.phone) L.push(`📞 <code>${esc(a.phone)}</code>`);
  if (a.email) L.push(`✉️ <code>${esc(a.email)}</code>`);
  if (a.linkedin) L.push(`🔗 ${esc(a.linkedin)}`);
  L.push(a.hasCv ? '📎 Резюме прикріплено' : '📎 Без резюме');
  if (a.message) L.push(`💬 ${esc(a.message.slice(0, 300))}${a.message.length > 300 ? '…' : ''}`);
  L.push(`➡️ ${HR_DASHBOARD_URL}`);
  return L.join('\n');
}

const b64utf8 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
const wrap76 = (b) => b.replace(/.{1,76}/g, (m) => m + '\r\n');
export function buildHrMailRaw(a, esc, from, to, nowDate = new Date()) {
  const rows = [
    ['Вакансія', a.vacancyTitle || 'Загальна анкета (Talent pool)'],
    ['Імʼя', a.fullName], ['Телефон', a.phone], ['Email', a.email], ['LinkedIn', a.linkedin],
    ['Резюме', a.hasCv ? 'прикріплено, відкривається в дашборді' : 'немає'],
  ].filter(([, v]) => v);
  const html = `<div style="font-family:Arial,sans-serif;color:#001154"><h2 style="margin:0 0 12px">Новий відгук із сайту barpi.com.ua</h2>`
    + `<table style="font-size:14px;line-height:1.5">${rows.map(([k, v]) => `<tr><td style="color:#888;padding:2px 12px 2px 0">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`
    + (a.message ? `<p style="font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(a.message)}</p>` : '')
    + `<p><a href="${HR_DASHBOARD_URL}" style="display:inline-block;background:#001154;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Відкрити дашборд «Кар'єра»</a></p></div>`;
  const subject = `Новий відгук із сайту: ${a.vacancyTitle || 'загальна анкета'}`;
  const id = `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}@barpi.com.ua>`;
  return [
    `From: Barpi Кар'єра <${from}>`.replace(/^From: (.*) </, (m, n) => `From: =?UTF-8?B?${b64utf8(n)}?= <`),
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64utf8(subject)}?=`,
    `Date: ${nowDate.toUTCString()}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64utf8(html)),
  ].join('\r\n');
}

export async function notifyHr(env, deps, a) {
  const esc = deps.escapeHtml || ((s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const doFetch = deps.fetch || fetch;
  const out = { telegram: 0, email: false };
  const token = env.TG_TOKEN || '';
  const text = buildHrTelegramText(a, esc);
  for (const chat of hrNotifyChats(env)) {
    if (!token) break;
    try {
      const r = await doFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      if (r && r.body && r.body.cancel) await r.body.cancel();
      if (r && r.ok) out.telegram++; else console.error('[careers/notify] telegram HTTP', r && r.status);
    } catch (e) { console.error('[careers/notify] telegram failed:', e.message); }
  }
  const to = String(env.HR_NOTIFY_EMAIL || '').trim();
  const from = String(env.HR_MAIL_FROM || '').trim();
  if (env.HR_MAIL && to && from && deps.EmailMessage) {
    try {
      await env.HR_MAIL.send(new deps.EmailMessage(from, to, buildHrMailRaw(a, esc, from, to)));
      out.email = true;
    } catch (e) { out.email_error = String(e && e.message || e).slice(0, 200); console.error('[careers/notify] email failed:', e.message); }
  }
  return out;
}
