/* Barpi · Співпраця з блогерами на barpi.com.ua/blogeram/ (v1.0.0, 24.11.2026)
   influencer-director, рішення Вадима 24.11.2026. Сторінка: site-embed/pages/creators.html (поле сторінки Horoshop),
   стилі: bp.css (блок «creators»). Дані: воркер barpi-creators → POST /creators-api/public/apply.
   Заявку ведуть у дашборді brand.barpi.ua/dashboard/creators/.
   GA4 (gtag сервісу Horoshop, G-6KN0Q8SSZJ): creator_form_start, creator_application (окремо від B2B).
   Антиспам: пастка-поле website + мітка часу bp_t (форма показана ≥ 3 с тому); перевіряє сервер. */
(function () {
  "use strict";
  function ready(fn) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  var ERR = {
    bot_check: "Не вдалося надіслати. Оновіть сторінку і спробуйте ще раз.",
    missing_name: "Вкажіть ваше ім'я.",
    missing_contact: "Вкажіть email, Telegram або телефон, щоб ми могли відповісти.",
    bad_email: "Перевірте email.",
    missing_profile: "Додайте посилання на профіль або нік.",
    age_required: "Співпраця лише для авторів 18+.",
    consent_required: "Потрібна згода на обробку персональних даних.",
    rate_limited: "Забагато спроб. Спробуйте за годину або напишіть на office@barpi.ua.",
    network: "Немає зв'язку з сервером. Спробуйте ще раз або напишіть на office@barpi.ua."
  };
  var UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
  function utm() {
    var o = {}, q = new URLSearchParams(location.search), keep = {};
    try { keep = JSON.parse(sessionStorage.getItem("bp_cv_utm") || "{}"); } catch (e) {}
    UTM.forEach(function (k) { o[k] = q.get(k) || keep[k] || ""; });
    if (!o.utm_source && document.referrer && document.referrer.indexOf(location.host) < 0) {
      try { o.utm_source = new URL(document.referrer).hostname.replace(/^www\./, ""); o.utm_medium = o.utm_medium || "referral"; } catch (e) {}
    }
    try { sessionStorage.setItem("bp_cv_utm", JSON.stringify(o)); } catch (e) {}
    return o;
  }
  function ga(name, params) {
    try { if (window.gtag) window.gtag("event", name, params || {}); else (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: name }, params || {})); } catch (e) {}
  }
  function opt(v, t) { return '<option value="' + v + '">' + t + "</option>"; }
  function field(name, label, inner, hint) {
    return '<label class="bp-cv-f"><span>' + label + "</span>" + inner + (hint ? '<small class="bp-small">' + hint + "</small>" : "") + "</label>";
  }
  var FORM =
    '<form class="bp-cv-form" novalidate>' +
    '<div class="bp-cv-row">' +
    field("name", "Ім'я *", '<input name="name" autocomplete="name" required maxlength="120">') +
    field("email", "Email", '<input name="email" type="email" inputmode="email" autocomplete="email" maxlength="160">') +
    "</div>" +
    field("telegram", "Telegram або телефон", '<input name="telegram" autocomplete="tel" maxlength="60" placeholder="@нік або +380…">') +
    '<p class="bp-small bp-cv-hint">* Потрібен хоча б один контакт: email, Telegram чи телефон.</p>' +
    '<div class="bp-cv-row">' +
    field("platform", "Основна платформа *", '<select name="platform" required>' + opt("", "Оберіть") + opt("instagram", "Instagram") + opt("tiktok", "TikTok") + opt("youtube", "YouTube") + opt("telegram", "Telegram") + opt("threads", "Threads") + opt("facebook", "Facebook") + opt("other", "Інше") + "</select>") +
    field("profile_url", "Посилання на профіль *", '<input name="profile_url" inputmode="url" required maxlength="400" placeholder="instagram.com/…">') +
    "</div>" +
    field("audience", "Аудиторія *", '<select name="audience" required>' + opt("", "Оберіть") + opt("lt1k", "до 1 тис.") + opt("1-5k", "1-5 тис.") + opt("5-20k", "5-20 тис.") + opt("20-100k", "20-100 тис.") + opt("100k+", "понад 100 тис.") + opt("ugc", "UGC без власної аудиторії") + "</select>") +
    '<fieldset class="bp-cv-pets"><legend>Ваш улюбленець *</legend>' +
    ["dog:Собака", "cat:Кіт", "both:Собака і кіт", "other:Інше"].map(function (x, i) { var p = x.split(":"); return '<label><input type="radio" name="pets" value="' + p[0] + '"' + (i ? "" : " required") + "> " + p[1] + "</label>"; }).join("") +
    "</fieldset>" +
    '<details class="bp-cv-more"><summary>Розкажіть більше (необов\'язково)</summary><div class="bp-cv-more-in">' +
    '<div class="bp-cv-row">' +
    field("role", "Хто ви", '<select name="role">' + opt("", "Оберіть") + opt("owner", "Власник собаки чи кота") + opt("petfluencer", "Петблогер (акаунт від імені тварини)") + opt("cynologist", "Кінолог") + opt("groomer", "Грумер") + opt("vet", "Ветеринар") + opt("shop", "Зоомагазин") + opt("shelter", "Притулок") + opt("ugc", "UGC-автор") + "</select>") +
    field("city", "Місто", '<input name="city" autocomplete="address-level2" maxlength="80">') +
    "</div>" +
    '<fieldset class="bp-cv-formats"><legend>Що хочете зняти</legend>' +
    ["tasting:Дегустація", "training:Тренування", "unboxing:Розпаковка", "compare:Порівняння", "day:День з улюбленцем", "giveaway:Розіграш"].map(function (x) { var p = x.split(":"); return '<label><input type="checkbox" name="formats" value="' + p[0] + '"> ' + p[1] + "</label>"; }).join("") +
    "</fieldset>" +
    field("sample_url", "Приклад вашого відео", '<input name="sample_url" inputmode="url" maxlength="400" placeholder="посилання на Reels, TikTok, Shorts">') +
    field("idea", "Ідея чи коментар", '<textarea name="idea" rows="4" maxlength="2000" placeholder="Що хочете зняти, що любить ваш улюбленець"></textarea>') +
    "</div></details>" +
    '<label class="bp-cv-chk"><input type="checkbox" name="age_ok" required><span>Мені 18 років або більше *</span></label>' +
    '<label class="bp-cv-chk"><input type="checkbox" name="consent" required><span>Погоджуюся на обробку персональних даних відповідно до <a href="/polityka-konfidentsiinosti/" target="_blank" rel="noopener">політики конфіденційності</a> *</span></label>' +
    '<input class="bp-cv-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<p class="bp-cv-err" role="alert" hidden></p>' +
    '<button class="bp-btn bp-btn--pri bp-cv-send" type="submit">Надіслати заявку</button>' +
    '<p class="bp-small bp-cv-alt">Не відправляється? Напишіть на <a href="mailto:office@barpi.ua?subject=Співпраця%20з%20блогером">office@barpi.ua</a> з посиланням на ваш профіль.</p>' +
    "</form>";

  ready(function () {
    var root = document.querySelector(".bp-creators");
    var slot = root && root.querySelector('[data-bp-creators="form"]');
    if (!slot) return;
    var api = root.getAttribute("data-api");
    var tags = utm();
    slot.innerHTML = FORM;
    var form = slot.querySelector("form"), err = form.querySelector(".bp-cv-err"), btn = form.querySelector(".bp-cv-send");
    var shownAt = Date.now(), started = false;
    form.addEventListener("focusin", function () { if (!started) { started = true; ga("creator_form_start", { form: "creators" }); } });
    var sticky = document.createElement("a");
    sticky.className = "bp-btn bp-btn--pri bp-cv-sticky"; sticky.href = "#bp-apply"; sticky.textContent = "Подати заявку"; sticky.setAttribute("data-bp-cv", "cta");
    root.appendChild(sticky);
    if ("IntersectionObserver" in window) {
      var seen = { hero: true, form: false };
      var hero = root.querySelector(".bp-cv-hero"), apply = root.querySelector("#bp-apply");
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.target === hero) seen.hero = e.isIntersecting; else seen.form = e.isIntersecting; });
        sticky.classList.toggle("is-on", !seen.hero && !seen.form);
      });
      if (hero) io.observe(hero); if (apply) io.observe(apply);
    }
    root.querySelectorAll('[data-bp-cv="cta"]').forEach(function (a) { a.addEventListener("click", function () { ga("creator_cta_click", {}); }); });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      err.hidden = true;
      var fd = new FormData(form), b = {};
      fd.forEach(function (v, k) { if (k !== "formats") b[k] = String(v); });
      b.formats = fd.getAll("formats");
      var tg = (b.telegram || "").trim();
      if (/^\+?[\d\s()-]{9,}$/.test(tg)) { b.phone = tg; b.telegram = ""; }
      b.age_ok = form.age_ok.checked; b.consent = form.consent.checked; b.bp_t = shownAt;
      UTM.forEach(function (k) { b[k] = tags[k]; });
      b.referrer = document.referrer.slice(0, 300); b.landing = location.href.slice(0, 300);
      var miss = !b.name ? "missing_name" : !(b.email || b.telegram || b.phone) ? "missing_contact" : !b.profile_url ? "missing_profile" : !b.age_ok ? "age_required" : !b.consent ? "consent_required" : "";
      if (!miss && (!b.platform || !b.audience || !b.pets)) miss = "fields";
      if (miss) { err.textContent = ERR[miss] || "Заповніть поля з зірочкою."; err.hidden = false; return; }
      btn.disabled = true; btn.textContent = "Надсилаємо…";
      fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (j) {
          if (!j || !j.ok) throw new Error((j && j.error) || "network");
          ga("creator_application", { creator_platform: b.platform, creator_audience: b.audience, creator_role: b.role });
          slot.innerHTML = '<div class="bp-cv-ok" role="status"><div class="bp-ico" aria-hidden="true">🐾</div><h3>Дякуємо! Заявку отримали.</h3>' +
            '<p class="bp-muted">Менеджерка Barpi відповість вам протягом 24 годин на пошту чи в Telegram. Поки чекаєте, подивіться наші <a href="/dehustatsiini-nabory-lasoshchiv/">дегустаційні набори</a>.</p></div>';
          slot.scrollIntoView({ behavior: "smooth", block: "center" });
        })
        .catch(function (e) {
          err.textContent = ERR[e.message] || ERR.network; err.hidden = false;
          btn.disabled = false; btn.textContent = "Надіслати заявку";
        });
    });
  });
})();
