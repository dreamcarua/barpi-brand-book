/* barpi-order-mail v1.0 (28.09.2026)
   Email Worker for office@barpi.com.ua. Forwards every message unchanged, and turns
   Horoshop new-order notifications into MoySklad customer orders via barpi-sync. */
import PostalMime from 'postal-mime';
import { parseOrder } from './parse.js';

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
  if (env.MODE !== 'live') {
    await tg(env, `🧪 Замовлення №${esc(o.number)} розібрано (тестовий режим), ${o.total} грн:\n${lines}`);
    return { ok: true, shadow: true };
  }
  const body = {
    name: String(o.number),
    description: [`Horoshop №${o.number}`, o.customer, o.phone, o.delivery, o.payment, o.comment ? 'Коментар: ' + o.comment : ''].filter(Boolean).join('\n'),
    positions: o.items.map((i) => ({ code: i.code, quantity: i.qty, price_kop: Math.round(i.price * 100) })),
  };
  const r = await env.SYNC.fetch('https://barpi-sync/order-by-code', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Key': env.ORDER_API_KEY }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: 'HTTP ' + r.status }));
  if (j.ok) await tg(env, j.duplicate ? `ℹ️ Замовлення №${esc(o.number)} вже є в МойСкладі.` : `✅ Замовлення №${esc(o.number)} з сайту внесено в МойСклад (${o.total} грн, позицій ${o.items.length}).`);
  else await tg(env, `⚠️ Замовлення №${esc(o.number)}: МойСклад відповів помилкою «${esc(j.error)}». Внесіть вручну. Лист: <code>${esc(key)}</code>`);
  return j;
}

export default {
  async email(message, env, ctx) {
    const raw = await new Response(message.raw).arrayBuffer();
    await message.forward(env.FORWARD_TO);
    ctx.waitUntil(handle(raw, env).catch((e) => tg(env, '⚠️ barpi-order-mail: ' + esc(e.message || e))));
  },
  async fetch() { return new Response('barpi-order-mail 1.0: email worker', { status: 200 }); },
};
