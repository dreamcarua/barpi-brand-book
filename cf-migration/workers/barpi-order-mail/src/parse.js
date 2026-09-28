/* Heuristic parser for Horoshop new-order notification e-mails (plain text or HTML).
   Relies on product articles on the site being MoySklad codes (B-0003, В-0018, A-00002, N-0109...). */
const CODE = /(?<![\wА-Яа-яІіЇїЄє-])([A-ZА-ЯІЇЄ]{1,4}-\d{3,5})(?![\w-])/g;
const MONEY = /(\d[\d\s ]{0,9}(?:[.,]\d{1,2})?)\s*(?:грн|₴|UAH)/gi;
const num = (s) => parseFloat(String(s).replace(/[\s ]/g, '').replace(',', '.'));

export function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<\/(tr|p|div|li|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8372;/g, '₴').replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

export function parseOrder(subject, text, html) {
  const body = html ? htmlToText(html) : String(text || '');
  const nm = String(subject).match(/(?:№|#|N\s?)\s*(\d{2,8})/) || String(subject).match(/замовлен\S*\D{0,15}(\d{2,8})/i) || body.match(/Замовлення\s*(?:№|#)\s*(\d{2,8})/i);
  const number = nm ? nm[1] : null;

  // items: text window after each article code up to the next code
  const hits = [...body.matchAll(CODE)];
  const items = [];
  for (let k = 0; k < hits.length; k++) {
    const code = hits[k][1];
    const from = hits[k].index + code.length;
    const to = k + 1 < hits.length ? hits[k + 1].index : Math.min(body.length, from + 300);
    const win = body.slice(from, to);
    const prices = [...win.matchAll(MONEY)].map((m) => num(m[1])).filter((v) => v > 0);
    let qty = null, price = null;
    const q = win.match(/(\d{1,3})\s*(?:шт|од|x|×)/i) || win.match(/(?:кількість|к-сть)\D{0,5}(\d{1,3})/i);
    if (prices.length >= 2) {
      price = prices[0];
      const ratio = prices[1] / prices[0];
      qty = Math.abs(ratio - Math.round(ratio)) < 0.01 && Math.round(ratio) >= 1 ? Math.round(ratio) : (q ? +q[1] : 1);
    } else if (prices.length === 1) { price = prices[0]; qty = q ? +q[1] : 1; }
    if (price != null) items.push({ code, qty, price });
  }
  // merge duplicates of the same code that come from repeated mentions
  const seen = new Map();
  for (const i of items) { const p = seen.get(i.code); if (!p) seen.set(i.code, i); }
  const uniq = [...seen.values()];

  const tm = body.match(/(?:Всього|Разом|До сплати|Загальна сума|Сума замовлення)[^\d]{0,40}(\d[\d\s ]*(?:[.,]\d{1,2})?)\s*(?:грн|₴)/i);
  const total = tm ? num(tm[1]) : null;
  const phone = (body.match(/\+?3?8?\s?\(?0\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/) || [])[0] || '';
  const pick = (re) => { const m = body.match(re); return m ? m[0].replace(/\s+/g, ' ').trim().slice(0, 200) : ''; };
  return {
    number, items: uniq, total, phone,
    customer: pick(/(?:ПІБ|Ім'я|Імʼя|Покупець|Одержувач)[^\n|]{0,80}/i),
    delivery: pick(/(?:Доставка|Відділення|Нова пошта)[^\n]{0,160}/i),
    payment: pick(/(?:Оплата|Спосіб оплати)[^\n]{0,120}/i),
    comment: (body.match(/Коментар[^\n]{0,300}/i) || [''])[0].replace(/^Коментар\S*\s*/i, ''),
  };
}
