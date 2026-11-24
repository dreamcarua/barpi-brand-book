import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, score, alertText, digestText, couponsIn } from '../src/logic.js';

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
test('digest only older than 24h', () => {
  const now = 2000000000;
  assert.equal(digestText([{ id: 1, name: 'x', score: 50, created_at: now - 3600 }], now, 'u'), null);
  assert.ok(digestText([{ id: 2, name: 'y', score: 50, created_at: now - 90000 }], now, 'u').includes('#2'));
});
test('coupon parse', () => {
  assert.deepEqual(couponsIn('Оплата\nЗнижка за купоном "kiara" (10%)'), ['kiara']);
  assert.deepEqual(couponsIn('немає'), []);
});
