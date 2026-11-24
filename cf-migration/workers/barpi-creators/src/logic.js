// barpi-creators · чиста логіка без прив'язки до Cloudflare (тестується в Node: tests/logic.test.mjs).
// Бал автора 0-100 рахується тут і ТОЙ САМИЙ код показується в дашборді (dashboard/creators/ бере score з API).

export const STATUSES = {
  new: 'Нова', in_progress: 'В роботі', offer: 'Пропозиція', approved_ship: 'Погоджено до відправлення',
  shipped: 'Надіслано', content_live: 'Контент вийшов', closed: 'Закрито', rejected: 'Відмова', spam: 'Спам',
};
export const AUDIENCE = { 'lt1k': 'до 1 тис.', '1-5k': '1-5 тис.', '5-20k': '5-20 тис.', '20-100k': '20-100 тис.', '100k+': '100 тис.+', 'ugc': 'UGC без власної аудиторії' };
export const ROLES = {
  owner: 'Власник собаки чи кота', petfluencer: 'Петфлюенсер (акаунт від імені тварини)', cynologist: 'Кінолог',
  groomer: 'Грумер', vet: 'Ветеринар', shop: 'Зоомагазин', shelter: 'Притулок', ugc: 'UGC-автор',
};
export const PETS = { dog: 'Собака', cat: 'Кіт', both: 'Собака і кіт', other: 'Інше' };
export const PLATFORMS = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', telegram: 'Telegram', facebook: 'Facebook', threads: 'Threads', other: 'Інше' };
export const FORMATS = {
  tasting: 'Дегустація («перша реакція»)', training: 'Тренування з ласощами', unboxing: 'Розпаковка',
  compare: 'Порівняння', day: 'День з улюбленцем', giveaway: 'Розіграш',
};
const HOSTS = {
  'instagram.com': 'instagram', 'tiktok.com': 'tiktok', 'youtube.com': 'youtube', 'youtu.be': 'youtube',
  't.me': 'telegram', 'telegram.me': 'telegram', 'facebook.com': 'facebook', 'fb.com': 'facebook', 'threads.net': 'threads', 'threads.com': 'threads',
};
const DISPOSABLE = /@(mailinator|10minutemail|guerrillamail|tempmail|temp-mail|yopmail|trashmail|sharklasers|getnada|dispostable)\./i;
const SHORT = /^(bit\.ly|tinyurl\.com|linktr\.ee|taplink\.cc|cutt\.ly)$/;

const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
export function hostOf(u) {
  try { return new URL(u).hostname.toLowerCase().replace(/^(www|m|vm|vt)\./, ''); } catch (e) { return ''; }
}
function urlOrEmpty(v) {
  let s = clip(v, 400);
  if (!s) return '';
  if (/^@?[a-z0-9._]{2,40}$/i.test(s)) return s.startsWith('@') ? s : '@' + s;   // нік без посилання
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return hostOf(s) ? s : '';
}

// Валідація і нормалізація форми. Повертає {ok, row} або {ok:false, error}.
export function normalise(body, now = Math.floor(Date.now() / 1000)) {
  const b = body || {};
  if (clip(b.website, 50)) return { ok: false, error: 'bot_check' };                 // пастка
  const t = Number(b.bp_t || 0);
  if (t && now * 1000 - t < 3000) return { ok: false, error: 'bot_check' };          // форму заповнили швидше 3 с
  const name = clip(b.name, 120);
  const email = clip(b.email, 160).toLowerCase();
  const phone = clip(b.phone, 40);
  const telegram = clip(b.telegram, 60);
  const profile_url = urlOrEmpty(b.profile_url);
  if (!name) return { ok: false, error: 'missing_name' };
  if (!email && !telegram && !phone) return { ok: false, error: 'missing_contact' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'bad_email' };
  if (!profile_url) return { ok: false, error: 'missing_profile' };
  if (!(b.age_ok === true || b.age_ok === 'on' || b.age_ok === '1' || b.age_ok === 1)) return { ok: false, error: 'age_required' };
  if (!(b.consent === true || b.consent === 'on' || b.consent === '1' || b.consent === 1)) return { ok: false, error: 'consent_required' };
  const pick = (v, dict) => (Object.prototype.hasOwnProperty.call(dict, v) ? v : '');
  const formats = (Array.isArray(b.formats) ? b.formats : String(b.formats || '').split(','))
    .map((x) => String(x).trim()).filter((x) => FORMATS[x]).slice(0, 6).join(',');
  const row = {
    kind: 'application', created_at: now, updated_at: now, status: 'new',
    name, email, phone, telegram, city: clip(b.city, 80), profile_url,
    platform: pick(b.platform, PLATFORMS), audience: pick(b.audience, AUDIENCE), role: pick(b.role, ROLES), pets: pick(b.pets, PETS),
    formats, sample_url: urlOrEmpty(b.sample_url), idea: clip(b.idea, 2000),
    age_ok: 1, consent: 1,
    utm_source: clip(b.utm_source, 80), utm_medium: clip(b.utm_medium, 80), utm_campaign: clip(b.utm_campaign, 120), utm_content: clip(b.utm_content, 120),
    referrer: clip(b.referrer, 300), landing: clip(b.landing, 300),
  };
  const sc = score(row);
  row.score = sc.score; row.score_why = sc.why.join(', '); row.flags = sc.flags.join(', ');
  row.history = JSON.stringify([{ at: now, by: 'форма', what: 'заявка з сайту' }]);
  return { ok: true, row };
}

// Бал 0-100: профіль 30, приклад відео 15, аудиторія до 20, роль 10, тварина 5, ідея 10, швидкий контакт 5, формати 5.
export function score(r) {
  const why = []; const flags = []; let s = 0;
  const host = hostOf(r.profile_url);
  const known = Object.keys(HOSTS).find((h) => host === h || host.endsWith('.' + h));
  if (known) { s += 25; why.push('профіль ' + PLATFORMS[HOSTS[known]]); if (r.platform && r.platform === HOSTS[known]) s += 5; }
  else if (host) { s += 12; why.push('сайт ' + host); if (SHORT.test(host)) flags.push('коротке посилання'); }
  else if (/^@/.test(r.profile_url || '')) { s += 10; flags.push('лише нік без посилання'); }
  else flags.push('немає профілю');
  if (r.sample_url) { s += 15; why.push('є приклад контенту'); }
  s += { 'lt1k': 5, '1-5k': 10, '5-20k': 15, '20-100k': 20, '100k+': 20, 'ugc': 15 }[r.audience] || 3;
  if (['petfluencer', 'cynologist', 'groomer', 'vet', 'shelter'].includes(r.role)) { s += 10; why.push(ROLES[r.role].toLowerCase()); }
  else if (r.role === 'shop' || r.role === 'ugc') s += 8; else if (r.role === 'owner') s += 7;
  if (r.pets) s += 5;
  if ((r.idea || '').length >= 40) { s += 10; why.push('є ідея'); }
  if (r.telegram || r.phone) s += 5;
  if (r.formats) s += 5;
  if (DISPOSABLE.test(r.email || '')) { s -= 30; flags.push('тимчасова пошта'); }
  if (/https?:|www\./i.test(r.name || '')) { s -= 30; flags.push('посилання в імені'); }
  s = Math.max(0, Math.min(100, s));
  return { score: s, why, flags, label: s >= 70 ? 'сильна' : s >= 45 ? 'середня' : 'перевірити' };
}

export const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Telegram: лише тег b і посилання a (правило бриджу: жодних інших кутових дужок).
export function alertText(r, id, dashUrl) {
  const label = r.score >= 70 ? 'сильна' : r.score >= 45 ? 'середня' : 'перевірити';
  const contact = [r.email, r.telegram, r.phone].filter(Boolean).map(esc).join(' · ');
  const lines = [
    `🐾 <b>Нова заявка блогера #${id}</b>`,
    `${esc(r.name)}${r.city ? ', ' + esc(r.city) : ''}`,
    `Профіль: ${esc(r.profile_url)}${r.platform ? ' (' + esc(PLATFORMS[r.platform]) + ')' : ''}`,
    r.audience ? `Аудиторія: ${esc(AUDIENCE[r.audience])}` : null,
    r.role ? `Хто: ${esc(ROLES[r.role])}${r.pets ? ' · ' + esc(PETS[r.pets]) : ''}` : null,
    r.formats ? `Формати: ${esc(r.formats.split(',').map((f) => FORMATS[f]).join(', '))}` : null,
    r.idea ? `Ідея: ${esc(r.idea.slice(0, 400))}` : null,
    `Контакт: ${contact}`,
    `⭐ ${r.score}/100 (${label})${r.score_why ? ': ' + esc(r.score_why) : ''}${r.flags ? ' · ⚠️ ' + esc(r.flags) : ''}`,
    r.utm_source ? `Джерело: ${esc(r.utm_source)}${r.utm_medium ? '/' + esc(r.utm_medium) : ''}` : null,
    '',
    `Відповісти протягом 24 год і поставити «В роботі»: ${esc(dashUrl)}#id=${id}`,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export function digestText(rows, now, dashUrl) {
  const old = rows.filter((r) => now - r.created_at >= 24 * 3600).sort((a, b) => (b.score || 0) - (a.score || 0));
  if (!old.length) return null;
  const h = (r) => Math.floor((now - r.created_at) / 3600);
  const out = [`⏰ <b>Заявки блогерів без відповіді понад 24 год: ${old.length}</b>`, ''];
  for (const r of old.slice(0, 15)) out.push(`#${r.id} ${esc(r.name)} · ⭐ ${r.score ?? '?'} · чекає ${h(r)} год`);
  if (old.length > 15) out.push(`… і ще ${old.length - 15}`);
  out.push('', `Поставте «В роботі» після першої відповіді: ${esc(dashUrl)}`);
  return out.join('\n');
}

// Київський час для крону (дайджест о 10:17 за Києвом).
export function kyivParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

// Купон у описі замовлення МойСклад (формат чекауту Horoshop): Знижка за купоном "kiara" (10%)
export function couponsIn(description) {
  const out = [];
  const re = /купоном\s+["«]([^"»]{2,40})["»]/gi; let m;
  while ((m = re.exec(String(description || '')))) out.push(m[1].trim().toLowerCase());
  return out;
}
