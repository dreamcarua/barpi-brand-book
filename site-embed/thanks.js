/* Barpi · рядок про співпрацю з блогерами на сторінці подяки після покупки (v1.0.0, 24.11.2026, influencer-director).
   Лоадер вантажить файл на адресах checkout/order/thank/success/zamovl. Показуємо рядок лише там, де на сторінці є
   номер замовлення («Замовлення №…»), щоб не зачепити кошик чи оформлення. Посилання з utm_source=thankyou. */
(function () {
  "use strict";
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (tries > 40) { clearInterval(iv); return; }
    var body = document.body;
    if (!body || document.getElementById("bp-thx-cv")) return;
    var txt = body.innerText || "";
    if (!/(Замовлення|Заказ)\s*(№|#)\s*\d{2,10}/i.test(txt) && !/Дякуємо за замовлення|Спасибо за заказ/i.test(txt)) return;
    clearInterval(iv);
    var box = document.createElement("div");
    box.id = "bp-thx-cv";
    box.setAttribute("style", "max-width:720px;margin:24px auto;padding:18px 20px;border-radius:18px;background:#EEF4FC;border:1px solid rgba(0,17,84,.1);font-family:Rubik,system-ui,sans-serif;color:#001154;font-size:16px;line-height:1.5");
    box.innerHTML = '<b>Ваш улюбленець любить камеру?</b> Знімайте його з Barpi: надсилаємо смаколики на огляд блогерам і UGC-авторам і даємо промокод −10% для аудиторії. ' +
      '<a href="/blogeram/?utm_source=thankyou&amp;utm_medium=site&amp;utm_campaign=creators" style="color:#001154;font-weight:700">Подати заявку</a>';
    var anchor = document.querySelector(".checkout-success, .order-success, .j-checkout-success, main, .layout-content") || body;
    anchor.appendChild(box);
    try { if (window.gtag) window.gtag("event", "creator_thankyou_view", {}); } catch (e) {}
  }, 500);
})();
