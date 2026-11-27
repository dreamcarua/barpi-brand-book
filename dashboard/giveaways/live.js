// Barpi · Розіграші · «Режим ефіру» (v1.3.0, 27.11.2026): студія на весь екран для прямого ефіру або запису.
// Перенесено з режиму ефіру дашборду DreamCar: великі барабани номера, картки статистики, рядок фактів,
// коментар переможця з фактами, телефон з постом, вердикт ✓/✗ прямо в ефірі.
// Відмінність: номери обирає сервер (один запит «Розіграти»), ефір лише відкриває записаний результат по одному.
import * as L from './lib/logic.js?v=1.3.0';
import * as X from './extra.js?v=1.3.0';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n) => Number(n || 0).toLocaleString('uk-UA');
const p2 = (n) => String(n).padStart(2, '0');
const dm = (ts) => { const d = new Date(ts * 1000); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}, ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const LOOPS = 8;
const EASE = 'cubic-bezier(0.23,1,0.32,1)';

// ctx: { get d(), me, API, api(path, method, body), reload(), toast(msg, bad), errText(e) }
export function openLive(ctx) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let d = ctx.d, g = d.g, alive = true, busy = false, factT = null, fi = 0, phoneOn = false, phoneTab = 'cm', shown = null, asking = false;
  const revealed = new Set();
  const el = document.createElement('div'); el.id = 'live'; if (g.cfg.festive) el.classList.add('festive');
  document.body.append(el); document.body.style.overflow = 'hidden';
  const $ = (s) => el.querySelector(s);
  const cur = () => d.winners.filter((w) => !w.void && w.gen === d.g.gen);
  const queue = () => cur().filter((w) => w.role === 'winner' && w.verdict !== 'failed').sort((a, b) => a.position - b.position || a.id - b.id);
  const nextUp = () => queue().find((w) => !revealed.has(w.id)) || null;
  const text = (w) => { const e = d.entries.find((x) => String(x.ig_id) === String(w.ig_id)); return e || null; };
  const digits = () => String(Math.max(1, d.g.pool_count || d.stats.ok || 1)).length;

  function frame() {
    const A = X.analysis(d), s = d.stats, c = g.cfg, mx = Math.max(1, ...A.series.map((x) => x[1]));
    const series = A.series.slice(0, 72);
    el.innerHTML = `<canvas class="fx" aria-hidden="true"></canvas>
    <div class="lt"><div class="row"><span class="brand">BARPI<small>розіграш</small></span><span class="pill"><i></i>${g.status === 'open' ? 'пул не зафіксовано' : '🔒 пул зафіксовано'}</span>${g.source === 'demo' ? '<span class="pill warn">тест</span>' : g.source === 'example' ? '<span class="pill warn">приклад</span>' : ''}</div>
      <div class="row"><button type="button" class="lb2" data-l="phone" title="Клавіша P">📱 Пост</button><button type="button" class="lb2" data-l="full" title="Клавіша F">⛶ Весь екран</button><button type="button" class="lb2" data-l="close">✕ Esc</button></div></div>
    <div class="body">
      <aside class="side">
        <div class="card"><div class="k">Учасників у пулі</div><div class="v">${nf(g.pool_count ?? s.ok)}</div><div class="s">з ${nf(s.comments_total)} коментарів · ${nf(s.accounts)} акаунтів</div></div>
        ${c.answer && c.answer.on ? `<div class="card"><div class="k">Правильних відповідей</div><div class="v">${A.share}%</div><div class="bars"><div class="r"><span class="l ok" style="--w:${A.share / 100}"><i></i>вгадали</span><b>${nf(A.pool)}</b></div><div class="r"><span class="l" style="--w:${(100 - A.share) / 100}"><i></i>інші версії</span><b>${nf(A.entries - A.pool)}</b></div></div></div>` : ''}
        ${A.first ? `<div class="card"><div class="k">Перший у пулі</div><div class="v sm">@${esc(A.first.username)}</div><div class="s">${g.media_ts && A.first.ts > g.media_ts ? 'через <b>' + esc(X.span(A.first.ts - g.media_ts)) + '</b> після публікації' : esc(dm(A.first.ts))}</div></div>` : ''}
        ${series.length > 1 ? `<div class="card"><div class="k">Активність по годинах</div><div class="spark">${series.map((x) => `<i class="${x === A.peak ? 'pk' : ''}" style="height:${Math.max(4, (x[1] / mx) * 100)}%"></i>`).join('')}</div><div class="s">пік <b>${esc(dm(A.peak[0]))}</b>: ${nf(A.peak[1])} за годину</div></div>` : ''}
      </aside>
      <section class="center">
        <div class="prz" id="lvPrz"></div><div class="sub" id="lvSub"></div>
        <div class="reels" id="lvReels">${Array.from({ length: digits() }, () => '<div class="reel"><div class="strip"></div></div>').join('')}<div class="count" id="lvCount"></div></div>
        <div class="flick" id="lvFlick"></div>
        <div class="winner" id="lvWin"></div>
      </section>
      <aside class="side right">
        ${A.otherTop.length ? `<div class="card"><div class="k">Інші версії учасників</div><div class="bars">${A.otherTop.map(([w, n]) => `<div class="r"><span class="l" style="--w:${n / A.otherTop[0][1]}"><i></i>${esc(w)}</span><b>${nf(n)}</b></div>`).join('')}</div></div>` : ''}
        ${A.authors[0] && A.authors[0][1] > 1 ? `<div class="card"><div class="k">Найактивніший</div><div class="v sm">@${esc(A.authors[0][0])}</div><div class="s"><b>${nf(A.authors[0][1])}</b> коментарів під постом</div></div>` : ''}
        ${A.topLikes[0] && A.topLikes[0].like_count ? `<div class="card"><div class="k">Найбільше лайків</div><div class="v sm">@${esc(A.topLikes[0].username)}</div><div class="s"><b>${nf(A.topLikes[0].like_count)}</b> ♥ на коментарі</div></div>` : ''}
        <div class="card"><div class="k">Подарунки</div><div id="lvAtt" class="bars"></div></div>
      </aside>
      <div class="phonewrap2" id="lvPhoneWrap"></div>
    </div>
    <div class="bottom"><div class="ticker"><span class="tag" id="lvTag"></span><span class="tx" id="lvTx"></span></div>
      <div class="ctl" id="lvCtl"></div></div>`;
    el.querySelectorAll('.strip').forEach((st) => { st.innerHTML = Array.from({ length: 10 * LOOPS }, (_, k) => `<div>${k % 10}</div>`).join(''); });
    el._facts = X.facts(d, A);
    setReels(shown ? shown.n : 0); tickFacts(true); state();
    if (phoneOn) buildPhone();
    snow();
  }
  // ── барабани: стрічка 0–9, повторена 8 разів; зупинка на цільовій цифрі в останньому колі ──
  const cellH = () => { const c = el.querySelector('.strip div'); return c ? c.getBoundingClientRect().height : 200; };
  const digitsOf = (n) => String(n).padStart(digits(), '0').split('').map(Number);
  function setReels(n) {
    const ds = digitsOf(n), h = cellH(), sig = n > 0 ? String(n).length : ds.length;
    el.querySelectorAll('.reel').forEach((r, k) => { const st = r.querySelector('.strip'); st.getAnimations().forEach((a) => a.cancel()); st.style.transform = `translateY(${-(10 * (LOOPS - 1) + ds[k]) * h}px)`; r.classList.toggle('lead', n > 0 && k < ds.length - sig); });
  }
  async function spinReels(n) {
    const ds = digitsOf(n), h = cellH(), reels = [...el.querySelectorAll('.reel')];
    reels.forEach((r) => r.classList.remove('lead'));
    if (calm) return setReels(n);
    // ліва цифра зупиняється першою, кожна наступна на 550 мс пізніше
    await Promise.all(reels.map((r, k) => { const st = r.querySelector('.strip'); const end = -(10 * (LOOPS - 1) + ds[k]) * h;
      st.getAnimations().forEach((a) => a.cancel());
      const a = st.animate([{ transform: `translateY(${-Math.floor(Math.random() * 10) * h}px)` }, { transform: `translateY(${end}px)` }], { duration: 2300 + k * 550, easing: EASE, fill: 'forwards' });
      return a.finished.then(() => { st.style.transform = `translateY(${end}px)`; a.cancel(); }, () => {}); }));
    if (alive) setReels(n);
  }
  async function countdown() {
    const c = $('#lvCount'); if (calm || !c) return;
    for (const t of ['3', '2', '1']) { if (!alive) return; c.textContent = t; try { await c.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)', offset: 0.35 }, { opacity: 0, transform: 'scale(1.04)' }], { duration: 640, easing: EASE }).finished; } catch (e) { return; } }
    c.textContent = '';
  }
  function flicker() { const f = $('#lvFlick'), P = d.pool; if (calm || !P.length) { f.textContent = ''; return () => {}; }
    let on = true; (function tick() { if (!on || !alive) return; f.textContent = '@' + P[Math.floor(Math.random() * P.length)].username; setTimeout(tick, 70 + Math.random() * 40); })();
    return () => { on = false; f.textContent = ''; }; }
  // ── конфеті й сніг ──
  let parts = [], raf = 0;
  function fxLoop() { if (raf || !alive) return; const cv = $('canvas.fx'); if (!cv) return; const k = Math.min(2, devicePixelRatio || 1); cv.width = el.clientWidth * k; cv.height = el.clientHeight * k; const cx = cv.getContext('2d');
    const step = () => { raf = 0; if (!alive) return; const w = cv.width, h = cv.height; cx.clearRect(0, 0, w, h); parts = parts.filter((p) => p.life > 0);
      for (const p of parts) { p.vy += p.g; p.vx *= p.dr; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.d; if (p.loop && p.y > h + p.s) { p.y = -p.s; p.x = Math.random() * w; }
        cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)) * (p.loop ? 0.5 : 1); cx.translate(p.x, p.y); cx.rotate(p.r);
        if (p.gl) { cx.font = `${p.s * 2}px serif`; cx.textAlign = 'center'; cx.fillText(p.gl, 0, 0); } else { cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); } cx.restore(); }
      if (parts.length) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); }
  function burst() { if (calm) return; const cv = $('canvas.fx'); if (!cv) return; const k = Math.min(2, devicePixelRatio || 1), w = el.clientWidth * k, h = el.clientHeight * k, fest = !!g.cfg.festive;
    const cols = ['#BAD9F4', '#ffffff', '#7fb2ea', '#4f8fe0'], gl = fest ? ['🎁', '⭐', '❄️', '🐾'] : ['🐾'];
    for (let i = 0; i < 150; i++) { const a = Math.random() * Math.PI * 2, v = (4 + Math.random() * 9) * k; parts.push({ x: w / 2, y: h * 0.42, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3 * k, g: 0.18 * k, dr: 0.985, r: Math.random() * 6, vr: 0.1, s: (3 + Math.random() * 5) * k, c: cols[i % cols.length], gl: Math.random() < (fest ? 0.25 : 0.06) ? gl[i % gl.length] : null, life: 1, d: 0.011 }); }
    fxLoop(); }
  function snow() { if (calm || !g.cfg.festive || parts.some((p) => p.loop)) return; const k = Math.min(2, devicePixelRatio || 1), w = el.clientWidth * k, h = el.clientHeight * k;
    for (let i = 0; i < 40; i++) parts.push({ x: Math.random() * w, y: Math.random() * h, vx: 0, vy: (0.4 + Math.random() * 0.9) * k, g: 0, dr: 1, r: 0, vr: 0.01, s: (5 + Math.random() * 7) * k, c: '#fff', gl: i % 3 ? '❄️' : '✨', life: 1, d: 0, loop: true }); fxLoop(); }
  // ── факти ──
  function tickFacts(now) { if (!alive || !el._facts || !el._facts.length) return; const f = el._facts[fi++ % el._facts.length], tx = $('#lvTx'), tg = $('#lvTag'); if (!tx) return;
    if (calm || now) { tg.textContent = f[0]; tx.textContent = f[1]; return; }
    tx.classList.add('out'); setTimeout(() => { if (!alive) return; const a = $('#lvTag'), b = $('#lvTx'); if (!a) return; a.textContent = f[0]; b.textContent = f[1]; b.classList.remove('out'); }, 260); }
  // ── переможець ──
  function showWinner(w) {
    shown = w; const e = text(w), kws = X.answerWords(g.cfg), cnt = d.pool.filter((p) => p.username === w.username).length;
    const after = e && g.media_ts && e.ts > g.media_ts ? X.span(e.ts - g.media_ts) : null, likes = e ? e.like_count : null;
    $('#lvWin').innerHTML = `${w.verdict === 'ok' ? '<div class="won ap">✓ отримувач подарунка</div>' : ''}
      <a class="nick ap" href="https://www.instagram.com/${esc(w.username)}/" target="_blank" rel="noopener noreferrer">@${esc(w.username)} <span>↗</span></a>
      ${e ? `<div class="cmt ap">${X.hl(e.text, kws)}</div>` : ''}
      <div class="facts2 ap"><span>номер <b>${w.n}</b> з ${nf(d.g.pool_count)}</span>${w.method === 'top_likes' ? `<span>найбільше лайків: <b>${nf(w.likes)}</b> ♥</span>` : '<span>випадковий номер</span>'}
        ${e ? `<span>написав(ла) <b>${esc(dm(e.ts))}</b></span>` : ''}${after ? `<span>через <b>${esc(after)}</b> після публікації</span>` : ''}
        ${g.cfg.answer && g.cfg.answer.on ? `<span><b>${w.n}-й</b> з правильною відповіддю</span>` : ''}${likes && w.method !== 'top_likes' ? `<span><b>${nf(likes)}</b> ♥ на коментарі</span>` : ''}${cnt > 1 ? `<span><b>${cnt}</b> номери в акаунта</span>` : ''}${w.promoted_from ? '<span>заміна попереднього переможця</span>' : ''}</div>`;
    $('#lvReels').classList.toggle('win', w.verdict === 'ok');
    if (phoneOn) focusPhone(w.ig_id);
  }
  function attempts() { const box = $('#lvAtt'); if (!box) return; const all = cur().filter((w) => w.role === 'winner').sort((a, b) => a.position - b.position || a.id - b.id);
    const pz = L.normPrizes(g.cfg.prizes);
    if (!all.length) { box.innerHTML = pz.length ? pz.map((p, i) => `<div class="r"><span class="l" style="--w:.2"><i></i>${i + 1}. ${esc(p.label)}</span><b>…</b></div>`).join('') : '<div class="s">ще не розіграно</div>'; return; }
    box.innerHTML = all.map((w) => { const open = revealed.has(w.id) || w.verdict === 'failed'; return `<div class="r"><span class="l${w.verdict === 'ok' ? ' ok' : w.verdict === 'failed' ? ' bad' : ''}" style="--w:${w.verdict === 'ok' ? 1 : open ? 0.55 : 0.2}"><i></i>${w.position}. ${open ? `№ ${w.n} @${esc(w.username)}` : esc(w.prize || 'переможець')}</span><b>${w.verdict === 'ok' ? '✓' : w.verdict === 'failed' ? '✗' : '…'}</b></div>`; }).join(''); }
  // ── стан кнопок ──
  function state() {
    if (!alive) return; const ctl = $('#lvCtl'), nx = nextUp(), q = queue(); attempts();
    const sub = $('#lvSub'), prz = $('#lvPrz'), pz = L.normPrizes(g.cfg.prizes);
    const title = (w) => (w && w.prize) || (pz[0] && pz[0].label) || g.title;
    let h = '';
    if (shown) h += `<a class="lb2" href="https://www.instagram.com/${esc(shown.username)}/" target="_blank" rel="noopener noreferrer" id="lvProf" title="Клавіша I">👤 @${esc(shown.username)} ↗</a>${g.media_permalink ? `<a class="lb2" href="${esc(X.commentUrl(g, shown.ig_id))}" target="_blank" rel="noopener noreferrer">💬 Коментар ↗</a>` : ''}`;
    if (d.g.status === 'open') { prz.textContent = title(null); sub.textContent = 'спершу підтвердьте фінальний список учасників'; h += '<button type="button" class="lb2 big" disabled>🔒 Спершу зафіксуйте пул</button>'; if (!shown) $('#lvWin').innerHTML = '<div class="sub">Закрийте ефір і натисніть «Підтвердити фінальний список» у кроці «Учасники»</div>'; }
    else if (d.g.status === 'frozen') { prz.textContent = title(null); sub.textContent = `номери від 1 до ${nf(d.g.pool_count)} · переможців: ${pz.length || g.cfg.winners || 1}`; h += '<button type="button" class="lb2 big primary" data-l="draw">🎁 Розіграти · пробіл</button>'; if (!shown) $('#lvWin').innerHTML = '<div class="sub">Натисніть «Розіграти» або пробіл</div>'; }
    else {
      const w = shown && cur().find((x) => x.id === shown.id);
      prz.textContent = title(w || nx); sub.textContent = `номери від 1 до ${nf(d.g.pool_count)} · відкрито ${q.filter((x) => revealed.has(x.id)).length} з ${q.length}`;
      if (asking && w) h += `<input type="text" id="lvReason" placeholder="Що саме не виконано" maxlength="300"><button type="button" class="lb2 no" data-l="fail">Підтвердити ✗</button><button type="button" class="lb2" data-l="cancel">Скасувати</button>`;
      else {
        if (w && revealed.has(w.id) && w.verdict === 'pending') h += '<button type="button" class="lb2 ok" data-l="ok">✓ Умови виконано</button><button type="button" class="lb2 no" data-l="ask">✗ Не виконано · замінити</button>';
        const lost = cur().find((x) => x.role === 'winner' && x.verdict === 'failed' && x.method !== 'top_likes' && !cur().some((y) => y.promoted_from === x.id));
        if (nx) h += `<button type="button" class="lb2 big primary" data-l="next">${revealed.size ? 'Наступний' : 'Відкрити переможця'} · пробіл</button>`;
        else if (lost) h += `<button type="button" class="lb2 big primary" data-l="extra" data-id="${lost.id}">Обрати наступного · пробіл</button>`;
        else if (!shown) { $('#lvWin').innerHTML = '<div class="sub">Усіх переможців уже відкрито</div>'; }
        if (!nx && !lost && q.length && q.every((x) => revealed.has(x.id))) h += '<span class="done">усіх переможців відкрито</span>';
      }
    }
    ctl.innerHTML = h; const r = $('#lvReason'); if (r) r.focus();
  }
  async function refresh() { await ctx.reload(); d = ctx.d; g = d.g; }
  async function reveal(w) {
    if (busy || !w) return; busy = true; asking = false;
    $('#lvCtl').innerHTML = ''; $('#lvReels').classList.remove('win'); $('#lvWin').innerHTML = '<div class="sub">Обираємо…</div>'; shown = null;
    $('#lvPrz').textContent = w.prize || g.title;
    await countdown(); if (!alive) return;
    const stop = w.method === 'top_likes' ? () => {} : flicker();
    await spinReels(w.n); stop(); if (!alive) return;
    revealed.add(w.id); showWinner(w); burst(); busy = false; state();
  }
  async function act(a, b) {
    if (busy && a !== 'close' && a !== 'full' && a !== 'phone') return;
    try {
      if (a === 'close') return close();
      if (a === 'full') return document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen().catch(() => {});
      if (a === 'phone') return togglePhone();
      if (a === 'draw') { busy = true; $('#lvCtl').innerHTML = ''; $('#lvWin').innerHTML = '<div class="sub">Сервер обирає номери…</div>'; await ctx.api('/' + g.id + '/draw', 'POST', {}); await refresh(); busy = false; return reveal(nextUp()); }
      if (a === 'next') return reveal(nextUp());
      if (a === 'ok') { await ctx.api('/' + g.id + '/verdict', 'POST', { winner_id: shown.id, verdict: 'ok' }); await refresh(); const w = cur().find((x) => x.id === shown.id); if (w) showWinner(w); burst(); return state(); }
      if (a === 'ask') { asking = true; return state(); }
      if (a === 'cancel') { asking = false; return state(); }
      if (a === 'fail') { const reason = ($('#lvReason').value || '').trim(); if (!reason) return ctx.toast('Вкажіть причину.', true);
        const j = await ctx.api('/' + g.id + '/verdict', 'POST', { winner_id: shown.id, verdict: 'failed', reason }); asking = false; await refresh();
        shown = null; setReels(0); $('#lvReels').classList.remove('win');
        $('#lvWin').innerHTML = `<div class="sub">${j.promoted ? 'Переможця замінено. Наступний: пробіл' : j.need_extra ? 'Резервних немає. Оберіть наступного: пробіл' : 'Спробу прибрано'}</div>`; return state(); }
      if (a === 'extra') { busy = true; await ctx.api('/' + g.id + '/extra', 'POST', { replace_id: Number(b.dataset.id) }); await refresh(); busy = false; return reveal(nextUp()); }
    } catch (e) { busy = false; ctx.toast(ctx.errText(e), true); try { await refresh(); } catch (x) { /* лишаємо як є */ } state(); }
  }
  // ── телефон з постом ──
  let phoneQ = '', qT = null;
  function buildPhone() { const wrap = $('#lvPhoneWrap'); if (!wrap) return; wrap.innerHTML = X.phoneView(d, { tab: phoneTab, q: phoneQ }, ctx.API); if (shown && phoneTab === 'cm' && !phoneQ) focusPhone(shown.ig_id); }
  function focusPhone(id) { if (phoneTab !== 'cm') { phoneTab = 'cm'; buildPhone(); return; } const c = el.querySelector(`.igc[data-id="${CSS.escape(String(id))}"]`); el.querySelectorAll('.igc.hit').forEach((x) => x.classList.remove('hit')); if (c) { c.classList.add('hit'); c.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' }); } }
  function togglePhone() { phoneOn = !phoneOn; $('.body').classList.toggle('phone-on', phoneOn); el.querySelector('[data-l=phone]').classList.toggle('on', phoneOn); if (phoneOn) buildPhone(); else $('#lvPhoneWrap').innerHTML = ''; }
  function close() { alive = false; clearInterval(factT); cancelAnimationFrame(raf); removeEventListener('keydown', key, true); if (document.fullscreenElement) document.exitFullscreen(); el.remove(); document.body.style.overflow = ''; ctx.onClose && ctx.onClose(); }
  function key(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { if (e.key === 'Enter' && e.target.id === 'lvReason') act('fail'); if (e.key === 'Escape') { asking = false; state(); } return; }
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') { e.preventDefault(); return close(); }
    if (k === 'p' || k === 'з') return togglePhone();
    if (k === 'f' || k === 'а') return act('full');
    if ((k === 'i' || k === 'ш') && $('#lvProf')) return window.open($('#lvProf').href, '_blank', 'noopener');
    if (e.code === 'Space') { e.preventDefault(); const b = el.querySelector('#lvCtl .big.primary'); if (b && !b.disabled) act(b.dataset.l, b); }
  }
  addEventListener('keydown', key, true);
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act=phone-tab]'); if (t) { phoneTab = t.dataset.t; return buildPhone(); }
    const b = e.target.closest('[data-l]'); if (b && !b.disabled) act(b.dataset.l, b);
  });
  el.addEventListener('input', (e) => { if (e.target.id !== 'igq') return; clearTimeout(qT); qT = setTimeout(() => { phoneQ = e.target.value; buildPhone(); const i = $('#igq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 220); });
  frame();
  // уже визначені й підтверджені переможці вважаються відкритими: ефір продовжується з того місця, де зупинився
  for (const w of queue()) if (w.verdict === 'ok') revealed.add(w.id);
  state();
  factT = setInterval(() => tickFacts(false), 6500);
}
