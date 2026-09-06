/* ============================================================
   Barpi Brand Bible v4.5 — Global JS
   v4.5: + Pipeline dashboard у topnav (воронка замовлень + B2B партнери)
   v4.4: prev/next навігація розділів (BB.PAGE_ORDER + BB.injectPageNav)
   v4.3: a11y — skip-link before sidebar, aria-current=page on active nav
   v4.2: SMM cleanup — викинуто HQ SMM + SMM v1 (Supabase project deleted)
   v4.1: Supabase refs повністю видалено (SUPABASE_URL/ANON), pure D1
   v4.0: CF Access (Zero Trust) edge auth — BB.AUTH видалено
   v3.4: BB.api → Cloudflare D1 (barpi-api Worker, Supabase REST deprecated)
   v3.3: Google OAuth backup auth (signInWithGoogle + UI button)
   v3.2: "Меню/Menu" label у hamburger button
   v3.1: BB.initMobileMenu (backdrop, ESC, auto-close, ARIA)
   v3.0: /products/ + /ambassadors/
   v2.9: /downloads/
   v2.8: BB.AUTH
   ============================================================ */

const BB = window.BB = window.BB || {};

BB.API_URL = 'https://barpi-api.vg-ab6.workers.dev';
BB.SYNC_URL = 'https://barpi-sync.vg-ab6.workers.dev';

BB.LOGO_DATA = 'data:image/webp;base64,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';

/* === BB.AUTH removed in v4.0 — CF Access (Zero Trust) handles auth at edge === */

/* ===== SKIP LINK (a11y, v4.3) ===== */
BB.SKIP_LINK_HTML = `<a href="#bb-main" class="skip-link"><span data-lang="uk">Перейти до контенту</span><span data-lang="en">Skip to main content</span></a>`;

/* ===== SIDEBAR HTML v4.3 ===== */
BB.SIDEBAR_HTML = `
<nav class="sidebar" id="bb-sidebar-nav" aria-label="Brand Bible navigation">
  <div class="sidebar-head">
    <a class="sidebar-brand" href="/">
      <img src="${BB.LOGO_DATA}" alt="Barpi" width="200" height="96" loading="eager">
      <div class="brand-text-sub">
        <span data-lang="uk">Brand Bible · v4.5</span>
        <span data-lang="en">Brand Bible · v4.5</span>
      </div>
    </a>
    <div class="sidebar-search" style="position:relative">
      <input type="text" id="bb-search" placeholder="Шукати / Search…" autocomplete="off" aria-label="Search Brand Bible" />
      <div id="bb-search-results" class="search-results" role="region" aria-live="polite"></div>
    </div>
    <div class="lang-switch" role="group" aria-label="Language switch">
      <button data-lang="uk">UK</button>
      <button data-lang="en">EN</button>
    </div>
  </div>
  <div class="sidebar-nav">
    <div class="nav-group">
      <div class="nav-group-label"><span data-lang="uk">Вступ</span><span data-lang="en">Introduction</span></div>
      <a class="nav-link" href="/"><span class="dot"></span><span data-lang="uk">Маніфест</span><span data-lang="en">Manifesto</span></a>
      <a class="nav-link" href="/about/"><span class="dot"></span><span data-lang="uk">Про бренд</span><span data-lang="en">About</span></a>
      <a class="nav-link" href="/team/"><span class="dot"></span><span data-lang="uk">Команда</span><span data-lang="en">Team</span></a>
      <a class="nav-link" href="/tech/"><span class="dot"></span><span data-lang="uk">Технологія SNECO</span><span data-lang="en">SNECO Technology</span></a>
      <a class="nav-link" href="/messages/"><span class="dot"></span><span data-lang="uk">Меседжі & слогани</span><span data-lang="en">Messages & slogans</span></a>
    </div>
    <div class="nav-group">
      <div class="nav-group-label"><span data-lang="uk">Ідентичність</span><span data-lang="en">Identity</span></div>
      <a class="nav-link" href="/visual/"><span class="dot"></span><span data-lang="uk">Візуальна система</span><span data-lang="en">Visual system</span></a>
      <a class="nav-link" href="/logo/"><span class="dot"></span><span data-lang="uk">Логотип</span><span data-lang="en">Logo</span></a>
      <a class="nav-link" href="/fonts/"><span class="dot"></span><span data-lang="uk">Шрифти & типографіка</span><span data-lang="en">Typography</span></a>
      <a class="nav-link" href="/voice/"><span class="dot"></span><span data-lang="uk">Голос бренду</span><span data-lang="en">Voice</span></a>
      <a class="nav-link" href="/photo/"><span class="dot"></span><span data-lang="uk">Фотографія</span><span data-lang="en">Photography</span></a>
      <a class="nav-link" href="/ambassadors/"><span class="dot" style="background:#e4405f"></span><span data-lang="uk">⭐ Амбасадори</span><span data-lang="en">⭐ Ambassadors</span></a>
    </div>
    <div class="nav-group">
      <div class="nav-group-label"><span data-lang="uk">Застосування</span><span data-lang="en">Application</span></div>
      <a class="nav-link" href="/digital/"><span class="dot"></span><span data-lang="uk">Digital · Instagram</span><span data-lang="en">Digital · Instagram</span></a>
      <a class="nav-link" href="/products/"><span class="dot" style="background:var(--accent,#BAD9F4)"></span><span data-lang="uk">🦴 Продукти (17 SKU)</span><span data-lang="en">🦴 Products (17 SKU)</span></a>
      <a class="nav-link" href="/packaging/"><span class="dot"></span><span data-lang="uk">Упаковка & SKU</span><span data-lang="en">Packaging & SKU</span></a>
      <a class="nav-link" href="/labels/"><span class="dot"></span><span data-lang="uk">Етикетки (9 SKU)</span><span data-lang="en">Labels (9 SKU)</span></a>
      <a class="nav-link" href="/partners/"><span class="dot"></span><span data-lang="uk">Партнери & Sales</span><span data-lang="en">Partners & Sales</span></a>
      <a class="nav-link" href="/pr/"><span class="dot"></span><span data-lang="uk">PR & криза</span><span data-lang="en">PR & Crisis</span></a>
      <a class="nav-link" href="/touchpoints/"><span class="dot"></span><span data-lang="uk">Touchpoints</span><span data-lang="en">Touchpoints</span></a>
    </div>
    <div class="nav-group">
      <div class="nav-group-label"><span data-lang="uk">Сервіс</span><span data-lang="en">Service</span></div>
      <a class="nav-link" href="/documents/"><span class="dot"></span><span data-lang="uk">Документи</span><span data-lang="en">Documents</span></a>
      <a class="nav-link" href="/downloads/"><span class="dot" style="background:var(--accent,#BAD9F4)"></span><span data-lang="uk">⬇️ Завантаження</span><span data-lang="en">⬇️ Downloads</span></a>
      <a class="nav-link" href="/brand-assets/"><span class="dot"></span><span data-lang="uk">Brand Assets Library</span><span data-lang="en">Brand Assets Library</span></a>
      <a class="nav-link" href="/roadmap/"><span class="dot"></span><span data-lang="uk">Roadmap</span><span data-lang="en">Roadmap</span></a>
      <a class="nav-link" href="/dashboard/"><span class="dot"></span><span data-lang="uk">Дашборди</span><span data-lang="en">Dashboards</span></a>
      <a class="nav-link" href="/architecture/"><span class="dot"></span><span data-lang="uk">Архітектура бренду</span><span data-lang="en">Brand architecture</span></a>
    </div>
    <div class="nav-group">
      <div class="nav-group-label"><span data-lang="uk">💡 Спільнота</span><span data-lang="en">💡 Community</span></div>
      <a class="nav-link" href="/ideas/"><span class="dot" style="background:var(--blue)"></span><span data-lang="uk">Пропозиції & ідеї</span><span data-lang="en">Ideas & proposals</span></a>
    </div>
  </div>
  <div class="sidebar-foot">
    <a href="https://barpi.com.ua" target="_blank" rel="noopener noreferrer" style="display:block;margin-bottom:8px;font-weight:600">barpi.com.ua →</a>
    <span data-lang="uk">© ТОВ «ПЕТ КОРП» · <a href="mailto:office@barpi.com.ua">office@barpi.com.ua</a></span>
    <span data-lang="en">© Pet Corp LLC · <a href="mailto:office@barpi.com.ua">office@barpi.com.ua</a></span>
  </div>
</nav>
`;
BB.injectSidebar = function() {
  const placeholder = document.getElementById('bb-sidebar');
  if (placeholder) placeholder.outerHTML = BB.SIDEBAR_HTML;
  else { const app = document.querySelector('.app'); if (app) app.insertAdjacentHTML('afterbegin', BB.SIDEBAR_HTML); }
};

BB.injectSkipLink = function() {
  // v4.3: skip-link стає першим focusable елементом для keyboard навігації
  if (!document.querySelector('.skip-link')) {
    document.body.insertAdjacentHTML('afterbegin', BB.SKIP_LINK_HTML);
  }
  // Помічаємо main елемент анкором, якщо немає
  const mainEl = document.querySelector('main.main, main.events-main, main.bb-main, main');
  if (mainEl && !mainEl.id) mainEl.id = 'bb-main';
  else if (mainEl && mainEl.id !== 'bb-main') {
    // Якщо у main уже є інший id — додаємо невидимий анкор
    if (!document.getElementById('bb-main')) {
      const anchor = document.createElement('a');
      anchor.id = 'bb-main';
      anchor.tabIndex = -1;
      anchor.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden';
      mainEl.parentNode.insertBefore(anchor, mainEl);
    }
  }
};

BB.setLang = function(lang) {
  if (!['uk','en'].includes(lang)) lang = 'uk';
  document.body.classList.remove('lang-uk','lang-en');
  document.body.classList.add('lang-' + lang);
  document.documentElement.lang = lang;
  localStorage.setItem('bb_lang', lang);
  document.querySelectorAll('.lang-switch button').forEach(b => { b.classList.toggle('active', b.dataset.lang === lang); });
  try {
    const h1 = document.querySelector('main h1');
    if (h1) {
      const span = h1.querySelector(`span[data-lang="${lang}"]`);
      const txt = (span ? span.textContent : h1.textContent).trim().replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').trim();
      if (txt) document.title = txt + ' · Barpi Brand Bible';
    }
  } catch(e) {}
};
BB.initLang = function() {
  const saved = localStorage.getItem('bb_lang') || 'uk';
  BB.setLang(saved);
  document.querySelectorAll('.lang-switch button').forEach(b => { b.addEventListener('click', () => BB.setLang(b.dataset.lang)); });
};
BB.markActiveNav = function() {
  let path = location.pathname.replace(/\/index\.html$/, '/');
  if (!path.endsWith('/')) path += '/';
  document.querySelectorAll('.sidebar .nav-link, .bb-topnav .nav-link').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href) return;
    let normalized = href.replace(/\/index\.html$/, '/');
    if (!normalized.endsWith('/')) normalized += '/';
    const isActive = normalized === path;
    a.classList.toggle('active', isActive);
    if (isActive) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
};

BB.initMobileMenu = function() {
  const toggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (!toggle || !sidebar) return;
  if (document.querySelector('.bb-topnav')) { document.body.classList.add('has-topnav'); }
  toggle.innerHTML = `<span class="mt-label"><span data-lang="uk">Меню</span><span data-lang="en">Menu</span></span><span class="mt-icon" aria-hidden="true"></span>`;
  let backdrop = document.querySelector('.menu-backdrop');
  if (!backdrop) { backdrop = document.createElement('div'); backdrop.className = 'menu-backdrop'; backdrop.setAttribute('aria-hidden', 'true'); document.body.appendChild(backdrop); }
  toggle.setAttribute('aria-label', 'Toggle navigation menu');
  toggle.setAttribute('aria-controls', 'bb-sidebar-nav');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('type', 'button');
  const isOpen = () => sidebar.classList.contains('open');
  const openMenu = () => { sidebar.classList.add('open'); toggle.classList.add('is-open'); backdrop.classList.add('shown'); document.body.classList.add('menu-open'); toggle.setAttribute('aria-expanded', 'true'); const firstLink = sidebar.querySelector('.nav-link'); if (firstLink) setTimeout(() => firstLink.focus({preventScroll: true}), 320); };
  const closeMenu = () => { sidebar.classList.remove('open'); toggle.classList.remove('is-open'); backdrop.classList.remove('shown'); document.body.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false'); };
  const toggleMenu = e => { if (e) e.preventDefault(); if (isOpen()) closeMenu(); else openMenu(); };
  toggle.onclick = null;
  toggle.addEventListener('click', toggleMenu);
  backdrop.addEventListener('click', closeMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) { closeMenu(); toggle.focus(); } });
  sidebar.querySelectorAll('.nav-link').forEach(link => { link.addEventListener('click', () => { if (window.innerWidth <= 900) setTimeout(closeMenu, 180); }); });
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (window.innerWidth > 900 && isOpen()) closeMenu(); }, 150); });
};

/* ===== PREV/NEXT НАВІГАЦІЯ РОЗДІЛІВ (v4.4) =====
   Порядок = порядок sidebar-навігації = наскрізна нумерація 01–25.
   /dashboard/ (23) пропущено — він за CF Access, публічний читач впреться в гейт. */
BB.PAGE_ORDER = [
  { num: '01', url: '/',              uk: 'Маніфест',              en: 'Manifesto' },
  { num: '02', url: '/about/',        uk: 'Про бренд',             en: 'About' },
  { num: '03', url: '/team/',         uk: 'Команда',               en: 'Team' },
  { num: '04', url: '/tech/',         uk: 'Технологія SNECO',      en: 'SNECO Technology' },
  { num: '05', url: '/messages/',     uk: 'Меседжі & слогани',     en: 'Messages & slogans' },
  { num: '06', url: '/visual/',       uk: 'Візуальна система',     en: 'Visual system' },
  { num: '07', url: '/logo/',         uk: 'Логотип',               en: 'Logo' },
  { num: '08', url: '/fonts/',        uk: 'Шрифти & типографіка',  en: 'Typography' },
  { num: '09', url: '/voice/',        uk: 'Голос бренду',          en: 'Voice' },
  { num: '10', url: '/photo/',        uk: 'Фотографія',            en: 'Photography' },
  { num: '11', url: '/ambassadors/',  uk: 'Амбасадори',            en: 'Ambassadors' },
  { num: '12', url: '/digital/',      uk: 'Digital · Instagram',   en: 'Digital · Instagram' },
  { num: '13', url: '/products/',     uk: 'Продукти (17 SKU)',     en: 'Products (17 SKU)' },
  { num: '14', url: '/packaging/',    uk: 'Упаковка & SKU',        en: 'Packaging & SKU' },
  { num: '15', url: '/labels/',       uk: 'Етикетки',              en: 'Labels' },
  { num: '16', url: '/partners/',     uk: 'Партнери & Sales',      en: 'Partners & Sales' },
  { num: '17', url: '/pr/',           uk: 'PR & криза',            en: 'PR & Crisis' },
  { num: '18', url: '/touchpoints/',  uk: 'Touchpoints',           en: 'Touchpoints' },
  { num: '19', url: '/documents/',    uk: 'Документи',             en: 'Documents' },
  { num: '20', url: '/downloads/',    uk: 'Завантаження',          en: 'Downloads' },
  { num: '21', url: '/brand-assets/', uk: 'Brand Assets Library',  en: 'Brand Assets Library' },
  { num: '22', url: '/roadmap/',      uk: 'Roadmap',               en: 'Roadmap' },
  { num: '24', url: '/architecture/', uk: 'Архітектура бренду',    en: 'Brand architecture' },
  { num: '25', url: '/ideas/',        uk: 'Пропозиції & ідеї',     en: 'Ideas & proposals' },
];
BB.injectPageNav = function() {
  if (location.pathname.startsWith('/dashboard/')) return;
  let path = location.pathname.replace(/\/index\.html$/, '/');
  if (!path.endsWith('/')) path += '/';
  const i = BB.PAGE_ORDER.findIndex(p => p.url === path);
  if (i === -1) return; // 404 та сторінки поза книгою
  const prev = BB.PAGE_ORDER[i - 1];
  const next = BB.PAGE_ORDER[i + 1];
  if (!prev && !next) return;
  const card = (p, dir) => `
    <a class="pn-${dir}" href="${p.url}">
      <span class="pn-label">${dir === 'prev'
        ? '<span data-lang="uk">← Попередній розділ</span><span data-lang="en">← Previous chapter</span>'
        : '<span data-lang="uk">Наступний розділ →</span><span data-lang="en">Next chapter →</span>'}</span>
      <span class="pn-title">${p.num} · <span data-lang="uk">${p.uk}</span><span data-lang="en">${p.en}</span></span>
    </a>`;
  const html = `<nav class="page-nav" aria-label="Chapter navigation">${prev ? card(prev, 'prev') : ''}${next ? card(next, 'next') : ''}</nav>`;
  const foot = document.querySelector('main .page-foot');
  if (foot) foot.insertAdjacentHTML('beforebegin', html);
  else { const m = document.querySelector('main.main, main'); if (m) m.insertAdjacentHTML('beforeend', html); }
};

BB.SEARCH_INDEX = [
  { id: 'manifesto', uk: 'Маніфест', en: 'Manifesto', url: '/' , words: 'турбота справжніх друзів один інгредієнт без зайвого' },
  { id: 'about', uk: 'Про бренд', en: 'About', url: '/about/', words: 'місія бачення цінності аудиторія barpi mission vision values' },
  { id: 'team', uk: 'Команда', en: 'Team', url: '/team/', words: 'Аксьонов Вадим Альона Мар\'яна Пилип org structure говернанс governance затвердження хто затверджує approvals оргструктура' },
  { id: 'tech', uk: 'Технологія SNECO', en: 'SNECO Technology', url: '/tech/', words: 'SNECO sneco 34 38 вакуум сушка вологи поживних космічні технології патент 160558' },
  { id: 'messages', uk: 'Меседжі і слогани', en: 'Messages', url: '/messages/', words: 'слогани claims tone of voice messaging космічна якість' },
  { id: 'visual', uk: 'Візуальна система', en: 'Visual system', url: '/visual/', words: 'логотип кольори шрифт Rubik SKU палітра' },
  { id: 'voice', uk: 'Голос бренду', en: 'Voice', url: '/voice/', words: 'tone of voice 70 30 турбота дружба' },
  { id: 'photo', uk: 'Фотографія', en: 'Photography', url: '/photo/', words: 'AI UGC реальні тварини' },
  { id: 'ambassadors', uk: 'Амбасадори', en: 'Ambassadors', url: '/ambassadors/', words: 'ambassadors ugc амбасадори Барні Кіара Райден Ліла Янголи хвостиків Айза Люк Мішаня Лея Айріш reels тікток pet pets' },
  { id: 'digital', uk: 'Digital · Instagram', en: 'Digital · Instagram', url: '/digital/', words: 'instagram reels stories каруселі контент пілари' },
  { id: 'products', uk: 'Продукти (17 SKU)', en: 'Products (17 SKU)', url: '/products/', words: 'products каталог SKU пупочки крекер зефір безе печінка хрустики сир довгожуйка серденька кульки EAN артикул калорії білки жири нутрієнти апетайзери для котів для собак промо набори' },
  { id: 'packaging', uk: 'Упаковка & SKU', en: 'Packaging & SKU', url: '/packaging/', words: 'каталог SKU упаковка packaging фасування 20г 100г 280мл' },
  { id: 'partners', uk: 'Партнери і Sales', en: 'Partners & Sales', url: '/partners/', words: 'E-ZOO MasterZoo PetHouse GooDwine GaraPet sales playbook B2B Лапа Леопольд KASTA Rozetka Zooroom Pethouse дистрибютор мережа партнер' },
  { id: 'pr', uk: 'PR і криза', en: 'PR & Crisis', url: '/pr/', words: 'crisis communication PR rework reply' },
  { id: 'touchpoints', uk: 'Touchpoints', en: 'Touchpoints', url: '/touchpoints/', words: 'touchpoints сайт instagram полиця магазин фестивалі' },
  { id: 'documents', uk: 'Документи', en: 'Documents', url: '/documents/', words: 'ТМ ТУ патент сертифікат лабораторний 383307 160558 ПЕТ КОРП 45519838 IBAN' },
  { id: 'downloads', uk: 'Завантаження', en: 'Downloads', url: '/downloads/', words: 'downloads презентація pdf docx прайс каталог сертифікат патент ТМ ТУ лабораторний реквізити виписка завантажити drive' },
  { id: 'roadmap', uk: 'Roadmap', en: 'Roadmap', url: '/roadmap/', words: 'roadmap Q3 пріоритети strategy 2026' },
  { id: 'dashboards', uk: 'Дашборди', en: 'Dashboards', url: '/dashboard/', words: 'dashboards Sales Inventory Events Customer 360 Financial Production Pipeline воронка замовлення партнери дистрибутори B2B' },
  { id: 'architecture', uk: 'Архітектура бренду', en: 'Brand architecture', url: '/architecture/', words: 'architecture snEco SNECO brand hierarchy branded house портфель лінійки naming написання назв барпі co-branding кобрендинг конкуренти Cosset Pala Brovko Trixie' },
  { id: 'ideas', uk: 'Ідеї та пропозиції', en: 'Ideas & proposals', url: '/ideas/', words: 'ideas propose suggest пропозиції' },
  { id: 'logo', uk: 'Логотип', en: 'Logo', url: '/logo/', words: 'logo лого wordmark barpi paw лапка dot крапка master files png webp clear space' },
  { id: 'fonts', uk: 'Шрифти & типографіка', en: 'Typography', url: '/fonts/', words: 'qanelas font typography typeface шрифт weight bold regular italic woff ttf' },
  { id: 'labels', uk: 'Етикетки продукції', en: 'Product labels', url: '/labels/', words: 'етикетки labels packaging хрустики печінка сир зефір безе крекер довгожуйка пупочки серденька stickers' },
  { id: 'brand-assets', uk: 'Brand Assets Library', en: 'Brand Assets Library', url: '/brand-assets/', words: 'logo logos brand assets library svg png ai pdf qanelas font catalog brochure brand-assets лого асет' },
];
BB.initSearch = function() {
  const input = document.getElementById('bb-search');
  const results = document.getElementById('bb-search-results');
  if (!input || !results) return;
  input.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    if (q.length < 2) { results.classList.remove('shown'); return; }
    const matches = BB.SEARCH_INDEX.filter(item => { const hay = (item.uk + ' ' + item.en + ' ' + item.words).toLowerCase(); return hay.includes(q); }).slice(0, 10);
    if (!matches.length) results.innerHTML = '<div class="search-result" style="color:var(--text-muted)">Нічого / No results</div>';
    else results.innerHTML = matches.map(m => `<a class="search-result" href="${m.url}"><div class="sect">${m.id}</div><span data-lang="uk">${m.uk}</span><span data-lang="en">${m.en}</span></a>`).join('');
    results.classList.add('shown');
  });
  input.addEventListener('blur', () => setTimeout(() => results.classList.remove('shown'), 200));
  input.addEventListener('focus', () => { if (input.value.length >= 2) results.classList.add('shown'); });
};

BB.api = function(path, opts = {}) { return fetch(BB.API_URL + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } }); };
BB.loadIdeas = async function(filter = 'all') { let q = '/brand_ideas?select=*&order=created_at.desc'; if (filter !== 'all') q += '&status=eq.' + filter; try { const r = await BB.api(q); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } catch(e) { console.error('Load ideas:', e); return []; } };
BB.submitIdea = async function(data) { try { const r = await BB.api('/brand_ideas', { method: 'POST', body: JSON.stringify(data) }); if (!r.ok) { console.error(await r.text()); return null; } return await r.json(); } catch(e) { return null; } };
BB.upvoteIdea = async function(id, current) { try { const r = await BB.api('/brand_ideas/' + id, { method: 'PATCH', body: JSON.stringify({ upvotes: (current || 0) + 1 }) }); return r.ok; } catch(e) { return false; } };
BB.renderIdeas = async function(filter = 'all') {
  const list = document.getElementById('ideas-list');
  const counter = document.getElementById('ideas-counter');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)">…</div>';
  const ideas = await BB.loadIdeas(filter);
  if (counter) counter.textContent = `${ideas.length} пропозицій / ideas`;
  if (!ideas.length) { list.innerHTML = '<div class="card" style="text-align:center;color:var(--text-muted)"><span data-lang="uk">Поки що пропозицій немає. Будьте першим!</span><span data-lang="en">No ideas yet. Be the first!</span></div>'; return; }
  list.innerHTML = ideas.map(i => `<div class="idea" data-id="${i.id}"><div class="idea-head"><div class="title">${escapeHTML(i.title)}</div><div class="status status-${i.status}">${i.status}</div></div><div class="idea-body">${escapeHTML(i.body)}</div><div class="idea-meta"><span>${escapeHTML(i.author_name || 'Анонім')}</span><span>${new Date(i.created_at).toLocaleDateString('uk-UA')}</span>${i.section_id ? `<span style="background:var(--bg);padding:1px 6px;border-radius:4px">${i.section_id}</span>` : ''}<button class="upvote" onclick="BB.handleUpvote('${i.id}', ${i.upvotes || 0}, this)">▲ ${i.upvotes || 0}</button></div></div>`).join('');
};
BB.handleUpvote = async function(id, current, btn) { btn.disabled = true; const ok = await BB.upvoteIdea(id, current); if (ok) btn.innerHTML = '▲ ' + (current + 1); btn.disabled = false; };
BB.initIdeasForm = function() {
  const form = document.getElementById('ideas-form');
  const newBtn = document.getElementById('ideas-new-btn');
  const submitBtn = document.getElementById('ideas-submit');
  const filterBtns = document.querySelectorAll('.ideas-filter button');
  if (!form || !newBtn || !submitBtn) return;
  newBtn.onclick = () => { form.style.display = form.style.display === 'none' ? 'block' : 'none'; };
  submitBtn.onclick = async () => {
    const data = { title: document.getElementById('idea-title').value.trim(), body: document.getElementById('idea-body').value.trim(), author_name: document.getElementById('idea-author').value.trim(), author_email: document.getElementById('idea-email').value.trim(), section_id: document.getElementById('idea-section').value.trim() || null, status: 'new' };
    if (!data.title) return alert('Введіть заголовок / Enter title');
    submitBtn.disabled = true; submitBtn.textContent = '…';
    const result = await BB.submitIdea(data);
    submitBtn.disabled = false; submitBtn.textContent = 'Надіслати / Submit';
    if (result) { form.style.display = 'none'; ['idea-title','idea-body','idea-author','idea-email','idea-section'].forEach(id => document.getElementById(id).value = ''); BB.renderIdeas(); alert('Дякуємо! Ваша пропозиція збережена. / Thanks! Saved.'); }
    else alert('Помилка / Error');
  };
  filterBtns.forEach(b => { b.onclick = () => { filterBtns.forEach(x => x.classList.remove('is-active')); b.classList.add('is-active'); BB.renderIdeas(b.dataset.status || 'all'); }; });
};
function escapeHTML(s) { if (!s) return ''; return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

BB.DASHBOARD_LINKS = [
  {href:'/dashboard/customer-360/', label:'👥 Customer 360', match:'customer-360'},
  {href:'/dashboard/financial/', label:'💵 Financial', match:'financial'},
  {href:'/dashboard/sales-performance/', label:'📈 Sales', match:'sales-performance'},
  {href:'/dashboard/production/', label:'🏭 Production', match:'production'},
  {href:'/dashboard/inventory/', label:'📦 Inventory', match:'inventory'},
  {href:'/dashboard/events/', label:'🎪 Events', match:'events'},
  {href:'/dashboard/pipeline/', label:'🔀 Pipeline', match:'pipeline'},
  {href:'/dashboard/', label:'📋 Усі', match:'__index__'},
  {href:'/', label:'📘 Brand Bible', match:'__brandbible__'},
];
BB.DASHBOARD_TOPNAV_CSS = `.bb-topnav{background:#0a0a0a;color:#fff;border-bottom:1px solid rgba(255,255,255,.1);position:sticky;top:0;z-index:300;font-family:Rubik,-apple-system,sans-serif}.bb-topnav-inner{max-width:1480px;margin:0 auto;padding:0 18px;display:flex;align-items:center;gap:14px;height:44px;overflow-x:auto;scrollbar-width:thin}.bb-topnav-inner::-webkit-scrollbar{height:0}.bb-topnav-brand{color:#fff;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:-.01em;display:flex;align-items:center;gap:5px;flex-shrink:0;padding-right:8px;border-right:1px solid rgba(255,255,255,.12);height:100%}.bb-topnav-brand .dot{color:#BAD9F4}.bb-topnav-brand:hover{opacity:.85}.bb-topnav-links{display:flex;align-items:center;gap:2px;flex:1}.bb-topnav-links .nav-link{color:rgba(255,255,255,.65);text-decoration:none;font-size:12.5px;font-weight:600;padding:6px 11px;border-radius:7px;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}.bb-topnav-links .nav-link:hover{background:rgba(255,255,255,.08);color:#fff}.bb-topnav-links .nav-link.active{background:rgba(186,217,244,.18);color:#BAD9F4}.bb-topnav-tools{display:flex;align-items:center;gap:8px;flex-shrink:0;color:rgba(255,255,255,.5);font-size:11px}@media(max-width:900px){.bb-topnav-inner{height:auto;padding:8px 12px;flex-wrap:wrap}.bb-topnav-brand{border-right:none;padding-right:0}.bb-topnav-links{order:3;width:100%}}`;
BB.injectDashboardTopnav = function(){
  const path = location.pathname;
  function isActive(m){ if (m === '__index__') return /^\/dashboard\/?$/.test(path); if (m === '__brandbible__') return false; return path.includes(m); }
  const style = document.createElement('style'); style.textContent = BB.DASHBOARD_TOPNAV_CSS; document.head.appendChild(style);
  const html = `<nav class="bb-topnav"><div class="bb-topnav-inner"><a href="/" class="bb-topnav-brand">Barpi<span class="dot">.</span></a><div class="bb-topnav-links">${BB.DASHBOARD_LINKS.map(l => `<a class="nav-link ${isActive(l.match) ? 'active' : ''}" href="${l.href}">${l.label}</a>`).join('')}</div><div class="bb-topnav-tools"><span id="bb-topnav-time"></span></div></div></nav>`;
  document.body.insertAdjacentHTML('afterbegin', html);
  const t = document.getElementById('bb-topnav-time');
  if (t) { const fmtT = () => { const d = new Date(); t.textContent = d.toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }; fmtT(); setInterval(fmtT, 30000); }
};

document.addEventListener('DOMContentLoaded', () => {
  BB.injectSkipLink();  // v4.3: skip-link перший elemenet for screen readers
  if (location.pathname.startsWith('/dashboard/')) BB.injectDashboardTopnav();
  BB.injectSidebar();
  BB.initLang();
  BB.markActiveNav();
  BB.injectPageNav();
  BB.initSearch();
  BB.initMobileMenu();
  if (document.getElementById('ideas-list')) { BB.renderIdeas(); BB.initIdeasForm(); }
});
