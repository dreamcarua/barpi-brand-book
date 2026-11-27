// ═══════════════════════════════════════════════════════════════════════════
// barpi-giveaways · розіграші Barpi в Instagram (рішення Вадима 27.11.2026).
//   brand.barpi.ua/dashboard/api/giveaways/*   сторінка /dashboard/giveaways/ за Cloudflare Access (JWT перевіряється)
//   brand.barpi.ua/giveaways-api/healthz
//   brand.barpi.ua/giveaways-api/protocol/<token>   публічний протокол опублікованого розіграшу (лише переможці і хеш пулу)
// Таблиці gw_* у D1 barpi-bible. Жеребкування робить сервер: пул фіксується, зерно і номери пишуться в gw_draws,
// повторний виклик повертає той самий результат. Анулювання лишається в історії.
// Секрет IG_TOKEN: токен сторінки Barpi (Graph API). Без нього працює лише режим «Тест».
// ═══════════════════════════════════════════════════════════════════════════
import { accessUser } from './access.js';
import * as L from '../../../../dashboard/giveaways/lib/logic.js';

const VERSION = '1.0.0';
const API = '/dashboard/api/giveaways';
const GRAPH = 'https://graph.facebook.com/v21.0';
const PAGE = 'https://brand.barpi.ua/dashboard/giveaways/';
const now = () => Math.floor(Date.now() / 1000);
const listOf = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const arr = (v) => (Array.isArray(v) ? v : []);
const clamp = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const str = (v, n) => (v == null ? '' : String(v).slice(0, n));
const tsOf = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };

class E extends Error { constructor(code, status = 400, extra = {}) { super(code); this.code = code; this.status = status; this.extra = extra; } }
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
}
const all = async (env, sql, ...b) => (await env.DB.prepare(sql).bind(...b).all()).results || [];
const one = (env, sql, ...b) => env.DB.prepare(sql).bind(...b).first();
const run = (env, sql, ...b) => env.DB.prepare(sql).bind(...b).run();
async function batch(env, stmts) { for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50)); }
const logStmt = (env, gid, by, action, detail) => env.DB.prepare('INSERT INTO gw_log (giveaway_id, at, by, action, detail) VALUES (?,?,?,?,?)').bind(gid, now(), by, action, detail == null ? null : JSON.stringify(detail).slice(0, 4000));
const kyivDate = (ts) => new Date(ts * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });

// ── умови розіграшу ───────────────────────────────────────────────────────
function cleanCfg(b, prev = {}) {
  const c = { ...prev };
  if ('one_per_account' in b) c.one_per_account = !!b.one_per_account;
  if ('exclude' in b) c.exclude = [...new Set(arr(b.exclude).map(L.cleanUser).filter(Boolean))].slice(0, 100);
  if ('answer' in b) {
    const groups = arr(b.answer && b.answer.groups).map((g) => arr(g).map((s) => str(s, 80).trim()).filter(Boolean).slice(0, 20)).filter((g) => g.length).slice(0, 30);
    c.answer = { on: !!(b.answer && b.answer.on), groups, need: clamp(b.answer && b.answer.need, 1, Math.max(1, groups.length), Math.max(1, groups.length)) };
  }
  if ('mention' in b) c.mention = { on: !!(b.mention && b.mention.on), min: clamp(b.mention && b.mention.min, 1, 10, 1) };
  if ('manual' in b) c.manual = { on: !!(b.manual && b.manual.on) };
  if ('winners' in b) c.winners = clamp(b.winners, 1, 100, 1);
  if ('reserves' in b) c.reserves = clamp(b.reserves, 0, 100, 0);
  if ('prizes' in b) c.prizes = arr(b.prizes).map((s) => str(s, 200).trim()).filter(Boolean).slice(0, 100);
  if ('rules' in b) c.rules = str(b.rules, 4000);
  if ('festive' in b) c.festive = !!b.festive;
  return c;
}
const cfgOf = (g) => { try { return JSON.parse(g.config || '{}'); } catch (e) { return {}; } };
const evalCfg = (g, env) => ({ ...cfgOf(g), starts_at: g.starts_at, ends_at: g.ends_at, organizer: env.IG_USERNAME || 'barpi.ua' });
async function compute(env, g) {
  const comments = await all(env, 'SELECT ig_id, parent_ig_id, username, text, ts, like_count, gone FROM gw_comments WHERE giveaway_id = ?', g.id);
  const dec = {};
  for (const d of await all(env, 'SELECT username, decision, reason FROM gw_decisions WHERE giveaway_id = ?', g.id)) dec[d.username] = d;
  return L.evaluate(comments, evalCfg(g, env), dec);
}
async function recount(env, g, res) {
  const s = res.stats;
  if (g.comments_total !== s.comments_total || g.accounts_count !== s.accounts || g.ok_count !== s.ok)
    await run(env, 'UPDATE gw_giveaways SET comments_total = ?, accounts_count = ?, ok_count = ? WHERE id = ?', s.comments_total, s.accounts, s.ok, g.id);
}
const getG = async (env, id) => { const g = await one(env, 'SELECT * FROM gw_giveaways WHERE id = ? AND deleted = 0', id); if (!g) throw new E('not_found', 404); return g; };
const pub = (g) => { const { config, ...r } = g; return { ...r, cfg: cfgOf(g) }; };

// ── Instagram Graph API ───────────────────────────────────────────────────
async function ig(env, path, params = {}) {
  if (!env.IG_TOKEN) throw new E('ig_not_connected', 503);
  const u = new URL(GRAPH + path);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, v);
  u.searchParams.set('access_token', env.IG_TOKEN);
  let r, j;
  try { r = await fetch(u); j = await r.json(); } catch (e) { throw new E('ig_unreachable', 502); }
  if (!r.ok || j.error) throw new E('ig_error', 502, { ig_code: j.error && j.error.code, ig_message: str(j.error && j.error.message, 300) });
  return j;
}
const igTs = (s) => { const t = Date.parse(String(s || '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')); return Number.isFinite(t) ? Math.floor(t / 1000) : null; };
const mediaOut = (m) => ({ id: m.id, caption: str(m.caption, 300), type: m.media_product_type || m.media_type, permalink: m.permalink, thumb: m.thumbnail_url || (m.media_type === 'VIDEO' ? '' : m.media_url) || '', ts: igTs(m.timestamp), comments: m.comments_count || 0, likes: m.like_count || 0 });
const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,comments_count,like_count';
async function mediaList(env, after) {
  const j = await ig(env, `/${env.IG_USER_ID}/media`, { fields: MEDIA_FIELDS, limit: 24, after });
  return { items: arr(j.data).map(mediaOut), after: j.paging && j.paging.next ? j.paging.cursors.after : null };
}
// Збір коментарів: до 40 сторінок по 50 за один виклик. Якщо весь пост пройдено за один виклик,
// позначаємо коментарі, що зникли з Instagram. Адресу наступної сторінки не зберігаємо: у ній токен.
async function fetchComments(env, g, by) {
  if (g.status !== 'open') throw new E('frozen', 409);
  if (g.source === 'demo') return { done: true, added: 0, demo: true };
  if (!g.media_id) throw new E('no_media', 400);
  const have = new Set((await all(env, 'SELECT ig_id FROM gw_comments WHERE giveaway_id = ?', g.id)).map((r) => r.ig_id));
  const seen = new Set(); const stmts = [];
  const ins = env.DB.prepare('INSERT OR IGNORE INTO gw_comments (giveaway_id, ig_id, parent_ig_id, username, text, ts, like_count) VALUES (?,?,?,?,?,?,?)');
  const add = (c, parent) => { const id = String(c.id); seen.add(id); if (!have.has(id)) { have.add(id); stmts.push(ins.bind(g.id, id, parent, str(c.username, 60), str(c.text, 2200), igTs(c.timestamp), c.like_count || 0)); } };
  let after = null, pages = 0, complete = false, err = null;
  try {
    while (pages < 40) {
      const j = await ig(env, `/${g.media_id}/comments`, { fields: 'id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}', limit: 50, after });
      pages++;
      for (const c of arr(j.data)) { add(c, null); for (const r of arr(c.replies && c.replies.data)) add(r, String(c.id)); }
      if (j.paging && j.paging.next && j.paging.cursors && j.paging.cursors.after) after = j.paging.cursors.after; else { complete = true; break; }
    }
  } catch (e) { if (!(e instanceof E)) throw e; err = e; }
  const added = stmts.length;
  let gone = 0;
  if (complete) {
    const missing = [...have].filter((id) => !seen.has(id));
    const back = await all(env, 'SELECT ig_id FROM gw_comments WHERE giveaway_id = ? AND gone = 1', g.id);
    for (const id of missing) stmts.push(env.DB.prepare('UPDATE gw_comments SET gone = 1 WHERE giveaway_id = ? AND ig_id = ? AND gone = 0').bind(g.id, id));
    for (const r of back) if (seen.has(r.ig_id)) stmts.push(env.DB.prepare('UPDATE gw_comments SET gone = 0 WHERE giveaway_id = ? AND ig_id = ?').bind(g.id, r.ig_id));
    gone = missing.length;
  }
  stmts.push(env.DB.prepare('UPDATE gw_giveaways SET fetched_at = ?, fetch_error = ?, fetch_partial = ?, updated_at = ? WHERE id = ?')
    .bind(now(), err ? JSON.stringify({ code: err.code, ...err.extra }) : null, complete ? 0 : 1, now(), g.id));
  stmts.push(logStmt(env, g.id, by, 'fetch', { added, pages, complete, gone, error: err ? err.code : null }));
  await batch(env, stmts);
  if (err && !added) throw err;
  return { done: true, added, pages, complete, gone, error: err ? { code: err.code, ...err.extra } : null };
}

// ── Telegram (необов'язково) ──────────────────────────────────────────────
async function tgSend(env, text) {
  if (!env.TG_TOKEN) return 0; let sent = 0;
  for (const chat of listOf(env.GW_TG_CHATS)) {
    try { const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }) }); if (r.ok) sent++; } catch (e) { console.error('[giveaways] telegram', e.message); }
  }
  return sent;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ── жеребкування ──────────────────────────────────────────────────────────
const winnersOf = (env, g) => all(env, 'SELECT * FROM gw_winners WHERE giveaway_id = ? ORDER BY void, role DESC, position, id', g.id);
const drawsOf = (env, g) => all(env, 'SELECT * FROM gw_draws WHERE giveaway_id = ? ORDER BY id', g.id);
async function doDraw(env, g, by, ctx) {
  if (g.status === 'drawn') return { repeated: true };
  if (g.status !== 'frozen') throw new E('not_frozen', 409);
  const cfg = cfgOf(g);
  const pool = await all(env, 'SELECT n, username, ig_id FROM gw_pool WHERE giveaway_id = ? ORDER BY n', g.id);
  const hash = await L.poolHash(pool);
  if (hash !== g.pool_hash || pool.length !== g.pool_count) throw new E('pool_mismatch', 500);
  const W = Math.min(cfg.winners || 1, pool.length), R = Math.min(cfg.reserves || 0, pool.length - W);
  const seed = L.randomSeed();
  const picks = await L.draw(seed, hash, pool.length, W + R);
  const t = now(); const byN = new Map(pool.map((p) => [p.n, p]));
  const prizes = arr(cfg.prizes);
  const stmts = [env.DB.prepare('INSERT INTO gw_draws (giveaway_id, gen, round, kind, algo, seed, pool_hash, pool_count, picks, taken, by, at) VALUES (?,?,1,?,?,?,?,?,?,?,?,?)')
    .bind(g.id, g.gen, 'main', L.ALGO, seed, hash, pool.length, JSON.stringify(picks), '[]', by, t)];
  picks.forEach((n, i) => {
    const p = byN.get(n); const win = i < W;
    stmts.push(env.DB.prepare('INSERT INTO gw_winners (giveaway_id, gen, round, role, position, n, username, ig_id, prize) VALUES (?,?,1,?,?,?,?,?,?)')
      .bind(g.id, g.gen, win ? 'winner' : 'reserve', win ? i + 1 : i - W + 1, n, p.username, p.ig_id, win ? prizes[i] || prizes[prizes.length - 1] || '' : null));
  });
  stmts.push(env.DB.prepare("UPDATE gw_giveaways SET status = 'drawn', drawn_at = ?, updated_at = ? WHERE id = ?").bind(t, t, g.id));
  stmts.push(logStmt(env, g.id, by, 'draw', { round: 1, winners: W, reserves: R, pool: pool.length, pool_hash: hash }));
  if (g.calendar_id) stmts.push(env.DB.prepare("UPDATE mkt_activities SET status = 'done', kpi_fact = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ? AND source = 'giveaways'").bind(pool.length, by, g.calendar_id));
  try { await env.DB.batch(stmts); } // UNIQUE(giveaway_id, gen, round): друге одночасне натискання відкотиться цілком
  catch (e) { if (/UNIQUE/i.test(String(e.message))) return { repeated: true }; throw e; }
  if (g.source !== 'demo') ctx.waitUntil(tgSend(env, `🎁 <b>Розіграш проведено:</b> ${esc(g.title)}\nУчасників у пулі: ${pool.length}, переможців: ${W}\n${PAGE}#/g/${g.id}`));
  return { ok: true };
}
async function doExtra(env, g, by, b) {
  if (g.status !== 'drawn') throw new E('not_drawn', 409);
  const cur = (await winnersOf(env, g)).filter((w) => !w.void && w.gen === g.gen);
  const pool = await all(env, 'SELECT n, username, ig_id FROM gw_pool WHERE giveaway_id = ? ORDER BY n', g.id);
  const taken = cur.map((w) => w.n);
  let prize = str(b.prize, 200), position = Math.max(0, ...cur.filter((w) => w.role === 'winner').map((w) => w.position)) + 1, from = null;
  if (b.replace_id) {
    const x = cur.find((w) => w.id === Number(b.replace_id));
    if (!x || x.verdict !== 'failed') throw new E('bad_replace', 400);
    if (cur.some((w) => w.promoted_from === x.id)) throw new E('already_replaced', 409);
    prize = x.prize || ''; position = x.position; from = x.id;
  }
  if (pool.length - taken.length < 1) throw new E('pool_exhausted', 409);
  const round = Math.max(0, ...(await drawsOf(env, g)).filter((d) => d.gen === g.gen).map((d) => d.round)) + 1;
  const seed = L.randomSeed();
  const [n] = await L.draw(seed, g.pool_hash, pool.length, 1, taken);
  const p = pool.find((q) => q.n === n); const t = now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO gw_draws (giveaway_id, gen, round, kind, algo, seed, pool_hash, pool_count, picks, taken, by, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(g.id, g.gen, round, 'extra', L.ALGO, seed, g.pool_hash, pool.length, JSON.stringify([n]), JSON.stringify(taken.slice().sort((a, c) => a - c)), by, t),
    env.DB.prepare('INSERT INTO gw_winners (giveaway_id, gen, round, role, position, n, username, ig_id, prize, promoted_from) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(g.id, g.gen, round, 'winner', position, n, p.username, p.ig_id, prize, from),
    logStmt(env, g.id, by, 'extra_draw', { round, n, replace: from, prize }),
  ]);
  return { ok: true };
}
async function doVerdict(env, g, by, b) {
  if (g.status !== 'drawn') throw new E('not_drawn', 409);
  const cur = (await winnersOf(env, g)).filter((w) => !w.void && w.gen === g.gen);
  const w = cur.find((x) => x.id === Number(b.winner_id));
  if (!w) throw new E('not_found', 404);
  const v = ['ok', 'failed', 'pending'].includes(b.verdict) ? b.verdict : null;
  if (!v) throw new E('bad_verdict', 400);
  const reason = str(b.reason, 500).trim();
  if (v === 'failed' && !reason) throw new E('reason_required', 400);
  if (w.verdict === 'failed' && cur.some((x) => x.promoted_from === w.id)) throw new E('already_replaced', 409);
  const t = now();
  const stmts = [env.DB.prepare('UPDATE gw_winners SET verdict = ?, verdict_reason = ?, verdict_by = ?, verdict_at = ? WHERE id = ?').bind(v, v === 'failed' ? reason : null, by, t, w.id)];
  let promoted = null;
  if (v === 'failed' && w.role === 'winner') {
    promoted = cur.filter((x) => x.role === 'reserve' && x.verdict !== 'failed').sort((a, c) => a.position - c.position)[0] || null;
    if (promoted) stmts.push(env.DB.prepare("UPDATE gw_winners SET role = 'winner', prize = ?, position = ?, promoted_from = ?, verdict = 'pending' WHERE id = ?").bind(w.prize, w.position, w.id, promoted.id));
  }
  stmts.push(logStmt(env, g.id, by, 'verdict', { username: w.username, verdict: v, reason, promoted: promoted ? promoted.username : null }));
  await env.DB.batch(stmts);
  return { ok: true, promoted: promoted ? promoted.username : null, need_extra: v === 'failed' && w.role === 'winner' && !promoted };
}

// ── публічний протокол ────────────────────────────────────────────────────
async function protocol(env, token) {
  if (!/^[a-f0-9]{32}$/.test(token)) return json({ error: 'not_found' }, 404);
  const g = await one(env, "SELECT * FROM gw_giveaways WHERE public_token = ? AND published = 1 AND deleted = 0 AND status = 'drawn' AND source = 'instagram'", token);
  if (!g) return json({ error: 'not_found' }, 404);
  const cfg = cfgOf(g);
  const ws = (await winnersOf(env, g)).filter((w) => !w.void && w.gen === g.gen && w.role === 'winner');
  const draws = await drawsOf(env, g);
  return json({
    title: g.title, post: g.media_permalink, rules: cfg.rules || '', starts_at: g.starts_at, ends_at: g.ends_at, drawn_at: g.drawn_at,
    conditions: { one_per_account: cfg.one_per_account !== false, answer: !!(cfg.answer && cfg.answer.on), mention: cfg.mention && cfg.mention.on ? cfg.mention.min : 0, manual: !!(cfg.manual && cfg.manual.on) },
    counts: { comments: g.comments_total, accounts: g.accounts_count, pool: g.pool_count },
    pool_hash: g.pool_hash, algo: L.ALGO,
    draws: draws.map((d) => ({ round: d.round, kind: d.kind, at: d.at, seed: d.void || d.gen !== g.gen ? null : d.seed, picks: d.void || d.gen !== g.gen ? null : JSON.parse(d.picks), taken: d.void || d.gen !== g.gen ? null : JSON.parse(d.taken || '[]'), void: !!d.void || d.gen !== g.gen, void_reason: d.void_reason || null })),
    winners: ws.sort((a, c) => a.position - c.position).filter((w) => w.verdict !== 'failed').map((w) => ({ position: w.position, username: w.username, n: w.n, prize: w.prize || '', confirmed: w.verdict === 'ok', replaced: !!w.promoted_from })),
    replaced: ws.filter((w) => w.verdict === 'failed').length,
  });
}

// ── API дашборда ──────────────────────────────────────────────────────────
async function dashboard(req, env, ctx, path, email) {
  const isAdmin = listOf(env.GW_ADMIN_EMAILS).map((x) => x.toLowerCase()).includes(email);
  const m = req.method;
  const body = async () => { try { return (await req.json()) || {}; } catch (e) { throw new E('bad_json', 400); } };
  if (path === '/me') return json({ email, isAdmin, version: VERSION, ig: { connected: !!env.IG_TOKEN, username: env.IG_USERNAME || 'barpi.ua' }, now: now() });
  if (path === '/ig/check') { const j = await ig(env, `/${env.IG_USER_ID}`, { fields: 'username,media_count' }); return json({ ok: true, username: j.username, media_count: j.media_count }); }
  if (path === '/media' && m === 'GET') return json(await mediaList(env, new URL(req.url).searchParams.get('after')));
  if (path === '/list' && m === 'GET') {
    const rows = (await all(env, 'SELECT * FROM gw_giveaways WHERE deleted = 0 ORDER BY id DESC LIMIT 500')).map(pub);
    const templates = (await all(env, 'SELECT id, name, config, created_by, created_at FROM gw_templates WHERE deleted = 0 ORDER BY id DESC')).map((t) => ({ ...t, config: JSON.parse(t.config) }));
    return json({ rows, templates, now: now() });
  }
  if (path === '/log' && m === 'GET') return json({ rows: await all(env, 'SELECT l.*, g.title FROM gw_log l LEFT JOIN gw_giveaways g ON g.id = l.giveaway_id ORDER BY l.id DESC LIMIT 300') });
  if (path === '/templates' && m === 'POST') {
    const b = await body(); const name = str(b.name, 120).trim(); if (!name) throw new E('name_required');
    const r = await run(env, 'INSERT INTO gw_templates (name, config, created_by, created_at) VALUES (?,?,?,?)', name, JSON.stringify(cleanCfg(b.cfg || {})), email, now());
    return json({ ok: true, id: r.meta.last_row_id });
  }
  const tm = path.match(/^\/templates\/(\d+)$/);
  if (tm && m === 'DELETE') { await run(env, 'UPDATE gw_templates SET deleted = 1 WHERE id = ?', Number(tm[1])); return json({ ok: true }); }
  if (path === '' || path === '/') {
    if (m !== 'POST') throw new E('method', 405);
    const b = await body(); const title = str(b.title, 160).trim(); if (!title) throw new E('title_required');
    const demo = b.source === 'demo'; const t = now();
    const cfg = cleanCfg({ one_per_account: true, winners: 1, reserves: 2, ...(b.cfg || {}) });
    const med = b.media || {};
    const r = await run(env, 'INSERT INTO gw_giveaways (title, source, media_id, media_permalink, media_caption, media_thumb, media_ts, starts_at, ends_at, config, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      title, demo ? 'demo' : 'instagram', demo ? null : str(med.id, 40) || null, demo ? null : str(med.permalink, 300) || null, demo ? 'Тестова публікація для репетиції' : str(med.caption, 300) || null, demo ? null : str(med.thumb, 1000) || null, demo ? null : tsOf(med.ts),
      tsOf(b.starts_at), tsOf(b.ends_at), JSON.stringify(cfg), email, t, t);
    const id = r.meta.last_row_id;
    const stmts = [logStmt(env, id, email, 'create', { title, source: demo ? 'demo' : 'instagram' })];
    if (demo) for (const c of L.demoComments(60, t - 60 * 613)) stmts.push(env.DB.prepare('INSERT OR IGNORE INTO gw_comments (giveaway_id, ig_id, parent_ig_id, username, text, ts, like_count) VALUES (?,?,?,?,?,?,?)').bind(id, c.ig_id, null, c.username, c.text, c.ts, c.like_count));
    await batch(env, stmts);
    return json({ ok: true, id });
  }
  const gm = path.match(/^\/(\d+)(?:\/([a-z]+))?$/);
  if (!gm) throw new E('not_found', 404);
  const g = await getG(env, Number(gm[1])); const act = gm[2] || '';
  if (!act && m === 'GET') {
    const res = await compute(env, g);
    if (g.status === 'open') await recount(env, g, res);
    const [pool, draws, winners, log] = await Promise.all([
      g.status === 'open' ? [] : all(env, 'SELECT n, username, ig_id FROM gw_pool WHERE giveaway_id = ? ORDER BY n', g.id),
      drawsOf(env, g), winnersOf(env, g), all(env, 'SELECT * FROM gw_log WHERE giveaway_id = ? ORDER BY id DESC LIMIT 200', g.id)]);
    return json({ g: pub(g), entries: res.entries, stats: res.stats, pool, draws, winners, log, now: now() });
  }
  if (!act && m === 'PATCH') {
    const b = await body(); const set = {}; const cfg = cfgOf(g);
    if ('title' in b) { const t = str(b.title, 160).trim(); if (!t) throw new E('title_required'); set.title = t; }
    if (g.status === 'open') {
      if ('starts_at' in b) set.starts_at = tsOf(b.starts_at);
      if ('ends_at' in b) set.ends_at = tsOf(b.ends_at);
      if (b.media && g.source === 'instagram') {
        if (g.media_id && String(b.media.id) !== String(g.media_id) && g.comments_total > 0) throw new E('media_locked', 409);
        Object.assign(set, { media_id: str(b.media.id, 40) || null, media_permalink: str(b.media.permalink, 300) || null, media_caption: str(b.media.caption, 300) || null, media_thumb: str(b.media.thumb, 1000) || null, media_ts: tsOf(b.media.ts) });
      }
      if (b.cfg) set.config = JSON.stringify(cleanCfg(b.cfg, cfg));
    } else if (b.cfg && 'festive' in b.cfg) set.config = JSON.stringify({ ...cfg, festive: !!b.cfg.festive });
    else if ('starts_at' in b || 'ends_at' in b || b.cfg || b.media) throw new E('frozen', 409);
    const keys = Object.keys(set); if (!keys.length) return json({ ok: true, unchanged: true });
    set.updated_at = now(); keys.push('updated_at');
    await env.DB.batch([env.DB.prepare(`UPDATE gw_giveaways SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`).bind(...keys.map((k) => set[k]), g.id),
      logStmt(env, g.id, email, 'edit', { fields: keys.filter((k) => k !== 'updated_at') })]);
    return json({ ok: true });
  }
  if (!act && m === 'DELETE') {
    if (g.status === 'drawn' && !(isAdmin && g.source === 'demo')) throw new E('drawn_keep', 409);
    if (!isAdmin && g.created_by !== email) throw new E('admin_only', 403);
    await env.DB.batch([env.DB.prepare('UPDATE gw_giveaways SET deleted = 1, published = 0, updated_at = ? WHERE id = ?').bind(now(), g.id), logStmt(env, g.id, email, 'delete', { title: g.title })]);
    return json({ ok: true });
  }
  if (m !== 'POST') throw new E('method', 405);
  const b = await body();
  if (act === 'fetch') return json(await fetchComments(env, g, email));
  if (act === 'decision') {
    if (g.status !== 'open') throw new E('frozen', 409);
    const u = L.cleanUser(b.username); if (!u) throw new E('username_required');
    if (b.decision === 'auto') {
      await env.DB.batch([env.DB.prepare('DELETE FROM gw_decisions WHERE giveaway_id = ? AND username = ?').bind(g.id, u), logStmt(env, g.id, email, 'decision', { username: u, decision: 'auto' })]);
    } else {
      if (!['ok', 'fail', 'review'].includes(b.decision)) throw new E('bad_decision');
      const reason = str(b.reason, 500).trim();
      if (b.decision === 'fail' && !reason) throw new E('reason_required');
      await env.DB.batch([env.DB.prepare('INSERT INTO gw_decisions (giveaway_id, username, decision, reason, by, at) VALUES (?,?,?,?,?,?) ON CONFLICT(giveaway_id, username) DO UPDATE SET decision = excluded.decision, reason = excluded.reason, by = excluded.by, at = excluded.at').bind(g.id, u, b.decision, reason, email, now()),
        logStmt(env, g.id, email, 'decision', { username: u, decision: b.decision, reason })]);
    }
    return json({ ok: true });
  }
  if (act === 'freeze') {
    if (g.status !== 'open') throw new E('frozen', 409);
    const res = await compute(env, g);
    if (res.stats.review > 0) throw new E('review_left', 409, { count: res.stats.review });
    const pool = L.poolOf(res.entries);
    if (!pool.length) throw new E('empty_pool', 409);
    const hash = await L.poolHash(pool); const t = now();
    const stmts = [env.DB.prepare('DELETE FROM gw_pool WHERE giveaway_id = ?').bind(g.id)];
    for (const p of pool) stmts.push(env.DB.prepare('INSERT INTO gw_pool (giveaway_id, n, username, ig_id) VALUES (?,?,?,?)').bind(g.id, p.n, p.username, p.ig_id));
    await batch(env, stmts);
    await env.DB.batch([env.DB.prepare("UPDATE gw_giveaways SET status = 'frozen', frozen_at = ?, frozen_by = ?, pool_hash = ?, pool_count = ?, comments_total = ?, accounts_count = ?, ok_count = ?, updated_at = ? WHERE id = ? AND status = 'open'")
      .bind(t, email, hash, pool.length, res.stats.comments_total, res.stats.accounts, res.stats.ok, t, g.id), logStmt(env, g.id, email, 'freeze', { pool: pool.length, pool_hash: hash })]);
    return json({ ok: true, pool: pool.length, pool_hash: hash });
  }
  if (act === 'unfreeze') {
    if (g.status !== 'frozen') throw new E(g.status === 'drawn' ? 'drawn_keep' : 'not_frozen', 409);
    await env.DB.batch([env.DB.prepare('DELETE FROM gw_pool WHERE giveaway_id = ?').bind(g.id),
      env.DB.prepare("UPDATE gw_giveaways SET status = 'open', frozen_at = NULL, frozen_by = NULL, pool_hash = NULL, pool_count = NULL, updated_at = ? WHERE id = ?").bind(now(), g.id),
      logStmt(env, g.id, email, 'unfreeze', { pool_hash: g.pool_hash })]);
    return json({ ok: true });
  }
  if (act === 'draw') return json(await doDraw(env, g, email, ctx));
  if (act === 'extra') return json(await doExtra(env, g, email, b));
  if (act === 'verdict') return json(await doVerdict(env, g, email, b));
  if (act === 'void') {
    if (!isAdmin) throw new E('admin_only', 403);
    if (g.status !== 'drawn') throw new E('not_drawn', 409);
    const reason = str(b.reason, 500).trim(); if (!reason) throw new E('reason_required');
    const t = now();
    await env.DB.batch([
      env.DB.prepare('UPDATE gw_draws SET void = 1, void_reason = ?, void_by = ?, void_at = ? WHERE giveaway_id = ? AND gen = ?').bind(reason, email, t, g.id, g.gen),
      env.DB.prepare('UPDATE gw_winners SET void = 1 WHERE giveaway_id = ? AND gen = ?').bind(g.id, g.gen),
      env.DB.prepare("UPDATE gw_giveaways SET status = 'frozen', gen = gen + 1, drawn_at = NULL, published = 0, updated_at = ? WHERE id = ?").bind(t, g.id),
      logStmt(env, g.id, email, 'void', { reason, gen: g.gen })]);
    return json({ ok: true });
  }
  if (act === 'publish') {
    if (g.source !== 'instagram') throw new E('demo_private', 409);
    if (g.status !== 'drawn') throw new E('not_drawn', 409);
    const on = !!b.on; const token = g.public_token || L.randomSeed().slice(0, 32);
    await env.DB.batch([env.DB.prepare('UPDATE gw_giveaways SET public_token = ?, published = ?, updated_at = ? WHERE id = ?').bind(token, on ? 1 : 0, now(), g.id), logStmt(env, g.id, email, on ? 'publish' : 'unpublish', null)]);
    return json({ ok: true, published: on, token });
  }
  if (act === 'calendar') {
    if (g.source !== 'instagram') throw new E('demo_private', 409);
    const t = now(); const s = kyivDate(g.starts_at || g.created_at || t), e = kyivDate(g.ends_at || g.starts_at || t);
    const status = g.status === 'drawn' ? 'done' : (g.starts_at && g.starts_at > t ? 'planned' : 'active');
    const cfg = cfgOf(g); const mech = [cfg.answer && cfg.answer.on ? 'правильна відповідь' : '', cfg.mention && cfg.mention.on ? 'відмітка друга' : '', cfg.manual && cfg.manual.on ? 'ручне підтвердження' : ''].filter(Boolean).join(' + ') || 'випадковий коментар';
    if (g.calendar_id) {
      await run(env, "UPDATE mkt_activities SET title = ?, start_date = ?, end_date = ?, status = ?, post_url = ?, mechanic = ?, kpi_fact = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ? AND source = 'giveaways'",
        'Розіграш: ' + g.title, s, e > s ? e : s, status, g.media_permalink, mech, g.pool_count || g.ok_count || null, email, g.calendar_id);
      return json({ ok: true, id: g.calendar_id, updated: true });
    }
    const r = await run(env, "INSERT INTO mkt_activities (title, start_date, end_date, direction, activity_type, mechanic, channel, owner, status, post_url, kpi_name, kpi_fact, comment, source, created_by, updated_by) VALUES (?,?,?,'ecom','Розіграш',?,'Instagram Barpi',?,?,?,'Учасники у пулі',?,?,'giveaways',?,?)",
      'Розіграш: ' + g.title, s, e > s ? e : s, mech, email, status, g.media_permalink, g.pool_count || g.ok_count || null, `Сторінка розіграшу: ${PAGE}#/g/${g.id}`, email, email);
    await env.DB.batch([env.DB.prepare('UPDATE gw_giveaways SET calendar_id = ? WHERE id = ?').bind(r.meta.last_row_id, g.id), logStmt(env, g.id, email, 'calendar', { activity_id: r.meta.last_row_id })]);
    return json({ ok: true, id: r.meta.last_row_id });
  }
  throw new E('not_found', 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url); const p = url.pathname;
    try {
      if (p === '/giveaways-api/healthz') return json({ ok: true, version: VERSION, ig: !!env.IG_TOKEN });
      if (p.startsWith('/giveaways-api/protocol/')) return await protocol(env, p.slice('/giveaways-api/protocol/'.length));
      if (p === API || p.startsWith(API + '/')) {
        const email = await accessUser(req, env);
        if (!email) return json({ error: 'unauthorized' }, 401);
        return await dashboard(req, env, ctx, p.slice(API.length).replace(/\/$/, ''), email);
      }
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      if (e instanceof E) return json({ error: e.code, ...e.extra }, e.status);
      console.error('[giveaways]', e && e.stack || e);
      return json({ error: 'internal' }, 500);
    }
  },
};
