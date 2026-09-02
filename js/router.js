// =========================================================
// ROUTER – hash-based navigation
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
import { setActiveNav } from './app.js';

let currentPage = 'dashboard';

export function navigateTo(page, params = {}) {
  const hash = `#${page}` + (params.id ? `/${params.id}` : '');
  window.location.hash = hash;
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('load', handleRoute);
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  const [page, id] = hash.split('/');
  const sectionPage = document.getElementById('sectionPage');
  const body = document.getElementById('sectionPageBody');
  const title = document.getElementById('sectionPageTitle');
  const sub = document.getElementById('sectionPageSub');

  // Special case: import page (opens modal)
  if (page === 'import') {
    openImportModal();
    sectionPage.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    return;
  }

  // Handle order detail – prevent loops
  if (page === 'order' && id) {
    // If drawer is already open for this order, do nothing
    if (selectedId === id) return;
    // Otherwise close current drawer and open new one
    closeDrawer();
    openDrawer(id);
    // The drawer will set hash again, but we exit early here to avoid loop.
    return;
  }

  // Close drawer if navigating away from order
  if (selectedId) closeDrawer();

  if (page === 'dashboard') {
    sectionPage.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    currentPage = 'dashboard';
    return;
  }

  // For other pages, show section page
  sectionPage.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  currentPage = page;

  // Render based on page
  switch (page) {
    case 'orders':
      title.textContent = 'All Work Orders';
      sub.textContent = 'Complete work-order register. Use the date filter dropdown to search by any configured date field.';
      renderAllOrders();
      break;
    case 'calendar':
      title.textContent = 'Calendar';
      sub.textContent = 'Work orders grouped by date. Select which date to use below.';
      renderCalendar();
      break;
    case 'reports':
      title.textContent = 'Reports';
      sub.textContent = 'Operational summary based on the current local work-order data.';
      renderReports();
      break;
    case 'analytics':
      title.textContent = 'Analytics';
      sub.textContent = 'Filter work orders and analyze the data.';
      renderAnalytics();
      break;
    case 'activity':
      title.textContent = 'Activity Log';
      sub.textContent = 'Most recent actions recorded by this frontend prototype.';
      renderActivity();
      break;
    case 'users':
      title.textContent = 'Users';
      sub.textContent = 'Assigned users detected from the current work-order records. Manage assignees here.';
      renderUsers();
      break;
    case 'settings':
      title.textContent = 'Settings';
      sub.textContent = 'Prototype settings and local data controls.';
      renderSettings();
      break;
    default:
      // Fallback to dashboard
      navigateTo('dashboard');
  }
   // Set active nav for the rendered page
  setActiveNav(page);
}