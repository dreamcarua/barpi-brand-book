/* Barpi · Кар'єра на barpi.com.ua/kariera/ (v1.0.0, 17.10.2026)
   Рішення Вадима 17.10.2026: розділ вакансій як у snEco (sneco.ua/kariera/) і Abris Art.
   Сторінка: site-embed/pages/careers.html (поле сторінки Horoshop), стилі: bp.css (блок «careers»).
   Дані: воркер barpi-hr → GET /hr-api/public/careers, POST /hr-api/public/careers/apply.
   Вакансію ведуть у дашборді brand.barpi.ua/dashboard/careers/; тут лише показ і відгук.
   Вакансія відкривається за якорем #<slug> (Horoshop інакше обробляє адреси з GET-параметрами).
   Антиспам: пастка-поле website + мітка часу bp_t (форма показана ≥ 3 с тому); перевіряє сервер. */
(function () {
  "use strict";
  function ready(fn) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }

  var FORMAT = { office: "Офіс", plant: "На виробництві", hybrid: "Гібрид", remote: "Віддалено" };
  var EMPLOY = { full: "Повна зайнятість", part: "Часткова зайнятість", contract: "Контракт / ФОП", internship: "Стажування" };
  var REGION = { ua: "Україна", eu: "Європа" };
  var LD_EMPLOY = { full: "FULL_TIME", part: "PART_TIME", contract: "CONTRACTOR", internship: "INTERN" };
  var CV_EXT = /\.(pdf|doc|docx|odt|rtf)$/i, CV_MAX = 10 * 1024 * 1024, MSG_MAX = 2000;
  var ERR = {
    bot_check: "Не вдалося надіслати. Оновіть сторінку і спробуйте ще раз.",
    consent_required: "Потрібна згода на обробку персональних даних.",
    missing_name: "Вкажіть ім'я та прізвище.",
    missing_contact: "Вкажіть email або телефон: одне з двох обов'язкове.",
    bad_email: "Перевірте email.",
    bad_linkedin: "Посилання на LinkedIn має починатися з https://",
    message_too_long: "Повідомлення довше за 2000 символів.",
    file_too_large: "Файл більший за 10 МБ.",
    bad_file_type: "Підходять PDF, DOC, DOCX, ODT або RTF.",
    vacancy_closed: "Цю вакансію вже закрито. Надішліть резюме в кадровий резерв нижче.",
    vacancy_not_found: "Вакансію не знайдено. Надішліть резюме в кадровий резерв нижче.",
    too_many_requests: "Забагато спроб з цієї мережі. Спробуйте за годину або напишіть на office@barpi.ua.",
    upload_failed: "Резюме не збереглося. Спробуйте ще раз.",
    storage_unavailable: "Резюме зараз не приймаємо. Надішліть форму без файлу або напишіть на office@barpi.ua."
  };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] === null || attrs[k] === undefined || attrs[k] === false) continue;
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function dmy(iso) { return iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4) : ""; }
  function money(n) { return new Intl.NumberFormat("uk-UA").format(n); }
  function salaryText(s) {
    if (!s) return "";
    var cur = { UAH: "грн", EUR: "€", USD: "$", PLN: "zł" }[s.currency] || s.currency;
    if (s.from && s.to) return money(s.from) + "–" + money(s.to) + " " + cur;
    if (s.from) return "від " + money(s.from) + " " + cur;
    return "до " + money(s.to) + " " + cur;
  }
  function place(v) { return [v.region ? REGION[v.region] : "Україна", v.city].filter(Boolean).join(" · "); }
  function chips(v) {
    var c = [];
    if (v.work_format && FORMAT[v.work_format]) c.push(FORMAT[v.work_format]);
    if (v.employment_type && EMPLOY[v.employment_type]) c.push(EMPLOY[v.employment_type]);
    var sal = salaryText(v.salary); if (sal) c.push(sal);
    return el("ul", { class: "bp-cr-tags" }, c.map(function (t) { return el("li", { text: t }); }));
  }

  ready(function () {
    var root = document.querySelector(".bp-careers");
    if (!root) return;
    var API = root.getAttribute("data-api") || "https://brand.barpi.ua/hr-api/public/careers";
    var listBox = root.querySelector('[data-bp-careers="list"]');
    var formBox = root.querySelector('[data-bp-careers="form"]');
    var countEl = root.querySelector('[data-bp-careers="count"]');
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var vacancies = [];

    if (formBox) formBox.appendChild(buildForm(null));

    // ── Список вакансій ──────────────────────────────────────────────────
    fetch(API, { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        vacancies = (d && d.vacancies) || [];
        renderList();
        addJsonLd();
        openFromHash();
      })
      .catch(function () {
        listBox.innerHTML = "";
        listBox.appendChild(el("div", { class: "bp-cr-empty" }, [
          el("h3", { text: "Не вдалося завантажити вакансії" }),
          el("p", { class: "bp-muted", html: 'Оновіть сторінку або напишіть нам на <a href="mailto:office@barpi.ua">office@barpi.ua</a>. Резюме можна надіслати у формі нижче.' })
        ]));
      });

    function renderList() {
      listBox.innerHTML = "";
      if (countEl) { countEl.textContent = String(vacancies.length); countEl.hidden = vacancies.length === 0; }
      if (!vacancies.length) {
        listBox.appendChild(el("div", { class: "bp-cr-empty" }, [
          el("div", { class: "bp-ico", "aria-hidden": "true", text: "🐾" }),
          el("h3", { text: "Зараз відкритих вакансій немає" }),
          el("p", { class: "bp-muted", text: "Ми завжди раді людям, які люблять тварин. Надішліть резюме, і ми напишемо, щойно з'явиться відповідна роль." }),
          el("a", { class: "bp-btn bp-btn--pri", href: "#bp-cv", text: "Надіслати резюме" })
        ]));
        return;
      }
      var ul = el("ul", { class: "bp-cr-cards" });
      vacancies.forEach(function (v) {
        var a = el("a", { class: "bp-cr-card", href: "#" + v.slug, "data-slug": v.slug }, [
          el("span", { class: "bp-cr-place", text: place(v) }),
          el("h3", { text: v.title }),
          chips(v),
          v.summary ? el("p", { class: "bp-muted", text: v.summary }) : null,
          el("span", { class: "bp-cr-more", text: "Детальніше →" })
        ]);
        ul.appendChild(el("li", null, [a]));
      });
      listBox.appendChild(ul);
    }

    // ── JobPosting для пошуковиків (лише відкриті вакансії з API) ──────────
    function addJsonLd() {
      if (!vacancies.length || document.getElementById("bp-jobs-ld")) return;
      var base = location.origin + location.pathname;
      var graph = vacancies.map(function (v) {
        var desc = [v.summary]
          .concat(v.responsibilities.length ? ["Обов'язки: " + v.responsibilities.join("; ")] : [])
          .concat(v.requirements.length ? ["Вимоги: " + v.requirements.join("; ")] : [])
          .concat(v.offer.length ? ["Пропонуємо: " + v.offer.join("; ")] : []).filter(Boolean).join("\n");
        var j = {
          "@type": "JobPosting", title: v.title, description: desc, url: base + "#" + v.slug,
          datePosted: (v.published_at || "").slice(0, 10) || undefined,
          validThrough: v.valid_through || undefined,
          employmentType: LD_EMPLOY[v.employment_type] || undefined,
          hiringOrganization: { "@type": "Organization", name: "Barpi", sameAs: "https://barpi.com.ua/", logo: "https://barpi.com.ua/content/images/2/200x96l90nn0/39890867632480.webp" },
          jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: v.city || "Мукачево", addressCountry: v.region === "eu" ? "EU" : "UA" } },
          directApply: true
        };
        if (v.work_format === "remote") { j.jobLocationType = "TELECOMMUTE"; j.applicantLocationRequirements = { "@type": "Country", name: "Україна" }; }
        if (v.salary) j.baseSalary = { "@type": "MonetaryAmount", currency: v.salary.currency, value: { "@type": "QuantitativeValue", minValue: v.salary.from || undefined, maxValue: v.salary.to || undefined, unitText: "MONTH" } };
        return j;
      });
      var s = document.createElement("script"); s.type = "application/ld+json"; s.id = "bp-jobs-ld";
      s.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
      document.head.appendChild(s);
    }

    // ── Деталі вакансії: панель поверх сторінки, адреса #slug ───────────────
    var panel = null, lastFocus = null;
    function openFromHash() {
      var h = decodeURIComponent((location.hash || "").slice(1));
      var v = vacancies.filter(function (x) { return x.slug === h; })[0];
      if (v) openPanel(v); else if (panel) closePanel(true);
    }
    window.addEventListener("hashchange", openFromHash);
    listBox.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("[data-slug]");
      if (!a) return;
      e.preventDefault();
      if (location.hash === "#" + a.getAttribute("data-slug")) openFromHash();
      else location.hash = a.getAttribute("data-slug");
    });

    function section(title, items) {
      if (!items || !items.length) return null;
      return el("div", { class: "bp-cr-sec" }, [el("h3", { text: title }), el("ul", { class: "bp-cr-ul" }, items.map(function (t) { return el("li", { text: t }); }))]);
    }
    function openPanel(v) {
      lastFocus = document.activeElement;
      if (panel) panel.remove();
      var body = el("div", { class: "bp-cr-pbody" }, [
        el("span", { class: "bp-cr-place", text: place(v) + (v.department ? " · " + v.department : "") }),
        el("h2", { id: "bp-cr-ptitle", text: v.title }),
        chips(v),
        v.summary ? el("p", { class: "bp-lead", text: v.summary }) : null,
        section("Що робитимете", v.responsibilities),
        section("Кого шукаємо", v.requirements),
        section("Що пропонуємо", v.offer),
        el("p", { class: "bp-small", text: "Опубліковано " + dmy((v.published_at || "").slice(0, 10)) + (v.valid_through ? " · актуально до " + dmy(v.valid_through) : "") }),
        el("div", { class: "bp-cr-apply", id: "bp-cr-apply" }, [el("h3", { text: "Відгукнутися на вакансію" }), buildForm(v)])
      ]);
      panel = el("div", { class: "bp bp-cr-overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "bp-cr-ptitle" }, [
        el("div", { class: "bp-cr-panel" }, [
          el("div", { class: "bp-cr-phead" }, [
            el("button", { class: "bp-cr-x", type: "button", "aria-label": "Закрити", onclick: function () { closePanel(); }, text: "✕" }),
            el("a", { class: "bp-btn bp-btn--pri bp-cr-go", href: "#bp-cr-apply", onclick: function (e) { e.preventDefault(); var t = panel.querySelector("#bp-cr-apply"); t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); var f = t.querySelector("input[name=full_name]"); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, reduce ? 0 : 400); }, text: "Відгукнутися" })
          ]),
          body
        ])
      ]);
      panel.addEventListener("click", function (e) { if (e.target === panel) closePanel(); });
      document.body.appendChild(panel);
      document.documentElement.classList.add("bp-cr-lock");
      requestAnimationFrame(function () { panel.classList.add("is-open"); });
      panel.querySelector(".bp-cr-x").focus({ preventScroll: true });
      document.addEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (!panel) return;
      if (e.key === "Escape") { closePanel(); return; }
      if (e.key !== "Tab") return;
      var f = panel.querySelectorAll("a[href],button:not([disabled]),input:not([type=hidden]):not([tabindex='-1']),textarea,select");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function closePanel(fromHash) {
      if (!panel) return;
      var p = panel; panel = null;
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("bp-cr-lock");
      p.classList.remove("is-open");
      setTimeout(function () { p.remove(); }, reduce ? 0 : 220);
      if (!fromHash && location.hash) history.replaceState(null, "", location.pathname + location.search + "#bp-vacancies");
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    // ── Форма відгуку (вакансія або кадровий резерв) ──────────────────────
    function buildForm(v) {
      var uid = "bpcr" + Math.random().toString(36).slice(2, 7);
      var shownAt = Date.now();
      var msg = el("textarea", { name: "message", id: uid + "m", rows: "4", maxlength: String(MSG_MAX) });
      var counter = el("span", { class: "bp-cr-counter", text: "0 / " + MSG_MAX });
      msg.addEventListener("input", function () { counter.textContent = msg.value.length + " / " + MSG_MAX; });
      var file = el("input", { type: "file", name: "cv", id: uid + "f", accept: ".pdf,.doc,.docx,.odt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf" });
      var fileName = el("span", { class: "bp-cr-fname", text: "Файл не обрано" });
      file.addEventListener("change", function () { fileName.textContent = file.files && file.files[0] ? file.files[0].name : "Файл не обрано"; });
      var status = el("div", { class: "bp-cr-status", role: "status", "aria-live": "polite" });
      var btn = el("button", { class: "bp-btn bp-btn--pri", type: "submit", text: v ? "Відгукнутися" : "Надіслати резюме" });
      function field(label, input, hint, req) {
        return el("div", { class: "bp-cr-fld" }, [el("label", { for: input.id }, [label, req ? el("b", { "aria-hidden": "true", text: " *" }) : null]), input, hint ? el("small", { text: hint }) : null]);
      }
      var form = el("form", { class: "bp-cr-form", novalidate: true }, [
        // пастка для ботів: людина її не бачить і не заповнює
        el("div", { class: "bp-cr-hp", "aria-hidden": "true" }, [el("label", { for: uid + "w", text: "Website" }), el("input", { type: "text", name: "website", id: uid + "w", tabindex: "-1", autocomplete: "off" })]),
        v ? el("input", { type: "hidden", name: "vacancy_slug", value: v.slug }) : null,
        el("div", { class: "bp-cr-row" }, [
          field("Ім'я та прізвище", el("input", { type: "text", name: "full_name", id: uid + "n", autocomplete: "name", maxlength: "200", required: true }), null, true)
        ]),
        el("div", { class: "bp-cr-row bp-cr-row2" }, [
          field("Email", el("input", { type: "email", name: "email", id: uid + "e", autocomplete: "email", inputmode: "email", maxlength: "200" })),
          field("Телефон", el("input", { type: "tel", name: "phone", id: uid + "p", autocomplete: "tel", inputmode: "tel", maxlength: "60" }))
        ]),
        el("p", { class: "bp-cr-hint", text: "Вкажіть email або телефон: одне з двох обов'язкове." }),
        field("LinkedIn (необов'язково)", el("input", { type: "url", name: "linkedin", id: uid + "l", inputmode: "url", maxlength: "300", placeholder: "https://" })),
        el("div", { class: "bp-cr-fld" }, [el("label", { for: uid + "m", text: "Повідомлення (необов'язково)" }), msg, el("small", null, ["До 2000 символів. ", counter])]),
        el("div", { class: "bp-cr-fld" }, [
          el("span", { class: "bp-cr-lbl", text: "Резюме (необов'язково)" }),
          el("label", { class: "bp-cr-file", for: uid + "f" }, [el("span", { class: "bp-cr-fbtn", text: "Обрати файл" }), fileName]), file,
          el("small", { text: "PDF, DOC, DOCX, ODT або RTF, до 10 МБ." })
        ]),
        el("label", { class: "bp-cr-consent" }, [el("input", { type: "checkbox", name: "consent", value: "1", required: true }), el("span", { html: 'Даю згоду на обробку персональних даних для підбору персоналу. Дані зберігаються 1 рік. <b aria-hidden="true">*</b>' })]),
        el("div", { class: "bp-cr-actions" }, [btn]),
        status
      ]);

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        status.className = "bp-cr-status"; status.textContent = "";
        form.querySelectorAll(".is-err").forEach(function (x) { x.classList.remove("is-err"); });
        var fd = new FormData(form);
        var bad = function (name, text) { var i = form.querySelector('[name="' + name + '"]'); if (i) { i.closest(".bp-cr-fld, .bp-cr-consent") && i.closest(".bp-cr-fld, .bp-cr-consent").classList.add("is-err"); i.focus(); } status.className = "bp-cr-status is-err"; status.textContent = text; };
        var name = String(fd.get("full_name") || "").trim(), email = String(fd.get("email") || "").trim(), phone = String(fd.get("phone") || "").trim();
        var li = String(fd.get("linkedin") || "").trim();
        if (!name) return bad("full_name", ERR.missing_name);
        if (!email && !phone) return bad("email", ERR.missing_contact);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("email", ERR.bad_email);
        if (li && !/^https?:\/\/\S+\.\S+$/i.test(li)) return bad("linkedin", ERR.bad_linkedin);
        if (String(fd.get("message") || "").length > MSG_MAX) return bad("message", ERR.message_too_long);
        var f = file.files && file.files[0];
        if (f) {
          if (!CV_EXT.test(f.name)) return bad("cv", ERR.bad_file_type);
          if (f.size > CV_MAX) return bad("cv", ERR.file_too_large);
        } else fd.delete("cv");
        if (!form.querySelector('[name="consent"]').checked) return bad("consent", ERR.consent_required);
        // людина, яка заповнила форму швидше за 3 с, отримала б «бот»: чекаємо різницю, а не відмовляємо
        var wait = Math.max(0, 3200 - (Date.now() - shownAt));
        fd.set("bp_t", String(shownAt));
        btn.disabled = true; btn.textContent = "Надсилаємо…";
        setTimeout(function () {
          fetch(API + "/apply", { method: "POST", body: fd })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
              if (res.ok && res.j.ok) return done();
              btn.disabled = false; btn.textContent = v ? "Відгукнутися" : "Надіслати резюме";
              status.className = "bp-cr-status is-err";
              status.textContent = ERR[res.j.error] || "Не вдалося надіслати. Спробуйте ще раз або напишіть на office@barpi.ua.";
            })
            .catch(function () {
              btn.disabled = false; btn.textContent = v ? "Відгукнутися" : "Надіслати резюме";
              status.className = "bp-cr-status is-err";
              status.textContent = "Немає звʼязку з сервером. Перевірте інтернет і спробуйте ще раз.";
            });
        }, wait);
      });

      function done() {
        var ok = el("div", { class: "bp-cr-done", role: "status", tabindex: "-1" }, [
          el("div", { class: "bp-cr-done-ico", "aria-hidden": "true", text: "✓" }),
          el("h3", { text: v ? "Дякуємо, відгук отримали!" : "Дякуємо, резюме отримали!" }),
          el("p", { class: "bp-muted", text: v ? "Ми відповідаємо кожному кандидату протягом 5 робочих днів." : "Ми напишемо, щойно з'явиться відповідна роль." })
        ]);
        form.replaceWith(ok);
        ok.focus({ preventScroll: false });
        try { if (window.gtag) gtag("event", "generate_lead", { lead_source: "careers", vacancy: v ? v.slug : "pool" }); } catch (e) {}
      }
      return form;
    }
  });
})();
