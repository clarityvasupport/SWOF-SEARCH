// =========================================================
// APP – entry point: initialises data, UI, and event listeners
// =========================================================

// ---------- Imports from data ----------
import {
  orders,
  history,
  users,
  displayConfig,
  importedHeaders,
  loadOrders,
  loadUsers,
  loadImportedHeaders,
  loadDisplayConfig,
  loadSharedState,
  syncSharedStorage,
  saveOrders,
  saveHistory,
  saveUsers,
  saveDisplayConfig,
  saveImportedHeaders,
  pushHistory,
  isOnline,
  loadApiUrl,
  getStoredPassword,
  clearMappingConfig,
} from './data.js';

// ---------- Imports from render ----------
import {
  render,
  getFilteredOrders,
  changeStatusDirect,
  undoLast,
  duplicateSelected,
  deleteSelected,
  newOrder,
  currentPage,
  updateUndoButtons,
  toggleEditability,
  initializeDashboardFilters,
} from './render.js';

// ---------- Imports from components ----------
import {
  openDrawer,
  closeDrawer,
  renderDrawer,
  selectedId,
} from './components/Drawer.js';

import {
  openEdit,
  closeEdit,
  editingId,
  deleteFromEdit,
  saveForm,
} from './components/EditModal.js';

import {
  openConfirmationModal,
  closeConfirmationModal,
  pendingConfirmation,
} from './components/ConfirmModal.js';

import {
  openStatusModal,
  closeStatusModal,
  confirmStatus,
} from './components/StatusModal.js';

// ---------- Imports from utils ----------
import {
  toast,
  showLoadingToast,
  hideLoadingToast,
  normalizeApiRows,
  parseDelimited,
  closeImagePreviewModal,
  setImagePreviewZoom,
  resetImagePreviewZoom,
  imagePreviewZoom,
} from './utils.js';

import {
  makeMappedOrder,
  showImportData,
  resetImportCenter,
  applyImport,
} from './importHelpers.js';

// ---------- Imports from pages (will be created next) ----------
import { render as renderAllOrders } from './pages/allOrders.js';
import { render as renderCalendar } from './pages/calendar.js';
import { render as renderReports } from './pages/reports.js';
import { render as renderAnalytics } from './pages/analytics.js';
import { render as renderActivity } from './pages/activity.js';
import { render as renderUsers } from './pages/users.js';
import { render as renderSettings } from './pages/settings.js';
import {
  openImportModal,
  closeImportModal,
  handleImportFile,
  handleImportApi,
  clearAllOrders,
  clearAllAndStopSync,
} from './pages/import.js';

// ---------- Router ----------
import { initRouter, navigateTo } from './router.js';

// ---------- Global state ----------
let isLoggedIn = false;
let storedPassword = 'password';
window.isLoggedIn = isLoggedIn;
window.toast = toast;
window.requireLogin = requireLogin;

// ---------- Login functions ----------
export function openLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  document.getElementById('loginError').classList.add('hidden');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  setTimeout(() => document.getElementById('loginUsername').focus(), 100);
}

export function closeLoginModal() {
  document.getElementById('loginModal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

export function login(username, password) {
  const validPassword = storedPassword || 'password';
  if (username === 'admin' && password === validPassword) {
    isLoggedIn = true;
    window.isLoggedIn = true;
    closeLoginModal();
    updateLoginUI();
    render();
    // Refresh settings if open
    const sectionPage = document.getElementById('sectionPage');
    if (!sectionPage.classList.contains('hidden')) {
      const title = document.getElementById('sectionPageTitle');
      if (title && title.textContent === 'Settings') {
        // We'll call renderSettings() which will re-render the checkboxes
        renderSettings();
      }
    }
    toast('✅ Logged in as Admin', 'success');
    return true;
  } else {
    document.getElementById('loginError').classList.remove('hidden');
    return false;
  }
}

export function logout() {
  openConfirmationModal({
    title: 'Confirm Logout',
    message: 'Are you sure you want to log out? Any unsaved changes will be lost.',
    confirmText: 'Logout',
    confirmClass: 'bg-red-600 hover:bg-red-700',
    onConfirm: () => {
      isLoggedIn = false;
      window.isLoggedIn = false;
      updateLoginUI();
      render();
      const sectionPage = document.getElementById('sectionPage');
      if (!sectionPage.classList.contains('hidden')) {
        const title = document.getElementById('sectionPageTitle');
        if (title && title.textContent === 'Settings') {
          renderSettings();
        }
      }
      closeConfirmationModal();
      toast('🔒 Logged out', 'info');
    },
  });
}

function updateLoginUI() {
  const loginBtn = document.getElementById('loginBtn');
  const loginText = document.getElementById('loginBtnText');
  if (isLoggedIn) {
    loginText.textContent = 'Logout';
    loginBtn.classList.remove('bg-brand-success');
    loginBtn.classList.add('bg-red-600', 'hover:bg-red-700');
  } else {
    loginText.textContent = 'Login';
    loginBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
    loginBtn.classList.add('bg-brand-success', 'hover:bg-[#6EAD30]');
  }
  toggleEditability();
}

function requireLogin() {
  if (!isLoggedIn) {
    openLoginModal();
    return false;
  }
  return true;
}

// ---------- Override protected functions ----------
const originalNewOrder = newOrder;
const originalOpenEdit = openEdit;
const originalDeleteSelected = deleteSelected;
const originalDeleteFromEdit = deleteFromEdit;
const originalDuplicateSelected = duplicateSelected;
const originalApplyImport = applyImport;
const originalOpenImportModal = openImportModal;
const originalClearAllOrders = clearAllOrders;
const originalChangeStatusDirect = changeStatusDirect;

window.newOrder = function() { if (requireLogin()) originalNewOrder(); };
window.openEdit = function(id) { if (requireLogin()) originalOpenEdit(id); };
window.deleteSelected = function() { if (requireLogin()) originalDeleteSelected(); };
window.deleteFromEdit = function() { if (requireLogin()) originalDeleteFromEdit(); };
window.duplicateSelected = function() { if (requireLogin()) originalDuplicateSelected(); };
window.applyImport = function(skipAuth) { if (skipAuth || requireLogin()) originalApplyImport(skipAuth); };
window.openImportModal = function() { if (requireLogin()) originalOpenImportModal(); };
window.clearAllOrders = function() { if (requireLogin()) originalClearAllOrders(); };
window.changeStatusDirect = function(id, newStatus) {
  if (requireLogin()) originalChangeStatusDirect(id, newStatus);
};

// Patch drawer status dropdown
document.getElementById('drawerStatusSelect').addEventListener('change', function(e) {
  if (!requireLogin()) {
    const o = orders.find(x => x.id === selectedId);
    if (o) e.target.value = o.status;
    return;
  }
  // The actual status change is handled by the component via openConfirmationModal
});

// ---------- Auto-sync from API ----------
async function autoSyncFromStoredApi(retryCount = 0) {
  const url = loadApiUrl();
  if (!url) return;
  try {
    const success = await fetchAndApplyWithSavedMapping(url);
    if (!success && retryCount < 2) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return autoSyncFromStoredApi(retryCount + 1);
    }
  } catch (err) {
    console.error('AutoSync error:', err);
    if (retryCount < 2) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return autoSyncFromStoredApi(retryCount + 1);
    }
    toast('⚠️ Auto-sync failed. Click Refresh to try again.', 'error');
  }
}

async function fetchAndApplyWithSavedMapping(apiUrl) {
  if (!apiUrl) return false;
  try {
    const response = await fetch(apiUrl, { method: 'GET', headers: { Accept: 'application/json, text/csv, text/plain, */*' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    let rows = [], headers = [];
    if (contentType.includes('application/json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
      const data = JSON.parse(text);
      rows = normalizeApiRows(data);
      if (!rows.length && data && typeof data === 'object') {
        const nested = Object.values(data).find(v => Array.isArray(v));
        if (nested) rows = nested;
      }
      if (!rows.length) throw new Error('JSON response did not contain an array of rows.');
      if (rows.every(row => row && typeof row === 'object' && !Array.isArray(row))) {
        headers = Object.keys(rows[0]);
      } else if (rows.every(Array.isArray)) {
        headers = rows[0].map((_, idx) => `Column ${idx+1}`);
        rows = rows.map(row => {
          const obj = {};
          headers.forEach((h, idx) => { obj[h] = row[idx] ?? ''; });
          return obj;
        });
      } else throw new Error('Unsupported JSON format from API.');
    } else {
      const parsed = parseDelimited(text);
      if (!parsed.headers.length || !parsed.rows.length) throw new Error('No rows returned from API');
      headers = parsed.headers;
      rows = parsed.rows;
    }
    const newOrders = rows.map((r, i) => makeMappedOrder(r, i));
    orders = newOrders;
    saveOrders();
    render();
    toast(`✅ API sync complete: ${orders.length} orders loaded.`, 'success');
    return true;
  } catch (err) {
    console.error('API sync failed:', err);
    toast('❌ API sync failed: ' + err.message, 'error');
    return false;
  }
}

// ---------- Init function ----------
async function initApp() {
  // 1. Load cached data
  orders = loadOrders();
  users = loadUsers();
  importedHeaders = loadImportedHeaders();
  displayConfig = loadDisplayConfig();

  // 2. Render immediately
  render();

  // 3. Load from cloud (KV)
  try {
    await loadSharedState();
    storedPassword = getStoredPassword();
    orders = loadOrders();
    users = loadUsers();
    importedHeaders = loadImportedHeaders();
    displayConfig = loadDisplayConfig();
    render();
    if (isLoggedIn) updateLoginUI();
  } catch (e) { console.warn('Cloud load failed, using local cache.', e); }

  // 4. Auto-sync from external API
  autoSyncFromStoredApi();

  // 5. Set up router
  initRouter();

  // 6. Attach global event listeners
  attachEventListeners();

  // 7. Make functions globally available (for inline onclick)
  window.render = render;
  window.undoLast = undoLast;
  window.newOrder = newOrder;
  window.openDrawer = openDrawer;
  window.openEdit = openEdit;
  window.deleteSelected = deleteSelected;
  window.duplicateSelected = duplicateSelected;
  window.changeStatusDirect = changeStatusDirect;
  window.openConfirmationModal = openConfirmationModal;
  window.closeConfirmationModal = closeConfirmationModal;
  window.openStatusModal = openStatusModal;
  window.closeStatusModal = closeStatusModal;
  window.confirmStatus = confirmStatus;
  window.openImportModal = openImportModal;
  window.closeImportModal = closeImportModal;
  window.applyImport = applyImport;
  window.toast = toast;
  window.requireLogin = requireLogin;
}

// ---------- Attach all event listeners ----------
function attachEventListeners() {
  // --- Hamburger ---
  const hamburger = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebarNav');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => sidebar.classList.toggle('open'));
    hamburger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sidebar.classList.toggle('open');
      }
    });
  }

  // --- Admin toggle ---
  const adminToggleBtn = document.getElementById('adminToggleBtn');
  const adminNav = document.getElementById('adminNav');
  const adminArrow = document.getElementById('adminArrow');
  if (adminToggleBtn && adminNav) {
    adminToggleBtn.addEventListener('click', function() {
      adminNav.classList.toggle('collapsed');
      adminArrow.classList.toggle('rotated');
      localStorage.setItem('adminCollapsed', adminNav.classList.contains('collapsed') ? 'true' : 'false');
    });
    const saved = localStorage.getItem('adminCollapsed');
    if (saved === 'true') {
      adminNav.classList.add('collapsed');
      adminArrow.classList.add('rotated');
    }
  }

  // --- Navigation buttons (data-nav) ---
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const page = this.dataset.nav;
      if (page === 'import') {
        openImportModal();
        return;
      }
      navigateTo(page);
    });
  });

  // --- Undo buttons ---
  document.getElementById('dashboardUndoBtn')?.addEventListener('click', undoLast);
  document.getElementById('mobileUndoBtn')?.addEventListener('click', undoLast);
  document.getElementById('drawerUndoBtn')?.addEventListener('click', undoLast);
  document.getElementById('modalUndoBtn')?.addEventListener('click', undoLast);

  // --- New order ---
  document.getElementById('newOrderBtn')?.addEventListener('click', () => {
    navigateTo('dashboard');
    newOrder();
  });

  // --- Import buttons ---
  document.getElementById('importTopBtn')?.addEventListener('click', openImportModal);
  document.getElementById('openImportModalBtn')?.addEventListener('click', openImportModal);
  document.getElementById('importSideBtn')?.addEventListener('click', openImportModal);

  // --- Login/Logout ---
  document.getElementById('loginBtn')?.addEventListener('click', () => {
    if (isLoggedIn) logout();
    else openLoginModal();
  });
  document.getElementById('closeLoginModalBtn')?.addEventListener('click', closeLoginModal);
  document.getElementById('loginModalBackdrop')?.addEventListener('click', closeLoginModal);
  document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    login(username, password);
  });

  // --- Change Password (handled in settings page) ---

  // --- Refresh button ---
  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    const icon = document.getElementById('refreshIcon');
    btn.disabled = true;
    icon.classList.add('animate-spin');
    showLoadingToast('🔄 Refreshing dashboard...');
    try {
      await Promise.all([loadSharedState(), autoSyncFromStoredApi()]);
      orders = loadOrders();
      users = loadUsers();
      importedHeaders = loadImportedHeaders();
      displayConfig = loadDisplayConfig();
      render();
      if (selectedId && orders.some(o => o.id === selectedId)) renderDrawer(selectedId);
      else if (selectedId) closeDrawer();
      hideLoadingToast();
      toast('✅ Dashboard refreshed successfully.', 'success');
    } catch (err) {
      hideLoadingToast();
      toast('❌ Refresh failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      icon.classList.remove('animate-spin');
    }
  });

  // --- Section page back ---
  document.getElementById('sectionBackBtn')?.addEventListener('click', () => {
    document.getElementById('sectionPage').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    window.location.hash = '#dashboard';
  });

  // --- Section refresh ---
  document.getElementById('sectionRefreshBtn')?.addEventListener('click', () => {
    orders = loadOrders();
    render();
    const p = document.getElementById('sectionPageTitle').textContent;
    const map = {
      'All Work Orders': 'all-orders',
      'Calendar': 'calendar',
      'Reports': 'reports',
      'Analytics': 'analytics',
      'Activity Log': 'activity',
      'Users': 'users',
      'Settings': 'settings',
    };
    if (map[p]) navigateTo(map[p]);
    toast('Section refreshed.', 'success');
  });

  // --- Drawer buttons ---
  document.getElementById('closeDrawerBtn')?.addEventListener('click', closeDrawer);
  document.getElementById('drawerCloseBottomBtn')?.addEventListener('click', closeDrawer);
  document.getElementById('drawerBackdrop')?.addEventListener('click', closeDrawer);
  document.getElementById('drawerEditBtn')?.addEventListener('click', () => {
    if (selectedId) openEdit(selectedId);
  });
  document.getElementById('drawerDuplicateBtn')?.addEventListener('click', duplicateSelected);
  document.getElementById('drawerDeleteBtn')?.addEventListener('click', deleteSelected);

  // --- Edit modal ---
  document.getElementById('editForm')?.addEventListener('submit', saveForm);
  document.getElementById('deleteFromEditBtn')?.addEventListener('click', deleteFromEdit);
  document.getElementById('addEditCustomFieldBtn')?.addEventListener('click', () => {
    if (!requireLogin()) return;
    const o = orders.find(x => x.id === editingId);
    if (!o) return;
    if (!Array.isArray(o.customFields)) o.customFields = [];
    const emptyField = o.customFields.find(f => !f.label && !f.value && !f._sourceHeader);
    if (emptyField) {
      toast('There is already an empty field. Fill it or remove it first.', 'info');
      setTimeout(() => {
        const wrap = document.getElementById('editCustomFields');
        const inputs = wrap?.querySelectorAll('.edit-field-label');
        if (inputs) {
          for (const inp of inputs) {
            if (!inp.value.trim()) {
              inp.focus();
              break;
            }
          }
        }
      }, 50);
      return;
    }
    o.customFields.push({ label: '', value: '', _sourceHeader: '' });
    saveOrders();
    renderEditCustomFields(o);
    toast('New field added. Fill in the details.', 'info');
    setTimeout(() => {
      const wrap = document.getElementById('editCustomFields');
      const inputs = wrap?.querySelectorAll('.edit-field-label');
      if (inputs && inputs.length) inputs[inputs.length - 1].focus();
    }, 50);
  });
  document.getElementById('closeEditModalBtn')?.addEventListener('click', closeEdit);
  document.getElementById('cancelEditBtn')?.addEventListener('click', closeEdit);
  document.getElementById('editModalBackdrop')?.addEventListener('click', closeEdit);

  // --- Status modal ---
  document.getElementById('closeStatusModalBtn')?.addEventListener('click', closeStatusModal);
  document.getElementById('cancelStatusBtn')?.addEventListener('click', closeStatusModal);
  document.getElementById('statusModalBackdrop')?.addEventListener('click', closeStatusModal);
  document.getElementById('confirmStatusBtn')?.addEventListener('click', confirmStatus);

  // --- Confirmation modal ---
  document.getElementById('closeConfirmModalBtn')?.addEventListener('click', closeConfirmationModal);
  document.getElementById('cancelConfirmBtn')?.addEventListener('click', closeConfirmationModal);
  document.getElementById('confirmModalBackdrop')?.addEventListener('click', closeConfirmationModal);
  document.getElementById('confirmModalConfirmBtn')?.addEventListener('click', () => {
    if (typeof pendingConfirmation === 'function') {
      pendingConfirmation();
    } else {
      closeConfirmationModal();
    }
  });

  // --- Image preview ---
  document.getElementById('closeImagePreviewModalBtn')?.addEventListener('click', closeImagePreviewModal);
  document.getElementById('imagePreviewModalBackdrop')?.addEventListener('click', closeImagePreviewModal);
  document.getElementById('zoomInImagePreviewBtn')?.addEventListener('click', () => setImagePreviewZoom(imagePreviewZoom + 0.2));
  document.getElementById('zoomOutImagePreviewBtn')?.addEventListener('click', () => setImagePreviewZoom(imagePreviewZoom - 0.2));
  document.getElementById('resetImagePreviewZoomBtn')?.addEventListener('click', resetImagePreviewZoom);

  // --- Import modal buttons ---
  document.getElementById('closeImportModalBtn')?.addEventListener('click', closeImportModal);
  document.getElementById('closeImportBottomBtn')?.addEventListener('click', closeImportModal);
  document.getElementById('importModalBackdrop')?.addEventListener('click', closeImportModal);
  document.getElementById('importClearBtn')?.addEventListener('click', () => {
    resetImportCenter();
    clearMappingConfig();
    closeImportModal();
    toast('Import cleared.', 'info');
  });
  document.getElementById('clearOrdersBtn')?.addEventListener('click', clearAllOrders);
  document.getElementById('clearEverythingBtn')?.addEventListener('click', clearAllAndStopSync);
  document.getElementById('confirmImportBtn')?.addEventListener('click', applyImport);
  document.getElementById('importDropzone')?.addEventListener('click', () => document.getElementById('importFileInput').click());
  document.getElementById('importFileInput')?.addEventListener('change', (e) => handleImportFile(e.target.files[0]));
  document.getElementById('importReadApiBtn')?.addEventListener('click', handleImportApi);
  document.getElementById('importReadPasteBtn')?.addEventListener('click', () => {
    const parsed = parseDelimited(document.getElementById('importPasteData').value);
    if (!parsed.headers.length || !parsed.rows.length) {
      toast('No readable rows found in the pasted data.', 'error');
      return;
    }
    showImportData(parsed.headers, parsed.rows, 'pasted data');
    toast('Pasted data loaded successfully. Review the mapping and confirm import.', 'success');
  });

  // --- Drag and drop for import dropzone ---
  const dz = document.getElementById('importDropzone');
  if (dz) {
    ['dragenter','dragover'].forEach(evt => dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.add('drag');
    }));
    ['dragleave','drop'].forEach(evt => dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.remove('drag');
    }));
    dz.addEventListener('drop', (e) => handleImportFile(e.dataTransfer.files[0]));
  }

  // --- Search and filters ---
  ['searchInput', 'statusFilter', 'priorityFilter', 'sortSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener(id === 'searchInput' ? 'input' : 'change', () => {
        currentPage = 1;
        render();
      });
    }
  });
  document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    initializeDashboardFilters();
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('priorityFilter').value = 'all';
    document.getElementById('sortSelect').value = 'created_desc';
    currentPage = 1;
    render();
  });

  // --- Pagination ---
  document.getElementById('prevPageBtn')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  document.getElementById('nextPageBtn')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(getFilteredOrders().length / 200));
    if (currentPage < totalPages) { currentPage++; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close modals in order of priority – we rely on the existing handler in index.html
      // We'll keep the original handler from index.html – we can override if needed.
    }
  });

  // --- Login modal enter key ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !document.getElementById('loginModal').classList.contains('hidden')) {
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      e.preventDefault();
      login(username, password);
    }
  });
}

// ---------- Start the app ----------
initApp();

// Export key functions for use in other modules
export { isLoggedIn, storedPassword, openLoginModal, closeLoginModal, login, logout, requireLogin };