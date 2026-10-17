// node --test cf-migration/workers/barpi-hr/tests/hr-careers.test.mjs   (Node 22.5+: вбудований node:sqlite як замінник D1)
// Barpi · найм і кар'єра (17.10.2026). Перевіряє: міграції двічі поспіль, білий список публічних полів,
// форму відгуку (антиспам, згода, контакти, резюме за вмістом), CORS лише barpi.com.ua,
// сповіщення (усі чати Telegram + лист), доступ до /api/hr/* через Cloudflare Access і списки.
// Мережі немає: fetch і пошта підмінені.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handlePublicCareers, publicVacancy, sniffCv, checkFormTime, notifyHr, hrNotifyChats, buildHrTelegramText, buildHrMailRaw } from '../src/careers.js';
import { handleHrApi } from '../src/hr.js';
import { getBearer, wrapWhitelist, accessUser } from '../src/access.js';

const M1 = readFileSync(new URL('../migrations/0001_hr_hiring.sql', import.meta.url), 'utf8');
const M2 = readFileSync(new URL('../migrations/0002_seed_sales_manager.sql', import.meta.url), 'utf8');

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const fix = (a) => a.map((x) => (x === undefined ? null : x));
  const stmt = (sql) => {
    let args = [];
    const st = {
      bind(...a) { args = fix(a); return st; },
      async run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; },
      async first() { return db.prepare(sql).get(...args) || null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
    };
    return st;
  };
  return { db, prepare: stmt, batch: async (sts) => Promise.all(sts.map((s) => s.run())) };
}
function kv() { const m = new Map(); return { m, async get(k) { return m.get(k) ?? null; }, async put(k, v) { m.set(k, v); } }; }
function r2() { const m = new Map(); return { m, async put(k, v) { m.set(k, v); }, async get(k) { return m.has(k) ? { body: m.get(k) } : null; }, async delete(k) { m.delete(k); } }; }
function env(extra = {}) {
  const e = { DB: d1(), OTP_KV: kv(), FILES_BUCKET: r2(), ...extra };
  e.DB.db.exec(M1); e.DB.db.exec(M2);
  return e;
}
const ctx = () => ({ waitUntil() {} });
const jsonResp = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const readJson = async (r) => { try { return await r.json(); } catch (e) { return null; } };
const norm = (e) => String(e || '').trim().toLowerCase();

test('міграції ідемпотентні і створюють опубліковану вакансію', () => {
  const e = env();
  e.DB.db.exec(M1); e.DB.db.exec(M2);   // вдруге: не падає і не дублює
  const rows = e.DB.db.prepare("SELECT slug, publish_site, status, show_salary FROM hr_vacancies").all();
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0] }, { slug: 'menedzher-z-prodazhu', publish_site: 1, status: 'open', show_salary: 0 });
  assert.equal(e.DB.db.prepare("SELECT count(*) n FROM hr_dict WHERE kind='source' AND value='Сайт'").get().n, 1);
});

test('publicVacancy: лише білий список, без внутрішніх полів і без зарплати', () => {
  const v = publicVacancy({ id: 1, slug: 's-1', title: 'T', notes: 'СЕКРЕТ', manager: 'Хтось', requirements: 'ВНУТР', priority: 'high', salary_from_kop: 4000000, show_salary: 0, responsibilities: '- a\n• b' });
  const s = JSON.stringify(v);
  for (const bad of ['СЕКРЕТ', 'Хтось', 'ВНУТР', 'high', '40000']) assert.ok(!s.includes(bad), bad);
  assert.deepEqual(v.responsibilities, ['a', 'b']);
  assert.equal(v.salary, null);
});

test('антиспам і резюме за вмістом', () => {
  const now = Date.now();
  assert.equal(checkFormTime(String(now - 10000), now), true);
  assert.equal(checkFormTime(String(now - 500), now), false);
  assert.equal(checkFormTime('', now), false);
  const pdf = new TextEncoder().encode('%PDF-1.4 xxxxxxxx');
  assert.equal(sniffCv('cv.pdf', pdf), 'application/pdf');
  assert.equal(sniffCv('cv.docx', pdf), null);
  assert.equal(sniffCv('cv.exe', pdf), null);
});

function applyReq(fields, file, origin = 'https://barpi.com.ua', ip = '1.2.3.4') {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (file) fd.set('cv', file);
  return new Request('https://brand.barpi.ua/api/public/careers/apply', { method: 'POST', body: fd, headers: { Origin: origin, 'CF-Connecting-IP': ip } });
}
const ok = (over = {}) => ({ website: '', bp_t: String(Date.now() - 8000), consent: '1', full_name: 'Олена Коваль', email: 'olena@example.com', ...over });

test('GET /api/public/careers: CORS лише для barpi.com.ua, вакансія за slug', async () => {
  const e = env();
  let r = await handlePublicCareers(new Request('https://x/api/public/careers', { headers: { Origin: 'https://barpi.com.ua' } }), e, ctx());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://barpi.com.ua');
  assert.equal((await r.json()).vacancies.length, 1);
  r = await handlePublicCareers(new Request('https://x/api/public/careers', { headers: { Origin: 'https://evil.example' } }), e, ctx());
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
  r = await handlePublicCareers(new Request('https://x/api/public/careers/menedzher-z-prodazhu'), e, ctx());
  assert.equal((await r.json()).vacancy.title, 'Менеджер з продажу');
});

test('POST apply: кандидат у воронку з резюме, загальна анкета в Talent pool, захисти', async () => {
  const sent = [];
  const e = env({ TG_TOKEN: 'T', HR_TG_CHATS: '111, 222', HR_MAIL: { send: async (m) => sent.push(m) }, HR_MAIL_FROM: 'careers@barpi.com.ua', HR_NOTIFY_EMAIL: 'office@barpi.ua' });
  const calls = [];
  const deps = { fetch: async (u, o) => { calls.push(JSON.parse(o.body).chat_id); return new Response('{}'); }, EmailMessage: class { constructor(f, t, raw) { Object.assign(this, { f, t, raw }); } } };
  const pdf = new File([new TextEncoder().encode('%PDF-1.4 test file body')], 'cv.pdf', { type: 'application/pdf' });
  let r = await handlePublicCareers(applyReq(ok({ vacancy_slug: 'menedzher-z-prodazhu' }), pdf), e, ctx(), deps);
  assert.equal(r.status, 200, await r.clone().text());
  const c = e.DB.db.prepare('SELECT * FROM hr_candidates').get();
  assert.equal(c.source, 'Сайт'); assert.equal(c.stage, 'new');
  assert.equal(e.DB.db.prepare('SELECT count(*) n FROM hr_files').get().n, 1);
  assert.equal(e.FILES_BUCKET.m.size, 1);
  assert.deepEqual(calls, ['111', '222']);
  assert.equal(sent.length, 1); assert.equal(sent[0].t, 'office@barpi.ua');

  r = await handlePublicCareers(applyReq(ok({ email: 'pool@example.com' })), e, ctx(), deps);
  assert.equal(r.status, 200);
  assert.equal(e.DB.db.prepare("SELECT reason FROM hr_talent_pool").get().reason, 'website');

  assert.equal((await handlePublicCareers(applyReq(ok({ consent: '' })), e, ctx(), deps)).status, 400);
  assert.equal((await handlePublicCareers(applyReq(ok({ email: '', phone: '' })), e, ctx(), deps)).status, 400);
  assert.equal((await handlePublicCareers(applyReq(ok({ website: 'spam' })), e, ctx(), deps)).status, 400);
  assert.equal((await handlePublicCareers(applyReq(ok(), null, 'https://evil.example'), e, ctx(), deps)).status, 403);
  const fake = new File([new TextEncoder().encode('MZ not a pdf at all')], 'cv.pdf');
  assert.equal((await handlePublicCareers(applyReq(ok(), fake, 'https://barpi.com.ua', '9.9.9.9'), e, ctx(), deps)).status, 415);
  for (let i = 0; i < 5; i++) await handlePublicCareers(applyReq(ok({ full_name: 'N' + i }), null, 'https://barpi.com.ua', '5.5.5.5'), e, ctx(), deps);
  assert.equal((await handlePublicCareers(applyReq(ok(), null, 'https://barpi.com.ua', '5.5.5.5'), e, ctx(), deps)).status, 429);
});

test('сповіщення: один канал падає, другий однаково йде; текст і лист про Barpi', async () => {
  assert.deepEqual(hrNotifyChats({ HR_TG_CHATS: ' 1 ,2,, ' }), ['1', '2']);
  const sent = [];
  const out = await notifyHr({ TG_TOKEN: 'T', HR_TG_CHATS: '1', HR_MAIL: { send: async (m) => sent.push(m) }, HR_MAIL_FROM: 'a@barpi.com.ua', HR_NOTIFY_EMAIL: 'office@barpi.ua' },
    { fetch: async () => { throw new Error('network'); }, EmailMessage: class { constructor(f, t, raw) { this.raw = raw; } } }, { fullName: 'A', hasCv: false });
  assert.deepEqual(out, { telegram: 0, email: true });
  const esc = (s) => String(s);
  assert.ok(buildHrTelegramText({ fullName: 'A' }, esc).includes('barpi.com.ua'));
  const raw = buildHrMailRaw({ fullName: 'A', vacancyTitle: 'B' }, esc, 'a@barpi.com.ua', 'office@barpi.ua');
  assert.match(raw, /^From: =\?UTF-8\?B\?/); assert.match(raw, /\r\nTo: office@barpi\.ua\r\n/);
});

async function hr(path, e, email, body = {}) {
  const req = new Request('https://brand.barpi.ua' + path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  const p = email ? { email, block: 'hr', isAdmin: (e.HR_ADMIN_EMAILS || '').includes(email) } : null;
  return handleHrApi(path, req, e, ctx(), { getBearer: async () => p, getWhitelist: wrapWhitelist(email || ''), jsonResp, readJson, normaliseEmail: norm });
}

test('/api/hr/*: без Access 401; HR_EMAILS обмежує; зарплати лише з payroll', async () => {
  const e = env({ HR_ADMIN_EMAILS: 'vg@abrisart.com' });
  assert.equal((await hr('/api/hr/bootstrap', e, null)).status, 401);
  let j = await (await hr('/api/hr/bootstrap', e, 'office@barpi.com.ua')).json();
  assert.equal(j.ok, true); assert.equal(j.me.canPayroll, false);
  assert.ok(!('salary_from_kop' in j.vacancies[0]));
  e.HR_EMAILS = 'aksonov@barpi.com.ua';
  assert.equal((await hr('/api/hr/bootstrap', e, 'office@barpi.com.ua')).status, 403);
  assert.equal((await hr('/api/hr/bootstrap', e, 'aksonov@barpi.com.ua')).status, 200);
  j = await (await hr('/api/hr/bootstrap', e, 'vg@abrisart.com')).json();
  assert.equal(j.me.canPayroll, true); assert.ok('salary_from_kop' in j.vacancies[0]);
});

test('accessUser: без JWT null; DEV-обхід лише з ACCESS_TEAM_DOMAIN=dev', async () => {
  const req = new Request('https://brand.barpi.ua/dashboard/api/hr/bootstrap');
  assert.equal(await accessUser(req, { ACCESS_TEAM_DOMAIN: 'https://uabarpi.cloudflareaccess.com', DEV_ACCESS_EMAIL: 'x@y.z' }), null);
  assert.equal(await accessUser(req, { ACCESS_TEAM_DOMAIN: 'dev', DEV_ACCESS_EMAIL: 'x@y.z' }), 'x@y.z');
  const forged = new Request(req.url, { headers: { 'Cf-Access-Jwt-Assertion': 'a.b.c' } });
  assert.equal(await accessUser(forged, { ACCESS_TEAM_DOMAIN: 'https://uabarpi.cloudflareaccess.com' }), null);
  assert.equal(await getBearer(req, { ACCESS_TEAM_DOMAIN: 'https://uabarpi.cloudflareaccess.com' }), null);
});
