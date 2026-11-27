// Barpi · Розіграші · сторінка /dashboard/giveaways/ (v1.0.0, 27.11.2026). Дані лише з воркера barpi-giveaways.
import * as L from './lib/logic.js?v=1.0.0';

const API = '/dashboard/api/giveaways';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const S = { me: null, rows: [], templates: [], now: 0, tab: 'active', d: null, step: 'rules', filter: 'all', q: '', limit: 300, reasonFor: null, nd: null, media: [], mediaAfter: null, mediaErr: null, verify: null, log: null };

const ERR = {
  unauthorized: 'Сесія завершилась. Оновіть сторінку і увійдіть знову.', ig_not_connected: 'Instagram ще не підключено: бракує доступу до сторінки Barpi.',
  ig_error: 'Instagram відповів помилкою.', ig_unreachable: 'Instagram не відповідає. Спробуйте за хвилину.', frozen: 'Пул зафіксовано: спершу зніміть фіксацію.',
  no_media: 'Спершу виберіть публікацію.', title_required: 'Вкажіть назву розіграшу.', reason_required: 'Вкажіть причину.', empty_pool: 'У пулі немає жодного допущеного учасника.',
  not_frozen: 'Спершу зафіксуйте пул.', not_drawn: 'Жеребкування ще не проведено.', drawn_keep: 'Жеребкування проведено: результат зберігається. Змінити може лише адміністратор через анулювання.',
  admin_only: 'Це може зробити лише адміністратор.', pool_exhausted: 'У пулі не лишилось учасників.', already_replaced: 'Цього переможця вже замінено.',
  demo_private: 'Тестовий розіграш не публікується і не йде в календар.', media_locked: 'Коментарі вже зібрано: публікацію змінити не можна. Створіть новий розіграш.',
  name_required: 'Вкажіть назву шаблону.', pool_mismatch: 'Пул не збігається з контрольним хешем. Зніміть фіксацію і зафіксуйте знову.', internal: 'Внутрішня помилка сервера.',
};
function errText(e) {
  let t = ERR[e.message] || 'Помилка: ' + e.message;
  if (e.message === 'review_left') t = `Лишилось перевірити учасників: ${e.data.count}. Поставте кожному ✓ або ✗.`;
  if (e.message === 'ig_error' && e.data && e.data.ig_message) t += ' ' + e.data.ig_message;
  return t;
}
async function api(path, method = 'GET', body) {
  const r = await fetch(API + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  let j = {}; try { j = await r.json(); } catch (e) { /* не JSON */ }
  if (!r.ok) { const e = new Error(j.error || 'http_' + r.status); e.data = j; throw e; }
  return j;
}
let toastT;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast' + (bad ? ' bad' : ''); }, bad ? 6000 : 3200); }
const say = (e) => { console.error(e); toast(errText(e), true); };
const p2 = (n) => String(n).padStart(2, '0');
const fmt = (ts) => { if (!ts) return 'не задано'; const d = new Date(ts * 1000); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const toInput = (ts) => { if (!ts) return ''; const d = new Date(ts * 1000); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const fromInput = (v) => (v ? Math.floor(new Date(v).getTime() / 1000) : null);
const lines = (v) => String(v || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
const copy = async (text, ok = 'Скопійовано') => { try { await navigator.clipboard.writeText(text); toast(ok); } catch (e) { toast('Не вдалося скопіювати', true); } };
function download(name, text, type = 'text/plain') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const thumb = (g) => `<div class="thumb">${g.media_thumb ? `<img src="${esc(g.media_thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${g.source === 'demo' ? 'ТЕСТ' : g.media_thumb ? '' : 'ПОСТ'}</div>`;
function mech(cfg) {
  const m = [];
  if (cfg.answer && cfg.answer.on) m.push('Правильна відповідь');
  if (cfg.mention && cfg.mention.on) m.push('Відмітка друга ×' + cfg.mention.min);
  if (cfg.manual && cfg.manual.on) m.push('Ручне підтвердження');
  return m.length ? m : ['Випадковий коментар'];
}
const kind = (g, now) => (g.status === 'drawn' ? 'done' : g.starts_at && g.starts_at > now ? 'planned' : 'active');
function statusChip(g, now) {
  if (g.status === 'drawn') return '<span class="chip ok">Завершено</span>';
  if (g.status === 'frozen') return '<span class="chip navy">Пул зафіксовано</span>';
  if (g.starts_at && g.starts_at > now) return '<span class="chip">Заплановано</span>';
  if (g.ends_at && g.ends_at < now) return '<span class="chip warn">Чекає жеребкування</span>';
  return '<span class="chip">Триває</span>';
}
const igBanner = () => (S.me.ig.connected ? '' : `<div class="banner"><b>Instagram ще не підключено.</b> Щоб бачити публікації й коментарі @${esc(S.me.ig.username)}, системному користувачу Meta потрібна роль на сторінці Barpi. Поки що доступний режим «Тест» на вигаданих коментарях: у ньому можна пройти весь шлях і записати репетицію презентації.</div>`);

// ── головна ───────────────────────────────────────────────────────────────
async function home() {
  const j = await api('/list'); S.rows = j.rows; S.templates = j.templates; S.now = j.now; S.d = null;
  if (S.tab === 'history' && !S.log) S.log = (await api('/log')).rows;
  renderHome();
}
function renderHome() {
  const by = { active: [], planned: [], done: [] };
  for (const g of S.rows) by[kind(g, S.now)].push(g);
  const real = S.rows.filter((g) => g.source !== 'demo');
  const tab = (id, name, n) => `<button data-act="tab" data-tab="${id}" class="${S.tab === id ? 'on' : ''}">${name}${n == null ? '' : `<i>${n}</i>`}</button>`;
  const card = (g) => `<a class="gcard" href="#/g/${g.id}">${thumb(g)}<div><div class="t">${esc(g.title)} ${g.source === 'demo' ? '<span class="chip test">Тест</span>' : ''}</div>
    <div class="m"><span>${mech(g.cfg).map(esc).join(' + ')}</span><span>${g.ends_at ? 'до <b>' + esc(fmt(g.ends_at)) + '</b>' : 'без дати завершення'}</span><span>коментарів <b>${g.comments_total}</b></span><span>допущено <b>${g.pool_count ?? g.ok_count}</b></span><span>переможців <b>${g.cfg.winners || 1}</b></span></div></div>
    <div class="st">${statusChip(g, S.now)}</div></a>`;
  let body = '';
  if (S.tab === 'templates') body = S.templates.length ? `<div class="cards">${S.templates.map((t) => `<div class="gcard" style="cursor:default;grid-template-columns:1fr auto"><div><div class="t">${esc(t.name)}</div><div class="m"><span>${mech(t.config).map(esc).join(' + ')}</span><span>переможців <b>${t.config.winners || 1}</b></span><span>резервних <b>${t.config.reserves || 0}</b></span></div></div>
      <div class="row"><button class="btn sm" data-act="new" data-tpl="${t.id}">Створити з шаблону</button><button class="btn sm danger" data-act="tpl-del" data-id="${t.id}">Видалити</button></div></div>`).join('')}</div>`
    : '<div class="empty">Шаблонів ще немає. Відкрийте розіграш і натисніть «Зберегти як шаблон».</div>';
  else if (S.tab === 'history') body = S.log && S.log.length ? `<div class="tablewrap"><table><tr><th>Коли</th><th>Розіграш</th><th>Дія</th><th>Хто</th><th>Деталі</th></tr>${S.log.map(logRow(true)).join('')}</table></div>` : '<div class="empty">Історія порожня.</div>';
  else body = by[S.tab].length ? `<div class="cards">${by[S.tab].map(card).join('')}</div>` : `<div class="empty">${{ active: 'Активних розіграшів немає.', planned: 'Запланованих розіграшів немає.', done: 'Завершених розіграшів ще немає.' }[S.tab]}</div>`;
  app.innerHTML = `<div class="head"><div><h1>Розіграші Barpi</h1><p class="lead">Створіть розіграш, виберіть публікацію, задайте умови, перевірте учасників і натисніть «Розіграти». Переможців обирає сервер, кожен крок лишається в протоколі.</p></div><div class="sp"></div><button class="btn" data-act="new">+ Створити розіграш</button></div>
    ${igBanner()}
    <div class="kpis"><div class="kpi"><b>${by.active.length}</b><span>активних</span></div><div class="kpi"><b>${by.planned.length}</b><span>запланованих</span></div><div class="kpi"><b>${real.filter((g) => g.status === 'drawn').length}</b><span>проведено (без тестів)</span></div><div class="kpi"><b>${real.filter((g) => g.status === 'drawn').reduce((a, g) => a + (g.pool_count || 0), 0)}</b><span>учасників у проведених</span></div></div>
    <div class="tabs">${tab('active', 'Активні', by.active.length)}${tab('planned', 'Заплановані', by.planned.length)}${tab('done', 'Завершені', by.done.length)}${tab('templates', 'Шаблони', S.templates.length)}${tab('history', 'Історія')}</div>${body}`;
}
const ACTION = { create: 'Створено', edit: 'Змінено умови', fetch: 'Зібрано коментарі', decision: 'Рішення щодо учасника', freeze: 'Пул зафіксовано', unfreeze: 'Фіксацію знято', draw: 'Жеребкування', extra_draw: 'Додатковий вибір', verdict: 'Перевірка переможця', void: 'Жеребкування анульовано', publish: 'Протокол опубліковано', unpublish: 'Протокол приховано', calendar: 'Додано в календар', delete: 'Видалено' };
const logRow = (withTitle) => (l) => { let d = ''; try { const o = JSON.parse(l.detail || 'null'); if (o) d = Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · '); } catch (e) { /* пусто */ }
  return `<tr><td class="small" style="white-space:nowrap">${esc(fmt(l.at))}</td>${withTitle ? `<td>${l.giveaway_id ? `<a href="#/g/${l.giveaway_id}">${esc(l.title || '№' + l.giveaway_id)}</a>` : ''}</td>` : ''}<td><b>${esc(ACTION[l.action] || l.action)}</b></td><td class="small">${esc(l.by || '')}</td><td class="small muted"><div class="cm">${esc(d)}</div></td></tr>`; };

// ── новий розіграш ────────────────────────────────────────────────────────
async function loadMedia(more) {
  if (!S.me.ig.connected) return;
  try { const j = await api('/media' + (more && S.mediaAfter ? '?after=' + encodeURIComponent(S.mediaAfter) : '')); S.media = more ? S.media.concat(j.items) : j.items; S.mediaAfter = j.after; S.mediaErr = null; }
  catch (e) { S.mediaErr = errText(e); }
}
function mediaGrid(sel) {
  if (!S.me.ig.connected) return '';
  if (S.mediaErr) return `<div class="banner bad">${esc(S.mediaErr)}</div>`;
  if (!S.media.length) return '<p class="muted small">Завантажую публікації…</p>';
  return `<div class="media">${S.media.map((m) => `<button type="button" class="mi ${sel && sel.id === m.id ? 'on' : ''}" data-act="pick" data-id="${esc(m.id)}"><div class="ph">${m.thumb ? `<img src="${esc(m.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : esc(m.type || 'ПОСТ')}</div><div class="cp"><b>${esc(fmt(m.ts))} · 💬 ${m.comments}</b>${esc(m.caption || 'без підпису')}</div></button>`).join('')}</div>${S.mediaAfter ? '<p style="margin-top:10px"><button class="btn sm soft" data-act="media-more">Показати старіші</button></p>' : ''}`;
}
function renderNew() {
  const n = S.nd;
  app.innerHTML = `<p><a href="#/">← Усі розіграші</a></p><div class="head"><h1>Новий розіграш</h1></div>${igBanner()}
  <div class="panel"><div class="grid2">
    <label class="f">Назва розіграшу<input type="text" id="n_title" maxlength="160" value="${esc(n.title)}" placeholder="Напр.: Адвент-календар, день 5"></label>
    <label class="f">Шаблон<select id="n_tpl"><option value="">Без шаблону</option>${S.templates.map((t) => `<option value="${t.id}" ${String(n.tpl) === String(t.id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
    <label class="f">Початок приймання коментарів<small>час вашого пристрою; порожньо = з моменту публікації</small><input type="datetime-local" id="n_start" value="${esc(n.starts)}"></label>
    <label class="f">Завершення приймання коментарів<input type="datetime-local" id="n_end" value="${esc(n.ends)}"></label>
  </div>
  <div class="row" style="margin-top:16px"><label class="check ${n.source === 'instagram' ? 'on' : ''}" style="flex:1;min-width:240px"><input type="radio" name="n_src" value="instagram" ${n.source === 'instagram' ? 'checked' : ''} ${S.me.ig.connected ? '' : 'disabled'}><div><b>Публікація Instagram</b><span>Коментарі з @${esc(S.me.ig.username)} через офіційний API</span></div></label>
    <label class="check ${n.source === 'demo' ? 'on' : ''}" style="flex:1;min-width:240px"><input type="radio" name="n_src" value="demo" ${n.source === 'demo' ? 'checked' : ''}><div><b>Тест</b><span>60 вигаданих коментарів для репетиції. Не публікується</span></div></label></div>
  ${n.source === 'instagram' ? `<h2 style="margin-top:18px">Публікація</h2><p class="muted small">Виберіть пост, під яким проводиться розіграш.</p>${mediaGrid(n.media)}` : ''}
  <div class="row" style="margin-top:18px"><button class="btn" data-act="create">Створити і перейти до умов</button><a class="btn sec" href="#/">Скасувати</a></div></div>`;
}
const keepNew = () => { if (!$('#n_title')) return; Object.assign(S.nd, { title: $('#n_title').value, tpl: $('#n_tpl').value, starts: $('#n_start').value, ends: $('#n_end').value }); };

// ── сторінка розіграшу ────────────────────────────────────────────────────
async function openG(id, keep) {
  const y = window.scrollY;
  S.d = await api('/' + id);
  if (!keep) { const g = S.d.g; S.step = g.status !== 'open' ? 'draw' : S.d.stats.comments_total ? 'people' : 'rules'; S.filter = 'all'; S.q = ''; S.limit = 300; S.reasonFor = null; S.verify = null; if (S.next) { S.step = S.next; S.next = null; } }
  renderG();
  if (keep) window.scrollTo(0, y);
}
const reload = () => openG(S.d.g.id, true);
const cur = () => S.d.winners.filter((w) => !w.void && w.gen === S.d.g.gen);
function renderG() {
  const d = S.d, g = d.g, open = g.status === 'open';
  const step = (id, n, t, s) => `<button data-act="step" data-step="${id}" class="${S.step === id ? 'on' : ''}">${n}. ${t}<small>${s}</small></button>`;
  app.innerHTML = `<p><a href="#/">← Усі розіграші</a></p>
  <div class="head">${thumb(g)}<div style="flex:1;min-width:220px"><h1>${esc(g.title)}</h1><p class="lead" style="margin-bottom:0">${statusChip(g, d.now)} ${g.source === 'demo' ? '<span class="chip test">Тест</span>' : ''} ${mech(g.cfg).map((m) => `<span class="chip">${esc(m)}</span>`).join(' ')} ${g.media_permalink ? `<a href="${esc(g.media_permalink)}" target="_blank" rel="noopener noreferrer">Відкрити пост ↗</a>` : ''}</p></div></div>
  <div class="steps">${step('rules', 1, 'Умови', g.ends_at ? 'до ' + esc(fmt(g.ends_at)) : 'без дати завершення')}${step('people', 2, 'Учасники', `допущено ${d.stats.ok} з ${d.stats.accounts}`)}${step('draw', 3, 'Жеребкування', g.status === 'drawn' ? 'проведено ' + esc(fmt(g.drawn_at)) : open ? 'пул не зафіксовано' : 'пул зафіксовано')}${step('proto', 4, 'Протокол', `${d.log.length} записів`)}</div>
  <div id="stepbox">${{ rules: stepRules, people: stepPeople, draw: stepDraw, proto: stepProto }[S.step]()}</div>`;
}
function stepRules() {
  const g = S.d.g, c = g.cfg, open = g.status === 'open', dis = open ? '' : 'disabled';
  const A = c.answer || {}, M = c.mention || {}, chk = (id, on, t, s, extra = '') => `<label class="check ${on ? 'on' : ''}"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${extra || dis}><div><b>${t}</b><span>${s}</span></div></label>`;
  return `${open ? '' : '<div class="banner">Пул зафіксовано, умови змінити не можна. Доступні лише назва і святкове оформлення.</div>'}
  <div class="panel"><h2>Основне</h2><div class="grid2">
    <label class="f">Назва розіграшу<input type="text" id="f_title" maxlength="160" value="${esc(g.title)}"></label>
    <label class="f">Instagram-акаунт<input type="text" value="@${esc(S.me.ig.username)}" disabled></label>
    <label class="f">Початок приймання коментарів<small>порожньо = з моменту публікації</small><input type="datetime-local" id="f_start" value="${toInput(g.starts_at)}" ${dis}></label>
    <label class="f">Завершення приймання коментарів<input type="datetime-local" id="f_end" value="${toInput(g.ends_at)}" ${dis}></label>
    <label class="f">Кількість переможців<input type="number" id="f_win" min="1" max="100" value="${c.winners || 1}" ${dis}></label>
    <label class="f">Кількість резервних<small>стають переможцями по черзі, якщо хтось не виконав умови</small><input type="number" id="f_res" min="0" max="100" value="${c.reserves ?? 2}" ${dis}></label>
  </div></div>
  <div class="panel"><h2>Механіка</h2><p class="muted small" style="margin-bottom:10px">Без позначок = випадковий коментар. Умови можна поєднувати.</p><div style="display:grid;gap:10px">
    ${chk('f_ans', A.on, 'Правильна відповідь', 'Регістр і розділові знаки не важливі. Схожі написання потрапляють на ручну перевірку.')}
    <div class="sub-f grid2" id="ans_box" ${A.on ? '' : 'hidden'}><label class="f">Правильні слова<small>кожне слово з нового рядка, варіанти написання через кому</small><textarea id="f_groups" ${dis} placeholder="яловичина, beef&#10;курка">${esc((A.groups || []).map((x) => x.join(', ')).join('\n'))}</textarea></label>
      <label class="f">Скільки різних слів треба знайти<small>порожньо = усі</small><input type="number" id="f_need" min="1" max="30" value="${A.groups && A.need && A.need < A.groups.length ? A.need : ''}" ${dis}></label></div>
    ${chk('f_men', M.on, 'Відмітка друга', 'У коментарі має бути @акаунт. Себе й @' + esc(S.me.ig.username) + ' не рахуємо. Чи існує такий акаунт, Instagram не повідомляє.')}
    <div class="sub-f" id="men_box" ${M.on ? '' : 'hidden'}><label class="f" style="max-width:260px">Скільки різних відміток потрібно<input type="number" id="f_min" min="1" max="10" value="${M.min || 1}" ${dis}></label></div>
    ${chk('f_man', c.manual && c.manual.on, 'Ручне підтвердження учасників', 'Для творчих конкурсів: кожного учасника допускаєте ви.')}
    ${chk('f_one', c.one_per_account !== false, 'Один акаунт, один шанс', 'Якщо вимкнути, кожен коментар, що відповідає умовам, дає окремий шанс.')}
  </div></div>
  <div class="panel"><h2>Подарунки і правила</h2><div class="grid2">
    <label class="f">Подарунки<small>рядок на кожне місце: перший рядок для першого переможця</small><textarea id="f_prizes" ${dis} placeholder="Набір Barpi «Яловичина»&#10;Набір Barpi «Курка»">${esc((c.prizes || []).join('\n'))}</textarea></label>
    <label class="f">Виключити акаунти<small>через кому або з нового рядка; @${esc(S.me.ig.username)} виключено завжди</small><textarea id="f_excl" ${dis} placeholder="alona.smm, partner_shop">${esc((c.exclude || []).join(', '))}</textarea></label>
    <label class="f" style="grid-column:1/-1">Додаткові умови участі<small>Потраплять у протокол. Підписку, лайк і репост у сторіс Instagram API не показує: їх перевіряють вручну в обраного переможця.</small><textarea id="f_rules" ${dis} placeholder="Бути підписаним на @barpi.ua, поставити лайк, доставка лише по Україні">${esc(c.rules || '')}</textarea></label>
  </div><div style="margin-top:12px">${chk('f_fest', c.festive, 'Святкове оформлення презентації', 'Сніг, зірки й подарунки в режимі 9:16. Панель керування лишається звичайною.', ' ')}</div></div>
  <div class="row"><button class="btn" data-act="save">Зберегти</button><button class="btn sec" data-act="tpl-save">Зберегти як шаблон</button>${g.source === 'instagram' ? `<button class="btn sec" data-act="calendar">${g.calendar_id ? 'Оновити в маркетинговому календарі' : 'Додати в маркетинговий календар'}</button>` : ''}<span style="flex:1"></span>${g.status !== 'drawn' || (S.me.isAdmin && g.source === 'demo') ? '<button class="btn danger" data-act="del">Видалити розіграш</button>' : ''}</div>`;
}
function readRules() {
  const v = (id) => ($('#' + id) ? $('#' + id).value : ''), on = (id) => !!($('#' + id) && $('#' + id).checked);
  const groups = L.parseGroups(v('f_groups'));
  if (on('f_ans') && !groups.length) throw new Error('Додайте хоча б одне правильне слово.');
  return { title: v('f_title'), starts_at: fromInput(v('f_start')), ends_at: fromInput(v('f_end')), cfg: {
    one_per_account: on('f_one'), exclude: v('f_excl').split(/[\s,]+/).filter(Boolean), answer: { on: on('f_ans'), groups, need: Number(v('f_need')) || groups.length },
    mention: { on: on('f_men'), min: Number(v('f_min')) || 1 }, manual: { on: on('f_man') }, winners: Number(v('f_win')) || 1, reserves: Number(v('f_res')) || 0, prizes: lines(v('f_prizes')), rules: v('f_rules'), festive: on('f_fest') } };
}
const LBL = { ok: ['ok', 'Допущено'], fail: ['bad', 'Відхилено'], review: ['warn', 'Перевірити'] };
function stepPeople() {
  const d = S.d, g = d.g, open = g.status === 'open', s = d.stats;
  const poolN = new Map(d.pool.map((p) => [p.ig_id, p.n]));
  let okN = 0; const rows = [];
  const q = S.q.trim().toLowerCase();
  for (const e of d.entries) {
    const n = e.final === 'ok' ? (open ? ++okN : poolN.get(String(e.ig_id))) : null;
    if (S.filter !== 'all' && e.final !== S.filter) continue;
    if (q && !(e.username.includes(q.replace(/^@/, '')) || String(e.text || '').toLowerCase().includes(q) || String(n) === q)) continue;
    rows.push({ e, n });
  }
  const f = (id, t, n) => `<button data-act="filter" data-f="${id}" class="${S.filter === id ? 'on' : ''}">${t}<i>${n}</i></button>`;
  const tr = ({ e, n }) => `<tr><td class="num">${n ?? ''}</td><td><a href="https://www.instagram.com/${esc(e.username)}/" target="_blank" rel="noopener noreferrer"><b>@${esc(e.username)}</b></a>${e.comments > 1 ? `<div class="small muted">коментарів: ${e.comments}</div>` : ''}</td>
    <td><div class="cm">${esc(e.text)}</div><div class="small muted">${esc(fmt(e.ts))}${e.like_count ? ' · ♥ ' + e.like_count : ''}</div></td>
    <td><span class="chip ${LBL[e.final][0]}">${LBL[e.final][1]}</span><div class="small muted" style="margin-top:4px">${esc(e.decided ? 'рішення оператора' + (e.reason ? ': ' + e.reason : '') : e.reasons.join('; '))}</div>
      ${S.reasonFor === e.username ? `<div class="reason"><input type="text" id="reason_in" placeholder="Причина відхилення" maxlength="300"><button class="btn sm danger" data-act="dec" data-u="${esc(e.username)}" data-d="fail">Відхилити</button></div>` : ''}</td>
    <td>${open ? `<div class="acts"><button class="y ${e.decided && e.final === 'ok' ? 'on' : ''}" title="Допустити" aria-label="Допустити" data-act="dec" data-u="${esc(e.username)}" data-d="ok">✓</button><button class="n ${e.decided && e.final === 'fail' ? 'on' : ''}" title="Не відповідає умовам" aria-label="Не відповідає умовам" data-act="ask-reason" data-u="${esc(e.username)}">✗</button><button class="q ${e.decided && e.final === 'review' ? 'on' : ''}" title="Потребує перевірки" aria-label="Потребує перевірки" data-act="dec" data-u="${esc(e.username)}" data-d="review">?</button>${e.decided ? `<button title="Повернути автоматичне рішення" aria-label="Повернути автоматичне рішення" data-act="dec" data-u="${esc(e.username)}" data-d="auto">↺</button>` : ''}</div>` : ''}</td></tr>`;
  let err = ''; try { const fe = g.fetch_error ? JSON.parse(g.fetch_error) : null; if (fe) err = `<div class="banner bad">Останній збір завершився помилкою: ${esc(ERR[fe.code] || fe.code)} ${esc(fe.ig_message || '')}</div>`; } catch (e) { /* пусто */ }
  return `${err}${g.fetch_partial ? '<div class="banner">Коментарів дуже багато: зібрано не всі. Натисніть «Оновити коментарі» ще раз.</div>' : ''}
  <div class="panel"><div class="row">${open && g.source === 'instagram' ? '<button class="btn" data-act="fetch">Оновити коментарі</button>' : ''}<span class="muted small">${g.source === 'demo' ? 'Тестові коментарі, вигадані акаунти' : g.fetched_at ? 'Зібрано ' + esc(fmt(g.fetched_at)) + ' через Instagram Graph API' : 'Коментарі ще не збирали'}</span><span style="flex:1"></span>
    <span class="small muted">коментарів ${s.comments_total} · відповідей ${s.replies} (не беруть участі)${s.gone ? ' · зникло з Instagram ' + s.gone : ''} · у періоді ${s.in_window}</span></div></div>
  <div class="row" style="margin-bottom:12px"><div class="tabs" style="margin:0">${f('all', 'Усі', s.entries)}${f('ok', 'Допущені', s.ok)}${f('review', 'Перевірити', s.review)}${f('fail', 'Відхилені', s.fail)}</div><span style="flex:1"></span><input type="search" id="q" placeholder="Пошук: @акаунт, слово або №" value="${esc(S.q)}" style="max-width:300px;margin:0"></div>
  ${rows.length ? `<div class="tablewrap"><table><tr><th>№</th><th>Акаунт</th><th>Коментар</th><th>Статус</th><th></th></tr>${rows.slice(0, S.limit).map(tr).join('')}</table></div>${rows.length > S.limit ? `<p style="margin-top:10px"><button class="btn sm soft" data-act="more">Показати ще (${rows.length - S.limit})</button></p>` : ''}` : '<div class="empty">Нікого не знайдено.</div>'}
  <div class="panel" style="margin-top:14px"><div class="row">${open ? `<div style="flex:1;min-width:240px"><b>Допущено ${s.ok}</b>${s.review ? `, ще перевірити <b style="color:var(--amber)">${s.review}</b>` : ''}<div class="small muted">Після фіксації список і номери не змінюються. Номери йдуть за часом коментаря.</div></div><button class="btn" data-act="freeze" ${s.review || !s.ok ? 'disabled' : ''}>🔒 Підтвердити фінальний список (${s.ok})</button>`
    : `<div style="flex:1"><b>Пул зафіксовано: ${g.pool_count}</b> · ${esc(fmt(g.frozen_at))} · ${esc(g.frozen_by || '')}<div class="mono muted">SHA-256: ${esc(g.pool_hash)}</div></div>${g.status === 'frozen' ? '<button class="btn sec" data-act="unfreeze">Зняти фіксацію</button>' : ''}`}</div></div>`;
}
function stepDraw() {
  const d = S.d, g = d.g, c = g.cfg;
  if (g.status === 'open') return `<div class="empty"><p style="margin-bottom:12px">Спершу перевірте учасників і підтвердьте фінальний список.</p><button class="btn" data-act="step" data-step="people">Перейти до учасників</button></div>`;
  if (g.status === 'frozen') {
    const W = Math.min(c.winners || 1, g.pool_count), R = Math.min(c.reserves || 0, g.pool_count - W);
    return `${g.gen ? '<div class="banner bad">Попереднє жеребкування анульовано. Запис про це лишається в протоколі.</div>' : ''}<div class="panel"><div class="kpis" style="margin-bottom:14px"><div class="kpi"><b>${g.pool_count}</b><span>учасників у пулі</span></div><div class="kpi"><b>${W}</b><span>переможців</span></div><div class="kpi"><b>${R}</b><span>резервних</span></div></div>
      <p class="muted small" style="margin-bottom:14px">Кожен учасник має однаковий шанс. Сервер бере криптографічно випадкове зерно, обирає номери і записує результат. Повторне натискання результат не змінює.</p>
      <button class="btn big" data-act="draw-ask">🎁 РОЗІГРАТИ ПОДАРУНКИ</button>
      <p style="margin-top:14px"><button class="btn sm sec" data-act="unfreeze">Зняти фіксацію і повернутись до списку</button></p></div>`;
  }
  const ws = cur(), win = ws.filter((w) => w.role === 'winner').sort((a, b) => a.position - b.position || a.id - b.id), res = ws.filter((w) => w.role === 'reserve').sort((a, b) => a.position - b.position);
  const text = new Map(d.entries.map((e) => [String(e.ig_id), e.text]));
  const replaced = new Set(ws.map((w) => w.promoted_from).filter(Boolean));
  const wcard = (w) => `<div class="winner ${w.role === 'reserve' ? 'reserve' : ''} ${w.verdict === 'failed' ? 'failed' : ''}"><div class="pos">${w.role === 'reserve' ? 'Р' + w.position : w.position}</div>
    <div><div class="nm"><a href="https://www.instagram.com/${esc(w.username)}/" target="_blank" rel="noopener noreferrer">@${esc(w.username)}</a></div>
      <div class="small muted">№ ${w.n} у пулі${w.prize ? ' · <b>' + esc(w.prize) + '</b>' : ''}${w.promoted_from ? ' · заміна попереднього переможця' : ''}</div>
      <div class="small" style="margin-top:4px;overflow-wrap:anywhere">${esc(text.get(String(w.ig_id)) || '')}</div>
      ${w.verdict === 'failed' ? `<div class="small" style="color:var(--red)">Не виконав умови: ${esc(w.verdict_reason || '')}</div>` : ''}
      ${S.reasonFor === 'w' + w.id ? `<div class="reason"><input type="text" id="reason_in" placeholder="Що саме не виконано" maxlength="300"><button class="btn sm danger" data-act="verdict" data-id="${w.id}" data-v="failed">Підтвердити</button></div>` : ''}</div>
    <div class="va row">${w.role === 'winner' ? (w.verdict === 'ok' ? '<span class="chip ok">Умови виконано</span>' : w.verdict === 'failed' ? (replaced.has(w.id) ? '<span class="chip bad">Замінено</span>' : `<button class="btn sm" data-act="extra" data-id="${w.id}">Обрати наступного</button>`)
      : `<button class="btn sm" data-act="verdict" data-id="${w.id}" data-v="ok">✓ Умови виконано</button><button class="btn sm danger" data-act="ask-reason" data-u="w${w.id}">✗ Не виконав</button>`) : '<span class="chip">Резерв</span>'}</div></div>`;
  const link = g.public_token ? `${location.origin}/giveaway/?t=${g.public_token}` : '';
  return `<div class="row" style="margin-bottom:14px"><button class="btn" data-act="show">▶ Презентація 9:16</button><button class="btn sec" data-act="copy-win">Скопіювати переможців</button><button class="btn sec" data-act="csv">Завантажити результати</button><button class="btn sec" data-act="verify">Перевірити жеребкування</button></div>
    ${S.verify ? `<div class="banner ${S.verify.ok ? 'ok' : 'bad'}">${esc(S.verify.text)}</div>` : ''}
    <h2>Переможці</h2>${win.map(wcard).join('')}
    ${res.length ? `<h2 style="margin-top:18px">Резервні</h2>${res.map(wcard).join('')}` : ''}
    <div class="panel" style="margin-top:18px"><h2>Публікація результатів</h2>${g.source === 'demo' ? '<p class="muted">Тестовий розіграш не публікується.</p>' : `<p class="muted small" style="margin-bottom:10px">Публічна сторінка показує назву, умови, переможців і контрольний хеш пулу. Повний список учасників не публікується.</p>
      <div class="row"><button class="btn ${g.published ? 'sec' : ''}" data-act="publish" data-on="${g.published ? 0 : 1}">${g.published ? 'Приховати протокол' : 'Опублікувати протокол'}</button>${g.published ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="mono">${esc(link)}</a><button class="btn sm soft" data-act="copy-link" data-link="${esc(link)}">Копіювати</button>` : ''}</div>`}</div>
    ${S.me.isAdmin ? `<div class="panel"><h2>Анулювання</h2><p class="muted small" style="margin-bottom:10px">Лише для помилки в умовах або списку. Запис про анулювання і причина лишаються в протоколі назавжди.</p><div class="reason" style="margin:0"><input type="text" id="void_in" placeholder="Причина анулювання" maxlength="300" style="margin:0"><button class="btn danger" data-act="void">Анулювати жеребкування</button></div></div>` : ''}`;
}
function stepProto() {
  const d = S.d, g = d.g, c = g.cfg;
  const draws = d.draws.map((x) => `<tr><td>${x.round}${x.gen !== g.gen || x.void ? ' <span class="chip bad">анульовано</span>' : ''}</td><td>${x.kind === 'main' ? 'основне' : 'додатковий вибір'}</td><td class="small">${esc(fmt(x.at))}<br>${esc(x.by || '')}</td><td class="mono">${esc(x.seed)}</td><td class="mono">${esc(JSON.parse(x.picks).join(', '))}</td><td class="small">${esc(x.void_reason || '')}</td></tr>`).join('');
  return `<div class="panel"><h2>Умови і підсумок</h2><div class="grid2 small">
      <div><b>Публікація:</b> ${g.media_permalink ? `<a href="${esc(g.media_permalink)}" target="_blank" rel="noopener noreferrer">${esc(g.media_permalink)}</a>` : g.source === 'demo' ? 'тест' : 'не вибрано'}</div>
      <div><b>Період:</b> ${esc(fmt(g.starts_at))} … ${esc(fmt(g.ends_at))}</div>
      <div><b>Механіка:</b> ${mech(c).map(esc).join(' + ')}; ${c.one_per_account !== false ? 'один акаунт, один шанс' : 'кожен коментар окремий шанс'}</div>
      <div><b>Правильні слова:</b> ${c.answer && c.answer.on ? esc(c.answer.groups.map((x) => x.join(' / ')).join('; ')) + ` (потрібно ${c.answer.need})` : 'не застосовується'}</div>
      <div><b>Коментарів:</b> ${d.stats.comments_total}, акаунтів ${d.stats.accounts}, допущено ${g.pool_count ?? d.stats.ok}</div>
      <div><b>Подарунки:</b> ${esc((c.prizes || []).join('; ') || 'не вказано')}</div>
      <div style="grid-column:1/-1"><b>Додаткові умови:</b> ${esc(c.rules || 'немає')}</div>
      <div style="grid-column:1/-1"><b>Контрольний хеш пулу (SHA-256):</b> <span class="mono">${esc(g.pool_hash || 'пул ще не зафіксовано')}</span></div>
      <div style="grid-column:1/-1"><b>Алгоритм:</b> ${esc(L.ALGO)}: номер = SHA-256(алгоритм | зерно | хеш пулу | лічильник), перші 64 біти, значення поза рівним діапазоном відкидаються; обраний номер вилучається з подальшого вибору.</div></div>
    <p style="margin-top:12px"><button class="btn sm sec" data-act="json">Завантажити протокол (JSON)</button></p></div>
    ${draws ? `<h2>Жеребкування</h2><div class="tablewrap" style="margin-bottom:14px"><table><tr><th>Коло</th><th>Тип</th><th>Коли і хто</th><th>Зерно</th><th>Номери</th><th>Причина анулювання</th></tr>${draws}</table></div>` : ''}
    <h2>Історія змін і перевірок</h2><div class="tablewrap"><table><tr><th>Коли</th><th>Дія</th><th>Хто</th><th>Деталі</th></tr>${d.log.map(logRow(false)).join('')}</table></div>`;
}
function modal(html) { const m = document.createElement('div'); m.className = 'modal-bg'; m.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`; m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); }); document.body.append(m); return m; }
async function verify() {
  const d = S.d, g = d.g; const bad = [];
  if ((await L.poolHash(d.pool)) !== g.pool_hash) bad.push('хеш списку учасників не збігається');
  for (const x of d.draws.filter((x) => !x.void && x.gen === g.gen)) {
    const picks = await L.draw(x.seed, x.pool_hash, x.pool_count, JSON.parse(x.picks).length, JSON.parse(x.taken || '[]'));
    if (JSON.stringify(picks) !== x.picks.replace(/\s/g, '')) bad.push(`коло ${x.round}: номери не збігаються`);
  }
  const map = new Map(d.pool.map((p) => [p.n, p.username]));
  for (const w of cur()) if (map.get(w.n) !== w.username) bad.push(`№ ${w.n}: акаунт не збігається зі списком`);
  S.verify = bad.length ? { ok: false, text: 'Перевірка не пройшла: ' + bad.join('; ') } : { ok: true, text: `Перевірено у вашому браузері: хеш списку з ${d.pool.length} учасників збігається, номери з кожного кола відтворено із зерна, акаунти відповідають номерам.` };
  renderG();
}

// ── презентація 9:16 ──────────────────────────────────────────────────────
function startShow() {
  const d = S.d, g = d.g, fest = !!g.cfg.festive;
  const ws = cur().filter((w) => w.role === 'winner' && w.verdict !== 'failed').sort((a, b) => a.position - b.position);
  if (!ws.length) return toast('Немає переможців для показу', true);
  const names = d.pool.map((p) => p.username), calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div'); el.className = 'show' + (fest ? ' festive' : '');
  el.innerHTML = `<div class="stage"><div class="paws" aria-hidden="true">${'🐾'.repeat(120)}</div><canvas></canvas><div class="lay"><div class="brand">BARPI<small>${fest ? 'СВЯТКОВИЙ РОЗІГРАШ' : 'РОЗІГРАШ'}</small></div><div class="ttl"></div><div class="mid"></div><div class="foot"></div></div></div>
    <div class="ctl"><button data-s="next">Далі · пробіл</button><button data-s="full">На весь екран · F</button><button data-s="clean">Сховати кнопки · H</button><button data-s="close">Закрити · Esc</button><div class="hint">Запишіть екран у межах вертикального кадру. Анімація показує вже записаний результат.</div></div>`;
  document.body.append(el);
  const stage = $('.stage', el), mid = $('.mid', el), cv = $('canvas', el), ctx = cv.getContext('2d');
  $('.ttl', el).textContent = g.title;
  $('.foot', el).textContent = `@${S.me.ig.username} · ${fmt(g.drawn_at).slice(0, 10)} · учасників: ${g.pool_count}${g.source === 'demo' ? ' · ТЕСТ' : ''}`;
  let i = -1, busy = false, timer = null, raf = 0, parts = [], alive = true;
  const fit = () => { const r = stage.getBoundingClientRect(), k = Math.min(2, devicePixelRatio || 1); cv.width = r.width * k; cv.height = r.height * k; };
  fit(); addEventListener('resize', fit);
  const GL = fest ? ['🎁', '⭐', '❄️', '🐾', '✨'] : ['🐾'];
  const COL = ['#BAD9F4', '#ffffff', '#7fb2ea', '#e9f2fd'];
  function burst() {
    if (calm) return;
    const w = cv.width, h = cv.height, n = fest ? 150 : 110;
    for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, v = (0.006 + Math.random() * 0.016) * h;
      parts.push({ x: w / 2, y: h * 0.52, vx: Math.cos(a) * v * 0.8, vy: Math.sin(a) * v - h * 0.008, g: h * 0.00028, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, s: (0.008 + Math.random() * 0.012) * w, c: COL[k % COL.length], gl: Math.random() < (fest ? 0.3 : 0.08) ? GL[k % GL.length] : null, life: 1, d: 0.006 + Math.random() * 0.006 }); }
    loop();
  }
  function snow() { if (calm || !fest) return; const w = cv.width, h = cv.height; for (let k = 0; k < 26; k++) parts.push({ x: Math.random() * w, y: Math.random() * h, vx: 0, vy: (0.0008 + Math.random() * 0.0014) * h, g: 0, r: 0, vr: 0.01, s: (0.012 + Math.random() * 0.014) * w, c: '#fff', gl: k % 3 ? '❄️' : '✨', life: 1, d: 0, loop: true }); loop(); }
  function loop() {
    if (raf || !alive) return;
    const step = () => { raf = 0; if (!alive) return; const w = cv.width, h = cv.height; ctx.clearRect(0, 0, w, h);
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.d; if (p.loop && p.y > h + p.s) { p.y = -p.s; p.x = Math.random() * w; }
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6)) * (p.loop ? 0.55 : 1); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        if (p.gl) { ctx.font = `${p.s * 1.9}px serif`; ctx.textAlign = 'center'; ctx.fillText(p.gl, 0, 0); } else { ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
        ctx.restore(); }
      if (parts.length) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }
  const size = (t) => `${Math.max(3.2, Math.min(13, 86 / (t.length * 0.66)))}cqw`;
  function intro() { mid.innerHTML = `<div class="lbl">Учасників у розіграші</div><div class="big">${g.pool_count}</div><div class="lbl" style="margin-top:2cqh">${ws.length === 1 ? 'Один переможець' : 'Переможців: ' + ws.length}</div>`; }
  function reveal(w, k) {
    busy = true;
    mid.innerHTML = `<div class="lbl">${ws.length === 1 ? 'Переможець' : `Переможець ${k + 1} / ${ws.length}`}</div>${w.prize ? '<div class="prize"></div>' : ''}<div class="name spin"></div>`;
    if (w.prize) $('.prize', mid).textContent = '🎁 ' + w.prize;
    const nm = $('.name', mid), win = '@' + w.username;
    const land = () => { nm.textContent = win; nm.style.fontSize = size(win); nm.className = 'name hit'; burst(); busy = false; };
    if (calm || names.length < 2) return land();
    let delay = 45, total = 0;
    const tick = () => { const t = '@' + names[Math.floor(Math.random() * names.length)]; nm.textContent = t; nm.style.fontSize = size(t); total += delay; delay *= 1.085; if (total > 2600) timer = setTimeout(land, delay); else timer = setTimeout(tick, delay); };
    tick();
  }
  function finale() { mid.innerHTML = `<div class="lbl">Вітаємо переможців</div><div class="all">${ws.map((w, k) => `<div style="animation-delay:${k * 60}ms"><b>@${esc(w.username)}</b>${w.prize ? `<span>${esc(w.prize)}</span>` : ''}</div>`).join('')}</div>`; burst(); }
  function next() { if (busy) return; i++; if (i < ws.length) reveal(ws[i], i); else if (i === ws.length && ws.length > 1) finale(); else { i = Math.min(i, ws.length); el.classList.remove('clean'); } }
  function close() { alive = false; clearTimeout(timer); cancelAnimationFrame(raf); removeEventListener('keydown', key, true); removeEventListener('resize', fit); if (document.fullscreenElement) document.exitFullscreen(); el.remove(); }
  function key(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'а') { if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().then(fit, () => {}); }
    else if (e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'р') el.classList.toggle('clean');
  }
  addEventListener('keydown', key, true);
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) { if (e.target.closest('.stage')) next(); return; }
    ({ next, close, full: () => (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen().then(fit, () => {})), clean: () => el.classList.toggle('clean') })[b.dataset.s](); });
  intro(); snow();
}

// ── дії ───────────────────────────────────────────────────────────────────
const ACT = {
  tab: async (b) => { S.tab = b.dataset.tab; if (S.tab === 'history') S.log = (await api('/log')).rows; renderHome(); },
  new: async (b) => { S.nd = { title: '', source: S.me.ig.connected ? 'instagram' : 'demo', media: null, starts: '', ends: '', tpl: b.dataset.tpl || '' }; location.hash = '#/new'; },
  pick: (b) => { keepNew(); S.nd.media = S.media.find((m) => m.id === b.dataset.id) || null; if (S.nd.media && !S.nd.title) S.nd.title = (S.nd.media.caption || '').split('\n')[0].slice(0, 80); renderNew(); },
  'media-more': async () => { keepNew(); await loadMedia(true); renderNew(); },
  create: async () => {
    keepNew(); const n = S.nd;
    if (!n.title.trim()) return toast(ERR.title_required, true);
    if (n.source === 'instagram' && !n.media) return toast(ERR.no_media, true);
    const tpl = S.templates.find((t) => String(t.id) === String(n.tpl));
    const j = await api('', 'POST', { title: n.title, source: n.source, media: n.media, starts_at: fromInput(n.starts), ends_at: fromInput(n.ends), cfg: tpl ? tpl.config : {} });
    S.next = 'rules'; S.nd = null; location.hash = '#/g/' + j.id;
  },
  step: (b) => { S.step = b.dataset.step; S.reasonFor = null; renderG(); window.scrollTo(0, 0); },
  save: async () => { const b = readRules(); await api('/' + S.d.g.id, 'PATCH', S.d.g.status === 'open' ? b : { title: b.title, cfg: { festive: b.cfg.festive } }); toast('Збережено'); await reload(); },
  'tpl-save': async () => { const b = readRules(); const m = modal(`<h2>Зберегти як шаблон</h2><label class="f">Назва шаблону<input type="text" id="tpl_name" maxlength="120" value="${esc(mech(b.cfg).join(' + '))}"></label><div class="row" style="margin-top:14px"><button class="btn" id="tpl_ok">Зберегти</button><button class="btn sec" data-close>Скасувати</button></div>`);
    $('#tpl_ok', m).onclick = async () => { try { await api('/templates', 'POST', { name: $('#tpl_name', m).value, cfg: b.cfg }); m.remove(); toast('Шаблон збережено'); } catch (e) { say(e); } }; },
  'tpl-del': async (b) => { await api('/templates/' + b.dataset.id, 'DELETE'); await home(); },
  calendar: async () => { const j = await api('/' + S.d.g.id + '/calendar', 'POST', {}); toast(j.updated ? 'Подію в календарі оновлено' : 'Додано в маркетинговий календар'); await reload(); },
  del: () => { const m = modal(`<h2>Видалити розіграш?</h2><p class="muted">«${esc(S.d.g.title)}» зникне зі списків. Запис лишиться в історії.</p><div class="row" style="margin-top:14px"><button class="btn danger" id="del_ok">Видалити</button><button class="btn sec" data-close>Скасувати</button></div>`);
    $('#del_ok', m).onclick = async () => { try { await api('/' + S.d.g.id, 'DELETE'); m.remove(); location.hash = '#/'; } catch (e) { say(e); } }; },
  fetch: async (b) => { b.disabled = true; b.textContent = 'Збираю коментарі…'; try { const j = await api('/' + S.d.g.id + '/fetch', 'POST', {}); toast(`Нових коментарів: ${j.added}${j.gone ? ', зникло: ' + j.gone : ''}`); } finally { await reload(); } },
  filter: (b) => { S.filter = b.dataset.f; S.limit = 300; renderG(); },
  more: () => { S.limit += 300; renderG(); },
  'ask-reason': (b) => { S.reasonFor = S.reasonFor === b.dataset.u ? null : b.dataset.u; renderG(); const i = $('#reason_in'); if (i) i.focus(); },
  dec: async (b) => { const d = b.dataset.d, reason = d === 'fail' ? ($('#reason_in') ? $('#reason_in').value.trim() : '') : ''; if (d === 'fail' && !reason) return toast(ERR.reason_required, true);
    await api('/' + S.d.g.id + '/decision', 'POST', { username: b.dataset.u, decision: d, reason }); S.reasonFor = null; await reload(); },
  freeze: async () => { const j = await api('/' + S.d.g.id + '/freeze', 'POST', {}); toast(`Пул зафіксовано: ${j.pool}`); S.step = 'draw'; await reload(); window.scrollTo(0, 0); },
  unfreeze: async () => { await api('/' + S.d.g.id + '/unfreeze', 'POST', {}); toast('Фіксацію знято'); S.step = 'people'; await reload(); },
  'draw-ask': () => { const g = S.d.g; const m = modal(`<h2>Розіграти подарунки?</h2><p class="muted">У пулі ${g.pool_count} учасників. Результат запишеться в протокол і не зміниться після повторного натискання.</p><div class="row" style="margin-top:14px"><button class="btn" id="draw_ok">Розіграти</button><button class="btn sec" data-close>Ще ні</button></div>`);
    $('#draw_ok', m).onclick = async () => { $('#draw_ok', m).disabled = true; try { await api('/' + g.id + '/draw', 'POST', {}); m.remove(); await reload(); startShow(); } catch (e) { m.remove(); say(e); } }; },
  show: () => startShow(),
  verify: () => verify(),
  verdict: async (b) => { const v = b.dataset.v, reason = v === 'failed' ? ($('#reason_in') ? $('#reason_in').value.trim() : '') : ''; if (v === 'failed' && !reason) return toast(ERR.reason_required, true);
    const j = await api('/' + S.d.g.id + '/verdict', 'POST', { winner_id: Number(b.dataset.id), verdict: v, reason }); S.reasonFor = null;
    toast(j.promoted ? `Переможцем став резервний @${j.promoted}` : j.need_extra ? 'Резервних не лишилось: натисніть «Обрати наступного»' : 'Збережено'); await reload(); },
  extra: async (b) => { await api('/' + S.d.g.id + '/extra', 'POST', { replace_id: Number(b.dataset.id) }); toast('Обрано нового переможця'); await reload(); },
  'copy-win': () => copy(cur().filter((w) => w.role === 'winner' && w.verdict !== 'failed').sort((a, b) => a.position - b.position).map((w) => `${w.position}. @${w.username}${w.prize ? ': ' + w.prize : ''}`).join('\n'), 'Переможців скопійовано'),
  'copy-link': (b) => copy(b.dataset.link),
  csv: () => { const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"'; const g = S.d.g;
    download(`barpi-giveaway-${g.id}.csv`, '﻿' + [['Роль', 'Місце', 'Акаунт', 'Номер у пулі', 'Подарунок', 'Статус', 'Причина', 'Коло'].join(';')].concat(cur().map((w) => [w.role === 'winner' ? 'переможець' : 'резерв', w.position, '@' + w.username, w.n, w.prize || '', { ok: 'умови виконано', failed: 'не виконав умови', pending: 'очікує перевірки' }[w.verdict], w.verdict_reason || '', w.round].map(q).join(';'))).join('\r\n'), 'text/csv'); },
  json: () => { const d = S.d; download(`barpi-giveaway-${d.g.id}-protocol.json`, JSON.stringify({ exported_at: new Date().toISOString(), giveaway: d.g, stats: d.stats, algo: L.ALGO, pool: d.pool, draws: d.draws, winners: d.winners, log: d.log }, null, 2), 'application/json'); },
  publish: async (b) => { const j = await api('/' + S.d.g.id + '/publish', 'POST', { on: b.dataset.on === '1' }); toast(j.published ? 'Протокол опубліковано' : 'Протокол приховано'); await reload(); },
  void: async () => { const reason = $('#void_in').value.trim(); if (!reason) return toast(ERR.reason_required, true); await api('/' + S.d.g.id + '/void', 'POST', { reason }); toast('Жеребкування анульовано'); await reload(); },
};
app.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  if (b.tagName === 'BUTTON') e.preventDefault();
  try { await ACT[b.dataset.act](b, e); } catch (err) { if (ERR[err.message] || err.data) say(err); else toast(err.message, true); }
});
app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'n_src') { keepNew(); S.nd.source = t.value; renderNew(); }
  if (t.id === 'f_ans') $('#ans_box').hidden = !t.checked;
  if (t.id === 'f_men') $('#men_box').hidden = !t.checked;
  if (t.type === 'checkbox' && t.closest('.check')) t.closest('.check').classList.toggle('on', t.checked);
});
let qT;
app.addEventListener('input', (e) => { if (e.target.id !== 'q') return; clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value; S.limit = 300; renderG(); const i = $('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 220); });
app.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'reason_in') { const b = e.target.parentElement.querySelector('button'); if (b) b.click(); } });

async function route() {
  try {
    const h = location.hash, m = h.match(/^#\/g\/(\d+)/);
    if (m) return await openG(Number(m[1]));
    if (h === '#/new') { if (!S.nd) S.nd = { title: '', source: S.me.ig.connected ? 'instagram' : 'demo', media: null, starts: '', ends: '', tpl: '' }; if (!S.templates.length) { const j = await api('/list'); S.templates = j.templates; } renderNew(); if (S.nd.source === 'instagram' && !S.media.length) { await loadMedia(); if (location.hash === '#/new') { keepNew(); renderNew(); } } return; }
    await home();
  } catch (e) { app.innerHTML = `<div class="banner bad">${esc(errText(e))}</div><p><a href="#/">← Усі розіграші</a></p>`; }
}
(async () => {
  try { S.me = await api('/me'); $('#who').textContent = S.me.email; } catch (e) { app.innerHTML = `<div class="banner bad">${esc(errText(e))}</div>`; return; }
  addEventListener('hashchange', route); route();
})();
