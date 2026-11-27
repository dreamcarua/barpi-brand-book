import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../../../dashboard/giveaways/lib/logic.js';

const c = (id, u, text, ts = 100, parent = null) => ({ ig_id: id, parent_ig_id: parent, username: u, text, ts, like_count: 0 });

test('випадковий коментар: один акаунт один шанс, відповіді й організатор поза пулом', () => {
  const r = L.evaluate([c('1', 'Anna', 'хочу', 10), c('2', 'anna', 'ще раз', 20), c('3', 'barpi.ua', 'успіхів'), c('4', 'bob', 'і я', 30), c('5', 'x', 'відповідь', 40, '1')], {});
  const ok = r.entries.filter((e) => e.final === 'ok').map((e) => e.username);
  assert.deepEqual(ok, ['anna', 'bob']);
  assert.equal(r.stats.replies, 1);
  assert.equal(r.entries.find((e) => e.username === 'barpi.ua').reasons[0], 'службовий акаунт');
});
test('період приймання коментарів', () => {
  const r = L.evaluate([c('1', 'a', 'x', 5), c('2', 'b', 'x', 50), c('3', 'c', 'x', 500)], { starts_at: 10, ends_at: 100 });
  assert.deepEqual(L.poolOf(r.entries).map((p) => p.username), ['b']);
});
test('правильна відповідь: регістр, варіанти, сумнівний збіг, кілька слів', () => {
  const cfg = { answer: { on: true, groups: [['яловичина', 'beef'], ['курка']], need: 2 } };
  const r = L.evaluate([c('1', 'a', 'ЯЛОВИЧИНА і Курка!', 1), c('2', 'b', 'яловичена, курка', 2), c('3', 'd', 'тільки курка', 3), c('4', 'e', 'Beef + курка', 4)], cfg);
  const st = Object.fromEntries(r.entries.map((e) => [e.username, e.final]));
  assert.deepEqual(st, { a: 'ok', b: 'review', d: 'fail', e: 'ok' });
  assert.equal(L.matchAnswer('курка', [['курка'], ['печінка']], 1).status, 'ok');
  assert.equal(L.matchAnswer('закуркавий', [['курка']]).status, 'fail');
});
test('відмітка друга: себе й організатора не рахуємо, потрібна кількість', () => {
  const cfg = { mention: { on: true, min: 2 } };
  const r = L.evaluate([c('1', 'a', '@a @barpi.ua @friend', 1), c('2', 'b', '@f1 і @F2.', 2), c('3', 'd', '@f1', 3), c('4', 'd', '@f9', 4)], cfg);
  const st = Object.fromEntries(r.entries.map((e) => [e.username, e.final]));
  assert.deepEqual(st, { a: 'fail', b: 'ok', d: 'ok' });
  assert.deepEqual(r.entries.find((e) => e.username === 'b').mentions, ['f1', 'f2']);
});
test('комбінація умов і ручне підтвердження', () => {
  const cfg = { answer: { on: true, groups: [['курка']] }, mention: { on: true, min: 1 }, manual: { on: true } };
  const r = L.evaluate([c('1', 'a', 'курка @f', 1), c('2', 'b', 'курка', 2)], cfg, {});
  assert.equal(r.entries[0].final, 'review');
  assert.equal(r.entries[1].final, 'fail');
  const r2 = L.evaluate([c('1', 'a', 'курка @f', 1), c('2', 'b', 'курка', 2)], cfg, { a: { decision: 'ok' }, b: { decision: 'ok', reason: 'друг у відповіді' } });
  assert.deepEqual(L.poolOf(r2.entries).map((p) => p.n + p.username), ['1a', '2b']);
});
test('кілька шансів на акаунт, якщо правило вимкнено', () => {
  const r = L.evaluate([c('1', 'a', 'x', 1), c('2', 'a', 'y', 2), c('3', 'b', 'z', 3)], { one_per_account: false });
  assert.equal(L.poolOf(r.entries).length, 3);
});
test('жеребкування: відтворюване, різні номери, без повторів у додатковому колі', async () => {
  const pool = L.poolOf(L.evaluate(L.demoComments(80), {}).entries);
  const h = await L.poolHash(pool);
  const seed = 'ab'.repeat(32);
  const p1 = await L.draw(seed, h, pool.length, 5);
  const p2 = await L.draw(seed, h, pool.length, 5);
  assert.deepEqual(p1, p2);
  assert.equal(new Set(p1).size, 5);
  assert.ok(p1.every((n) => n >= 1 && n <= pool.length));
  const extra = await L.draw(L.randomSeed(), h, pool.length, 3, p1);
  assert.ok(extra.every((n) => !p1.includes(n)));
  assert.notDeepEqual(await L.draw('cd'.repeat(32), h, pool.length, 5), p1);
  assert.equal((await L.draw(seed, h, 3, 10)).length, 3);
});
test('рівномірність: 20 учасників, 4000 розіграшів, кожен у межах 5 сигм', async () => {
  const N = 20, T = 4000, cnt = Array(N).fill(0);
  for (let i = 0; i < T; i++) cnt[(await L.draw('s' + i, 'h', N, 1))[0] - 1]++;
  const exp = T / N, sd = Math.sqrt(T * (1 / N) * (1 - 1 / N));
  assert.ok(cnt.every((x) => Math.abs(x - exp) < 5 * sd), cnt.join(','));
});
test('хеш пулу залежить від складу і порядку', async () => {
  const a = [{ n: 1, username: 'a', ig_id: '1' }, { n: 2, username: 'b', ig_id: '2' }];
  assert.notEqual(await L.poolHash(a), await L.poolHash([a[0]]));
  assert.equal((await L.poolHash(a)).length, 64);
});
