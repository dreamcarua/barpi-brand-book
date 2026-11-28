import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, score, alertText, digestMessages, couponsIn } from '../src/logic.js';

const base = { name: 'Оля', email: 'olia@gmail.com', profile_url: 'instagram.com/olia_dog', platform: 'instagram', audience: '5-20k',
  role: 'petfluencer', pets: 'dog', formats: ['tasting', 'training'], idea: 'Зніму першу реакцію мого корги на сир кульки і тренування з ними', age_ok: true, consent: true };

test('valid form normalises and scores', () => {
  const v = normalise(base, 2000000000);
  assert.equal(v.ok, true);
  assert.equal(v.row.profile_url, 'https://instagram.com/olia_dog');
  assert.equal(v.row.formats, 'tasting,training');
  assert.ok(v.row.score >= 70, String(v.row.score));
});
test('18+ and consent required', () => {
  assert.equal(normalise({ ...base, age_ok: false }).error, 'age_required');
  assert.equal(normalise({ ...base, consent: false }).error, 'consent_required');
});
test('contact and profile required', () => {
  assert.equal(normalise({ ...base, email: '' }).error, 'missing_contact');
  assert.equal(normalise({ ...base, email: '', telegram: '@olia' }).ok, true);
  assert.equal(normalise({ ...base, profile_url: '' }).error, 'missing_profile');
});
test('honeypot and too fast', () => {
  assert.equal(normalise({ ...base, website: 'x' }).error, 'bot_check');
  assert.equal(normalise({ ...base, bp_t: 1999999999500 }, 2000000000).error, 'bot_check');
});
test('score bounds and flags', () => {
  const s = score({ name: 'http://spam', email: 'a@mailinator.com', profile_url: '' });
  assert.equal(s.score, 0);
  assert.ok(s.flags.includes('тимчасова пошта'));
  assert.ok(score({ ...normalise(base).row, sample_url: 'https://t.me/x/1', telegram: '@o' }).score <= 100);
});
test('alert has no stray tags and escapes', () => {
  const r = normalise({ ...base, name: 'A<b>' }).row;
  const t = alertText(r, 7, 'https://brand.barpi.ua/dashboard/creators/');
  assert.ok(t.includes('A&lt;b&gt;'));
  assert.ok(!/<(?!\/?b>)/.test(t));
});
const now = 2000000000;
const app = (id, ago, extra = {}) => ({ id, name: 'n' + id, score: 50, status: 'new', created_at: now - ago, ...extra });

test('digest: two sections, best score first', () => {
  const [t, ...rest] = digestMessages([app(1, 3600, { score: 40 }), app(2, 7200, { score: 90, idea: 'x'.repeat(300), email: 'a@b.co' }), app(3, 90000)], now, 'u');
  assert.equal(rest.length, 0);
  assert.ok(t.includes('Нові за добу: 2') && t.includes('Без відповіді понад 24 год: 1'));
  assert.ok(t.indexOf('<b>#2</b>') < t.indexOf('<b>#1</b>'));
  assert.ok(t.includes('u#id=2') && t.includes('x'.repeat(200) + '…') && !t.includes('x'.repeat(201)));
  assert.ok(t.includes('#3 n3'));
});
test('digest: empty, spam and answered are not listed', () => {
  assert.deepEqual(digestMessages([], now, 'u'), ['🐾 Заявок за добу не було']);
  assert.deepEqual(digestMessages([app(1, 3600, { status: 'spam' }), app(2, 90000, { status: 'in_progress' })], now, 'u'), ['🐾 Заявок за добу не було']);
});
test('digest: since previous report, no gap and no duplicate', () => {
  const t = digestMessages([app(1, 86430)], now, 'u', now - 86460).join('\n');
  assert.ok(t.includes('Нові за добу: 1') && !t.includes('Без відповіді понад'));
});
test('digest: long report is split under 3800, nothing lost, tags intact', () => {
  const rows = Array.from({ length: 40 }, (_, i) => app(i + 1, 3600, { name: '<&' + i, idea: 'і'.repeat(200), profile_url: 'https://instagram.com/a' }));
  rows.push(app(99, 3600, { name: '&'.repeat(120), city: '&'.repeat(80), email: '&'.repeat(160), telegram: '&'.repeat(60), profile_url: '&'.repeat(400), idea: '&'.repeat(200) }));
  const m = digestMessages(rows, now, 'u');
  assert.ok(m.length > 1);
  for (const t of m) { assert.ok(t.length <= 3800); assert.equal((t.match(/<b>/g) || []).length, (t.match(/<\/b>/g) || []).length); assert.ok(!/<(?!\/?b>)/.test(t)); }
  for (const r of rows) assert.ok(m.join('\n').includes(`<b>#${r.id}</b>`));
});
test('coupon parse', () => {
  assert.deepEqual(couponsIn('Оплата\nЗнижка за купоном "kiara" (10%)'), ['kiara']);
  assert.deepEqual(couponsIn('немає'), []);
});
