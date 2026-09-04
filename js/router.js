// =========================================================
// ROUTER – hash-based navigation (with dashboard hide/show)
// (v1.3.22 – handle initial hash if load event already fired)
// =========================================================

import { render as renderAllOrders } from './pages/allOrders.js';
import { render as renderCalendar } from './pages/calendar.js';
import { render as renderReports } from './pages/reports.js';
import { render as renderAnalytics } from './pages/analyticsPage.js';
import { render as renderActivity } from './pages/activity.js';
import { render as renderUsers } from './pages/users.js';
import { render as renderSettings } from './pages/settings.js';
import { closeDrawer, selectedId, openDrawer } from './components/Drawer.js';
import { openImportModal } from './pages/import.js';

let currentPage = 'dashboard';

export function navigateTo(page, params = {}) {
  const hash = `#${page}` + (params.id ? `/${encodeURIComponent(params.id)}` : '');
  console.log(`[router] navigateTo called: ${hash}`);

  if (window.location.hash === hash) {
    console.log('[router] hash is already the same – forcing re-render');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function initRouter() {
  console.log('[router] initRouter - attaching hashchange and load listeners');
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('load', handleRoute);

  // If the page is already loaded (e.g., on refresh or direct URL paste),
  // the 'load' event may have already fired, so handle the route immediately.
  if (document.readyState === 'complete') {
    console.log('[router] page already loaded – handling route now');
    handleRoute();
  }
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  console.log(`[router] handleRoute called with hash: "${hash}"`);

  const [rawPage, rawId] = hash.split('/');
  const page = rawPage;
  // Decode the ID – important for spaces and special characters
  const id = rawId ? decodeURIComponent(rawId) : null;
  console.log(`[router] parsed page: "${page}", id: "${id || 'none'}"`);

  let sectionPage = document.getElementById('sectionPage');
  const body = document.getElementById('sectionPageBody');
  const title = document.getElementById('sectionPageTitle');
  const sub = document.getElementById('sectionPageSub');
  const mainContent = document.getElementById('dashboardMain');

  // Special case: import page (opens modal)
  if (page === 'import') {
    console.log('[router] import page – opening modal');
    openImportModal();
    if (sectionPage) {
      sectionPage.classList.add('hidden');
      sectionPage.style.cssText = '';
    }
    document.body.classList.remove('overflow-hidden');
    if (mainContent) {
      mainContent.style.display = '';
      mainContent.classList.remove('dashboard-hidden');
    }
    return;
  }

  // Handle order detail
  if (page === 'order' && id) {
    console.log(`[router] order detail for id: ${id}, selectedId: ${selectedId}`);
    if (selectedId === id) {
      console.log('[router] already showing this order, skipping');
      return;
    }
    closeDrawer();
    // Check if the order actually exists before trying to open it
    const orderExists = window.orders ? window.orders.some(o => o.id === id) : false;
    if (!orderExists) {
      console.warn(`[router] Order with id "${id}" not found – navigating to dashboard`);
      navigateTo('dashboard');
      return;
    }
    openDrawer(id);
    return;
  }

  if (selectedId) {
    console.log('[router] closing drawer');
    closeDrawer();
  }

  // ----- DASHBOARD -----
  if (page === 'dashboard') {
    console.log('[router] navigating to dashboard');
    if (sectionPage) {
      sectionPage.classList.add('hidden');
      sectionPage.style.cssText = '';
    }
    document.body.classList.remove('overflow-hidden');
    currentPage = 'dashboard';
    if (mainContent) {
      mainContent.style.display = '';
      mainContent.classList.remove('dashboard-hidden');
    }
    if (typeof window.setActiveNav === 'function') {
      window.setActiveNav('dashboard');
    } else {
      console.warn('[router] window.setActiveNav not defined');
    }
    return;
  }

  // ----- SECTION PAGES -----
  console.log(`[router] showing section page for: ${page}`);

  // Ensure sectionPage exists
  if (!sectionPage) {
    console.warn('[router] #sectionPage not found – creating one');
    const newSection = document.createElement('div');
    newSection.id = 'sectionPage';
    newSection.className = 'fixed left-0 xl:left-[182px] right-0 top-[64px] bottom-0 z-[35] bg-brand-dark text-white overflow-y-auto';
    newSection.innerHTML = `
      <div class="max-w-[1500px] mx-auto px-5 lg:px-8 py-6">
        <div class="flex items-center justify-between gap-4 mb-6">
          <div>
            <button id="sectionBackBtn" type="button" class="text-xs font-bold text-brand-orange hover:text-brand-orange/80 mb-2 transition">← Back to Dashboard</button>
            <h2 id="sectionPageTitle" class="text-2xl font-black text-white"></h2>
            <p id="sectionPageSub" class="text-sm text-white/50 mt-1"></p>
          </div>
          <button id="sectionRefreshBtn" type="button" class="px-3 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition">↻ Refresh</button>
        </div>
        <div id="sectionPageBody"></div>
      </div>
    `;
    document.body.appendChild(newSection);
    sectionPage = newSection;
    // Update references
    title = document.getElementById('sectionPageTitle');
    sub = document.getElementById('sectionPageSub');
    body = document.getElementById('sectionPageBody');
  }

  // Move sectionPage to body if not already
  if (sectionPage.parentNode !== document.body) {
    document.body.appendChild(sectionPage);
    console.log('[router] moved sectionPage to body');
  }

  // Clear any previous inline styles and force visibility
  sectionPage.style.cssText = '';
  sectionPage.classList.remove('hidden');
  // Explicitly set display: block and other required styles via inline (safe)
  sectionPage.style.display = 'block';
  sectionPage.style.position = 'fixed';
  sectionPage.style.top = '64px';
  sectionPage.style.bottom = '0';
  sectionPage.style.zIndex = '35';
  sectionPage.style.background = '#1E1E1C';
  sectionPage.style.overflowY = 'auto';

  document.body.classList.add('overflow-hidden');
  currentPage = page;

  // HIDE DASHBOARD
  if (mainContent) {
    mainContent.style.display = 'none';
    mainContent.classList.add('dashboard-hidden');
  }

  // Determine which page to render
  let renderFn = null;
  let pageTitle = '';
  let pageSub = '';

  switch (page) {
    case 'orders':
      pageTitle = 'All Work Orders';
      pageSub = 'Complete work-order register.';
      renderFn = renderAllOrders;
      break;
    case 'calendar':
      pageTitle = 'Calendar';
      pageSub = 'Work orders grouped by date.';
      renderFn = renderCalendar;
      break;
    case 'reports':
      pageTitle = 'Reports';
      pageSub = 'Operational summary.';
      renderFn = renderReports;
      break;
    case 'analytics':
      pageTitle = 'Analytics';
      pageSub = 'Filter and analyze data.';
      renderFn = renderAnalytics;
      break;
    case 'activity':
      pageTitle = 'Activity Log';
      pageSub = 'Recent actions recorded.';
      renderFn = renderActivity;
      break;
    case 'users':
      pageTitle = 'Users';
      pageSub = 'Manage assignees.';
      renderFn = renderUsers;
      break;
    case 'settings':
      pageTitle = 'Settings';
      pageSub = 'Prototype settings.';
      renderFn = renderSettings;
      break;
    default:
      console.log(`[router] unknown page: "${page}", falling back to dashboard`);
      navigateTo('dashboard');
      return;
  }

  if (title) title.textContent = pageTitle;
  if (sub) sub.textContent = pageSub;

  if (typeof window.setActiveNav === 'function') {
    window.setActiveNav(page);
  } else {
    console.warn('[router] setActiveNav not defined');
  }

  if (renderFn) {
    console.log(`[router] scheduling render for ${page}`);
    if (body) body.innerHTML = `<div class="text-center py-20 text-white/50">Loading ${pageTitle}...</div>`;

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          console.log(`[router] executing renderFn for ${page}`);
          renderFn();
          console.log(`[router] renderFn for ${page} completed successfully`);
        } catch (err) {
          console.error(`[router] ❌ Error rendering ${page}:`, err);
          if (body) {
            body.innerHTML = `
              <div class="text-center py-16 max-w-2xl mx-auto">
                <div class="text-4xl mb-4">⚠️</div>
                <h3 class="text-xl font-bold text-white mb-2">Failed to load ${pageTitle}</h3>
                <p class="text-white/60 text-sm mb-4">${err.message || 'Unknown error'}</p>
                <button onclick="window.location.hash='#dashboard'"
                        class="px-5 py-2.5 bg-brand-orange text-black font-bold rounded-xl hover:bg-brand-orange/80 transition">
                  ← Back to Dashboard
                </button>
                <p class="text-white/30 text-xs mt-6">Check the browser console (F12) for full error details.</p>
              </div>
            `;
          }
        } finally {
          // Ensure dashboard stays hidden even if renderFn throws
          if (mainContent) {
            mainContent.style.display = 'none';
            mainContent.classList.add('dashboard-hidden');
          }
        }
      }, 20);
    });
  } else {
    console.warn(`[router] no render function for ${page}`);
    if (body) {
      body.innerHTML = `
        <div class="text-center py-16">
          <p class="text-white/50">No render function found for "${page}".</p>
          <button onclick="window.location.hash='#dashboard'"
                  class="mt-4 px-5 py-2.5 bg-brand-orange text-black font-bold rounded-xl">
            ← Back to Dashboard
          </button>
        </div>
      `;
    }
  }

  console.log(`[router] handleRoute complete for ${page}`);
}