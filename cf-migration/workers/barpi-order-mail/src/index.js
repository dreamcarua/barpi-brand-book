/* barpi-order-mail v1.1 (10.11.2026: МС numbers the order, description as typed by hand, duplicate vs manual entry, group alerts)
   v1.0 (28.09.2026)
   Email Worker for office@barpi.com.ua. Forwards every message unchanged, and turns
   Horoshop new-order notifications into MoySklad customer orders via barpi-sync. */
import PostalMime from 'postal-mime';
import { parseOrder, buildDescription } from './parse.js';

async function tg(env, text) {
  if (!env.TG_TOKEN || !env.TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch (_) {}
}
const esc = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

async function handle(raw, env) {
  const mail = await PostalMime.parse(raw);
  const subject = mail.subject || '';
  const text = mail.text || '';
  const html = mail.html || '';
  if (!/замовлен/i.test(subject)) return { skipped: 'subject' };
  const o = parseOrder(subject, text, html);
  if (!o.number) return { skipped: 'no order number' };
  const d = new Date();
  const key = `order-mail/${d.toISOString().slice(0, 10)}/${o.number}-${d.getTime()}.eml`;
  try { await env.RAW.put(key, raw); } catch (_) {}

  const sumItems = o.items.reduce((a, i) => a + i.price * i.qty, 0);
  const ok = o.items.length > 0 && o.total != null && Math.abs(sumItems - o.total) < 1.01;
  const lines = o.items.map((i) => `• ${esc(i.code)} × ${i.qty} по ${i.price} грн`).join('\n');
  if (!ok) {
    await tg(env, `⚠️ <b>Замовлення №${esc(o.number)}</b> з сайту не внесено в МойСклад автоматично: не зійшлась сума або не знайдено товари (позицій ${o.items.length}, сума позицій ${sumItems}, сума в листі ${o.total}).\n${lines}\nЛист збережено: <code>${esc(key)}</code>. Внесіть вручну.`);
    return { ok: false, key, o };
  }
  const description = buildDescription(o);
  const body = {
    number: String(o.number),
    description,
    positions: o.items.map((i) => ({ code: i.code, quantity: i.qty, price_kop: Math.round(i.price * 100) })),
  };
  if (env.MODE !== 'live') {
    // shadow: run the whole sync path (duplicates, code lookup, payload) with dryrun, create nothing
    const dr = await env.SYNC.fetch('https://barpi-sync/order-by-code', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Key': env.ORDER_API_KEY }, body: JSON.stringify({ ...body, dryrun: true }) });
    const dj = await dr.json().catch(() => ({ ok: false, error: 'HTTP ' + dr.status }));
    const st = !dj.ok ? `помилка «${esc(dj.error)}»` : dj.duplicate ? `уже є в МС №${esc(dj.name)} (${dj.manual ? 'вручну' : 'автоматично'}), не дублювали б` : 'готово до внесення';
    await tg(env, `🧪 Замовлення сайту №${esc(o.number)} розібрано (тестовий режим, в МойСклад не вносимо), ${o.total} грн:\n${lines}\nОпис:\n<code>${esc(description)}</code>\nМойСклад: ${st}`);
    return { ok: true, shadow: true, sync: dj.ok ? { duplicate: !!dj.duplicate } : dj };
  }
  const r = await env.SYNC.fetch('https://barpi-sync/order-by-code', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Key': env.ORDER_API_KEY }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: 'HTTP ' + r.status }));
  if (j.ok) await tg(env, j.duplicate ? `ℹ️ Замовлення сайту №${esc(o.number)} вже є в МойСкладі (${j.manual ? 'внесене вручну' : 'автоматично'}), №${esc(j.name)}; не дублюю.` : `✅ Замовлення сайту №${esc(o.number)} внесено в МойСклад як №${esc(j.name)} (${o.total} грн, позицій ${o.items.length}).`);
  else await tg(env, `⚠️ Замовлення №${esc(o.number)}: МойСклад відповів помилкою «${esc(j.error)}». Внесіть вручну. Лист: <code>${esc(key)}</code>`);
  return j;
}

export default {
  async email(message, env, ctx) {
    const raw = await new Response(message.raw).arrayBuffer();
    await message.forward(env.FORWARD_TO);
    ctx.waitUntil(handle(raw, env).catch((e) => tg(env, '⚠️ barpi-order-mail: ' + esc(e.message || e))));
  },
  async fetch() { return new Response('barpi-order-mail 1.1: email worker', { status: 200 }); },
};
