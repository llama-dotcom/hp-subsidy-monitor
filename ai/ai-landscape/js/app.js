/* ============================================
   AI Landscape — App Logic
   Loads JSON data, renders cards, filters, search
   ============================================ */

// SVG icon library — premium monoline icons
const ICONS = {
  bot: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',
  sparkles: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>',
  brain: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.04Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.04Z"/></svg>',
  search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  whale: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c0-3 2-5 5-5s5 2 6 5c1-3 3-5 6-5s4 2 4 5"/><path d="M2 12c2 4 6 7 10 7s8-3 10-7"/><circle cx="7" cy="11" r="0.5" fill="currentColor"/></svg>',
  bolt: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  llama: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22V10a3 3 0 0 1 3-3h2V4a2 2 0 1 1 4 0v3h2a3 3 0 0 1 3 3v12"/><circle cx="9" cy="13" r="0.5" fill="currentColor"/><circle cx="15" cy="13" r="0.5" fill="currentColor"/></svg>',
  cloud: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 1 0 0-9 6 6 0 0 0-11.7 1.5A4 4 0 0 0 6 19h11.5z"/></svg>',
  wind: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>',
  window: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
  diamond: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/></svg>',
  heart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  cursor: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>',
  package: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  surf: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>',
  computer: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  tools: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  refresh: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>',
  flask: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v5l5 9a3 3 0 0 1-2.6 4.5H6.6A3 3 0 0 1 4 17l5-9z"/><path d="M9 8h6"/></svg>',
  bug: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="12" height="14" rx="6"/><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M21 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>',
  doc: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
  graduation: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
  rocket: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
  chart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  link: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  newspaper: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></svg>',
  calendar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  catalog: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
};

// Map system IDs to icons (fallback: 'bot')
const SYSTEM_ICONS = {
  // LLM Frontier
  'chatgpt': 'bot',
  'claude': 'sparkles',
  'gemini': 'sparkles',
  'grok': 'bolt',
  'microsoft-copilot': 'window',
  // LLM Open-weight
  'llama': 'llama',
  'mistral': 'wind',
  'deepseek': 'whale',
  'qwen': 'cloud',
  'kimi': 'sparkles',
  'glm': 'cloud',
  'falcon': 'bolt',
  'command': 'diamond',
  // LLM Search
  'perplexity': 'search',
  'you-com': 'search',
  // LLM Regional
  'doubao': 'cloud',
  'minimax': 'cloud',
  'yi': 'cloud',
  'aleph-alpha': 'flask',
  // LLM Specialized
  'pi': 'heart',
  'ai21': 'brain',
  'reka': 'sparkles',
  'liquid-ai': 'wind',
  'mercury': 'bolt',
  // Coding IDE-native
  'cursor': 'cursor',
  'windsurf': 'surf',
  'zed': 'bolt',
  'trae': 'cursor',
  'void': 'code',
  // Coding IDE extensions
  'github-copilot': 'code',
  'tabnine': 'brain',
  'cody': 'search',
  'continue-dev': 'refresh',
  'jetbrains-ai': 'brain',
  'supermaven': 'bolt',
  // Coding CLI / agentic
  'claude-code': 'sparkles',
  'aider': 'tools',
  'codex-cli': 'code',
  'openhands': 'tools',
  'goose': 'tools',
  'plandex': 'doc',
  // Coding Cloud IDE
  'replit': 'computer',
  'bolt-new': 'bolt',
  'v0': 'computer',
  'lovable': 'heart',
  'same-new': 'refresh',
  // Coding Specialized
  'amazon-q-developer': 'package',
  'gemini-code-assist': 'sparkles',
  'devin': 'tools'
};

const App = {
  data: {},
  currentFilter: 'all',

  // --- Init ---
  async init() {
    this.initTheme();
    this.initNav();
    this.initDate();
    this.initRefresh();
    await this.loadPageData();
  },

  // --- Theme (default: dark, persists in localStorage 'ai-theme') ---
  initTheme() {
    const saved = localStorage.getItem('ai-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.querySelector('.btn-theme');
    if (btn) {
      btn.addEventListener('click', () => this.toggleTheme());
      this.updateThemeLabel();
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ai-theme', next);
    this.updateThemeLabel();
  },

  updateThemeLabel() {
    const btn = document.querySelector('.btn-theme');
    if (!btn) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    // Show OPPOSITE mode (Design QA spec)
    btn.textContent = isDark ? 'Light mode' : 'Dark mode';
  },

  // --- Header date ---
  initDate() {
    const el = document.querySelector('.hdr-date');
    if (!el) return;
    const d = new Date();
    el.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // --- Refresh button ---
  initRefresh() {
    const btn = document.querySelector('.btn-refresh');
    if (btn) btn.addEventListener('click', () => location.reload());
  },

  // --- Mobile Nav ---
  initNav() {
    // Mark active tab
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.hdr-tab').forEach(a => {
      const href = a.getAttribute('href');
      if (href === current || (current === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
  },

  // --- Data Loading (uses global vars from script tags) ---
  getData(name) {
    const map = {
      'llm_chatbots': typeof DATA_LLM_CHATBOTS !== 'undefined' ? DATA_LLM_CHATBOTS : null,
      'coding_tools': typeof DATA_CODING_TOOLS !== 'undefined' ? DATA_CODING_TOOLS : null,
      'synergies': typeof DATA_SYNERGIES !== 'undefined' ? DATA_SYNERGIES : null,
      'news': typeof DATA_NEWS !== 'undefined' ? DATA_NEWS : null,
      'events': typeof DATA_EVENTS !== 'undefined' ? DATA_EVENTS : null
    };
    return map[name] || null;
  },

  async loadPageData() {
    const page = (window.location.pathname.split('/').pop() || 'index.html').replace('.html', '');
    switch (page) {
      case 'index':
      case '':
        await this.loadDashboard();
        break;
      case 'systems':
        await this.loadSystems();
        break;
      case 'synergies':
        await this.loadSynergies();
        break;
      case 'news':
        await this.loadNews();
        break;
    }
    this.updateTimestamp();
  },

  // --- Dashboard ---
  async loadDashboard() {
    const llms = this.getData('llm_chatbots');
    const coding = this.getData('coding_tools');
    if (!llms || !coding) return;

    this.data.llms = llms;
    this.data.coding = coding;

    // KPI Stats
    const statsEl = document.getElementById('stats-grid');
    if (statsEl) {
      const all = [...llms, ...coding];
      const freeCount = all.filter(s => s.pricing && s.pricing.free_tier).length;
      statsEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-card__label">Systems Tracked</div>
          <div class="stat-card__value">${all.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">LLM Chatbots</div>
          <div class="stat-card__value">${llms.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Coding Tools</div>
          <div class="stat-card__value">${coding.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Free Tier</div>
          <div class="stat-card__value">${freeCount}</div>
        </div>
      `;
    }

    // Top LLMs
    const topLlmsEl = document.getElementById('top-llms');
    if (topLlmsEl) {
      const top = [...llms].sort((a, b) => a.market_position - b.market_position).slice(0, 5);
      topLlmsEl.innerHTML = top.map(s => this.renderMiniCard(s)).join('');
    }

    // Top Coding
    const topCodingEl = document.getElementById('top-coding');
    if (topCodingEl) {
      const top = [...coding].sort((a, b) => a.market_position - b.market_position).slice(0, 5);
      topCodingEl.innerHTML = top.map(s => this.renderMiniCard(s)).join('');
    }
  },

  iconFor(sys) {
    return ICONS[SYSTEM_ICONS[sys.id]] || ICONS.bot;
  },

  renderMiniCard(sys) {
    const flag = this.flagEmoji(sys.country_code);
    return `
      <div class="card" onclick="window.location.href='systems.html#${sys.id}'">
        <div class="card__rank">#${sys.market_position}</div>
        <div class="card__header">
          <div class="card__icon">${this.iconFor(sys)}</div>
          <div class="card__title-group">
            <div class="card__title">${this.esc(sys.name)}</div>
            <div class="card__developer">${this.esc(sys.developer)}${sys.country ? ` · ${flag} ${this.esc(sys.country)}` : ''}</div>
          </div>
        </div>
        <div class="card__description">${this.esc(sys.description)}</div>
        <div class="card__meta">
          ${sys.pricing && sys.pricing.free_tier ? '<span class="badge badge--free">Free tier</span>' : ''}
          ${sys.pricing && sys.pricing.pro_price ? `<span class="badge badge--price">${this.esc(sys.pricing.pro_price)}</span>` : ''}
          ${sys.estimated_users ? `<span class="badge badge--users">${this.esc(sys.estimated_users)}</span>` : ''}
        </div>
      </div>
    `;
  },

  // --- Systems Page ---
  async loadSystems() {
    const llms = this.getData('llm_chatbots');
    const coding = this.getData('coding_tools');
    if (!llms || !coding) return;

    this.data.llms = llms;
    this.data.coding = coding;

    this.initFilters();
    this.initSearch();
    this.renderSystems();

    // Scroll to hash
    if (window.location.hash) {
      setTimeout(() => {
        const el = document.getElementById(window.location.hash.slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  },

  initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderSystems();
      });
    });
  },

  initSearch() {
    const input = document.getElementById('search-input');
    if (input) {
      input.addEventListener('input', () => this.renderSystems());
    }
  },

  // --- Cluster definitions ---
  llmClusters: [
    { id: 'frontier', label: 'Frontier Models (Closed-Source)', desc: 'Top-tier proprietary models from major US labs' },
    { id: 'open-weight', label: 'Open-Weight Models', desc: 'Open-source and open-weight models you can self-host' },
    { id: 'search-research', label: 'Search & Research', desc: 'AI assistants built around web search and citations' },
    { id: 'specialized', label: 'Specialized & Enterprise', desc: 'Niche, enterprise-focused, or domain-specific models' },
    { id: 'regional', label: 'Regional Champions', desc: 'Leading models from outside the US ecosystem' }
  ],
  codingClusters: [
    { id: 'ide-native', label: 'AI-Native IDEs', desc: 'Standalone editors built around AI from day one' },
    { id: 'ide-extension', label: 'IDE Extensions', desc: 'Plugins for VS Code, JetBrains, and other editors' },
    { id: 'cli-agent', label: 'CLI & Agentic Tools', desc: 'Terminal-based agents that can act autonomously' },
    { id: 'cloud-ide', label: 'Cloud IDEs & App Builders', desc: 'Browser-based AI coding and instant deployment' },
    { id: 'specialized', label: 'Specialized Tools', desc: 'Cloud-vendor and niche developer assistants' }
  ],

  renderSystems() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase();

    const llmSection = document.getElementById('llm-section');
    const codingSection = document.getElementById('coding-section');
    const llmGrid = document.getElementById('llm-grid');
    const codingGrid = document.getElementById('coding-grid');
    const llmTable = document.getElementById('llm-table-body');
    const codingTable = document.getElementById('coding-table-body');

    const filterData = (items) => items.filter(s => {
      if (query) {
        const text = `${s.name} ${s.developer} ${s.owner || ''} ${s.country || ''} ${s.description}`.toLowerCase();
        return text.includes(query);
      }
      return true;
    }).sort((a, b) => a.market_position - b.market_position);

    const showLlm = this.currentFilter === 'all' || this.currentFilter === 'llm';
    const showCoding = this.currentFilter === 'all' || this.currentFilter === 'coding';

    if (llmSection) llmSection.style.display = showLlm ? '' : 'none';
    if (codingSection) codingSection.style.display = showCoding ? '' : 'none';

    // LLM table (flat)
    if (showLlm && llmTable) {
      llmTable.innerHTML = filterData(this.data.llms).map(s => this.renderTableRow(s)).join('');
    }
    if (showCoding && codingTable) {
      llmTable && (codingTable.innerHTML = filterData(this.data.coding).map(s => this.renderTableRow(s, true)).join(''));
      codingTable.innerHTML = filterData(this.data.coding).map(s => this.renderTableRow(s, true)).join('');
    }

    // LLM grid (clustered)
    if (showLlm && llmGrid) {
      llmGrid.innerHTML = this.renderClustered(filterData(this.data.llms), this.llmClusters);
    }
    if (showCoding && codingGrid) {
      codingGrid.innerHTML = this.renderClustered(filterData(this.data.coding), this.codingClusters, true);
    }
  },

  renderClustered(items, clusters, isCoding = false) {
    if (items.length === 0) {
      return '<p style="color:var(--dim);padding:20px 0">No systems match your search.</p>';
    }
    let html = '';
    for (const cluster of clusters) {
      const inCluster = items.filter(s => s.cluster === cluster.id);
      if (inCluster.length === 0) continue;
      html += `
        <div class="cluster-section">
          <div class="cluster-header">
            <div>
              <h3 class="cluster-title">${this.esc(cluster.label)}</h3>
              <p class="cluster-desc">${this.esc(cluster.desc)}</p>
            </div>
            <span class="cluster-count">${inCluster.length}</span>
          </div>
          <div class="cards-grid">
            ${inCluster.map(s => this.renderFullCard(s, isCoding)).join('')}
          </div>
        </div>
      `;
    }
    // Items without a cluster (legacy data)
    const noCluster = items.filter(s => !s.cluster || !clusters.find(c => c.id === s.cluster));
    if (noCluster.length) {
      html += `
        <div class="cluster-section">
          <div class="cluster-header">
            <div><h3 class="cluster-title">Other</h3></div>
            <span class="cluster-count">${noCluster.length}</span>
          </div>
          <div class="cards-grid">
            ${noCluster.map(s => this.renderFullCard(s, isCoding)).join('')}
          </div>
        </div>
      `;
    }
    return html;
  },

  flagEmoji(code) {
    if (!code || code.length !== 2) return '';
    const cc = code.toUpperCase();
    const a = String.fromCodePoint(0x1F1E6 + cc.charCodeAt(0) - 65);
    const b = String.fromCodePoint(0x1F1E6 + cc.charCodeAt(1) - 65);
    return a + b;
  },

  renderFullCard(sys, isCoding = false) {
    const prosHtml = (sys.pros || []).map(p => `<li>${this.esc(p)}</li>`).join('');
    const consHtml = (sys.cons || []).map(c => `<li>${this.esc(c)}</li>`).join('');
    const useCasesHtml = (sys.use_cases || []).map(u =>
      `<span class="use-case-tag">${this.esc(u)}</span>`
    ).join('');
    const idesHtml = isCoding && sys.supported_ides
      ? `<div class="detail-section"><h4>Supported IDEs</h4><div class="use-cases">${sys.supported_ides.map(i => `<span class="use-case-tag">${this.esc(i)}</span>`).join('')}</div></div>`
      : '';

    const flag = this.flagEmoji(sys.country_code);
    const ownerLine = sys.owner && sys.owner !== sys.developer
      ? ` · Owned by ${this.esc(sys.owner)}` : '';

    return `
      <div class="card" id="${sys.id}">
        <div class="card__rank">#${sys.market_position}</div>
        <div class="card__header">
          <div class="card__icon">${this.iconFor(sys)}</div>
          <div class="card__title-group">
            <div class="card__title">${this.esc(sys.name)}</div>
            <div class="card__developer">${this.esc(sys.developer)}${sys.launch_date ? ` · Since ${this.esc(sys.launch_date)}` : ''}</div>
          </div>
        </div>
        ${(sys.country || sys.owner) ? `
        <div class="card__origin">
          ${flag ? `<span class="flag">${flag}</span>` : ''}
          ${sys.country ? `<span>${this.esc(sys.country)}</span>` : ''}
          ${ownerLine ? `<span class="origin-owner">${ownerLine}</span>` : ''}
        </div>` : ''}
        <div class="card__description">${this.esc(sys.description)}</div>
        <div class="card__meta">
          ${sys.pricing?.free_tier ? `<span class="badge badge--free">Free tier</span>` : '<span class="badge">Paid only</span>'}
          ${sys.pricing?.pro_price ? `<span class="badge badge--price">${this.esc(sys.pricing.pro_price)}</span>` : ''}
          ${sys.estimated_users ? `<span class="badge badge--users">${this.esc(sys.estimated_users)}</span>` : ''}
          ${sys.latest_model ? `<span class="badge">${this.esc(sys.latest_model)}</span>` : ''}
        </div>
        <button class="card__expand-btn" onclick="App.toggleCard(this)">
          Show details →
        </button>
        <div class="card__details">
          <div class="detail-section">
            <div class="pros-cons">
              <div class="pros"><h4>Pros</h4><ul>${prosHtml}</ul></div>
              <div class="cons"><h4>Cons</h4><ul>${consHtml}</ul></div>
            </div>
          </div>
          ${useCasesHtml ? `<div class="detail-section"><h4>Use Cases</h4><div class="use-cases">${useCasesHtml}</div></div>` : ''}
          ${idesHtml}
          <div class="detail-section">
            <a href="${this.esc(sys.url)}" target="_blank" rel="noopener noreferrer">Visit ${this.esc(sys.name)} →</a>
          </div>
        </div>
      </div>
    `;
  },

  renderTableRow(sys, isCoding = false) {
    const flag = this.flagEmoji(sys.country_code);
    return `
      <tr>
        <td class="mono-cell"><strong>#${sys.market_position}</strong></td>
        <td><strong>${this.esc(sys.name)}</strong></td>
        <td>${this.esc(sys.developer)}</td>
        <td>${flag ? flag + ' ' : ''}${this.esc(sys.country || '—')}</td>
        <td>${sys.pricing?.free_tier ? 'Yes' : 'No'}</td>
        <td class="mono-cell">${sys.pricing?.pro_price ? this.esc(sys.pricing.pro_price) : '—'}</td>
        <td class="mono-cell">${sys.estimated_users ? this.esc(sys.estimated_users) : '—'}</td>
      </tr>
    `;
  },

  toggleCard(btn) {
    const card = btn.closest('.card');
    const isExpanded = card.classList.toggle('expanded');
    btn.textContent = isExpanded ? 'Hide details ←' : 'Show details →';
  },

  // --- Synergies Page ---
  synergyIconFor(syn) {
    const map = {
      'research-to-code': 'flask',
      'code-review-workflow': 'search',
      'debug-pipeline': 'bug',
      'documentation-workflow': 'doc',
      'learning-workflow': 'graduation',
      'rapid-prototyping': 'rocket',
      'data-analysis': 'chart',
      'migration-workflow': 'refresh'
    };
    return ICONS[map[syn.id]] || ICONS.link;
  },

  async loadSynergies() {
    const data = this.getData('synergies');
    if (!data) return;

    const grid = document.getElementById('synergies-grid');
    if (!grid) return;

    grid.innerHTML = data.map(syn => `
      <div class="synergy-card">
        <div class="synergy-card__header">
          <div class="synergy-card__icon">${this.synergyIconFor(syn)}</div>
          <div class="synergy-card__title">${this.esc(syn.title)}</div>
        </div>
        <div class="synergy-card__tools">
          ${syn.tools.map(t => `<span class="badge badge--price">${this.esc(t)}</span>`).join('')}
        </div>
        <div class="synergy-card__desc">${this.esc(syn.description)}</div>
        <ol class="synergy-card__steps">
          ${syn.steps.map(s => `<li>${this.esc(s)}</li>`).join('')}
        </ol>
      </div>
    `).join('');
  },

  // --- News Page ---
  async loadNews() {
    const newsData = this.getData('news');
    const eventsData = this.getData('events');

    if (newsData) this.renderNews(newsData);
    this.initEventFilters();
    if (eventsData) this.renderEvents(eventsData);
  },

  renderNews(items) {
    const grid = document.getElementById('news-grid');
    if (!grid) return;

    const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
    grid.innerHTML = sorted.map(n => {
      const priorityClass = n.importance === 'high' ? 'priority-high'
        : n.importance === 'medium' ? 'priority-medium'
        : 'priority-low';
      return `
      <div class="news-card ${priorityClass}">
        <div class="news-card__header">
          <span class="news-card__category">${this.esc(n.category)}</span>
          <span class="news-card__date">${this.formatDate(n.date)}</span>
        </div>
        <div class="news-card__title">${this.esc(n.title)}</div>
        <div class="news-card__summary">${this.esc(n.summary)}</div>
        <div class="news-card__source"><a href="${this.esc(n.source_url)}" target="_blank" rel="noopener noreferrer">${this.esc(n.source)} →</a></div>
      </div>
    `;
    }).join('');
  },

  renderEvents(items) {
    const timeline = document.getElementById('events-timeline');
    if (!timeline) return;

    this.data.events = items;
    this.filterEvents('all');
  },

  initEventFilters() {
    document.querySelectorAll('.event-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.event-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterEvents(btn.dataset.region);
      });
    });
  },

  filterEvents(region) {
    const timeline = document.getElementById('events-timeline');
    if (!timeline || !this.data.events) return;

    let items = [...this.data.events];
    if (region !== 'all') {
      items = items.filter(e => e.region === region);
    }

    const now = new Date();
    // Only show upcoming events (today and future)
    items = items.filter(e => new Date(e.date_end || e.date_start) >= now);
    items.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    if (items.length === 0) {
      timeline.innerHTML = '<p style="color:var(--text-muted);padding:20px 0">No upcoming events in this category.</p>';
      return;
    }

    timeline.innerHTML = items.map(e => {
      const start = new Date(e.date_start);
      const month = start.toLocaleString('en', { month: 'short' }).toUpperCase();
      const day = start.getDate();
      const year = start.getFullYear();

      return `
        <div class="event-card ${e.highlight ? 'highlight' : ''}">
          <div class="event-card__date-box">
            <div class="event-card__month">${month} ${year}</div>
            <div class="event-card__day">${day}</div>
          </div>
          <div class="event-card__info">
            <div class="event-card__name">${e.url ? `<a href="${e.url}" target="_blank" rel="noopener noreferrer">${this.esc(e.name)}</a>` : this.esc(e.name)}</div>
            <div class="event-card__location">${this.esc(e.location_city)}, ${this.esc(e.location_country)}${e.estimated_attendees ? ` · ${this.esc(e.estimated_attendees)} attendees` : ''}</div>
            <div class="event-card__desc">${this.esc(e.description)}</div>
            <div class="event-card__type">
              <span class="badge">${e.type}</span>
              <span class="badge">${e.region}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // --- Utilities ---
  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  },

  updateTimestamp() {
    const el = document.getElementById('last-updated');
    if (el) {
      el.textContent = `Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
  }
};

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
