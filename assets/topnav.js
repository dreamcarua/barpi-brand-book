/* ============================================================
   Barpi Dashboards Topnav — snEco-style
   Інжектиться на всіх дашбордах. Active помічається автоматично.
   ============================================================ */
(function(){
  const links = [
    {href:'/dashboard/customer-360/', label:'👥 Customer 360', match:'customer-360'},
    {href:'/dashboard/financial/', label:'💵 Financial', match:'financial'},
    {href:'/dashboard/sales-performance/', label:'📈 Sales', match:'sales-performance'},
    {href:'/dashboard/hq/', label:'🚀 HQ SMM', match:'/hq'},
    {href:'/dashboard/events/', label:'🎪 Events', match:'events'},
    {href:'/dashboard/smm/', label:'📊 SMM v1', match:'/smm'},
    {href:'/dashboard/', label:'📋 Dashboards', match:'__index__'},
    {href:'/', label:'📘 Brand Bible', match:'__brandbible__'},
  ];
  const path = location.pathname;
  function isActive(m){
    if (m === '__index__') return /\/dashboard\/?$/.test(path);
    if (m === '__brandbible__') return path === '/' || path === '/index.html';
    return path.includes(m);
  }
  const css = `
.bb-topnav{background:#0a0a0a;color:#fff;padding:0;border-bottom:1px solid rgba(255,255,255,.1);position:sticky;top:0;z-index:300;font-family:Rubik,-apple-system,sans-serif}
.bb-topnav-inner{max-width:1480px;margin:0 auto;padding:0 18px;display:flex;align-items:center;gap:14px;height:44px;overflow-x:auto;scrollbar-width:thin}
.bb-topnav-inner::-webkit-scrollbar{height:0}
.bb-topnav-brand{color:#fff;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:-.01em;display:flex;align-items:center;gap:5px;flex-shrink:0;padding-right:8px;border-right:1px solid rgba(255,255,255,.12);height:100%;align-items:center}
.bb-topnav-brand .dot{color:#BAD9F4}
.bb-topnav-brand:hover{opacity:.85}
.bb-topnav-links{display:flex;align-items:center;gap:2px;flex:1}
.bb-topnav-links .nav-link{color:rgba(255,255,255,.65);text-decoration:none;font-size:12.5px;font-weight:600;padding:6px 11px;border-radius:7px;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
.bb-topnav-links .nav-link:hover{background:rgba(255,255,255,.08);color:#fff}
.bb-topnav-links .nav-link.active{background:rgba(186,217,244,.18);color:#BAD9F4}
.bb-topnav-tools{display:flex;align-items:center;gap:8px;flex-shrink:0;color:rgba(255,255,255,.5);font-size:11px}
@media(max-width:900px){.bb-topnav-inner{height:auto;padding:8px 12px;flex-wrap:wrap}.bb-topnav-brand{height:auto;border-right:none;padding-right:0}.bb-topnav-links{order:3;width:100%}}
`;
  const head = document.head || document.getElementsByTagName('head')[0];
  const style = document.createElement('style');
  style.textContent = css;
  head.appendChild(style);
  const html = `
<nav class="bb-topnav">
  <div class="bb-topnav-inner">
    <a href="/" class="bb-topnav-brand">Barpi<span class="dot">.</span></a>
    <div class="bb-topnav-links">
      ${links.map(l => `<a class="nav-link ${isActive(l.match) ? 'active' : ''}" href="${l.href}">${l.label}</a>`).join('')}
    </div>
    <div class="bb-topnav-tools"><span id="bb-topnav-time"></span></div>
  </div>
</nav>
`;
  function inject(){
    document.body.insertAdjacentHTML('afterbegin', html);
    const t = document.getElementById('bb-topnav-time');
    if (t) {
      const fmtT = () => { const d = new Date(); t.textContent = d.toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); };
      fmtT(); setInterval(fmtT, 30000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
