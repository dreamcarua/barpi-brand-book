/* ============================================================
   Barpi Brand Bible v2.0 — Global JS
   ============================================================ */

const BB = window.BB = window.BB || {};

BB.SUPABASE_URL = 'https://zrcqmwlpsggiqgipvxhv.supabase.co';
BB.SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyY3Ftd2xwc2dnaXFnaXB2eGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MzcyMTYsImV4cCI6MjA5NTUxMzIxNn0.ROzbQ6aGRs-9rDVIDv0UyzlrvBRWFmFMQ7n77bLALmY';

/* ===== SIDEBAR HTML (one source of truth) ===== */
BB.SIDEBAR_HTML = `
<nav class="sidebar" id="bb-sidebar-nav">
  <div class="sidebar-head">
    <a class="sidebar-brand" href="/">
      <div class="brand-mark">B</div>
      <div class="brand-text">Barpi<span class="small" data-lang="uk">Brand Bible · v2.0</span><span class="small" data-lang="en">Brand Bible · v2.0</span></div>
    </a>
    <div class="sidebar-search" style="position:relative">
      <input type="text" id="bb-search" placeholder="Шукати / Search…" autocomplete="off" />
      <div id="bb-search-results" class="search-results"></div>
    </div>
    <div class="lang-switch">
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
      <a class="nav-link" href="/tech/"><span class="dot"></span><span data-lang="uk">Історія & SNECO</span><span data-lang="en">History & SNECO</span></a>
      <a class="nav-link" href="/messages/"><span class="dot"></span><span data-lang="uk">Меседжі & слогани</span><span data-lang="en">Messages & slogans</span></a>
    </div>
    <div class="nav-group">
      <div class="nav-group-label"><span data-lang="uk">Ідентичність</span><span data-lang="en">Identity</span></div>
      <a class="nav-link" href="/visual/"><span class="dot"></span><span data-lang="uk">Візуальна система</span><span data-lang="en">Visual system</span></a>
      <a class="nav-link" href="/voice/"><span class="dot"></span><span data-lang="uk">Голос бренду</span><span data-lang="en">Voice</span></a>
      <a class="nav-link" href="/photo/"><span class="dot"></span><span data-lang="uk">Фотографія</span><span data-lang="en">Photography</span></a>
    </div>
    <div class="nav-group">
      <div class="nav-group-label"><span data-lang="uk">Застосування</span><span data-lang="en">Application</span></div>
      <a class="nav-link" href="/digital/"><span class="dot"></span><span data-lang="uk">Digital · Instagram</span><span data-lang="en">Digital · Instagram</span></a>
      <a class="nav-link" href="/packaging/"><span class="dot"></span><span data-lang="uk">Упаковка</span><span data-lang="en">Packaging</span></a>
      <a class="nav-link" href="/partners/"><span class="dot"></span><span data-lang="uk">Партнери & Sales</span><span data-lang="en">Partners & Sales</span></a>
      <a class="nav-link" href="/pr/"><span class="dot"></span><span data-lang="uk">PR & криза</span><span data-lang="en">PR & Crisis</span></a>
      <a class="nav-link" href="/touchpoints/"><span class="dot"></span><span data-lang="uk">Touchpoints</span><span data-lang="en">Touchpoints</span></a>
    </div>
    <div class="nav-group">
      <div class="nav-group-label"><span data-lang="uk">Сервіс</span><span data-lang="en">Service</span></div>
      <a class="nav-link" href="/documents/"><span class="dot"></span><span data-lang="uk">Документи</span><span data-lang="en">Documents</span></a>
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
    <span data-lang="uk">© ТОВ «ПЕТ КОРП» · <a href="mailto:office@barpi.com.ua">office@barpi.com.ua</a></span>
    <span data-lang="en">© Pet Corp LLC · <a href="mailto:office@barpi.com.ua">office@barpi.com.ua</a></span>
  </div>
</nav>
`;

BB.injectSidebar = function() {
  const placeholder = document.getElementById('bb-sidebar');
  if (placeholder) {
    placeholder.outerHTML = BB.SIDEBAR_HTML;
  } else {
    // fallback: insert at start of body
    const app = document.querySelector('.app');
    if (app) app.insertAdjacentHTML('afterbegin', BB.SIDEBAR_HTML);
  }
};

/* ===== Lang switcher ===== */
BB.setLang = function(lang) {
  if (!['uk','en'].includes(lang)) lang = 'uk';
  document.body.classList.remove('lang-uk','lang-en');
  document.body.classList.add('lang-' + lang);
  document.documentElement.lang = lang;
  localStorage.setItem('bb_lang', lang);
  document.querySelectorAll('.lang-switch button').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
};
BB.initLang = function() {
  const saved = localStorage.getItem('bb_lang') || 'uk';
  BB.setLang(saved);
  document.querySelectorAll('.lang-switch button').forEach(b => {
    b.addEventListener('click', () => BB.setLang(b.dataset.lang));
  });
};

/* ===== Sidebar active state ===== */
BB.markActiveNav = function() {
  let path = location.pathname.replace(/\/index\.html$/, '/');
  if (!path.endsWith('/')) path += '/';
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href) return;
    let normalized = href.replace(/\/index\.html$/, '/');
    if (!normalized.endsWith('/')) normalized += '/';
    a.classList.toggle('active', normalized === path);
  });
};

/* ===== Search ===== */
BB.SEARCH_INDEX = [
  { id: 'manifesto', uk: 'Маніфест', en: 'Manifesto', url: '/' , words: 'турбота справжніх друзів один інгредієнт без зайвого' },
  { id: 'about', uk: 'Про бренд', en: 'About', url: '/about/', words: 'місія бачення цінності аудиторія barpi mission vision values' },
  { id: 'team', uk: 'Команда', en: 'Team', url: '/team/', words: 'Аксьонов Вадим Альона Мар\'яна Пилип org structure' },
  { id: 'tech', uk: 'Технологія SNECO', en: 'SNECO Technology', url: '/tech/', words: 'SNECO sneco 34 38 вакуум сушка вологи поживних' },
  { id: 'messages', uk: 'Меседжі і слогани', en: 'Messages', url: '/messages/', words: 'слогани claims tone of voice messaging' },
  { id: 'visual', uk: 'Візуальна система', en: 'Visual system', url: '/visual/', words: 'логотип кольори шрифт Qanelas SKU палітра' },
  { id: 'voice', uk: 'Голос бренду', en: 'Voice', url: '/voice/', words: 'tone of voice 70 30 турбота дружба' },
  { id: 'photo', uk: 'Фотографія', en: 'Photography', url: '/photo/', words: 'AI UGC реальні тварини fotografía' },
  { id: 'digital', uk: 'Digital · Instagram', en: 'Digital · Instagram', url: '/digital/', words: 'instagram reels stories каруселі контент пілари' },
  { id: 'packaging', uk: 'Упаковка', en: 'Packaging', url: '/packaging/', words: 'упаковка SKU курячі пупочки сир крекер зефір безе печінка хрустики' },
  { id: 'partners', uk: 'Партнери і Sales', en: 'Partners & Sales', url: '/partners/', words: 'E-ZOO MasterZoo PetHouse GooDwine GaraPet sales playbook B2B' },
  { id: 'pr', uk: 'PR і криза', en: 'PR & Crisis', url: '/pr/', words: 'crisis communication PR rework reply' },
  { id: 'touchpoints', uk: 'Touchpoints', en: 'Touchpoints', url: '/touchpoints/', words: 'touchpoints сайт instagram полиця магазин фестивалі' },
  { id: 'documents', uk: 'Документи', en: 'Documents', url: '/documents/', words: 'ТМ ТУ патент сертифікат лабораторний 383307 160558' },
  { id: 'roadmap', uk: 'Roadmap', en: 'Roadmap', url: '/roadmap/', words: 'roadmap Q3 пріоритети strategy 2026' },
  { id: 'dashboards', uk: 'Дашборди', en: 'Dashboards', url: '/dashboard/', words: 'dashboards SMM Sales Inventory Partners Events HQ' },
  { id: 'architecture', uk: 'Архітектура бренду', en: 'Brand architecture', url: '/architecture/', words: 'architecture snEco SNECO brand hierarchy' },
  { id: 'ideas', uk: 'Ідеї та пропозиції', en: 'Ideas & proposals', url: '/ideas/', words: 'ideas propose suggest пропозиції' },
];
BB.initSearch = function() {
  const input = document.getElementById('bb-search');
  const results = document.getElementById('bb-search-results');
  if (!input || !results) return;
  input.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    if (q.length < 2) { results.classList.remove('shown'); return; }
    const matches = BB.SEARCH_INDEX.filter(item => {
      const hay = (item.uk + ' ' + item.en + ' ' + item.words).toLowerCase();
      return hay.includes(q);
    }).slice(0, 10);
    if (!matches.length) {
      results.innerHTML = '<div class="search-result" style="color:var(--text-muted)">Нічого / No results</div>';
    } else {
      results.innerHTML = matches.map(m => `
        <a class="search-result" href="${m.url}">
          <div class="sect">${m.id}</div>
          <span data-lang="uk">${m.uk}</span><span data-lang="en">${m.en}</span>
        </a>`).join('');
    }
    results.classList.add('shown');
  });
  input.addEventListener('blur', () => setTimeout(() => results.classList.remove('shown'), 200));
  input.addEventListener('focus', () => { if (input.value.length >= 2) results.classList.add('shown'); });
};

/* ===== Ideas (Supabase REST) ===== */
BB.api = function(path, opts = {}) {
  return fetch(BB.SUPABASE_URL + '/rest/v1' + path, {
    ...opts,
    headers: {
      'apikey': BB.SUPABASE_ANON,
      'Authorization': 'Bearer ' + BB.SUPABASE_ANON,
      'Content-Type': 'application/json',
      'Prefer': opts.method === 'POST' ? 'return=representation' : '',
      ...(opts.headers || {})
    }
  });
};

BB.loadIdeas = async function(filter = 'all') {
  let q = '/brand_ideas?select=*&order=created_at.desc';
  if (filter !== 'all') q += '&status=eq.' + filter;
  try {
    const r = await BB.api(q);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) { console.error('Load ideas:', e); return []; }
};

BB.submitIdea = async function(data) {
  try {
    const r = await BB.api('/brand_ideas', { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) { console.error(await r.text()); return null; }
    return await r.json();
  } catch (e) { return null; }
};

BB.upvoteIdea = async function(id, current) {
  try {
    const r = await BB.api('/brand_ideas?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify({ upvotes: (current || 0) + 1 })
    });
    return r.ok;
  } catch (e) { return false; }
};

BB.renderIdeas = async function(filter = 'all') {
  const list = document.getElementById('ideas-list');
  const counter = document.getElementById('ideas-counter');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)">…</div>';
  const ideas = await BB.loadIdeas(filter);
  if (counter) counter.textContent = `${ideas.length} пропозицій / ideas`;
  if (!ideas.length) {
    list.innerHTML = '<div class="card" style="text-align:center;color:var(--text-muted)"><span data-lang="uk">Поки що пропозицій немає. Будьте першим!</span><span data-lang="en">No ideas yet. Be the first!</span></div>';
    return;
  }
  list.innerHTML = ideas.map(i => `
    <div class="idea" data-id="${i.id}">
      <div class="idea-head">
        <div class="title">${escapeHTML(i.title)}</div>
        <div class="status status-${i.status}">${i.status}</div>
      </div>
      <div class="idea-body">${escapeHTML(i.body)}</div>
      <div class="idea-meta">
        <span>${escapeHTML(i.author_name || 'Анонім')}</span>
        <span>${new Date(i.created_at).toLocaleDateString('uk-UA')}</span>
        ${i.section_id ? `<span style="background:var(--bg);padding:1px 6px;border-radius:4px">${i.section_id}</span>` : ''}
        <button class="upvote" onclick="BB.handleUpvote('${i.id}', ${i.upvotes || 0}, this)">▲ ${i.upvotes || 0}</button>
      </div>
    </div>`).join('');
};

BB.handleUpvote = async function(id, current, btn) {
  btn.disabled = true;
  const ok = await BB.upvoteIdea(id, current);
  if (ok) btn.innerHTML = '▲ ' + (current + 1);
  btn.disabled = false;
};

BB.initIdeasForm = function() {
  const form = document.getElementById('ideas-form');
  const newBtn = document.getElementById('ideas-new-btn');
  const submitBtn = document.getElementById('ideas-submit');
  const filterBtns = document.querySelectorAll('.ideas-filter button');
  if (!form || !newBtn || !submitBtn) return;
  newBtn.onclick = () => { form.style.display = form.style.display === 'none' ? 'block' : 'none'; };
  submitBtn.onclick = async () => {
    const data = {
      title: document.getElementById('idea-title').value.trim(),
      body: document.getElementById('idea-body').value.trim(),
      author_name: document.getElementById('idea-author').value.trim(),
      author_email: document.getElementById('idea-email').value.trim(),
      section_id: document.getElementById('idea-section').value.trim() || null,
      status: 'new',
    };
    if (!data.title) return alert('Введіть заголовок / Enter title');
    submitBtn.disabled = true;
    submitBtn.textContent = '…';
    const result = await BB.submitIdea(data);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Надіслати / Submit';
    if (result) {
      form.style.display = 'none';
      ['idea-title','idea-body','idea-author','idea-email','idea-section'].forEach(id => document.getElementById(id).value = '');
      BB.renderIdeas();
      alert('Дякуємо! Ваша пропозиція збережена. / Thanks! Saved.');
    } else { alert('Помилка / Error'); }
  };
  filterBtns.forEach(b => {
    b.onclick = () => {
      filterBtns.forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      BB.renderIdeas(b.dataset.status || 'all');
    };
  });
};

function escapeHTML(s) {
  if (!s) return '';
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.addEventListener('DOMContentLoaded', () => {
  BB.injectSidebar();
  BB.initLang();
  BB.markActiveNav();
  BB.initSearch();
  const toggle = document.querySelector('.menu-toggle');
  if (toggle) toggle.onclick = () => document.querySelector('.sidebar')?.classList.toggle('open');
  if (document.getElementById('ideas-list')) {
    BB.renderIdeas();
    BB.initIdeasForm();
  }
});
