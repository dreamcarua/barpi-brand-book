import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrder, buildDescription, deliveryBlock } from '../src/parse.js';

const html = `<h2>Нове замовлення №769</h2><table>
<tr><td>ПІБ</td><td>Шафар Денис Вадимович</td></tr><tr><td>Телефон</td><td>+38 (093) 232-05-05</td></tr>
<tr><td>Доставка</td><td>Київ</td></tr><tr><td></td><td>ТОВ"Нова Пошта"</td></tr><tr><td></td><td>Відділення №360 (до 30 кг): вул. Златоустівська, 22</td></tr>
<tr><td>Оплата</td><td>Післяплата</td></tr>
<tr><td>B-0044</td><td>89 грн</td><td>2</td><td>178 грн</td></tr><tr><td>B-0042</td><td>89 грн</td><td>2</td><td>178 грн</td></tr>
<tr><td>Всього</td><td>356 грн</td></tr></table>`;

test('parse: number, items, total', () => {
  const o = parseOrder('Нове замовлення №769', '', html);
  assert.equal(o.number, '769');
  assert.deepEqual(o.items.map((i) => [i.code, i.qty, i.price]), [['B-0044', 2, 89], ['B-0042', 2, 89]]);
  assert.equal(o.total, 356);
});
test('description in the manual format', () => {
  const o = parseOrder('Нове замовлення №769', '', html);
  const d = buildDescription(o).split('\n');
  assert.match(d[0], /Рахунок №769$/);
  assert.ok(d.some((l) => /^Доставка Київ/.test(l)));
  assert.ok(d.some((l) => /Нова Пошта/.test(l)));
  assert.ok(d.some((l) => /^Відділення №360/.test(l)));
  assert.ok(d.some((l) => /^Оплата Післяплата/.test(l)));
});
test('deliveryBlock without Доставка is empty', () => assert.deepEqual(deliveryBlock('nothing'), []));

test('last item window does not swallow the grand total', () => {
  const o = parseOrder('Нове замовлення №1', 'B-0003 100 грн\nКількість 2 шт\nВсього 300 грн', '');
  assert.equal(o.items.length, 1);
  assert.equal(o.items[0].qty, 2);
  assert.equal(o.total, 300);
});
