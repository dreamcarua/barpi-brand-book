/* Barpi content pages v5.1 (01.10.2026): details, partners, about, faq, home */
(function () {
  function ready(fn) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  ready(function () {
    var root = document.querySelector(".bp");
    if (!root) return;
    // home page: move server-rendered slots into place (content stays in HTML for SEO)
    if (root.classList.contains("bp-home")) {
      var S = {}; ["top", "cats", "main"].forEach(function (n) { S[n] = root.querySelector('[data-slot="' + n + '"]'); }); var slot = function (n) { return S[n]; };
      var after = function (el, ref) { if (el && ref && ref.parentNode) ref.parentNode.insertBefore(el, ref.nextSibling); };
      var banner = document.querySelector(".banners-group"), benefits = document.querySelector("section.benefits"), promo = document.querySelector("section.promo") || document.querySelector("section.storefront");
      var h1 = document.querySelector(".frontInfo-content > h1, .frontInfo h1, .about__wrap > h1"), h1slot = root.querySelector(".bp-h1-slot");
      if (h1 && h1slot) { h1.removeAttribute("class"); h1slot.appendChild(h1); }
      // v8.1 (01.10.2026): mobile theme — do NOT move slots above products (CLS 0.705 / LCP 5.6 s in PSI). Products first, brand block stays in "about" below.
      var mobileTheme = !!(window.GLOBAL && GLOBAL.theme === "horoshop_mobile");
      if (!mobileTheme) {
        if (banner) after(slot("top"), banner); else if (benefits) benefits.parentNode.insertBefore(slot("top"), benefits);
        after(slot("cats"), benefits || slot("top"));
        after(slot("main"), promo || slot("cats"));
      }
      document.documentElement.classList.add("bp-home-on");
      root = document.body;
    }
    if (root.querySelector(".bp-hero h1")) { var mh = document.querySelector(".main-h"); if (mh && !root.contains(mh)) mh.remove(); [].forEach.call(document.querySelectorAll("h1"), function (h) { if (!root.contains(h)) h.remove(); }); }
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    // reveal on scroll
    var rv = root.querySelectorAll(".bp-rv");
    if ("IntersectionObserver" in window && !reduce) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -8% 0px" });
      rv.forEach(function (el) { io.observe(el); });
    } else rv.forEach(function (el) { el.classList.add("is-in"); });

    // counters
    root.querySelectorAll("[data-count]").forEach(function (el) {
      var to = parseFloat(el.getAttribute("data-count")), suf = el.getAttribute("data-suf") || "", pre = el.getAttribute("data-pre") || "";
      if (reduce || !("IntersectionObserver" in window)) { el.textContent = pre + to + suf; return; }
      var o = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; o.disconnect();
        if (es[0].boundingClientRect.top < 0) return;
        var t0 = performance.now(), d = 1100;
        (function tick(t) { var k = Math.min(1, (t - t0) / d), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
          el.textContent = pre + v + suf; if (k < 1) requestAnimationFrame(tick); })(t0);
      }); o.observe(el);
    });

    // ring (10% rule)
    root.querySelectorAll(".bp-ring").forEach(function (r) {
      var to = parseFloat(r.getAttribute("data-p") || "10");
      if (reduce || !("IntersectionObserver" in window)) { r.style.setProperty("--p", to); return; }
      r.style.setProperty("--p", 0);
      var o = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; o.disconnect();
        var t0 = performance.now();
        (function tick(t) { var k = Math.min(1, (t - t0) / 1200); r.style.setProperty("--p", (to * (1 - Math.pow(1 - k, 3))).toFixed(1)); if (k < 1) requestAnimationFrame(tick); })(t0);
      }); o.observe(r);
    });

    // filter chips for ingredient cards
    root.querySelectorAll(".bp-filter").forEach(function (bar) {
      var target = root.querySelector(bar.getAttribute("data-target"));
      bar.addEventListener("click", function (ev) {
        var b = ev.target.closest("button"); if (!b) return;
        bar.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        var f = b.getAttribute("data-f");
        target.querySelectorAll("article").forEach(function (a) {
          a.hidden = !(f === "all" || (" " + a.getAttribute("data-tags") + " ").indexOf(" " + f + " ") >= 0);
        });
      });
    });

    // week planner
    root.querySelectorAll(".bp-week").forEach(function (wk) {
      var box = root.querySelector(wk.getAttribute("data-box"));
      function show(d) {
        wk.querySelectorAll(".bp-day").forEach(function (x) { x.setAttribute("aria-pressed", x === d ? "true" : "false"); });
        box.innerHTML = "<h3>" + d.getAttribute("data-title") + "</h3><p class='bp-muted' style='margin:0'>" + d.getAttribute("data-text") + "</p>";
      }
      wk.addEventListener("click", function (ev) { var d = ev.target.closest(".bp-day"); if (d) show(d); });
      var first = wk.querySelector(".bp-day"); if (first) show(first);
    });

    // treat calculator: 10% of daily energy (RER = 70*kg^0.75; dog x1.6, cat x1.2)
    root.querySelectorAll(".bp-calc").forEach(function (c) {
      var pet = "dog", seg = c.querySelector(".bp-seg"), w = c.querySelector("input[type=range]"), wv = c.querySelector("[data-wv]"),
          sel = c.querySelector("select"), out = c.querySelector("[data-out]"), pk = c.querySelector("p[data-pack]"), kc = c.querySelector("[data-kc]"), bar = c.querySelector(".bp-bar i");
      function calc() {
        var kg = parseFloat(w.value), kcal100 = parseFloat(sel.value), o = sel.options[sel.selectedIndex];
        var mer = 70 * Math.pow(kg, 0.75) * (pet === "dog" ? 1.6 : 1.2), treat = mer * 0.10, g = treat / kcal100 * 100;
        wv.textContent = kg + " кг";
        out.textContent = (g < 10 ? g.toFixed(1).replace(".", ",") : Math.round(g)) + " г";
        kc.textContent = Math.round(treat) + " ккал з " + Math.round(mer);
        var ps = parseFloat(o.getAttribute("data-pack") || "20"), days = Math.round(ps / g);
        function dn(n) { var a = n % 10, b = n % 100; return (a === 1 && b !== 11) ? "день" : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? "дні" : "днів"; }
        pk.textContent = days >= 1 ? "Маленької пачки " + ps + " г вистачить щонайменше на " + days + " " + dn(days) + "." : "Денний максимум більший за пачку " + ps + " г. Це верхня межа, а не рекомендована порція.";
        var fm = c.querySelector("[data-freqmsg]"), fr = o.getAttribute("data-freq");
        if (fm) fm.textContent = fr ? "Цей смак: " + fr + " рази на тиждень. В інші дні обирайте легші смаки." : "Чергуйте з іншими смаками протягом тижня.";
        bar.style.width = Math.min(100, g / 1.2) + "%";
        (o.getAttribute("data-cat") === "no" && pet === "cat") ? c.setAttribute("data-warn", "1") : c.removeAttribute("data-warn");
        var wn = c.querySelector("[data-warnmsg]"); if (wn) wn.hidden = !c.hasAttribute("data-warn");
      }
      seg.addEventListener("click", function (ev) {
        var b = ev.target.closest("button"); if (!b) return; pet = b.getAttribute("data-pet");
        seg.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        if (pet === "cat") { w.max = 12; if (+w.value > 8) w.value = 4; } else { w.max = 60; }
        calc();
      });
      w.addEventListener("input", calc); sel.addEventListener("change", calc); calc();
    });

    // pdf inline viewer
    root.querySelectorAll("[data-pdfopen]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        var v = root.querySelector(b.getAttribute("data-pdfopen")); if (!v) return; ev.preventDefault();
        if (!v.querySelector("iframe")) v.innerHTML = '<iframe loading="lazy" title="Рекомендації Barpi, PDF" src="' + b.getAttribute("href") + '"></iframe>';
        v.classList.toggle("is-open");
        b.textContent = v.classList.contains("is-open") ? "Сховати перегляд" : "Переглянути онлайн";
      });
    });


    // FAQ search + categories
    var qa = root.querySelector("[data-faqsearch]") ? root.querySelector(root.querySelector("[data-faqsearch]").getAttribute("data-faqsearch")) : null;
    if (qa) {
      var inp = root.querySelector("[data-faqsearch]"), cats = root.querySelector("[data-faqcats]"), cat = "all", empty = qa.querySelector("[data-faqempty]");
      function norm(s) { return (s || "").toLowerCase().replace(/[’']/g, "'"); }
      function apply() {
        var q = norm(inp.value.trim()), shown = 0;
        qa.querySelectorAll(".bp-qgroup").forEach(function (g) {
          var gv = 0, okCat = cat === "all" || g.getAttribute("data-cat") === cat;
          g.querySelectorAll("details").forEach(function (d) {
            var hit = okCat && (!q || norm(d.textContent).indexOf(q) >= 0);
            d.hidden = !hit; if (hit) { gv++; if (q) d.open = true; }
          });
          g.hidden = gv === 0; shown += gv;
        });
        if (empty) empty.hidden = shown > 0;
      }
      inp.addEventListener("input", apply);
      if (cats) cats.addEventListener("click", function (ev) {
        var b = ev.target.closest("button"); if (!b) return; cat = b.getAttribute("data-f");
        cats.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        apply();
      });
    }

    // FAQPage JSON-LD from .bp-faq (SEO / AI answers)
    var faq = root.querySelectorAll(".bp-faq details");
    if (faq.length && !document.getElementById("bp-faq-ld")) {
      var ld = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [] };
      faq.forEach(function (d) {
        var q = d.querySelector("summary"), a = d.querySelector("div");
        if (q && a) ld.mainEntity.push({ "@type": "Question", "name": q.textContent.trim(), "acceptedAnswer": { "@type": "Answer", "text": a.textContent.trim() } });
      });
      var s = document.createElement("script"); s.type = "application/ld+json"; s.id = "bp-faq-ld"; s.textContent = JSON.stringify(ld); document.head.appendChild(s);
    }
  });
})();

/* 28.10.2026 (site audit, Clarity dead/rage clicks on /details/): product names, pack photos and the
   calculator now lead to the product cards; PDF links show their size and a loading state. */
(function () {
  if (location.pathname !== "/details/") return;
  var U = { "легені": "/yalovychi-leheni-barpi-15g/", "пупочки": "/kuriachi-shlunky-barpi-20g/", "шлунки": "/kuriachi-shlunky-barpi-20g/",
    "серденька": "/kuriachi-serdechka-barpi-20g/", "печінка": "/yalovycha-pechinka-barpi-20g/", "крекер": "/yalovychyi-rubets-barpi-15g/",
    "рубець": "/yalovychyi-rubets-barpi-15g/", "хрустики": "/yalovycha-trakheia-barpi-20g/", "трахея": "/yalovycha-trakheia-barpi-20g/",
    "довгожуйка": "/yalovycha-stanova-zhyla-barpi-20g/", "безе": "/yalovyche-vymia-barpi-20g/", "вим": "/yalovyche-vymia-barpi-20g/",
    "сир стіки": "/syr-stiky-barpi-20g/", "сир": "/syr-kulky-barpi-20g/", "зефір": "/yalovychi-leheni-barpi-15g/" };
  function url(t) { t = (t || "").toLowerCase(); for (var k in U) if (t.indexOf(k) >= 0) return U[k]; return null; }
  function go() {
    var root = document.querySelector(".bp"); if (!root) return;
    // ingredient cards: image + name become links, plus an explicit "Купити" link
    root.querySelectorAll("#bp-ing article").forEach(function (a) {
      var img = a.querySelector("img"), h = a.querySelector("h3,h4,b,strong"), u = url((img && img.alt) || (h && h.textContent));
      if (!u || a.querySelector(".bp-buy")) return;
      if (img && !img.closest("a")) { var w = document.createElement("a"); w.href = u; w.setAttribute("aria-label", img.alt); img.parentNode.insertBefore(w, img); w.appendChild(img); }
      if (h && !h.closest("a")) { var l = document.createElement("a"); l.href = u; l.className = "bp-name-link"; while (h.firstChild) l.appendChild(h.firstChild); h.appendChild(l); }
      var b = document.createElement("a"); b.href = u; b.className = "bp-buy"; b.textContent = "Купити →"; a.appendChild(b);
    });
    // calculator: link to the selected product under the result
    root.querySelectorAll(".bp-calc").forEach(function (c) {
      var sel = c.querySelector("select"), out = c.querySelector(".bp-out"); if (!sel || !out) return;
      var l = document.createElement("a"); l.className = "bp-btn bp-btn--pri bp-calc-buy"; out.appendChild(l);
      function upd() { var o = sel.options[sel.selectedIndex], u = url(o.textContent); l.hidden = !u; if (u) { l.href = u; l.textContent = "Купити «" + o.textContent.split(",")[0].replace(/\s*\(.*\)/, "") + "» →"; } }
      sel.addEventListener("change", upd); upd();
    });
    // PDF: show size, give feedback while a 3.3 MB file loads on mobile
    root.querySelectorAll('a[href$=".pdf"][download]').forEach(function (a) {
      if (!/МБ/.test(a.textContent)) a.appendChild(document.createTextNode(" · 3,3 МБ"));
      a.addEventListener("click", function () { var t = a.textContent; a.textContent = "Завантажується…"; setTimeout(function () { a.textContent = t; }, 5000); });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
