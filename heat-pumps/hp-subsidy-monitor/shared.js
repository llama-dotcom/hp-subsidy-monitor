// === SHARED HEADER & THEME for all pages ===

// Theme init (before DOM)
(function(){const s=localStorage.getItem('hp-theme');if(s)document.documentElement.setAttribute('data-theme',s);})();

// Inject header
function initHeader(activePage){
  const pages=[
    {id:'dashboard',label:'Dashboard',icon:'layout-dashboard',href:'index.html',tabAction:"showP('dash',this)"},
    {id:'countries',label:'Countries',icon:'globe',href:'index.html',tabAction:"showP('countries',this)"},
    {id:'prices',label:'Electricity Prices',icon:'bolt',href:'energy-prices.html'},
    {id:'about',label:'About',icon:'info',href:'about.html'}
  ];
  const isIndex=activePage==='dashboard'||activePage==='countries';

  const isDk=(document.documentElement.getAttribute('data-theme')||'dark')==='dark';
  const themeLbl=isDk?'Light mode':'Dark mode';

  const header=document.createElement('header');
  header.innerHTML=`
    <div class="hdr-container">
      <div class="hdr-logo">
        <div class="hdr-icon"><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
        <div><div class="hdr-title">HP Subsidy Monitor</div><div class="hdr-sub">European Heat Pump Subsidy Dashboard</div></div>
      </div>
      <div class="hdr-tabs">
        ${pages.map(p=>{
          const cls='hdr-tab'+(p.id===activePage?' active':'');
          if(isIndex&&p.tabAction) return`<button class="${cls}" onclick="${p.tabAction}">${p.label}</button>`;
          return`<a href="${p.href}" class="${cls}">${p.label}</a>`;
        }).join('')}
      </div>
      <div class="hdr-right">
        <span class="hdr-scope">AW · LW · EW · Hybrids</span>
        <button class="hdr-refresh" id="refresh-btn" onclick="typeof refreshData==='function'?refreshData():location.reload()"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg> Refresh</button>
        <button class="hdr-theme" onclick="toggleTheme()"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg> <span id="theme-label">${themeLbl}</span></button>
        <span class="hdr-date" id="last-updated">${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
      </div>
    </div>`;
  document.body.prepend(header);
}

// Theme toggle
function toggleTheme(){
  const c=document.documentElement.getAttribute('data-theme')||'dark';
  const n=c==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',n);
  localStorage.setItem('hp-theme',n);
  document.getElementById('theme-label').textContent=n==='dark'?'Light mode':'Dark mode';
  // Notify page-specific handlers
  if(typeof onThemeChange==='function')onThemeChange(n);
}

// Inject shared CSS
const sharedCSS=document.createElement('style');
sharedCSS.textContent=`
header{background:var(--bg);border-bottom:1px solid var(--glass-b);padding:12px 0;position:sticky;top:0;z-index:1000;backdrop-filter:blur(24px);}
.hdr-container{max-width:1400px;margin:0 auto;padding:0 20px;display:flex;justify-content:space-between;align-items:center;gap:10px;}
.hdr-logo{display:flex;align-items:center;gap:10px;}
.hdr-icon{width:32px;height:32px;background:linear-gradient(135deg,#c9a84c,#e8dcc8);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#2a2015;}
.hdr-title{font-size:1.05rem;font-weight:700;color:var(--text);}
.hdr-sub{font-size:0.65rem;color:var(--dim);}
.hdr-tabs{display:flex;gap:2px;background:rgba(30,41,59,0.3);border-radius:10px;padding:3px;}
[data-theme="light"] .hdr-tabs{background:rgba(190,180,165,0.25);}
.hdr-tab{padding:7px 18px;border-radius:8px;font-size:0.8rem;font-weight:500;color:var(--dim);text-decoration:none;display:flex;align-items:center;gap:6px;transition:all 0.2s;border:none;cursor:pointer;background:none;font-family:inherit;}
.hdr-tab:hover{color:var(--text);opacity:1;}
.hdr-tab.active{color:var(--text);background:rgba(56,189,248,0.15);box-shadow:0 0 12px rgba(56,189,248,0.1);}
.hdr-right{display:flex;align-items:center;gap:10px;}
.hdr-scope{font-size:0.68rem;color:var(--dim);background:rgba(100,116,139,0.12);padding:3px 8px;border-radius:5px;letter-spacing:0.3px;}
.hdr-refresh{background:linear-gradient(135deg,#22a6b3,#7ed6df);border:none;border-radius:8px;padding:5px 12px;cursor:pointer;color:#0a2e33;font-size:0.75rem;font-weight:400;transition:all 0.2s;display:flex;align-items:center;gap:4px;}
.hdr-refresh:hover{opacity:0.9;transform:translateY(-1px);box-shadow:0 2px 8px rgba(34,166,179,0.3);}
[data-theme="light"] .hdr-refresh{background:linear-gradient(135deg,#1a8a95,#5bbec7);color:#f0fafa;}
.hdr-theme{border-radius:8px;padding:5px 12px;cursor:pointer;font-size:0.75rem;font-weight:500;transition:all 0.2s;border:none;display:flex;align-items:center;gap:5px;}
[data-theme="dark"] .hdr-theme{background:linear-gradient(135deg,#e8dcc8,#f5eede);color:#3a3025;box-shadow:inset 0 1px 0 rgba(255,255,255,0.3);}
[data-theme="light"] .hdr-theme,.hdr-theme{background:linear-gradient(135deg,#2a2f3d,#3d4556);color:#e0dcd4;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);}
.hdr-theme:hover{opacity:0.9;transform:translateY(-1px);}
.hdr-date{font-size:0.65rem;color:var(--dim);}
@media(max-width:900px){
  .hdr-container{flex-direction:column;align-items:flex-start;}
  .hdr-tabs{width:100%;justify-content:center;}
}
`;
document.head.appendChild(sharedCSS);
