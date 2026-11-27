// Barpi Giveaways · чиста логіка без мережі й без бази. Один файл для воркера (barpi-giveaways),
// сторінки /dashboard/giveaways/ (перевірка жеребкування в браузері) і тестів у Node.
// Жеребкування відтворюване: знаючи зерно, хеш пулу і розмір пулу, будь-хто отримає ті самі номери.
export const ALGO = 'barpi-draw-v1';
// v2 (27.11.2026): після вибору номера з подальшого вибору вилучаються всі номери того самого акаунта
export const ALGO2 = 'barpi-draw-v2';

export function normText(s) {
  return String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[ʼ’‘`´]/g, "'").replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}@._'\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function words(s) {
  return normText(s).split(' ').map((w) => w.replace(/^[._'-]+|[._'-]+$/g, '')).filter(Boolean);
}
export function lev(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Один варіант відповіді проти тексту: 'exact' | 'fuzzy' | null. Фрази шукаємо за межами слів.
export function matchVariant(textWords, variant) {
  const vw = words(variant);
  if (!vw.length) return null;
  const hay = ' ' + textWords.join(' ') + ' ';
  if (hay.includes(' ' + vw.join(' ') + ' ')) return 'exact';
  if (vw.length === 1 && vw[0].length >= 5) {
    const max = vw[0].length >= 9 ? 2 : 1;
    if (textWords.some((w) => Math.abs(w.length - vw[0].length) <= max && lev(w, vw[0]) <= max)) return 'fuzzy';
  }
  return null;
}
// groups: [[варіанти одного слова], ...]; need: скільки різних слів треба знайти (типово всі).
export function matchAnswer(text, groups, need) {
  const tw = words(text);
  let exact = 0, fuzzy = 0;
  const hit = [];
  for (const g of groups || []) {
    let best = null;
    for (const v of g) { const m = matchVariant(tw, v); if (m === 'exact') { best = 'exact'; break; } if (m) best = 'fuzzy'; }
    if (best === 'exact') { exact++; hit.push(g[0]); } else if (best === 'fuzzy') { fuzzy++; hit.push(g[0] + '?'); }
  }
  const n = Math.max(1, Math.min(need || (groups || []).length, (groups || []).length || 1));
  return { status: exact >= n ? 'ok' : exact + fuzzy >= n ? 'review' : 'fail', exact, fuzzy, need: n, hit };
}
export function mentionsOf(text, self, skip = []) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/@([A-Za-z0-9._]{1,30})/g)) {
    const u = m[1].toLowerCase().replace(/\.+$/, '');
    if (u && u !== self && !skip.includes(u)) out.add(u);
  }
  return [...out];
}
export function parseGroups(text) {
  return String(text || '').split(/\n+/).map((l) => l.split(',').map((x) => x.trim()).filter(Boolean)).filter((g) => g.length);
}
export function cleanUser(u) { return String(u || '').trim().toLowerCase().replace(/^@/, ''); }

// Головна функція: коментарі + умови + ручні рішення → учасники.
// comments: [{ig_id, parent_ig_id, username, text, ts, like_count, gone}], ts у секундах.
// cfg: {starts_at, ends_at, one_per_account, include_replies, exclude[], organizer, answer{on,groups,need}, mention{on,min}, manual{on}}
// decisions: {username: {decision:'ok'|'fail'|'review', reason}}
export function evaluate(comments, cfg = {}, decisions = {}) {
  const c = cfg || {};
  const organizer = cleanUser(c.organizer || 'barpi.ua');
  const exclude = new Set([organizer, ...(c.exclude || []).map(cleanUser)].filter(Boolean));
  const single = c.one_per_account !== false;
  const A = c.answer && c.answer.on ? c.answer : null;
  const M = c.mention && c.mention.on ? { min: Math.max(1, Number(c.mention.min) || 1) } : null;
  const manual = !!(c.manual && c.manual.on);
  const withReplies = !!c.include_replies;
  const SUS = /(^|[^\p{L}])(або|чи|или|or)([^\p{L}]|$)|\?|\//iu;
  const stats = { comments_total: comments.length, replies: 0, gone: 0, top_level: 0, in_window: 0, accounts: 0, ok: 0, fail: 0, review: 0, entries: 0 };
  const by = new Map();
  for (const x of comments) {
    if (x.parent_ig_id) { stats.replies++; if (!withReplies) continue; }
    if (x.gone) { stats.gone++; continue; }
    if (!x.parent_ig_id) stats.top_level++;
    const u = cleanUser(x.username);
    if (!u) continue;
    const inWin = (!c.starts_at || x.ts >= c.starts_at) && (!c.ends_at || x.ts <= c.ends_at);
    if (inWin) stats.in_window++;
    if (!by.has(u)) by.set(u, []);
    by.get(u).push({ ...x, username: u, inWin });
  }
  stats.accounts = by.size;
  const entries = [];
  const judge = (u, list, rep) => {
    // list: коментарі, що оцінюються разом (усі коментарі акаунта або один коментар)
    const reasons = [];
    let auto = 'ok';
    let pick = rep || list[0];
    let ment = [];
    if (A) {
      let best = null;
      for (const x of list) { const r = matchAnswer(x.text, A.groups, A.need); if (r.status === 'ok') { best = { x, r }; break; } if (r.status === 'review' && !best) best = { x, r }; }
      if (!best) { auto = 'fail'; reasons.push('немає правильної відповіді'); }
      else { pick = best.x; if (best.r.status === 'review') { auto = 'review'; reasons.push('сумнівний збіг: ' + best.r.hit.join(', ')); }
        else if (best.r.need === 1 && (A.groups || []).length === 1 && SUS.test(String(best.x.text))) { auto = 'review'; reasons.push('відповідь є, але в коментарі кілька варіантів або питання'); }
        else reasons.push('відповідь: ' + best.r.hit.join(', ')); }
    }
    if (M) {
      const set = new Set();
      for (const x of list) for (const m of mentionsOf(x.text, u, [organizer])) set.add(m);
      ment = [...set];
      if (ment.length < M.min) { auto = 'fail'; reasons.push(`відміток ${ment.length} з ${M.min}`); }
      else { reasons.push('відмітки: ' + ment.map((m) => '@' + m).join(' ')); if (!A) pick = list.find((x) => mentionsOf(x.text, u, [organizer]).length) || pick; }
    }
    if (manual && auto === 'ok') { auto = 'review'; reasons.push('потрібне ручне підтвердження'); }
    return { auto, reasons, pick, ment };
  };
  for (const [u, all] of by) {
    all.sort((a, b) => a.ts - b.ts || String(a.ig_id).localeCompare(String(b.ig_id)));
    const win = all.filter((x) => x.inWin);
    const d = decisions[u] || null;
    const push = (res, key, count) => {
      const final = d ? d.decision : res.auto;
      entries.push({ key, username: u, ig_id: res.pick.ig_id, text: res.pick.text, ts: res.pick.ts, like_count: res.pick.like_count || 0,
        auto: res.auto, reasons: res.reasons, final, decided: !!d, reason: d ? d.reason || '' : '', mentions: res.ment, comments: count, reply: !!res.pick.parent_ig_id });
    };
    if (exclude.has(u)) { push({ auto: 'fail', reasons: ['службовий акаунт'], pick: all[0], ment: [] }, u, all.length); continue; }
    if (!win.length) { push({ auto: 'fail', reasons: ['коментар поза періодом'], pick: all[0], ment: [] }, u, all.length); continue; }
    if (single) push(judge(u, win), u, all.length);
    else {
      let any = false;
      for (const x of win) { const r = judge(u, [x], x); if (r.auto !== 'fail') { any = true; push(r, u + '#' + x.ig_id, all.length); } }
      if (!any) push(judge(u, win), u, all.length);
    }
  }
  entries.sort((a, b) => a.ts - b.ts || String(a.ig_id).localeCompare(String(b.ig_id)));
  for (const e of entries) stats[e.final] = (stats[e.final] || 0) + 1;
  stats.entries = entries.length;
  return { entries, stats };
}

export function poolOf(entries) {
  return entries.filter((e) => e.final === 'ok').map((e, i) => ({ n: i + 1, username: e.username, ig_id: String(e.ig_id), like_count: e.like_count || 0 }));
}
export function canonical(pool) { return pool.map((p) => `${p.n}\t${p.username}\t${p.ig_id}`).join('\n'); }
export async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function poolHash(pool) { return sha256hex(canonical(pool)); }
export function randomSeed() {
  const a = new Uint8Array(32); crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
}
// Вибір count різних номерів з 1..size (крім taken). Без зсуву за модулем: зайві значення відкидаються.
// owners (v2): масив акаунтів за номером (owners[n-1]); після вибору номера всі номери цього акаунта вилучаються.
export async function draw(seed, hash, size, count, taken = [], owners = null) {
  const skip = new Set(taken);
  const left = [];
  for (let n = 1; n <= size; n++) if (!skip.has(n)) left.push(n);
  const picks = [];
  const algo = owners ? ALGO2 : ALGO;
  let counter = 0;
  while (picks.length < count && left.length) {
    const h = await sha256hex(`${algo}|${seed}|${hash}|${counter++}`);
    const x = BigInt('0x' + h.slice(0, 16));
    const m = BigInt(left.length);
    const limit = ((1n << 64n) / m) * m;
    if (x >= limit) continue;
    const n = left.splice(Number(x % m), 1)[0];
    picks.push(n);
    if (owners) { const u = owners[n - 1]; for (let i = left.length - 1; i >= 0; i--) if (owners[left[i] - 1] === u) left.splice(i, 1); }
  }
  return picks;
}
// Подарунки: рядок або {label, method}; method: random (випадковий номер) | top_likes (найбільше лайків).
export function normPrizes(list) {
  return (Array.isArray(list) ? list : []).map((p) => (typeof p === 'string' ? { label: p, method: 'random' } : { label: String((p && p.label) || ''), method: p && p.method === 'top_likes' ? 'top_likes' : 'random' })).filter((p) => p.label.trim());
}
// Гонка за лайки: пул за спаданням лайків, за рівності раніший номер; без акаунтів з used.
export function likesRank(pool, used = new Set()) {
  return pool.filter((p) => !used.has(p.username)).slice().sort((a, b) => (b.like_count || 0) - (a.like_count || 0) || a.n - b.n);
}
// Усі номери перелічених акаунтів (для виключення з випадкового вибору).
export function numbersOf(pool, users) { const s = new Set(users); return pool.filter((p) => s.has(p.username)).map((p) => p.n); }

// Аналітика поста: лише підрахунки, без мережі. comments як у evaluate, entries з evaluate.
const STOP = new Set('дуже який яка яке які коли тому того цього цьому щоб якщо також тільки лише буде були було може можна треба наша наші наш ваша ваші ваш мене тебе нього неї них його їхні собі дякую привіт хочу хочемо беремо участь нашого нашої нашому виграти вашого вашої будь ласка this that with from have what your'.split(' '));
export function analyze(comments, entries, opt = {}) {
  const ok = entries.filter((e) => e.final === 'ok');
  const base = ok.length ? ok : entries;
  const live = comments.filter((c) => !c.gone);
  const hrs = new Map();
  for (const e of base) { const h = Math.floor(e.ts / 3600) * 3600; hrs.set(h, (hrs.get(h) || 0) + 1); }
  const keys = [...hrs.keys()].sort((a, b) => a - b);
  const series = [];
  if (keys.length) for (let h = keys[0]; h <= keys[keys.length - 1] && series.length < 24 * 60; h += 3600) series.push([h, hrs.get(h) || 0]);
  const peak = series.reduce((m, x) => (x[1] > m[1] ? x : m), [0, 0]);
  const first = base[0] || null, last = base[base.length - 1] || null;
  const firstDay = first ? Math.round((base.filter((e) => e.ts - first.ts < 86400).length / base.length) * 100) : 0;
  const firstHour = first ? base.filter((e) => e.ts - first.ts < 3600).length : 0;
  const by = new Map();
  for (const c of live) { if (c.parent_ig_id && !opt.include_replies) continue; const u = cleanUser(c.username); if (u && u !== cleanUser(opt.organizer || 'barpi.ua')) by.set(u, (by.get(u) || 0) + 1); }
  const authors = [...by.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const dist = [['1 коментар', 0], ['2–3', 0], ['4–10', 0], ['11+', 0]];
  for (const [, c] of authors) dist[c === 1 ? 0 : c <= 3 ? 1 : c <= 10 ? 2 : 3][1]++;
  const likeDist = [['0 лайків', 0], ['1–4', 0], ['5–19', 0], ['20+', 0]];
  for (const e of base) { const l = e.like_count || 0; likeDist[l === 0 ? 0 : l < 5 ? 1 : l < 20 ? 2 : 3][1]++; }
  let n = 0; const num = new Map(); for (const e of ok) num.set(String(e.ig_id), ++n);
  const topLikes = base.slice().sort((a, b) => (b.like_count || 0) - (a.like_count || 0) || a.ts - b.ts).slice(0, 10).map((e) => ({ username: e.username, text: e.text, like_count: e.like_count || 0, ig_id: e.ig_id, n: num.get(String(e.ig_id)) || null }));
  const other = new Map();
  for (const e of entries) { if (e.final === 'ok' || !e.reasons.includes('немає правильної відповіді')) continue; for (const w of new Set(words(e.text).filter((w) => w.length >= 4 && !STOP.has(w) && !w.startsWith('@') && !/^\d+$/.test(w)))) other.set(w, (other.get(w) || 0) + 1); }
  const otherTop = [...other.entries()].filter((x) => x[1] > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  const longest = base.slice().sort((a, b) => String(b.text).length - String(a.text).length)[0] || null;
  return { series, peak, first, last, firstDay, firstHour, authors, dist, likeDist, topLikes, otherTop, longest, pool: ok.length, entries: entries.length,
    comments: live.length, share: entries.length ? Math.round((ok.length / entries.length) * 100) : 0, maxLikes: topLikes[0] ? topLikes[0].like_count : 0 };
}
// Тестові коментарі для репетиції (режим «Тест»): детерміновані, вигадані акаунти.
export function demoComments(n = 60, base = 1700000000) {
  const names = ['luna', 'archi', 'bublyk', 'mars', 'zefir', 'oscar', 'jack', 'busya', 'rex', 'simba', 'tosha', 'kiwi'];
  const said = ['Хочу виграти!', 'Яловичина, наш улюблений смак', 'Курка! @friend_one', 'Печінка @friend_two @friend_three', 'беремо участь', 'яловичена', 'Сердечка для нашого хвостика @friend_four', '🐶🐶🐶'];
  const out = [];
  let s = 7;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < n; i++) {
    const u = `test_${names[Math.floor(rnd() * names.length)]}_${Math.floor(rnd() * 40)}`;
    out.push({ ig_id: 'demo' + String(i + 1).padStart(4, '0'), parent_ig_id: null, username: u, text: said[Math.floor(rnd() * said.length)], ts: base + i * 613, like_count: Math.floor(rnd() * 9) });
  }
  return out;
}
