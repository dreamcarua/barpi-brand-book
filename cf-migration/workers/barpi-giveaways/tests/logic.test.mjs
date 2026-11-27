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
test('відповіді на коментарі беруть участь лише за увімкненої опції', () => {
  const cs = [c('1', 'a', 'x', 1), c('2', 'b', 'y', 2, '1')];
  assert.deepEqual(L.poolOf(L.evaluate(cs, {}).entries).map((p) => p.username), ['a']);
  assert.deepEqual(L.poolOf(L.evaluate(cs, { include_replies: true }).entries).map((p) => p.username), ['a', 'b']);
});
test('одна правильна відповідь: кілька варіантів або питання йдуть на перевірку', () => {
  const cfg = { answer: { on: true, groups: [['курка']] } };
  const r = L.evaluate([c('1', 'a', 'курка або качка', 1), c('2', 'b', 'курка?', 2), c('3', 'd', 'Курка!', 3)], cfg);
  assert.deepEqual(r.entries.map((e) => e.final), ['review', 'review', 'ok']);
});
test('подарунки: рядки і обʼєкти, гонка за лайки', () => {
  assert.deepEqual(L.normPrizes(['A', { label: 'B', method: 'top_likes' }, { label: ' ' }, { label: 'C', method: 'x' }]), [{ label: 'A', method: 'random' }, { label: 'B', method: 'top_likes' }, { label: 'C', method: 'random' }]);
  const pool = [{ n: 1, username: 'a', like_count: 3 }, { n: 2, username: 'b', like_count: 9 }, { n: 3, username: 'c', like_count: 9 }, { n: 4, username: 'b', like_count: 20 }];
  assert.deepEqual(L.likesRank(pool).map((p) => p.n), [4, 2, 3, 1]);
  assert.deepEqual(L.likesRank(pool, new Set(['b'])).map((p) => p.n), [3, 1]);
  assert.deepEqual(L.numbersOf(pool, ['b']), [2, 4]);
});
test('жеребкування v2: один акаунт не виграє двічі, v1 лишається відтворюваним', async () => {
  const owners = ['a', 'a', 'a', 'b', 'b', 'c', 'd', 'd'];
  for (let i = 0; i < 200; i++) {
    const p = await L.draw('seed' + i, 'h', owners.length, 4, [], owners);
    assert.equal(new Set(p.map((n) => owners[n - 1])).size, p.length);
    assert.equal(p.length, 4);
    assert.deepEqual(p, await L.draw('seed' + i, 'h', owners.length, 4, [], owners));
  }
  assert.equal((await L.draw('s', 'h', owners.length, 9, [], owners)).length, 4);
  assert.notDeepEqual(await L.draw('same', 'h', 50, 10), await L.draw('same', 'h', 50, 10, [], Array.from({ length: 50 }, (_, i) => 'u' + i)));
});
test('аналітика: години, пік, розподіли, топ лайків', () => {
  const cs = [c('1', 'a', 'курка', 3600), c('2', 'a', 'ще', 3700), c('3', 'b', 'курка', 3800), c('4', 'd', 'качка смачна', 7300), c('5', 'e', 'качка', 7400), c('6', 'f', 'курка', 90000)];
  cs[2].like_count = 7;
  const ev = L.evaluate(cs, { answer: { on: true, groups: [['курка']] } });
  const a = L.analyze(cs, ev.entries);
  assert.equal(a.pool, 3); assert.equal(a.peak[1], 2); assert.equal(a.series[0][1], 2);
  assert.equal(a.topLikes[0].username, 'b'); assert.equal(a.topLikes[0].n, 2);
  assert.deepEqual(a.dist.map((x) => x[1]), [4, 1, 0, 0]);
  assert.deepEqual(a.otherTop[0], ['Качка', 2]);
  assert.equal(a.firstDay, 67);
});
test('інші версії: довідник продуктів, правильні не рахуються', () => {
  const cs = [c('1', 'a', 'курка', 1), c('2', 'b', 'Мабуть індичка?', 2), c('3', 'd', 'індичка або качка', 3), c('4', 'e', 'Печінка!', 4), c('5', 'f', 'хочу виграти', 5)];
  const ev = L.evaluate(cs, { answer: { on: true, groups: [['курка']] } });
  const a = L.analyze(cs, ev.entries, { answers: ['курка'] });
  assert.equal(a.byProduct, true);
  assert.deepEqual(a.otherTop, [['Індичка', 2], ['Качка', 1], ['Печінка', 1]]);
  assert.deepEqual(L.productsIn('Сердечка для хвостика, вим’я'), ['Сердечка', "Вим'я"]);
  assert.deepEqual(L.productsIn('сирий'), []);
});
