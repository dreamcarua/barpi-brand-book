// Barpi HQ — Telegram Bot Edge Function (deployed via MCP)
// Live URL: https://zrcqmwlpsggiqgipvxhv.supabase.co/functions/v1/telegram-bot
// See repo /supabase/functions/telegram-bot/README.md for setup steps.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';
const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? 'https://zrcqmwlpsggiqgipvxhv.supabase.co';
const SUPA_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const sb = createClient(SUPA_URL, SUPA_SERVICE_KEY, { auth: { persistSession: false } });

async function tg(method: string, body: Record<string, unknown>) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function reply(chat_id: number, text: string, extras: Record<string, unknown> = {}) {
  await tg('sendMessage', { chat_id, text, parse_mode: 'Markdown', ...extras });
}

function fmtUah(n: number): string {
  return new Intl.NumberFormat('uk-UA').format(Math.round(n)) + ' ₴';
}

async function cmdStart(chat_id: number, user_id: number) {
  await reply(chat_id, `🐾 *Barpi HQ Bot*\n\nПривіт! Я допомагаю SMM-команді Barpi.\n\n/help — список команд\n/sale — додати продаж\n/stats — KPI за 7 днів\n/publications — план на сьогодні\n/me — мій статус\n\nТвій Telegram ID: \`${user_id}\``);
}

async function cmdHelp(chat_id: number) {
  const help = `📋 *Команди*\n\n/sale <кільк> <sku> <канал> <грн> [нотатки]\nПриклад: \`/sale 5 yalovich-30 e-zoo 450 промо\`\n\n/stats — виручка, замовлення, топ-канал за 7 днів\n/publications — публікації на сьогодні\n/me — твій профіль і whitelist`;
  await reply(chat_id, help);
}

async function cmdSale(chat_id: number, args: string[]) {
  if (args.length < 4) {
    await reply(chat_id, `❌ Формат: \`/sale <кільк> <sku> <канал> <грн> [нотатки]\``);
    return;
  }
  const [qty, sku, channel, revenue, ...rest] = args;
  const notes = rest.length > 0 ? rest.join(' ') : null;
  const { data: skuRow } = await sb.from('sales_sku').select('id,name').ilike('sku_code', sku).maybeSingle();
  if (!skuRow) { await reply(chat_id, `❌ SKU \`${sku}\` не знайдено`); return; }
  const { data: chanRow } = await sb.from('sales_channels').select('id,name').ilike('slug', channel).maybeSingle();
  if (!chanRow) { await reply(chat_id, `❌ Канал \`${channel}\` не знайдено`); return; }
  const payload = {
    date: new Date().toISOString().slice(0, 10),
    channel_id: chanRow.id,
    sku_id: skuRow.id,
    quantity: parseInt(qty),
    revenue_uah: parseFloat(revenue),
    notes: notes ? `[tg] ${notes}` : '[tg]',
  };
  const { error } = await sb.from('sales_daily').insert(payload);
  if (error) { await reply(chat_id, `❌ ${error.message}`); return; }
  await reply(chat_id, `✅ Продаж додано!\n${skuRow.name} × ${qty} → ${chanRow.name}\n${fmtUah(parseFloat(revenue))}`);
}

async function cmdStats(chat_id: number) {
  const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data } = await sb.from('sales_daily').select('quantity, revenue_uah, channel:sales_channels(name)').gte('date', sevenAgo);
  if (!data?.length) { await reply(chat_id, `📊 Немає продажів за 7 днів`); return; }
  const revenue = data.reduce((s: number, r: any) => s + Number(r.revenue_uah || 0), 0);
  const qty = data.reduce((s: number, r: any) => s + Number(r.quantity || 0), 0);
  const byChan: Record<string, number> = {};
  data.forEach((r: any) => { const k = r.channel?.name || '—'; byChan[k] = (byChan[k] || 0) + Number(r.revenue_uah || 0); });
  const topChan = Object.entries(byChan).sort((a, b) => b[1] - a[1])[0];
  await reply(chat_id, `📊 *KPI за 7 днів*\n\n💰 Виручка: *${fmtUah(revenue)}*\n📦 Одиниць: *${qty}*\n🏆 Топ-канал: *${topChan[0]}* (${fmtUah(topChan[1])})\n📝 Транзакцій: ${data.length}`);
}

async function cmdPublications(chat_id: number) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from('publications').select('id, title, status, scheduled_at, rubric:rubrics(name)').gte('scheduled_at', today + 'T00:00:00').lt('scheduled_at', today + 'T23:59:59').order('scheduled_at');
  if (!data?.length) { await reply(chat_id, `📅 На сьогодні публікацій немає`); return; }
  const lines = data.map((p: any) => {
    const time = new Date(p.scheduled_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    return `*${time}* — ${p.title}\n_${p.rubric?.name || '—'} · ${p.status}_`;
  });
  await reply(chat_id, `📅 *Публікації на сьогодні* (${data.length})\n\n${lines.join('\n\n')}`);
}

async function cmdMe(chat_id: number, user_id: number, username: string | undefined) {
  const { data: user } = await sb.from('users').select('id, name, email, role').eq('telegram_id', user_id.toString()).maybeSingle();
  if (!user) { await reply(chat_id, `❌ Ти не у whitelist.\n\nTelegram ID: \`${user_id}\`${username ? '\nUsername: @' + username : ''}\n\nПопроси адміна додати тебе в users.telegram_id`); return; }
  await reply(chat_id, `👤 *${user.name}*\n📧 ${user.email}\n🛡️ Роль: ${user.role}`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (WEBHOOK_SECRET) {
    const got = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (got !== WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  }
  let update: any;
  try { update = await req.json(); } catch { return new Response('bad request', { status: 400 }); }
  const msg = update.message;
  if (!msg?.chat?.id || !msg.from?.id || !msg.text) return new Response(JSON.stringify({ ok: true }), { status: 200 });
  const chat_id = msg.chat.id, user_id = msg.from.id, username = msg.from.username, text = msg.text.trim();
  try {
    if (text === '/start' || text.startsWith('/start ')) await cmdStart(chat_id, user_id);
    else if (text === '/help' || text.startsWith('/help ')) await cmdHelp(chat_id);
    else if (text === '/me' || text.startsWith('/me ')) await cmdMe(chat_id, user_id, username);
    else if (text === '/stats' || text.startsWith('/stats ')) await cmdStats(chat_id);
    else if (text === '/publications' || text.startsWith('/publications ')) await cmdPublications(chat_id);
    else if (text.startsWith('/sale')) await cmdSale(chat_id, text.split(/\s+/).slice(1));
    else if (text.startsWith('/')) await reply(chat_id, `❓ Невідома команда. /help — список`);
  } catch (e) {
    await reply(chat_id, `❌ ${(e as Error).message}`);
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
