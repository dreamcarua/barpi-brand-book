/* Barpi · дашборд блогерів (dashboard/creators/), v1.0.0 24.11.2026. Дані: воркер barpi-creators, /dashboard/api/creators/*. */
(function () {
  "use strict";
  var API = "/dashboard/api/creators/";
  var LANG = (function () { try { return localStorage.getItem("bp_lang") || "uk"; } catch (e) { return "uk"; } })();
  function T(uk, en) { return LANG === "en" ? en : uk; }
  var ST = { new: ["Нова", "New"], in_progress: ["В роботі", "In progress"], offer: ["Пропозиція", "Offer"], approved_ship: ["Погоджено до відправлення", "Approved to ship"], shipped: ["Надіслано", "Shipped"], content_live: ["Контент вийшов", "Content live"], closed: ["Закрито", "Closed"], rejected: ["Відмова", "Rejected"], spam: ["Спам", "Spam"] };
  var AUD = { "lt1k": "<1k", "1-5k": "1-5k", "5-20k": "5-20k", "20-100k": "20-100k", "100k+": "100k+", "ugc": "UGC" };
  var ROLE = { owner: ["Власник", "Owner"], petfluencer: ["Петблогер", "Petfluencer"], cynologist: ["Кінолог", "Dog trainer"], groomer: ["Грумер", "Groomer"], vet: ["Ветеринар", "Vet"], shop: ["Зоомагазин", "Pet shop"], shelter: ["Притулок", "Shelter"], ugc: ["UGC-автор", "UGC creator"] };
  var PETS = { dog: ["Собака", "Dog"], cat: ["Кіт", "Cat"], both: ["Собака і кіт", "Dog and cat"], other: ["Інше", "Other"] };
  var FMT = { tasting: ["Дегустація", "Tasting"], training: ["Тренування", "Training"], unboxing: ["Розпаковка", "Unboxing"], compare: ["Порівняння", "Comparison"], day: ["День з улюбленцем", "Day with pet"], giveaway: ["Розіграш", "Giveaway"] };
  var rows = [], now = 0, me = {}, filter = { q: "", s: "", k: "", wait: false };
  var $ = function (id) { return document.getElementById(id); };
  function L(p) { return p ? p[LANG === "en" ? 1 : 0] : ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safeUrl(u) { u = String(u || ""); return /^https?:\/\//i.test(u) ? u : ""; }
  function date(t) { if (!t) return ""; var d = new Date(t * 1000); return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Kyiv" }) + " " + d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" }); }
  function toast(t) { var e = $("toast"); e.textContent = t; e.style.display = "block"; clearTimeout(e._t); e._t = setTimeout(function () { e.style.display = "none"; }, 2200); }
  function api(path, opt) {
    return fetch(API + path, Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, opt || {}))
      .then(function (r) { if (r.status === 401 || r.status === 403) throw new Error("access"); return r.json(); });
  }
  function sc(n) { var c = n >= 70 ? "s-hi" : n >= 45 ? "s-mid" : "s-lo"; return '<span class="score ' + c + '">' + (n == null ? "?" : n) + "</span>"; }
  function waitH(r) { return r.status === "new" && r.kind === "application" ? Math.floor((now - r.created_at) / 3600) : 0; }

  function kpis() {
    var c = function (f) { return rows.filter(f).length; };
    var apps = rows.filter(function (r) { return r.kind === "application"; });
    var avg = apps.length ? Math.round(apps.reduce(function (s, r) { return s + (r.score || 0); }, 0) / apps.length) : 0;
    var cost = rows.reduce(function (s, r) { return s + (Number(r.ship_cost_uah) || 0) + (Number(r.fee_uah) || 0); }, 0);
    var k = [
      ["", c(function () { return true; }), T("усього авторів", "creators total")],
      ["new", c(function (r) { return r.status === "new"; }), T("нові", "new")],
      ["wait", c(function (r) { return waitH(r) >= 24; }), T("чекають понад 24 год", "waiting over 24 h"), true],
      ["in_progress", c(function (r) { return r.status === "in_progress" || r.status === "offer"; }), T("в роботі і пропозиції", "in progress and offers")],
      ["shipped", c(function (r) { return r.status === "shipped"; }), T("надіслано", "shipped")],
      ["content_live", c(function (r) { return r.status === "content_live"; }), T("контент вийшов", "content live")],
      ["", avg, T("середній бал заявок", "average score")],
      ["", Math.round(cost).toLocaleString("uk-UA") + " ₴", T("відправки і гонорари", "shipping and fees")],
    ];
    $("kpis").innerHTML = k.map(function (x) { return '<div class="kpi' + (x[3] && x[1] > 0 ? " alert" : "") + '" data-s="' + x[0] + '"><b>' + esc(x[1]) + "</b><span>" + esc(x[2]) + "</span></div>"; }).join("");
  }
  function list() {
    var q = filter.q.toLowerCase();
    var v = rows.filter(function (r) {
      if (filter.wait && waitH(r) < 24) return false;
      if (filter.s && r.status !== filter.s) return false;
      if (filter.k && r.kind !== filter.k) return false;
      if (q && [r.name, r.profile_url, r.email, r.telegram, r.phone, r.city, r.promo_code].join(" ").toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (!v.length) { $("list").innerHTML = '<div class="empty">' + T("Поки порожньо. Нові заявки з barpi.com.ua/blogeram/ з'являться тут.", "Empty for now. New applications will appear here.") + "</div>"; return; }
    $("list").innerHTML = "<table><thead><tr><th>#</th><th>" + T("Автор", "Creator") + '</th><th class="hide-m">' + T("Аудиторія", "Audience") + '</th><th class="hide-m">' + T("Хто", "Who") + "</th><th>" + T("Бал", "Score") + "</th><th>" + T("Статус", "Status") + '</th><th class="hide-m">' + T("Створено", "Created") + "</th></tr></thead><tbody>" +
      v.map(function (r) {
        var w = waitH(r);
        return '<tr class="row" data-id="' + r.id + '"><td>' + r.id + "</td><td><b>" + esc(r.name) + "</b>" + (r.kind === "ambassador" ? ' <span class="st">' + T("амбасадор", "ambassador") + "</span>" : "") + (r.promo_code ? ' <span class="st">' + esc(r.promo_code) + "</span>" : "") +
          '<div class="small muted">' + esc(r.profile_url || "") + "</div></td>" +
          '<td class="hide-m">' + esc(AUD[r.audience] || "") + '</td><td class="hide-m">' + esc(L(ROLE[r.role])) + (r.pets ? '<div class="small muted">' + esc(L(PETS[r.pets])) + "</div>" : "") + "</td>" +
          "<td>" + sc(r.score) + '</td><td><span class="st st-' + esc(r.status) + '">' + esc(L(ST[r.status]) || r.status) + "</span>" + (w >= 24 ? '<div class="wait">' + T("чекає ", "waiting ") + w + T(" год", " h") + "</div>" : "") + "</td>" +
          '<td class="hide-m small">' + date(r.created_at) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }
  function field(k, label, type, val, opts) {
    if (type === "select") return '<label class="f">' + label + '<select data-k="' + k + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(val || "") === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></label>";
    if (type === "area") return '<label class="f">' + label + '<textarea data-k="' + k + '" rows="3">' + esc(val) + "</textarea></label>";
    return '<label class="f">' + label + '<input data-k="' + k + '" type="' + (type || "text") + '" value="' + esc(val) + '"></label>';
  }
  function collect() { var b = {}; document.querySelectorAll("#panel [data-k]").forEach(function (e) { b[e.getAttribute("data-k")] = e.value; }); return b; }
  function stOpts() { return Object.keys(ST).map(function (k) { return [k, L(ST[k])]; }); }
  function open(id) {
    var r = rows.find(function (x) { return String(x.id) === String(id); }); if (!r) return;
    var hist = []; try { hist = JSON.parse(r.history || "[]"); } catch (e) {}
    var link = safeUrl(r.profile_url), sample = safeUrl(r.sample_url), content = safeUrl(r.content_url);
    $("panel").innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><h2>#' + r.id + " " + esc(r.name) + '</h2><div class="small muted">' + date(r.created_at) + " · " + sc(r.score) + " " + esc(r.score_why || "") + (r.flags ? " · ⚠️ " + esc(r.flags) : "") + '</div></div><button class="btn sec" id="x" aria-label="close">✕</button></div>' +
      '<dl class="box">' +
      "<dt>" + T("Профіль", "Profile") + "</dt><dd>" + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(r.profile_url) + "</a>" : esc(r.profile_url)) + (r.platform ? " · " + esc(r.platform) : "") + "</dd>" +
      "<dt>" + T("Контакти", "Contacts") + "</dt><dd>" + esc([r.email, r.telegram, r.phone].filter(Boolean).join(" · ")) + (r.city ? " · " + esc(r.city) : "") + "</dd>" +
      "<dt>" + T("Аудиторія, хто, тварина", "Audience, role, pet") + "</dt><dd>" + esc([AUD[r.audience], L(ROLE[r.role]), L(PETS[r.pets])].filter(Boolean).join(" · ")) + "</dd>" +
      (r.formats ? "<dt>" + T("Формати", "Formats") + "</dt><dd>" + esc(r.formats.split(",").map(function (f) { return L(FMT[f]); }).join(", ")) + "</dd>" : "") +
      (sample ? "<dt>" + T("Приклад відео", "Sample video") + '</dt><dd><a href="' + esc(sample) + '" target="_blank" rel="noopener noreferrer">' + esc(sample) + "</a></dd>" : "") +
      (r.idea ? "<dt>" + T("Ідея", "Idea") + "</dt><dd>" + esc(r.idea) + "</dd>" : "") +
      (r.utm_source ? "<dt>" + T("Джерело", "Source") + "</dt><dd>" + esc([r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ")) + "</dd>" : "") +
      "</dl>" +
      '<div class="grid2">' +
      field("status", T("Статус", "Status"), "select", r.status, stOpts()) +
      field("owner", T("Хто веде", "Owner"), "text", r.owner || me.email || "") +
      field("offer", T("Що пропонуємо (набір, продукти)", "Offer (set, products)"), "text", r.offer || "") +
      field("promo_code", T("Промокод −10% (з Horoshop)", "Promo code -10% (Horoshop)"), "text", r.promo_code || "") +
      field("fee_uah", T("Гонорар UGC, ₴", "UGC fee, UAH"), "number", r.fee_uah == null ? "" : r.fee_uah) +
      field("ship_cost_uah", T("Вартість відправки, ₴", "Shipping cost, UAH"), "number", r.ship_cost_uah == null ? "" : r.ship_cost_uah) +
      field("ship_doc", T("Документ МойСклад", "MoySklad document"), "text", r.ship_doc || "") +
      field("ship_ttn", T("ТТН Нова Пошта", "Nova Poshta waybill"), "text", r.ship_ttn || "") +
      "</div>" +
      field("content_url", T("Посилання на контент", "Content link"), "text", r.content_url || "") +
      (content ? '<div class="small"><a href="' + esc(content) + '" target="_blank" rel="noopener noreferrer">' + T("відкрити контент ↗", "open content ↗") + "</a></div>" : "") +
      field("notes", T("Нотатки", "Notes"), "area", r.notes || "") +
      '<div class="row-actions"><button class="btn" id="save">' + T("Зберегти", "Save") + "</button>" + (me.isAdmin ? '<button class="btn danger" id="del">' + T("Видалити", "Delete") + "</button>" : "") + "</div>" +
      '<div class="hist">' + hist.slice().reverse().map(function (h) { return "<div>" + date(h.at) + " · " + esc(h.by) + ": " + esc(h.what) + "</div>"; }).join("") + "</div>";
    $("drawer").classList.add("on");
    $("x").onclick = close;
    $("save").onclick = function () {
      api(r.id, { method: "PATCH", body: JSON.stringify(collect()) }).then(function (j) { if (j.error) throw new Error(j.error); toast(T("Збережено", "Saved")); close(); load(); }).catch(function (e) { toast(T("Помилка: ", "Error: ") + e.message); });
    };
    var d = $("del");
    if (d) d.onclick = function () { if (!confirm(T("Видалити заявку #", "Delete application #") + r.id + "?")) return; api(r.id, { method: "DELETE" }).then(function () { toast(T("Видалено", "Deleted")); close(); load(); }); };
  }
  function close() { $("drawer").classList.remove("on"); if (/id=/.test(location.hash)) history.replaceState(null, "", location.pathname); }
  function addForm() {
    $("panel").innerHTML = '<div style="display:flex;justify-content:space-between"><h2>' + T("Додати автора", "Add creator") + '</h2><button class="btn sec" id="x">✕</button></div><p class="small muted">' + T("Для амбасадорів і авторів, яких знайшли самі.", "For ambassadors and creators found by the team.") + "</p>" +
      '<div class="grid2">' + field("name", T("Ім'я *", "Name *"), "text", "") + field("profile_url", T("Профіль", "Profile"), "text", "") +
      field("email", "Email", "text", "") + field("telegram", "Telegram", "text", "") +
      field("kind", T("Тип", "Type"), "select", "application", [["application", T("Автор", "Creator")], ["ambassador", T("Амбасадор", "Ambassador")]]) +
      field("status", T("Статус", "Status"), "select", "in_progress", stOpts()) + "</div>" +
      field("idea", T("Нотатка", "Note"), "area", "") +
      '<div class="row-actions"><button class="btn" id="save">' + T("Додати", "Add") + "</button></div>";
    $("drawer").classList.add("on");
    $("x").onclick = close;
    $("save").onclick = function () {
      api("manual", { method: "POST", body: JSON.stringify(collect()) }).then(function (j) { if (j.error) throw new Error(j.error); toast(T("Додано", "Added")); close(); load(); }).catch(function (e) { toast(T("Помилка: ", "Error: ") + e.message); });
    };
  }
  function codes() {
    $("codes").innerHTML = '<div class="empty">' + T("Рахуємо…", "Counting…") + "</div>";
    api("codes").then(function (j) {
      var ks = Object.keys(j.codes || {});
      var note = '<p class="small muted" style="margin:10px 0">' + T("Замовлення сайту з купоном (дзеркало МойСклад у D1). Останнє замовлення в дзеркалі: ", "Site orders with a coupon (MoySklad mirror in D1). Latest order in the mirror: ") + esc(j.orders_synced_until || "?") + "</p>";
      if (!ks.length) { $("codes").innerHTML = '<div class="empty">' + T("Ще немає кодів. Створіть купон у Horoshop і впишіть його в картку автора.", "No codes yet. Create a coupon in Horoshop and write it into the creator card.") + "</div>" + note; return; }
      $("codes").innerHTML = "<table><thead><tr><th>" + T("Код", "Code") + "</th><th>" + T("Автор", "Creator") + "</th><th>" + T("Замовлень", "Orders") + "</th><th>" + T("Сума, ₴", "Sum, UAH") + "</th><th>" + T("Оплачено, ₴", "Paid, UAH") + "</th><th>" + T("Останнє", "Last") + "</th></tr></thead><tbody>" +
        ks.sort(function (a, b) { return j.codes[b].sum_uah - j.codes[a].sum_uah; }).map(function (k) { var c = j.codes[k]; return '<tr class="row" data-id="' + c.id + '"><td><b>' + esc(k) + "</b></td><td>" + esc(c.name) + "</td><td>" + c.orders + "</td><td>" + Math.round(c.sum_uah).toLocaleString("uk-UA") + "</td><td>" + Math.round(c.paid_uah).toLocaleString("uk-UA") + "</td><td>" + esc((c.last || "").slice(0, 10)) + "</td></tr>"; }).join("") + "</tbody></table>" + note;
    }).catch(function () { $("codes").innerHTML = '<div class="empty">' + T("Не вдалося завантажити.", "Failed to load.") + "</div>"; });
  }
  function setLang(l) {
    LANG = l; try { localStorage.setItem("bp_lang", l); } catch (e) {}
    document.body.className = "lang-" + l; document.documentElement.lang = l === "en" ? "en" : "uk";
    document.querySelectorAll(".lang button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-l") === l); });
    $("q").placeholder = T("Пошук: ім'я, профіль, контакт, код", "Search: name, profile, contact, code");
    $("fs").innerHTML = '<option value="">' + T("Усі статуси", "All statuses") + "</option>" + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (filter.s === k ? " selected" : "") + ">" + esc(L(ST[k])) + "</option>"; }).join("");
    var fk = $("fk"); fk.options[0].text = T("Усі типи", "All types"); fk.options[1].text = T("Заявки", "Applications"); fk.options[2].text = T("Амбасадори", "Ambassadors");
    kpis(); list();
  }
  function load() {
    return Promise.all([api("me"), api("list")]).then(function (a) { me = a[0]; rows = a[1].rows || []; now = a[1].now; kpis(); list(); var m = location.hash.match(/id=(\d+)/); if (m) open(m[1]); })
      .catch(function (e) { $("list").innerHTML = '<div class="empty">' + (e.message === "access" ? T("Немає доступу. Увійдіть через Cloudflare Access з робочою поштою.", "No access. Sign in via Cloudflare Access with your work e-mail.") : T("Не вдалося завантажити дані.", "Failed to load data.")) + "</div>"; });
  }
  document.querySelectorAll(".lang button").forEach(function (b) { b.onclick = function () { setLang(b.getAttribute("data-l")); }; });
  $("tabs").onclick = function (e) {
    var b = e.target.closest("button"); if (!b) return; var t = b.getAttribute("data-t");
    document.querySelectorAll("#tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
    ["list", "codes", "guide"].forEach(function (v) { $("v-" + v).hidden = v !== t; });
    if (t === "codes") codes();
  };
  $("q").oninput = function (e) { filter.q = e.target.value; list(); };
  $("fs").onchange = function (e) { filter.s = e.target.value; filter.wait = false; list(); };
  $("fk").onchange = function (e) { filter.k = e.target.value; list(); };
  $("kpis").onclick = function (e) { var k = e.target.closest(".kpi"); if (!k) return; var s = k.getAttribute("data-s"); filter.wait = s === "wait"; filter.s = s === "wait" ? "" : s; $("fs").value = filter.s; list(); };
  $("add").onclick = addForm;
  document.addEventListener("click", function (e) { var tr = e.target.closest("tr.row"); if (tr) open(tr.getAttribute("data-id")); });
  $("drawer").addEventListener("click", function (e) { if (e.target.id === "drawer") close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  setLang(LANG); load();
})();
