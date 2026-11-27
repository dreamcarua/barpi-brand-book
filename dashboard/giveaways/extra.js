// Barpi · Розіграші · аналітика поста, перегляд «як у застосунку», факти для презентації (v1.2.0, 27.11.2026).
// Перенесено з дашборду DreamCar «Учасники з коментарів»; дані ті самі, що бачить воркер, нових запитів немає.
import * as L from './lib/logic.js?v=1.4.0';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n) => (n == null || n === '' ? 'н/д' : Number(n).toLocaleString('uk-UA'));
const p2 = (n) => String(n).padStart(2, '0');
// 1 учасник, 2 учасники, 5 учасників
export const pl = (n, a, b, c) => { const x = Math.abs(n) % 100, y = x % 10; return `${nf(n)} ${x > 10 && x < 20 ? c : y === 1 ? a : y >= 2 && y <= 4 ? b : c}`; };
const hm = (ts) => { const d = new Date(ts * 1000); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)} ${p2(d.getHours())}:00`; };
const full = (ts) => { const d = new Date(ts * 1000); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const span = (sec) => { const m = Math.round(sec / 60); return m < 60 ? `${m} хв` : m < 1440 ? `${Math.floor(m / 60)} год ${m % 60} хв` : `${Math.floor(m / 1440)} дн ${Math.floor((m % 1440) / 60)} год`; };
export function commentUrl(g, igId, parent) {
  const m = String(g.media_permalink || '').match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/);
  if (!m) return g.media_permalink || '';
  return parent ? `https://www.instagram.com/p/${m[1]}/c/${parent}/r/${igId}/` : `https://www.instagram.com/p/${m[1]}/c/${igId}/`;
}
export function answerWords(cfg) { return cfg.answer && cfg.answer.on ? (cfg.answer.groups || []).flat() : []; }
// Підсвітка правильних слів у тексті коментаря
export function hl(text, kws) {
  const t = esc(text);
  const k = (kws || []).map((s) => esc(String(s).trim())).filter(Boolean).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!k.length) return t;
  return t.replace(new RegExp('(' + k.join('|') + ')', 'giu'), '<mark>$1</mark>');
}
export function analysis(d) { return L.analyze(d.comments || [], d.entries || [], { include_replies: !!d.g.cfg.include_replies, answers: answerWords(d.g.cfg) }); }

// Факти для панелі й презентації: [назва, текст]
export function facts(d, A) {
  const g = d.g, f = [];
  if (A.first) f.push(['Перший', `@${A.first.username} написав ${g.media_ts && A.first.ts > g.media_ts ? 'через ' + span(A.first.ts - g.media_ts) + ' після публікації' : full(A.first.ts)}`]);
  if (g.cfg.answer && g.cfg.answer.on) f.push(['Точність', `${A.share}% учасників дали правильну відповідь: ${nf(A.pool)} з ${nf(A.entries)}`]);
  if (A.peak[1]) f.push(['Пік', `${hm(A.peak[0])}: ${pl(A.peak[1], 'учасник', 'учасники', 'учасників')} за годину`]);
  if (A.firstHour) f.push(['Швидкість', `за першу годину: ${pl(A.firstHour, 'учасник', 'учасники', 'учасників')}`]);
  if (A.otherTop[0]) f.push(['Інші версії', A.byProduct ? `${A.otherTop[0][0]}: так подумали ${pl(A.otherTop[0][1], 'учасник', 'учасники', 'учасників')}` : `«${A.otherTop[0][0]}»: це слово є в коментарях ${pl(A.otherTop[0][1], 'учасника', 'учасників', 'учасників')} без правильної відповіді`]);
  if (A.authors[0] && A.authors[0][1] > 1) f.push(['Найактивніший', `@${A.authors[0][0]}: ${pl(A.authors[0][1], 'коментар', 'коментарі', 'коментарів')}`]);
  if (A.longest && String(A.longest.text).length > 60) f.push(['Найдетальніша відповідь', `@${A.longest.username}: «${String(A.longest.text).slice(0, 90)}${String(A.longest.text).length > 90 ? '…' : ''}»`]);
  if (A.first && A.last && A.last.ts > A.first.ts) f.push(['Тривалість', `учасники писали ${span(A.last.ts - A.first.ts)}`]);
  f.push(['Прозорість', 'список зафіксовано до жеребкування, номери обирає сервер, кожен крок у протоколі']);
  return f;
}

const bars = (rows) => { const mx = Math.max(...rows.map((x) => x[1]), 1); return `<div class="dist">${rows.map(([l, v]) => `<div class="r"><span>${esc(l)}</span><span class="t"><i style="width:${(v / mx) * 100}%"></i></span><b>${nf(v)}</b></div>`).join('')}</div>`; };

export function stepStats(d) {
  const g = d.g, c = g.cfg, s = d.stats, st = g.stats || {}, A = analysis(d);
  if (!s.comments_total) return '<div class="empty">Аналітика з\'явиться після збору коментарів.</div>';
  const prizes = L.normPrizes(c.prizes), race = prizes.some((p) => p.method === 'top_likes');
  const leader = A.topLikes[0];
  const kpi = (l, v, sub) => `<div class="kpi"><b>${nf(v)}</b><span>${l}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  const mx = Math.max(...A.series.map((x) => x[1]), 1), step = Math.max(1, Math.ceil(A.series.length / 8));
  const timeline = A.series.length ? `<div class="tl" role="img" aria-label="Кількість учасників по годинах">${A.series.map((x) => `<i class="${x === A.peak ? 'pk' : ''}" style="height:${Math.max(x[1] ? 3 : 0, (x[1] / mx) * 100)}%" title="${esc(hm(x[0]))}: ${x[1]}"></i>`).join('')}</div>
    <div class="tlx">${A.series.filter((_, i) => i % step === 0).map((x) => `<span>${esc(hm(x[0]))}</span>`).join('')}</div>
    <p class="small muted" style="margin-top:8px">Пік: <b>${esc(hm(A.peak[0]))}</b>, ${nf(A.peak[1])} за годину. Перша доба дала <b>${A.firstDay}%</b> учасників.${A.series.length >= 24 * 60 ? ' Показано перші 60 діб.' : ''}</p>` : '<p class="muted">Немає даних.</p>';
  const lb = (rows, fmt) => (rows.length ? `<ol class="lb">${rows.map(fmt).join('')}</ol>` : '<p class="muted small">Немає даних.</p>');
  const gap = st.comments != null && s.comments_total < st.comments ? `<div class="banner${s.comments_total < st.comments * 0.98 ? '' : ' soft'}">Зібрано <b>${nf(s.comments_total)}</b> з <b>${nf(st.comments)}</b>: Instagram у лічильнику поста показує на ${nf(st.comments - s.comments_total)} більше. Можливі причини: коментарі видалено автором або приховано фільтром Instagram. У розіграші беруть участь лише коментарі, які віддав API.</div>` : '';
  return `${gap}
  <div class="kpis">${kpi('лайків поста', st.likes)}${kpi('коментарів зібрано', s.comments_total, st.comments != null ? 'Instagram рахує ' + nf(st.comments) : '')}${kpi(g.status === 'open' ? 'допущено зараз' : 'номерів у пулі', g.pool_count ?? s.ok, c.answer && c.answer.on ? `точність ${A.share}%` : '')}${kpi('унікальних акаунтів', s.accounts, s.accounts ? 'у середньому ' + (A.comments / Math.max(1, A.authors.length)).toFixed(1).replace('.', ',') + ' коментаря на акаунт' : '')}${kpi('охоплення', st.reach, st.views != null ? 'перегляди ' + nf(st.views) : '')}${kpi('репости', st.shares, st.saved != null ? 'збереження ' + nf(st.saved) : '')}</div>
  ${st.at ? '' : '<p class="small muted" style="margin:-8px 0 14px">Лайки поста, охоплення і репости з\'являться після наступного оновлення коментарів.</p>'}
  <div class="grid2">
    <div class="panel"><h2>Динаміка коментарів</h2><p class="small muted" style="margin-bottom:10px">${A.pool ? 'допущені учасники' : 'усі учасники'} по годинах, час вашого пристрою</p>${timeline}</div>
    <div class="panel"><h2>Гонка за лайки</h2><p class="small muted" style="margin-bottom:10px">топ-10 коментарів${race ? ' · є подарунок «Найбільше лайків»' : ''}${leader && leader.like_count ? ` · лідирує @${esc(leader.username)}` : ''}</p>
      ${lb(A.topLikes.filter((x) => x.like_count > 0), (r, i) => `<li><span class="rk">${i + 1}</span><div class="who"><a href="${esc(g.media_permalink ? commentUrl(g, r.ig_id) : 'https://www.instagram.com/' + r.username + '/')}" target="_blank" rel="noopener noreferrer">@${esc(r.username)}</a>${r.n ? ` <span class="small muted">№ ${r.n}</span>` : ''}<div class="tx">${esc(r.text)}</div><div class="bar"><i style="width:${Math.max(2, (r.like_count / Math.max(1, A.maxLikes)) * 100)}%"></i></div></div><b>${nf(r.like_count)} ♥</b></li>`)}</div>
  </div>
  <div class="grid3">
    <div class="panel"><h2>Найактивніші</h2><p class="small muted" style="margin-bottom:10px">коментарів на акаунт</p>${lb(A.authors.slice(0, 8), ([u, n], i) => `<li><span class="rk">${i + 1}</span><div class="who"><a href="https://www.instagram.com/${esc(u)}/" target="_blank" rel="noopener noreferrer">@${esc(u)}</a><div class="bar"><i style="width:${(n / A.authors[0][1]) * 100}%"></i></div></div><b>${nf(n)}</b></li>`)}</div>
    <div class="panel"><h2>Скільки пишуть</h2><p class="small muted" style="margin-bottom:10px">розподіл акаунтів</p>${bars(A.dist)}${A.authors.length ? `<p class="small muted" style="margin-top:8px"><b>${Math.round((A.dist[0][1] / A.authors.length) * 100)}%</b> акаунтів залишили один коментар.</p>` : ''}</div>
    <div class="panel"><h2>${c.answer && c.answer.on ? 'Відповіді' : 'Лайки на коментарях'}</h2><p class="small muted" style="margin-bottom:10px">${c.answer && c.answer.on ? 'правильні слова: ' + esc(answerWords(c).join(', ')) : 'розподіл учасників'}</p>
      ${c.answer && c.answer.on ? bars([['допущено', s.ok], ['на перевірці', s.review], ['відхилено', s.fail]]) : bars(A.likeDist)}
      ${A.otherTop.length ? `<p class="small muted" style="margin-top:8px">${A.byProduct ? 'Інші версії учасників: ' + A.otherTop.map(([w, n]) => `${esc(w)} ${n}`).join(', ') : 'Часті слова в коментарях без правильної відповіді: ' + A.otherTop.map(([w, n]) => `«${esc(w)}» ${n}`).join(', ')}.</p>` : ''}</div>
  </div>
  <div class="panel"><h2>Факти</h2><dl class="facts">${facts(d, A).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
  <p class="small muted">Підписку, лайк поста і репост у сторіс Instagram через API не показує: колонка «Акаунт» веде на профіль, перевіряйте переможця вручну перед оголошенням.</p>`;
}

// Перегляд «як у застосунку»: публікація і всі коментарі з номерами пулу
const AV = ['#001154', '#1f5fbf', '#3b82c4', '#6b7fd7', '#0d7a6b', '#b26a00', '#8a3fa0', '#b3261e'];
const avc = (u) => AV[[...String(u)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % AV.length];
export function ago(ts, now) { const s = Math.max(0, now - ts); return s < 3600 ? `${Math.max(1, Math.round(s / 60))} хв` : s < 86400 ? `${Math.round(s / 3600)} год` : s < 86400 * 7 ? `${Math.round(s / 86400)} дн` : `${Math.round(s / (86400 * 7))} тиж`; }
export function phoneView(d, state, API) {
  const g = d.g, kws = answerWords(g.cfg);
  const num = new Map();
  if (d.pool.length) for (const p of d.pool) num.set(String(p.ig_id), p.n); else { let n = 0; for (const e of d.entries) if (e.final === 'ok') num.set(String(e.ig_id), ++n); }
  let q = String(state.q || '').trim().toLowerCase().replace(/^@/, '').replace(/^[№#]\s*/, '');
  let rows = (d.comments || []).filter((c) => !c.gone).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const total = rows.length;
  if (q) rows = rows.filter((r) => (/^\d+$/.test(q) ? String(num.get(String(r.ig_id))) === q : String(r.username || '').toLowerCase().includes(q) || String(r.text || '').toLowerCase().includes(q)));
  const shown = rows.slice(0, 600);
  const img = g.media_id ? `<img src="${API}/img/m/${esc(g.media_id)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  const list = shown.map((r) => { const n = num.get(String(r.ig_id)); return `<div class="igc${r.parent_ig_id ? ' rep' : ''}${n ? '' : ' off'}" data-id="${esc(r.ig_id)}"><span class="a" style="background:${avc(r.username)}">${esc(String(r.username || '?').slice(0, 1).toUpperCase())}</span>
    <div><div class="t"><b>${esc(r.username)}</b> ${hl(r.text, kws)}</div><div class="m"><span>${esc(ago(r.ts, d.now))}</span>${r.like_count ? `<span>${nf(r.like_count)} позначок «Подобається»</span>` : ''}${n ? `<span class="no">№ ${n}</span>` : ''}${g.media_permalink ? `<a href="${esc(commentUrl(g, r.ig_id, r.parent_ig_id))}" target="_blank" rel="noopener noreferrer">відкрити ↗</a>` : ''}</div></div>
    <span class="h">♡${r.like_count ? '<br>' + nf(r.like_count) : ''}</span></div>`; }).join('');
  return `<div class="phonewrap"><div class="phone"><div class="scr">
    <div class="ighd"><span class="a" style="background:#001154">B</span><b>${esc(g.source === 'demo' ? 'тестовий пост' : 'barpi.ua')}</b><span class="sp"></span><span class="small">${g.media_ts ? esc(full(g.media_ts).slice(0, 10)) : ''}</span></div>
    <div class="igtabs"><button type="button" data-act="phone-tab" data-t="post" class="${state.tab === 'post' ? 'on' : ''}">Публікація</button><button type="button" data-act="phone-tab" data-t="cm" class="${state.tab !== 'post' ? 'on' : ''}">Коментарі · ${nf(total)}</button></div>
    ${state.tab === 'post' ? `<div class="igview"><div class="igpost">${img || '<div class="noimg">' + (g.source === 'demo' ? 'ТЕСТ' : 'ПОСТ') + '</div>'}</div><div class="igcap"><b>${esc(g.source === 'demo' ? 'тест' : 'barpi.ua')}</b> ${esc(g.media_caption || '')}</div>${g.media_permalink ? `<p style="padding:0 14px 14px"><a href="${esc(g.media_permalink)}" target="_blank" rel="noopener noreferrer">Відкрити в Instagram ↗</a></p>` : ''}</div>`
    : `<div class="igview"><div class="igsearch"><input id="igq" type="search" placeholder="Пошук: @акаунт, слово або №" value="${esc(state.q || '')}"></div><div class="iglist">${list || '<div class="ignote">Нічого не знайдено. Спробуйте номер, частину акаунта або слово з коментаря.</div>'}${rows.length > 600 ? `<div class="ignote">Показано 600 з ${nf(rows.length)}: уточніть пошук</div>` : ''}<div class="ignote">Коментарі з Instagram Graph API · вигляд як у застосунку · бліді рядки не в пулі</div></div></div>`}
  </div></div></div>`;
}
