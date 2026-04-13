/* ============================================
   My News Hub — Frontend Logic
   ============================================ */

(function () {
  'use strict';

  // --- Config ---
  const API_URL = '/api/news-hub-data';
  const SECTIONS = ['politics', 'tech', 'esslingen', 'saratov', 'lifestyle'];

  // --- Theme ---
  function initTheme() {
    const saved = localStorage.getItem('news-hub-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    updateThemeBtn();
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('news-hub-theme', next);
    updateThemeBtn();
  }

  function updateThemeBtn() {
    const btn = document.querySelector('.btn-theme');
    if (!btn) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '\u2600\uFE0F' : '\uD83C\uDF19';
    btn.setAttribute('aria-label', isDark ? 'Светлая тема' : 'Тёмная тема');
  }

  // --- Date display ---
  function showDate() {
    const el = document.querySelector('.hdr-date');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('ru-RU', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  // --- Tab navigation ---
  function initTabs() {
    const tabs = document.querySelectorAll('.hdr-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const section = tab.dataset.section;
        activateSection(section);

        // Close mobile menu
        const nav = document.getElementById('nav-tabs');
        if (nav) nav.classList.remove('open');
      });
    });
  }

  function activateSection(name) {
    // Update tabs
    document.querySelectorAll('.hdr-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.section === name);
    });
    // Update sections
    document.querySelectorAll('.news-section').forEach(s => {
      s.classList.toggle('active', s.id === 'section-' + name);
    });
    // Save to URL hash
    history.replaceState(null, '', '#' + name);
  }

  // --- Mobile menu ---
  function initMobileMenu() {
    const toggle = document.querySelector('.hdr-toggle');
    const nav = document.getElementById('nav-tabs');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }

  // --- Render news cards ---
  function renderCards(sectionId, articles) {
    const grid = document.getElementById('grid-' + sectionId);
    if (!grid) return;

    if (!articles || articles.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-state__icon">&#128240;</div>Новостей пока нет. Загляни после следующего обновления.</div>';
      return;
    }

    grid.innerHTML = articles.map(a => {
      const date = a.published_at ? formatDate(a.published_at) : '';
      const source = escapeHtml(a.source || '');
      const title = escapeHtml(a.title || 'Без заголовка');
      const summary = escapeHtml(a.summary || '');
      const url = a.url || '#';
      const cardSection = a.section || sectionId;

      return `<article class="news-card" data-section="${cardSection}">
        <h3 class="news-card__title"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${title}</a></h3>
        ${summary ? `<p class="news-card__summary">${summary}</p>` : ''}
        <div class="news-card__meta">
          ${source ? `<span class="news-card__source">${source}</span>` : ''}
          ${date ? `<span class="news-card__date">${date}</span>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Fetch data ---
  async function loadData() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();

      // Render regular sections
      ['politics', 'tech', 'esslingen', 'saratov'].forEach(s => {
        renderCards(s, data[s] || []);
      });

      // Merge beauty + carnivore into lifestyle
      const lifestyle = [
        ...(data['beauty'] || []),
        ...(data['carnivore'] || []),
      ].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      renderCards('lifestyle', lifestyle);

    } catch (err) {
      console.warn('API unavailable, trying fallback data...', err);
      loadFallbackData();
    }
  }

  function loadFallbackData() {
    SECTIONS.forEach(s => {
      const grid = document.getElementById('grid-' + s);
      if (grid) grid.innerHTML = '<div class="empty-state"><div class="empty-state__icon">&#128240;</div>Новости появятся после первого автоматического обновления.</div>';
    });
  }

  // --- Hash routing ---
  function initHashRoute() {
    const hash = location.hash.replace('#', '');
    if (hash && SECTIONS.includes(hash)) {
      activateSection(hash);
    }
  }

  // --- Init ---
  function init() {
    initTheme();
    showDate();
    initTabs();
    initMobileMenu();
    initHashRoute();
    loadData();

    document.querySelector('.btn-theme')?.addEventListener('click', toggleTheme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
