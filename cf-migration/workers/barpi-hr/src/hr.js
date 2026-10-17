// ═══════════════════════════════════════════════════════════════════════════
// Barpi · HR · найм: API дашборда brand.barpi.ua/dashboard/careers/ (17.10.2026)
// ───────────────────────────────────────────────────────────────────────────
// Копія Abris Art (abrisart-auth/src/lib/hr.js), яка є копією snEco (sneco-auth/src/hr.js v2.81.2).
// Рішення Вадима 17.10.2026: «повтори повністю функціонал».
// Цієї фази: вакансії (з публікацією на barpi.com.ua), кандидати і воронка, Talent pool,
// файли кандидата (R2), канали і витрати на них, довідники, журнал змін.
// НЕ цієї фази: співробітники, фонд оплати праці, плинність (hr_employees, hr_payroll …).
//
// Доступ (перевіряється на КОЖНОМУ запиті, бо JWT живе 30 днів):
//   • Barpi: вхід дає Cloudflare Access (той самий allowlist, що й увесь /dashboard/*), воркер
//     сам перевіряє підпис JWT Access (index.js → accessUser). Далі: email у HR_EMAILS (секрет,
//     порожній = усі, хто пройшов Access) або адмін (HR_ADMIN_EMAILS);
//   • суми зарплат (вилки вакансій, очікування кандидатів) і прапорець show_salary:
//     лише адміни і HR_PAYROLL_EMAILS. Зарплатні поля вирізаються НА СЕРВЕРІ.
// Усі записи йдуть у hr_audit_log.
// ═══════════════════════════════════════════════════════════════════════════

export const HR_BLOCK = 'hr';
export const HR_PAYROLL_LIST = 'hr-payroll';

export const HR_STAGES = [
  'new', 'screening', 'hr_interview', 'mgr_interview',
  'offer', 'offer_accepted', 'hired', 'offer_declined', 'rejected',
];
export const HR_STAGES_CLOSED = ['hired', 'offer_declined', 'rejected'];

const VAC_STATUS   = ['open', 'on_hold', 'closed', 'cancelled'];
const VAC_PRIORITY = ['low', 'normal', 'high', 'critical'];
const CURRENCIES   = ['UAH', 'EUR', 'USD', 'PLN'];
const TP_REASON = ['finalist', 'declined_offer', 'no_vacancy', 'referral', 'sourced', 'former_employee', 'website', 'other'];
const TP_TEMP   = ['hot', 'warm', 'cold'];
const TP_STATUS = ['active', 'engaged', 'archived'];

// Публічна частина вакансії (кар'єра на barpi.com.ua)
export const VAC_REGION = ['ua', 'eu'];
export const VAC_FORMAT = ['office', 'plant', 'hybrid', 'remote'];
export const VAC_EMPLOY = ['full', 'part', 'contract', 'internship'];
export const VAC_LANG   = ['uk', 'en'];
// 3–80 символів: латиниця, цифри, дефіс. 'apply' зарезервовано маршрутом /api/public/careers/apply.
export const RE_SLUG = /^[a-z0-9-]{3,80}$/;
export const RESERVED_SLUGS = new Set(['apply']);
export function isValidSlug(s) {
  return typeof s === 'string' && RE_SLUG.test(s) && !RESERVED_SLUGS.has(s);
}
// Джерело кандидата з форми на сайті (так канал видно у «Каналах»)
export const SITE_SOURCE = 'Сайт';

const MONEY_FIELDS = {
  hr_vacancies:   ['salary_from_kop', 'salary_to_kop'],
  hr_candidates:  ['expected_salary_kop'],
  hr_talent_pool: ['expected_salary_kop'],
};

// ── Опис сутностей: таблиця + дозволені для запису поля + їх тип ───────────
// type: str | int | date (YYYY-MM-DD) | period (YYYY-MM) | money (int, kop) | enum | bool
export const HR_ENTITIES = {
  vacancy: {
    table: 'hr_vacancies',
    audit: 'vacancy',
    sys: { createdAt: 1, updatedAt: 1, createdBy: 1, updatedBy: 1 },
    fields: {
      title: { t: 'str', max: 200, required: true },
      company: { t: 'str', max: 100 },
      department: { t: 'str', max: 100 },
      manager: { t: 'str', max: 200 },
      headcount: { t: 'int', min: 1, max: 1000 },
      priority: { t: 'enum', values: VAC_PRIORITY },
      open_date: { t: 'date' },
      target_date: { t: 'date' },
      close_date: { t: 'date' },
      status: { t: 'enum', values: VAC_STATUS },
      source: { t: 'str', max: 100 },
      currency: { t: 'enum', values: CURRENCIES },
      salary_from_kop: { t: 'money', payroll: true },
      salary_to_kop: { t: 'money', payroll: true },
      requirements: { t: 'str', max: 6000 },
      notes: { t: 'str', max: 4000 },
      // ── Публікація на barpi.com.ua. Те, що нижче, бачить увесь світ ──
      publish_site: { t: 'bool' },
      slug: { t: 'str', max: 80, lower: true, re: RE_SLUG, reserved: RESERVED_SLUGS },
      public_title: { t: 'str', max: 200 },
      region: { t: 'enum', values: VAC_REGION },
      city: { t: 'str', max: 100 },
      work_format: { t: 'enum', values: VAC_FORMAT },
      employment_type: { t: 'enum', values: VAC_EMPLOY },
      lang: { t: 'enum', values: VAC_LANG },
      summary: { t: 'str', max: 1000 },
      responsibilities: { t: 'str', max: 4000 },
      public_requirements: { t: 'str', max: 4000 },
      offer: { t: 'str', max: 4000 },
      // Прапорець вмикає показ вилки на сайті. Без payroll-доступу людина не бачить суми,
      // тож не може й вирішувати, чи публікувати їх (інакше прочитала б вилку з публічного API).
      show_salary: { t: 'bool', payroll: true },
      valid_through: { t: 'date' },
    },
  },
  candidate: {
    table: 'hr_candidates',
    audit: 'candidate',
    sys: { createdAt: 1, updatedAt: 1, createdBy: 1, updatedBy: 1 },
    fields: {
      full_name: { t: 'str', max: 200, required: true },
      vacancy_id: { t: 'int' },
      position: { t: 'str', max: 150 },
      company: { t: 'str', max: 100 },
      department: { t: 'str', max: 100 },
      source: { t: 'str', max: 100 },
      stage: { t: 'enum', values: HR_STAGES },
      rating: { t: 'int', min: 0, max: 5 },
      email: { t: 'str', max: 200 },
      phone: { t: 'str', max: 60 },
      linkedin: { t: 'str', max: 300 },
      cv_url: { t: 'str', max: 500 },
      currency: { t: 'enum', values: CURRENCIES },
      expected_salary_kop: { t: 'money', payroll: true },
      owner_email: { t: 'str', max: 200 },
      first_contact_date: { t: 'date' },
      screening_date: { t: 'date' },
      hr_interview_date: { t: 'date' },
      mgr_interview_date: { t: 'date' },
      offer_sent_date: { t: 'date' },
      offer_date: { t: 'date' },
      start_date: { t: 'date' },
      closed_date: { t: 'date' },
      reject_reason: { t: 'str', max: 300 },
      notes: { t: 'str', max: 4000 },
    },
  },
  // Talent pool: резерв людей «на потім». Повернення з пулу створює НОВИЙ запис кандидата
  // з джерелом 'Talent pool' (так видно у «Каналах», скільки наймів дав резерв).
  talent: {
    table: 'hr_talent_pool',
    audit: 'talent',
    sys: { createdAt: 1, updatedAt: 1, createdBy: 1, updatedBy: 1 },
    fields: {
      full_name: { t: 'str', max: 200, required: true },
      candidate_id: { t: 'int' },
      position: { t: 'str', max: 150 },
      department: { t: 'str', max: 100 },
      company: { t: 'str', max: 100 },
      skills: { t: 'str', max: 500 },
      reason: { t: 'enum', values: TP_REASON },
      temperature: { t: 'enum', values: TP_TEMP },
      status: { t: 'enum', values: TP_STATUS },
      rating: { t: 'int', min: 0, max: 5 },
      source: { t: 'str', max: 100 },
      email: { t: 'str', max: 200 },
      phone: { t: 'str', max: 60 },
      linkedin: { t: 'str', max: 300 },
      cv_url: { t: 'str', max: 500 },
      location: { t: 'str', max: 120 },
      currency: { t: 'enum', values: CURRENCIES },
      expected_salary_kop: { t: 'money', payroll: true },
      last_contact_date: { t: 'date' },
      next_contact_date: { t: 'date' },
      consent_until: { t: 'date' },
      engaged_candidate_id: { t: 'int' },
      owner_email: { t: 'str', max: 200 },
      notes: { t: 'str', max: 6000 },
    },
  },
  source_cost: {
    table: 'hr_source_costs',
    audit: 'source_cost',
    sys: { updatedAt: 1, updatedBy: 1 },
    upsertKey: ['source', 'period'],
    fields: {
      source: { t: 'str', max: 100, required: true },
      period: { t: 'period', required: true },
      currency: { t: 'enum', values: CURRENCIES },
      cost_kop: { t: 'money' },
      note: { t: 'str', max: 500 },
    },
  },
  dict: {
    table: 'hr_dict',
    audit: 'dict',
    sys: { createdAt: 1 },
    fields: {
      kind: { t: 'str', max: 40, required: true },
      value: { t: 'str', max: 150, required: true },
      meta: { t: 'str', max: 500 },
      sort_order: { t: 'int' },
      active: { t: 'bool' },
    },
  },
};

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_PERIOD = /^\d{4}-\d{2}$/;

// безпечний доступ до словника сутностей ('constructor' / '__proto__' не проходять)
export function hrEntity(name) {
  return (typeof name === 'string' && Object.prototype.hasOwnProperty.call(HR_ENTITIES, name)) ? HR_ENTITIES[name] : null;
}

export function hrCoerce(spec, raw) {
  // { ok:true, value } | { ok:false, error }
  if (raw === null || raw === undefined || raw === '') {
    if (spec.required) return { ok: false, error: 'required' };
    return { ok: true, value: null };
  }
  switch (spec.t) {
    case 'str': {
      if (typeof raw === 'object') return { ok: false, error: 'bad_format' };
      let s = String(raw).trim();
      if (spec.lower) s = s.toLowerCase();
      // поле з шаблоном (slug) не обрізаємо мовчки: обрізаний slug = інша адреса
      if (spec.re) {
        if (!s) return spec.required ? { ok: false, error: 'required' } : { ok: true, value: null };
        if (!spec.re.test(s)) return { ok: false, error: 'bad_format' };
        if (spec.reserved && spec.reserved.has(s)) return { ok: false, error: 'reserved' };
        return { ok: true, value: s };
      }
      s = s.slice(0, spec.max || 500);
      if (spec.required && !s) return { ok: false, error: 'required' };
      return { ok: true, value: s };
    }
    case 'int': {
      if (typeof raw === 'object') return { ok: false, error: 'not_a_number' };
      const n = Number(raw);
      if (!Number.isSafeInteger(n)) return { ok: false, error: 'not_a_number' };
      if (spec.min !== undefined && n < spec.min) return { ok: false, error: 'too_small' };
      if (spec.max !== undefined && n > spec.max) return { ok: false, error: 'too_big' };
      return { ok: true, value: n };
    }
    case 'money': {
      if (typeof raw === 'object') return { ok: false, error: 'not_a_number' };
      const n = Math.round(Number(raw));
      if (!Number.isFinite(n)) return { ok: false, error: 'not_a_number' };
      if (n < 0) return { ok: false, error: 'negative' };
      if (n > 1e13) return { ok: false, error: 'too_big' };
      return { ok: true, value: n };
    }
    case 'bool':
      return { ok: true, value: (raw === true || raw === 1 || raw === '1' || raw === 'true') ? 1 : 0 };
    case 'date': {
      const s = String(raw).trim();
      if (!RE_DATE.test(s)) return { ok: false, error: 'bad_date' };
      const d = new Date(s + 'T00:00:00Z');
      if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return { ok: false, error: 'bad_date' };
      const y = d.getUTCFullYear();
      if (y < 1940 || y > 2100) return { ok: false, error: 'date_out_of_range' };
      return { ok: true, value: s };
    }
    case 'period': {
      const s = String(raw).trim();
      if (!RE_PERIOD.test(s)) return { ok: false, error: 'bad_period' };
      const m = parseInt(s.slice(5, 7), 10);
      if (m < 1 || m > 12) return { ok: false, error: 'bad_period' };
      return { ok: true, value: s };
    }
    case 'enum': {
      const s = String(raw).trim();
      if (!spec.values.includes(s)) return { ok: false, error: 'bad_enum' };
      return { ok: true, value: s };
    }
    default:
      return { ok: false, error: 'unknown_type' };
  }
}

// Автозаповнення дат при переході кандидата по воронці
export const STAGE_DATE_FIELD = {
  screening: 'screening_date',
  hr_interview: 'hr_interview_date',
  mgr_interview: 'mgr_interview_date',
  offer: 'offer_sent_date',
  offer_accepted: 'offer_date',
  hired: 'start_date',
  offer_declined: 'closed_date',
  rejected: 'closed_date',
};

export function hrStripMoney(rows, table, canPayroll) {
  if (canPayroll) return rows || [];
  const fields = MONEY_FIELDS[table];
  if (!fields || !rows?.length) return rows || [];
  return rows.map((r) => {
    const c = { ...r };
    for (const f of fields) delete c[f];
    return c;
  });
}

const MONEY_KEYS = new Set(['expected_salary_kop', 'salary_from_kop', 'salary_to_kop']);
// У hr_audit_log.diff потрапляють старі/нові значення полів, у т.ч. вилки й очікування.
// Без редакції людина без hr-payroll відновила б їх через /api/hr/audit.
export function redactAuditRow(r, canPayroll) {
  if (canPayroll) return r;
  if (!r.diff) return r;
  let d;
  try { d = JSON.parse(r.diff); } catch (e) { return { ...r, diff: null, redacted: 1 }; }
  const walk = (o) => {
    if (!o || typeof o !== 'object') return o;
    for (const k of Object.keys(o)) {
      if (MONEY_KEYS.has(k)) o[k] = '***';
      else if (o[k] && typeof o[k] === 'object') walk(o[k]);
    }
    return o;
  };
  return { ...r, diff: JSON.stringify(walk(d)), redacted: 1 };
}

// Дата по Києву: toISOString дає UTC і вночі зсуває «сьогодні» на вчора
export function kyivToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
const nowSec = () => Math.floor(Date.now() / 1000);

// ── Доступ ─────────────────────────────────────────────────────────────────
// p — розібраний JWT (getBearer уже звірив isAdmin з поточним ADMIN_EMAILS).
export async function hrAccess(p, env, getWhitelist, normaliseEmail) {
  if (!p || !p.email) return { ok: false };
  const email = normaliseEmail(p.email);
  let ok = !!p.isAdmin;
  if (!ok && p.block === HR_BLOCK) {
    try { ok = (await getWhitelist(env, HR_BLOCK)).map(normaliseEmail).includes(email); } catch (e) { ok = false; }
  }
  if (!ok) return { ok: false };
  let canPayroll = !!p.isAdmin;
  if (!canPayroll) {
    try { canPayroll = (await getWhitelist(env, HR_PAYROLL_LIST)).map(normaliseEmail).includes(email); } catch (e) { canPayroll = false; }
  }
  return { ok: true, email, isAdmin: !!p.isAdmin, canPayroll };
}

// ═══════════════════════════════════════════════════════════════════════════
// РОУТЕР /api/hr/*  (усе POST)
// deps = { getBearer, getWhitelist, jsonResp, readJson, normaliseEmail }
// ═══════════════════════════════════════════════════════════════════════════
export async function handleHrApi(path, request, env, ctx, deps) {
  const { getBearer, getWhitelist, jsonResp, readJson, normaliseEmail } = deps;
  const J = (b, s = 200) => jsonResp(b, s, env);
  if (request.method !== 'POST') return J({ error: 'method not allowed' }, 405);

  const p = await getBearer(request, env);
  const acc = await hrAccess(p, env, getWhitelist, normaliseEmail);
  if (!acc.ok) return J({ error: 'unauthorized' }, p ? 403 : 401);
  const { email, canPayroll } = acc;

  // Файловий маршрут ДО readJson: тіло бінарне, readJson його вичерпав би.
  if (path === '/api/hr/file-upload') return await hrFileUpload(env, J, request, email);

  const body = (await readJson(request)) || {};

  // Погодинний ліміт записів (KV), щоб один JWT не міг флудити D1
  const WRITE_PATHS = new Set(['/api/hr/save', '/api/hr/delete', '/api/hr/stage', '/api/hr/import']);
  if (WRITE_PATHS.has(path) && env.OTP_KV) {
    try {
      const key = `rl:hr:${email}:${Math.floor(Date.now() / 3600000)}`;
      const cost = path === '/api/hr/import' ? 25 : 1;
      const n = parseInt((await env.OTP_KV.get(key)) || '0', 10) + cost;
      if (n > 400) return J({ error: 'rate_limited' }, 429);
      await env.OTP_KV.put(key, String(n), { expirationTtl: 7200 });
    } catch (e) { /* ліміт не має ламати роботу */ }
  }
  const audit = async (entity, entityId, action, diff) => {
    try {
      await env.DB.prepare(
        'INSERT INTO hr_audit_log (entity, entity_id, action, diff, actor_email, at) VALUES (?,?,?,?,?,?)'
      ).bind(entity, entityId || null, action, diff ? JSON.stringify(diff).slice(0, 4000) : null, email, nowSec()).run();
    } catch (e) { /* аудит не має ламати операцію */ }
  };

  switch (path) {
    case '/api/hr/bootstrap':  return await hrBootstrap(env, J, { email, isAdmin: acc.isAdmin, canPayroll });
    case '/api/hr/save':       return await hrSave(env, J, body, { email, canPayroll, audit });
    case '/api/hr/delete':     return await hrDelete(env, J, body, { canPayroll, audit });
    case '/api/hr/stage':      return await hrStage(env, J, body, { email, canPayroll, audit });
    case '/api/hr/import':     return await hrImport(env, J, body, { email, canPayroll, audit });
    case '/api/hr/audit':      return await hrAuditList(env, J, body, canPayroll);
    case '/api/hr/candidate-events': return await hrCandidateEvents(env, J, body);
    case '/api/hr/files':      return await hrFileList(env, J, body, 'hr_files');
    case '/api/hr/file-get':   return await hrFileGet(env, J, body, 'hr_files');
    case '/api/hr/file-delete':return await hrFileDelete(env, J, body, 'hr_files', audit);
    case '/api/hr/talent-files':       return await hrFileList(env, J, body, 'hr_talent_files');
    case '/api/hr/talent-file-get':    return await hrFileGet(env, J, body, 'hr_talent_files');
    case '/api/hr/talent-file-delete': return await hrFileDelete(env, J, body, 'hr_talent_files', audit);
    default:                   return J({ error: 'not found' }, 404);
  }
}

// ── /api/hr/bootstrap: усе одним запитом ───────────────────────────────────
async function hrBootstrap(env, J, me) {
  try {
    const q = (sql) => env.DB.prepare(sql).all();
    const [dict, vacancies, candidates, sourceCosts, talent] = await Promise.all([
      q('SELECT id,kind,value,meta,sort_order,active FROM hr_dict WHERE active=1 ORDER BY kind, sort_order, value'),
      q('SELECT * FROM hr_vacancies ORDER BY status, open_date DESC'),
      q('SELECT * FROM hr_candidates ORDER BY stage_changed_at DESC LIMIT 5000'),
      q('SELECT * FROM hr_source_costs ORDER BY period DESC LIMIT 2000'),
      q('SELECT * FROM hr_talent_pool ORDER BY updated_at DESC LIMIT 5000'),
    ]);
    return J({
      ok: true,
      me,
      server_time: nowSec(),
      dict: dict.results || [],
      vacancies: hrStripMoney(vacancies.results || [], 'hr_vacancies', me.canPayroll),
      candidates: hrStripMoney(candidates.results || [], 'hr_candidates', me.canPayroll),
      source_costs: sourceCosts.results || [],
      talent: hrStripMoney(talent.results || [], 'hr_talent_pool', me.canPayroll),
      talent_ready: true,
    }, 200);
  } catch (e) {
    console.error('[hr/bootstrap]', e.message);
    // найчастіша причина: міграцію 0027 ще не застосовано
    const missing = /no such table/i.test(String(e.message));
    return J({ error: missing ? 'not_migrated' : 'bootstrap_failed' }, missing ? 503 : 500);
  }
}

export function hrPrepareFields(cfg, data, canPayroll, isCreate) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  const cols = {}; const errors = {};
  for (const [key, spec] of Object.entries(cfg.fields)) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      if (isCreate && spec.required) errors[key] = 'required';
      continue;
    }
    if (spec.payroll && !canPayroll) continue;           // мовчки ігноруємо ЗП-поля без доступу
    const r = hrCoerce(spec, data[key]);
    if (!r.ok) { errors[key] = r.error; continue; }
    if (r.value === null && spec.required) { errors[key] = 'required'; continue; }
    cols[key] = r.value;
  }
  return { cols, errors };
}

// ── /api/hr/save ───────────────────────────────────────────────────────────
async function hrSave(env, J, body, { email, canPayroll, audit }) {
  const cfg = hrEntity(body.entity);
  if (!cfg) return J({ error: 'bad_entity', allowed: Object.keys(HR_ENTITIES) }, 400);

  const id = body.id ? parseInt(body.id, 10) : 0;
  const data = body.data || {};
  const isCreate = !id;
  const { cols, errors } = hrPrepareFields(cfg, data, canPayroll, isCreate);
  if (Object.keys(errors).length) return J({ error: 'validation_failed', fields: errors }, 400);
  if (!Object.keys(cols).length) return J({ error: 'no_fields' }, 400);

  if (cfg.table === 'hr_vacancies') {
    if (cols.open_date && cols.close_date && cols.close_date < cols.open_date) {
      return J({ error: 'validation_failed', fields: { close_date: 'before_open_date' } }, 400);
    }
    let vacBefore = null;
    if (!isCreate) vacBefore = await env.DB.prepare('SELECT * FROM hr_vacancies WHERE id = ?').bind(id).first();
    if (!isCreate && !vacBefore) return J({ error: 'not_found', id }, 404);
    const pub = await hrVacancyPublishPrep(env, cols, vacBefore, id);
    if (pub) return J(pub.body, pub.status);
  }
  if (cfg.table === 'hr_talent_pool' && isCreate && cols.candidate_id) {
    const ex = await env.DB.prepare('SELECT id FROM hr_talent_pool WHERE candidate_id = ?').bind(cols.candidate_id).first();
    if (ex) return J({ error: 'duplicate', id: ex.id }, 409);
  }

  const now = nowSec();
  const sys = cfg.sys || {};
  try {
    if (isCreate) {
      // upsert по природному ключу (source_cost: source+period)
      if (cfg.upsertKey && cfg.upsertKey.every((k) => cols[k] != null)) {
        const where = cfg.upsertKey.map((k) => `${k} = ?`).join(' AND ');
        const exist = await env.DB.prepare(`SELECT id FROM ${cfg.table} WHERE ${where}`)
          .bind(...cfg.upsertKey.map((k) => cols[k])).first();
        if (exist) return await hrSave(env, J, { entity: body.entity, id: exist.id, data }, { email, canPayroll, audit });
      }
      const keys = Object.keys(cols);
      const extraCols = []; const extraBinds = [];
      if (sys.createdAt) { extraCols.push('created_at'); extraBinds.push(now); }
      if (sys.updatedAt) { extraCols.push('updated_at'); extraBinds.push(now); }
      if (sys.createdBy) { extraCols.push('created_by'); extraBinds.push(email); }
      if (sys.updatedBy) { extraCols.push('updated_by'); extraBinds.push(email); }
      const allCols = [...keys, ...extraCols];
      const sql = `INSERT INTO ${cfg.table} (${allCols.join(',')}) VALUES (${allCols.map(() => '?').join(',')})`;
      const res = await env.DB.prepare(sql).bind(...keys.map((k) => cols[k]), ...extraBinds).run();
      const newId = res.meta.last_row_id;
      await audit(cfg.audit, newId, 'create', cols);
      if (cfg.table === 'hr_candidates') {
        await env.DB.prepare('INSERT INTO hr_candidate_events (candidate_id, from_stage, to_stage, at, actor_email) VALUES (?,?,?,?,?)')
          .bind(newId, null, cols.stage || 'new', now, email).run();
      }
      const row = await env.DB.prepare(`SELECT * FROM ${cfg.table} WHERE id = ?`).bind(newId).first();
      return J({ ok: true, id: newId, created: true, row: hrStripMoney([row], cfg.table, canPayroll)[0] }, 200);
    }

    const before = await env.DB.prepare(`SELECT * FROM ${cfg.table} WHERE id = ?`).bind(id).first();
    if (!before) return J({ error: 'not_found', id }, 404);
    const keys = Object.keys(cols);
    const setParts = keys.map((k) => `${k} = ?`);
    const binds = keys.map((k) => cols[k]);
    if (sys.updatedAt) { setParts.push('updated_at = ?'); binds.push(now); }
    if (sys.updatedBy) { setParts.push('updated_by = ?'); binds.push(email); }
    binds.push(id);
    await env.DB.prepare(`UPDATE ${cfg.table} SET ${setParts.join(', ')} WHERE id = ?`).bind(...binds).run();

    const diff = {};
    for (const k of keys) if (before[k] !== cols[k]) diff[k] = [before[k], cols[k]];
    if (Object.keys(diff).length) await audit(cfg.audit, id, 'update', diff);
    const row = await env.DB.prepare(`SELECT * FROM ${cfg.table} WHERE id = ?`).bind(id).first();
    return J({ ok: true, id, row: hrStripMoney([row], cfg.table, canPayroll)[0] }, 200);
  } catch (e) {
    console.error('[hr/save]', body.entity, e.message);
    if (String(e).includes('UNIQUE')) return J({ error: 'duplicate' }, 409);
    return J({ error: 'save_failed' }, 500);
  }
}

// Видалити файли запису з R2 і з таблиці (резюме = персональні дані, сиріт у бакеті не лишаємо)
async function dropFiles(env, table, fk, id) {
  let rows = [];
  try { rows = (await env.DB.prepare(`SELECT id, r2_key FROM ${table} WHERE ${fk} = ?`).bind(id).all()).results || []; }
  catch (e) { return 0; }
  for (const f of rows) {
    try { if (env.FILES_BUCKET) await env.FILES_BUCKET.delete(f.r2_key); } catch (e) { /* рядок прибираємо в будь-якому разі */ }
    await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(f.id).run();
  }
  return rows.length;
}

// ── /api/hr/delete ─────────────────────────────────────────────────────────
async function hrDelete(env, J, body, { audit }) {
  const cfg = hrEntity(body.entity);
  if (!cfg) return J({ error: 'bad_entity' }, 400);
  const id = parseInt(body.id, 10);
  if (!id) return J({ error: 'id_required' }, 400);
  try {
    const before = await env.DB.prepare(`SELECT * FROM ${cfg.table} WHERE id = ?`).bind(id).first();
    if (!before) return J({ error: 'not_found' }, 404);
    let files = 0;
    if (cfg.table === 'hr_vacancies') {
      await env.DB.prepare('UPDATE hr_candidates SET vacancy_id = NULL WHERE vacancy_id = ?').bind(id).run();
    }
    if (cfg.table === 'hr_candidates') {
      files = await dropFiles(env, 'hr_files', 'candidate_id', id);
      await env.DB.prepare('DELETE FROM hr_candidate_events WHERE candidate_id = ?').bind(id).run();
      // Запис у Talent pool лишається, лише втрачає посилання на видалений відбір
      await env.DB.prepare('UPDATE hr_talent_pool SET candidate_id = NULL WHERE candidate_id = ?').bind(id).run();
      await env.DB.prepare("UPDATE hr_talent_pool SET engaged_candidate_id = NULL, status = CASE WHEN status='engaged' THEN 'active' ELSE status END WHERE engaged_candidate_id = ?").bind(id).run();
    }
    if (cfg.table === 'hr_talent_pool') {
      files = await dropFiles(env, 'hr_talent_files', 'talent_id', id);
    }
    await env.DB.prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).bind(id).run();
    await audit(cfg.audit, id, 'delete', { snapshot: before, files });
    return J({ ok: true, id }, 200);
  } catch (e) {
    console.error('[hr/delete]', e.message);
    return J({ error: 'delete_failed' }, 500);
  }
}

// ── /api/hr/stage: рух кандидата по воронці (канбан) ───────────────────────
async function hrStage(env, J, body, { email, canPayroll, audit }) {
  const id = parseInt(body.id, 10);
  const to = String(body.to_stage || '');
  if (!id) return J({ error: 'id_required' }, 400);
  if (!HR_STAGES.includes(to)) return J({ error: 'bad_stage', allowed: HR_STAGES }, 400);
  try {
    const c = await env.DB.prepare('SELECT * FROM hr_candidates WHERE id = ?').bind(id).first();
    if (!c) return J({ error: 'not_found' }, 404);
    if (c.stage === to) return J({ ok: true, id, unchanged: true }, 200);

    const now = nowSec();
    const today = kyivToday();
    const sets = ['stage = ?', 'stage_changed_at = ?', 'updated_at = ?', 'updated_by = ?'];
    const binds = [to, now, now, email];
    const dateField = STAGE_DATE_FIELD[to];
    if (dateField && !c[dateField]) { sets.push(`${dateField} = ?`); binds.push(today); }
    if (!c.first_contact_date) {
      const created = c.created_at ? kyivToday(new Date(c.created_at * 1000)) : today;
      sets.push('first_contact_date = ?'); binds.push(created);
    }
    if (body.reject_reason && (to === 'rejected' || to === 'offer_declined')) {
      sets.push('reject_reason = ?'); binds.push(String(body.reject_reason).slice(0, 300));
    }
    binds.push(id);
    await env.DB.prepare(`UPDATE hr_candidates SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    await env.DB.prepare('INSERT INTO hr_candidate_events (candidate_id, from_stage, to_stage, at, actor_email, note) VALUES (?,?,?,?,?,?)')
      .bind(id, c.stage, to, now, email, body.note ? String(body.note).slice(0, 500) : null).run();
    await audit('candidate', id, 'stage', { stage: [c.stage, to] });

    const row = await env.DB.prepare('SELECT * FROM hr_candidates WHERE id = ?').bind(id).first();
    return J({ ok: true, id, row: hrStripMoney([row], 'hr_candidates', canPayroll)[0] }, 200);
  } catch (e) {
    console.error('[hr/stage]', e.message);
    return J({ error: 'stage_failed' }, 500);
  }
}

// ── /api/hr/import: масовий імпорт (CSV з фронта) ──────────────────────────
async function hrImport(env, J, body, { email, canPayroll, audit }) {
  const cfg = hrEntity(body.entity);
  if (!cfg) return J({ error: 'bad_entity' }, 400);
  if (cfg.table !== 'hr_candidates' && cfg.table !== 'hr_talent_pool') {
    return J({ error: 'import_not_supported_for_entity', use: '/api/hr/save' }, 400);
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return J({ error: 'no_rows' }, 400);
  if (rows.length > 300) return J({ error: 'too_many_rows', max: 300 }, 400);

  const now = nowSec();
  const sys = cfg.sys || {};
  const failed = [];
  const stmts = [];
  for (let i = 0; i < rows.length; i++) {
    const { cols, errors } = hrPrepareFields(cfg, rows[i] || {}, canPayroll, true);
    if (Object.keys(errors).length) { failed.push({ row: i, errors }); continue; }
    const keys = Object.keys(cols);
    const extraCols = []; const extraBinds = [];
    if (sys.createdAt) { extraCols.push('created_at'); extraBinds.push(now); }
    if (sys.updatedAt) { extraCols.push('updated_at'); extraBinds.push(now); }
    if (sys.createdBy) { extraCols.push('created_by'); extraBinds.push(email); }
    if (sys.updatedBy) { extraCols.push('updated_by'); extraBinds.push(email); }
    const allCols = [...keys, ...extraCols];
    stmts.push(env.DB.prepare(`INSERT INTO ${cfg.table} (${allCols.join(',')}) VALUES (${allCols.map(() => '?').join(',')})`)
      .bind(...keys.map((k) => cols[k]), ...extraBinds));
  }
  if (!stmts.length) return J({ error: 'all_rows_invalid', failed }, 400);
  try {
    await env.DB.batch(stmts);
    await audit(cfg.audit, null, 'import', { count: stmts.length, entity: body.entity });
    return J({ ok: true, imported: stmts.length, failed }, 200);
  } catch (e) {
    console.error('[hr/import]', e.message);
    return J({ error: 'import_failed', failed }, 500);
  }
}

// ── /api/hr/audit ──────────────────────────────────────────────────────────
async function hrAuditList(env, J, body, canPayroll) {
  const limit = Math.min(parseInt(body.limit, 10) || 100, 500);
  const entity = body.entity ? String(body.entity).slice(0, 30) : null;
  const entityId = body.entity_id ? parseInt(body.entity_id, 10) : null;
  try {
    let sql = 'SELECT * FROM hr_audit_log WHERE 1=1';
    const binds = [];
    if (entity) { sql += ' AND entity = ?'; binds.push(entity); }
    if (entityId) { sql += ' AND entity_id = ?'; binds.push(entityId); }
    sql += ' ORDER BY at DESC LIMIT ?'; binds.push(limit);
    const rs = await env.DB.prepare(sql).bind(...binds).all();
    return J({ ok: true, log: (rs.results || []).map((r) => redactAuditRow(r, canPayroll)) }, 200);
  } catch (e) {
    return J({ error: 'audit_failed' }, 500);
  }
}

async function hrCandidateEvents(env, J, body) {
  const id = parseInt(body.candidate_id, 10);
  if (!id) return J({ error: 'candidate_id_required' }, 400);
  try {
    const rs = await env.DB.prepare('SELECT * FROM hr_candidate_events WHERE candidate_id = ? ORDER BY at ASC').bind(id).all();
    return J({ ok: true, events: rs.results || [] }, 200);
  } catch (e) {
    return J({ error: 'events_failed' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ФАЙЛИ КАНДИДАТА. Резюме = персональні дані: окремий шлях, а не спільний /api/ideas/upload.
// Прямого URL у файлів немає: /files/* віддає лише префікс uploads/, а hr/cv/* віддає
// цей воркер вмістом після перевірки доступу hr.
// ═══════════════════════════════════════════════════════════════════════════
export const HR_FILE_MAX = 10 * 1024 * 1024;
const HR_MIME_OK = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf', 'text/rtf', 'text/plain',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);
export const HR_EXT_OK = /\.(pdf|doc|docx|odt|rtf|txt|jpe?g|png|webp|heic|heif)$/i;

async function hrFileUpload(env, J, request, email) {
  if (!env.FILES_BUCKET) return J({ error: 'storage_unavailable' }, 503);
  const url = new URL(request.url);
  const candId = parseInt(url.searchParams.get('candidate_id'), 10);
  const rawName = String(url.searchParams.get('filename') || 'file').slice(0, 120);
  if (!candId) return J({ error: 'candidate_id_required' }, 400);
  if (!HR_EXT_OK.test(rawName)) return J({ error: 'bad_type' }, 415);
  const mime = (request.headers.get('Content-Type') || 'application/octet-stream').split(';')[0].trim();
  if (mime !== 'application/octet-stream' && !HR_MIME_OK.has(mime)) return J({ error: 'bad_type' }, 415);
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > HR_FILE_MAX) return J({ error: 'too_large' }, 413);

  const cand = await env.DB.prepare('SELECT id FROM hr_candidates WHERE id = ?').bind(candId).first();
  if (!cand) return J({ error: 'candidate_not_found' }, 404);

  const data = await request.arrayBuffer();
  if (data.byteLength === 0) return J({ error: 'empty_file' }, 400);
  if (data.byteLength > HR_FILE_MAX) return J({ error: 'too_large' }, 413);

  // У ключі R2 лише латиниця; оригінальна назва живе в БД і в Content-Disposition
  const safe = rawName.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 60);
  const rnd = Math.random().toString(36).slice(2, 10);
  const key = `hr/cv/${candId}/${Date.now().toString(36)}-${rnd}-${safe}`;
  try {
    await env.FILES_BUCKET.put(key, data, { httpMetadata: { contentType: mime } });
    const r = await env.DB.prepare(
      'INSERT INTO hr_files (candidate_id, filename, r2_key, size_bytes, mime, uploaded_by, uploaded_at) VALUES (?,?,?,?,?,?,?)'
    ).bind(candId, rawName, key, data.byteLength, mime, email, nowSec()).run();
    return J({ ok: true, id: r.meta?.last_row_id, filename: rawName, size_bytes: data.byteLength, mime }, 200);
  } catch (e) {
    console.error('[hr/file-upload]', e.message);
    try { await env.FILES_BUCKET.delete(key); } catch (e2) { /* нічого */ }
    return J({ error: 'upload_failed' }, 500);
  }
}

// table — лише одна з двох констант, ззовні не приходить
const FILE_TABLES = {
  hr_files: { fk: 'candidate_id', idParam: 'candidate_id', audit: 'candidate' },
  hr_talent_files: { fk: 'talent_id', idParam: 'talent_id', audit: 'talent' },
};

async function hrFileList(env, J, body, table) {
  const t = FILE_TABLES[table];
  const ownerId = parseInt(body[t.idParam], 10);
  if (!ownerId) return J({ error: `${t.idParam}_required` }, 400);
  const { results } = await env.DB.prepare(
    `SELECT id, filename, size_bytes, mime, kind, uploaded_by, uploaded_at FROM ${table} WHERE ${t.fk} = ? ORDER BY uploaded_at DESC`
  ).bind(ownerId).all();
  return J({ rows: results || [] }, 200);
}

// Вміст у відповіді, а не підписаним URL: фронт качає fetch-ем з Bearer і робить blob.
async function hrFileGet(env, J, body, table) {
  if (!env.FILES_BUCKET) return J({ error: 'storage_unavailable' }, 503);
  const id = parseInt(body.id, 10);
  if (!id) return J({ error: 'id_required' }, 400);
  const tbl = table === 'hr_talent_files' ? 'hr_talent_files' : 'hr_files';
  const row = await env.DB.prepare(`SELECT r2_key, filename, mime FROM ${tbl} WHERE id = ?`).bind(id).first();
  if (!row) return J({ error: 'not_found' }, 404);
  const obj = await env.FILES_BUCKET.get(row.r2_key);
  if (!obj) return J({ error: 'file_missing' }, 404);
  // Заголовки ті самі, що в JSON-відповідей (у Barpi дашборд і API на одному домені brand.barpi.ua)
  const headers = new Headers();
  const jh = J({}, 200)?.headers;
  if (jh && typeof jh.forEach === 'function') jh.forEach((v, k) => { if (k.toLowerCase() !== 'content-type') headers.set(k, v); });
  headers.set('Access-Control-Expose-Headers', 'Content-Disposition');
  headers.set('Content-Type', row.mime || 'application/octet-stream');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(obj.body, { headers });
}

async function hrFileDelete(env, J, body, table, audit) {
  const t = FILE_TABLES[table];
  const id = parseInt(body.id, 10);
  if (!id) return J({ error: 'id_required' }, 400);
  const row = await env.DB.prepare(`SELECT id, ${t.fk} AS owner_id, r2_key, filename FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) return J({ error: 'not_found' }, 404);
  try { await env.FILES_BUCKET?.delete(row.r2_key); } catch (e) { /* запис прибираємо в будь-якому разі */ }
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  await audit(t.audit, row.owner_id, 'file_delete', { file: row.filename });
  return J({ ok: true }, 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// ПУБЛІКАЦІЯ ВАКАНСІЇ НА САЙТІ
// ═══════════════════════════════════════════════════════════════════════════
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i',
  ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia',
  ё: 'io', ы: 'y', э: 'e', ъ: '',
};
// На початку слова (транслітерація КМУ 2010): є→ye, ї→yi, й→y, ю→yu, я→ya
const TRANSLIT_START = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };

export function hrTranslit(text) {
  const src = String(text || '').toLowerCase().replace(/[’'ʼ`"]/g, '');
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const atStart = i === 0 || !/[a-zа-яіїєґё0-9]/.test(src[i - 1]);
    if (atStart && TRANSLIT_START[ch]) out += TRANSLIT_START[ch];
    else if (Object.prototype.hasOwnProperty.call(TRANSLIT, ch)) out += TRANSLIT[ch];
    else out += ch;
  }
  return out;
}

export function hrSlugify(text) {
  let s = hrTranslit(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 70) s = s.slice(0, 70).replace(/-[^-]*$/, '') || s.slice(0, 70);
  s = s.replace(/-+$/g, '');
  if (s.length < 3 || RESERVED_SLUGS.has(s)) s = ('vacancy-' + s).replace(/-+$/g, '');
  return s;
}

// Перевірки й автозаповнення перед записом вакансії. Мутує cols.
// null — усе гаразд, або { status, body } з помилкою.
async function hrVacancyPublishPrep(env, cols, before, id) {
  const has = (k) => Object.prototype.hasOwnProperty.call(cols, k);
  if (has('slug') && cols.slug) {
    const ex = await env.DB.prepare('SELECT id FROM hr_vacancies WHERE slug = ? AND id <> ?').bind(cols.slug, id || 0).first();
    if (ex) return { status: 409, body: { error: 'validation_failed', fields: { slug: 'slug_taken' }, id: ex.id } };
  }
  const willPublish = (has('publish_site') ? cols.publish_site : (before?.publish_site || 0)) === 1;
  if (!willPublish) return null;
  const slugNow = has('slug') ? cols.slug : (before?.slug || null);
  if (!slugNow) {
    const base = hrSlugify(cols.public_title || before?.public_title || cols.title || before?.title || 'vacancy');
    let cand = base;
    for (let n = 2; n < 200; n++) {
      const ex = await env.DB.prepare('SELECT id FROM hr_vacancies WHERE slug = ? AND id <> ?').bind(cand, id || 0).first();
      if (!ex) break;
      cand = `${base}-${n}`;
    }
    cols.slug = cand;
  }
  // момент публікації: прапорець перейшов 0 → 1
  if (!(before?.publish_site === 1)) cols.published_at = nowSec();
  return null;
}
