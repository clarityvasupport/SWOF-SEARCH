// =========================================================
// APP – entry point (v1.3.3 – added Change Password modal)
// =========================================================

import {
  orders,
  undoHistory,
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
  saveUndoHistory,
  saveUsers,
  saveDisplayConfig,
  saveImportedHeaders,
  pushHistory,
  isOnline,
  loadApiUrl,
  getStoredPassword,
  setStoredPassword,
  clearMappingConfig,
} from './data.js';

import {
  render,
  getFilteredOrders,
  changeStatusDirect,
  undoLast,
  duplicateSelected,
  deleteSelected,
  newOrder,
  currentPage as page,
  setCurrentPage,
  updateUndoButtons,
  toggleEditability,
  initializeDashboardFilters,
} from './render.js';

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
  renderEditCustomFields,
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
  imagePreviewTranslate,
  openImagePreviewModal,
  applyImagePreviewTransform,
  showPreviewItem,
  initCollapsibleFilter,
} from './utils.js';

import {
  makeMappedOrder,
  showImportData,
  resetImportCenter,
  applyImport,
} from './importHelpers.js';

import { render as renderAllOrders } from './pages/allOrders.js';
import { render as renderCalendar } from './pages/calendar.js';
import { render as renderReports } from './pages/reports.js';
import { render as renderAnalytics } from './pages/analyticsPage.js';
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

import { initRouter, navigateTo } from './router.js';

// ---------- Global state ----------
let isLoggedIn = false;
let storedPassword = 'password';
window.isLoggedIn = isLoggedIn;
window.toast = toast;
window.requireLogin = requireLogin;

// ---------- Login functions ----------
function openLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  document.getElementById('loginError').classList.add('hidden');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  setTimeout(() => document.getElementById('loginUsername').focus(), 100);
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function login(username, password) {
  const validPassword = storedPassword || 'password';
  if (username === 'admin' && password === validPassword) {
    isLoggedIn = true;
    window.isLoggedIn = true;
    closeLoginModal();
    updateLoginUI();
    render();
    const sectionPage = document.getElementById('sectionPage');
    if (!sectionPage.classList.contains('hidden')) {
      const title = document.getElementById('sectionPageTitle');
      if (title && title.textContent === 'Settings') {
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

function logout() {
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
        if (title && title.textContent === 'Settings') renderSettings();
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

// ---------- Change Password functions ----------
function openChangePasswordModal() {
  // Reset form state
  const modal = document.getElementById('changePasswordModal');
  if (!modal) return;
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmNewPassword').value = '';
  document.getElementById('changePasswordError').classList.add('hidden');
  document.getElementById('changePasswordSuccess').classList.add('hidden');
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  setTimeout(() => document.getElementById('currentPassword').focus(), 100);
}

function closeChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');
  if (modal) modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function handleChangePassword(e) {
  e.preventDefault();
  const current = document.getElementById('currentPassword').value.trim();
  const newPass = document.getElementById('newPassword').value.trim();
  const confirm = document.getElementById('confirmNewPassword').value.trim();

  const errorEl = document.getElementById('changePasswordError');
  const successEl = document.getElementById('changePasswordSuccess');
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  // Validate current password
  if (current !== storedPassword) {
    errorEl.textContent = 'Current password is incorrect.';
    errorEl.classList.remove('hidden');
    return;
  }

  if (newPass.length < 4) {
    errorEl.textContent = 'New password must be at least 4 characters.';
    errorEl.classList.remove('hidden');
    return;
  }

  if (newPass !== confirm) {
    errorEl.textContent = 'New passwords do not match.';
    errorEl.classList.remove('hidden');
    return;
  }

  // Update password
  storedPassword = newPass;
  setStoredPassword(newPass);

  // Sync to cloud (KV) – update the password in the shared state
  // We need to push the updated password to KV.
  // syncSharedStorage() will send the current state including the new password.
  // However, syncSharedStorage() relies on the global `orders` etc.
  // We can call it directly, but we also need to ensure the password is included in the payload.
  // The password is stored in `storedPassword` and `setStoredPassword` updates the internal variable.
  // The `syncSharedStorage` function reads `storedPassword` via getStoredPassword().
  // But we need to make sure that `syncSharedStorage` actually sends it.
  // In data.js, syncSharedStorage builds payload with `password: storedPassword || 'password'`.
  // Since we updated `storedPassword` and called `setStoredPassword`, it's already reflected.
  // We'll call syncSharedStorage to push to KV.
  syncSharedStorage();

  // Show success and close after short delay
  successEl.textContent = 'Password updated successfully!';
  successEl.classList.remove('hidden');
  toast('✅ Password changed successfully.', 'success');

  setTimeout(() => {
    closeChangePasswordModal();
  }, 1500);
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

document.getElementById('drawerStatusSelect').addEventListener('change', function(e) {
  if (!requireLogin()) {
    const o = orders.find(x => x.id === selectedId);
    if (o) e.target.value = o.status;
    return;
  }
});

// ---------- Auto-sync ----------
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
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { Accept: 'application/json, text/csv, text/plain, */*' },
    });
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
    orders.length = 0;
    orders.push(...newOrders);
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

// ---------- Init ----------
async function initApp() {
  // === FIX: define setActiveNav on window BEFORE router init ===
  window.setActiveNav = setActiveNav;

  // ------------------------------------------------------------------
  // NEW: CLOUD-FIRST initialisation
  // ------------------------------------------------------------------
  // 1. Attempt to load from KV (cloud) – falls back to localStorage if needed
  await loadSharedState();

  // 2. Ensure displayConfig has defaults
  if (displayConfig.sidebarPinned === undefined) {
    displayConfig.sidebarPinned = false;
    saveDisplayConfig();
  }

  // 3. Render the dashboard with the loaded data (cloud or local)
  render();

  // 4. Update password from stored (cloud or local)
  storedPassword = getStoredPassword();

  // 5. If logged in, update UI
  if (isLoggedIn) updateLoginUI();

  // 6. Auto-sync from API endpoint (if configured) – this runs separately
  autoSyncFromStoredApi();

  // 7. Initialize router and event listeners
  initRouter();
  attachEventListeners();

  // Expose globals
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
  window.renderEditCustomFields = renderEditCustomFields;
  window.openImagePreviewModal = openImagePreviewModal;
  window.setImagePreviewZoom = setImagePreviewZoom;
  window.resetImagePreviewZoom = resetImagePreviewZoom;
  // Change Password functions
  window.openChangePasswordModal = openChangePasswordModal;
  window.closeChangePasswordModal = closeChangePasswordModal;
}

// ---------- Event listeners ----------
function attachEventListeners() {
  // --- Sidebar auto-close toggle with pin rotation ---
  const sidebar = document.getElementById('sidebarNav');
  const toggleBtn = document.getElementById('toggleAutoCloseBtn');
  const pinIcon = document.getElementById('pinIcon');

  function updateSidebarPinState(pinned) {
    if (!pinIcon) return;
    if (pinned) {
      pinIcon.innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v6m0 0l-3-3m3 3l3-3M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v2m0 14v2" />
      `;
      pinIcon.setAttribute('data-pinned', 'true');
      pinIcon.classList.add('pin-rotated');
    } else {
      pinIcon.innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v6m0 0l-3-3m3 3l3-3M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
      `;
      pinIcon.setAttribute('data-pinned', 'false');
      pinIcon.classList.remove('pin-rotated');
    }
    if (sidebar) {
      sidebar.dataset.pinned = pinned ? 'true' : 'false';
    }
  }

  const pinned = displayConfig.sidebarPinned || false;
  updateSidebarPinState(pinned);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const newPinned = !displayConfig.sidebarPinned;
      displayConfig.sidebarPinned = newPinned;
      saveDisplayConfig();
      updateSidebarPinState(newPinned);
      toast(newPinned ? 'Sidebar pinned – will not auto-close.' : 'Sidebar unpinned – will auto-close on outside tap.', 'info');
    });
  }

  // --- Close sidebar on outside click (if not pinned) ---
  const hamburger = document.getElementById('hamburgerBtn');

  document.addEventListener('click', function(e) {
    if (!sidebar || !hamburger) return;
    if (displayConfig.sidebarPinned) return;
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target) || hamburger.contains(e.target)) return;
    sidebar.classList.remove('open');
  });

  // Hamburger toggles open/close
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    hamburger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sidebar.classList.toggle('open');
      }
    });
  }

  // Admin toggle
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
    // Default to collapsed (true) if no preference is saved
    if (saved === null || saved === 'true') {
      adminNav.classList.add('collapsed');
      adminArrow.classList.add('rotated');
      if (saved === null) {
        localStorage.setItem('adminCollapsed', 'true');
      }
    }
  }

  // Navigation
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const page = this.dataset.nav;
      if (page === 'import') {
        openImportModal();
        setActiveNav('import');
        return;
      }
      navigateTo(page);
      setActiveNav(page);
    });
  });

  // Undo
  document.getElementById('dashboardUndoBtn')?.addEventListener('click', undoLast);
  document.getElementById('mobileUndoBtn')?.addEventListener('click', undoLast);
  document.getElementById('drawerUndoBtn')?.addEventListener('click', undoLast);
  document.getElementById('modalUndoBtn')?.addEventListener('click', undoLast);

  // New order
  document.getElementById('newOrderBtn')?.addEventListener('click', () => {
    navigateTo('dashboard');
    newOrder();
  });

  // Import
  document.getElementById('importTopBtn')?.addEventListener('click', openImportModal);
  document.getElementById('openImportModalBtn')?.addEventListener('click', openImportModal);
  document.getElementById('importSideBtn')?.addEventListener('click', openImportModal);

  // Login
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

  // ---- Change Password modal events ----
  document.getElementById('closeChangePasswordModalBtn')?.addEventListener('click', closeChangePasswordModal);
  document.getElementById('changePasswordModalBackdrop')?.addEventListener('click', closeChangePasswordModal);
  document.getElementById('changePasswordForm')?.addEventListener('submit', handleChangePassword);

  // Refresh
  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    const icon = document.getElementById('refreshIcon');
    btn.disabled = true;
    icon.classList.add('animate-spin');
    showLoadingToast('🔄 Refreshing dashboard...');
    try {
      await loadSharedState();
      await autoSyncFromStoredApi();
      const freshOrders = loadOrders();
      orders.length = 0;
      orders.push(...freshOrders);
      const freshUsers = loadUsers();
      users.length = 0;
      users.push(...freshUsers);
      const freshHeaders = loadImportedHeaders();
      importedHeaders.length = 0;
      importedHeaders.push(...freshHeaders);
      const freshConfig = loadDisplayConfig();
      Object.assign(displayConfig, freshConfig);
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

  // Section back
  document.getElementById('sectionBackBtn')?.addEventListener('click', () => {
    document.getElementById('sectionPage').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    window.location.hash = '#dashboard';
    setActiveNav('dashboard');
  });

  // Section refresh
  document.getElementById('sectionRefreshBtn')?.addEventListener('click', () => {
    const freshOrders = loadOrders();
    orders.length = 0;
    orders.push(...freshOrders);
    render();
    const p = document.getElementById('sectionPageTitle').textContent;
    const map = {
      'All Work Orders': 'orders',
      Calendar: 'calendar',
      Reports: 'reports',
      Analytics: 'analytics',
      'Activity Log': 'activity',
      Users: 'users',
      Settings: 'settings',
    };
    if (map[p]) navigateTo(map[p]);
    toast('Section refreshed.', 'success');
  });

  // Drawer
  document.getElementById('closeDrawerBtn')?.addEventListener('click', closeDrawer);
  document.getElementById('drawerCloseBottomBtn')?.addEventListener('click', closeDrawer);
  document.getElementById('drawerBackdrop')?.addEventListener('click', closeDrawer);
  document.getElementById('drawerEditBtn')?.addEventListener('click', () => {
    if (selectedId) openEdit(selectedId);
  });
  document.getElementById('drawerDuplicateBtn')?.addEventListener('click', duplicateSelected);
  document.getElementById('drawerDeleteBtn')?.addEventListener('click', deleteSelected);

  // Edit modal
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

  // Status modal
  document.getElementById('closeStatusModalBtn')?.addEventListener('click', closeStatusModal);
  document.getElementById('cancelStatusBtn')?.addEventListener('click', closeStatusModal);
  document.getElementById('statusModalBackdrop')?.addEventListener('click', closeStatusModal);
  document.getElementById('confirmStatusBtn')?.addEventListener('click', confirmStatus);

  // Confirmation modal
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

  // Image preview buttons
  document.getElementById('closeImagePreviewModalBtn')?.addEventListener('click', closeImagePreviewModal);
  document.getElementById('imagePreviewModalBackdrop')?.addEventListener('click', closeImagePreviewModal);

  // ---- Zoom slider ----
  const zoomSlider = document.getElementById('imagePreviewZoomSlider');
  if (zoomSlider) {
    zoomSlider.addEventListener('input', function() {
      const val = parseFloat(this.value);
      setImagePreviewZoom(val);
    });
  }

  // ---- Zoom buttons (sync with slider) ----
  document.getElementById('zoomInImagePreviewBtn')?.addEventListener('click', () => {
    const newZoom = Math.min(imagePreviewZoom + 0.2, 4);
    setImagePreviewZoom(newZoom);
    if (zoomSlider) zoomSlider.value = newZoom;
  });

  document.getElementById('zoomOutImagePreviewBtn')?.addEventListener('click', () => {
    const newZoom = Math.max(imagePreviewZoom - 0.2, 1);
    setImagePreviewZoom(newZoom);
    if (zoomSlider) zoomSlider.value = newZoom;
  });

  document.getElementById('resetImagePreviewZoomBtn')?.addEventListener('click', () => {
    resetImagePreviewZoom();
    if (zoomSlider) zoomSlider.value = 1;
  });

  // ---- Image preview modal navigation ----
  document.getElementById('imagePreviewPrevBtn')?.addEventListener('click', () => {
    const current = window._previewCurrentIndex || 0;
    const prev = current - 1;
    if (prev >= 0) showPreviewItem(prev);
  });

  document.getElementById('imagePreviewNextBtn')?.addEventListener('click', () => {
    const current = window._previewCurrentIndex || 0;
    const next = current + 1;
    const items = window._previewItems || [];
    if (next < items.length) showPreviewItem(next);
  });

  // ---- Pointer events for panning ----
  const imagePreviewViewport = document.getElementById('imagePreviewModalViewport');
  let dragStart = null;

  if (imagePreviewViewport) {
    imagePreviewViewport.addEventListener('pointerdown', (event) => {
      if (imagePreviewZoom <= 1) return;
      event.preventDefault();
      dragStart = {
        startX: event.clientX,
        startY: event.clientY,
        originX: imagePreviewTranslate.x,
        originY: imagePreviewTranslate.y,
      };
      imagePreviewViewport.setPointerCapture(event.pointerId);
    });

    imagePreviewViewport.addEventListener('pointermove', (event) => {
      if (!dragStart || imagePreviewZoom <= 1) return;
      event.preventDefault();
      const deltaX = event.clientX - dragStart.startX;
      const deltaY = event.clientY - dragStart.startY;
      imagePreviewTranslate.x = dragStart.originX + deltaX;
      imagePreviewTranslate.y = dragStart.originY + deltaY;
      applyImagePreviewTransform();
    });

    imagePreviewViewport.addEventListener('pointerup', () => {
      dragStart = null;
    });

    imagePreviewViewport.addEventListener('pointerleave', () => {
      dragStart = null;
    });

    // ---- Collapsible filter bar on mobile ----
    const filterBar = document.querySelector('.filter-bar-collapsible');
    if (filterBar) {
      initCollapsibleFilter(filterBar, {
        toggleLabel: 'Search & Filter',
        toggleIcon: `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-width="2" stroke-linecap="round" d="M21 21l-4.5-4.5M16 10.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z" />
          </svg>
        `
      });
    }
  }

  // ---- Auto-refresh drawer when file detection completes ----
  document.addEventListener('drive-detection-complete', (e) => {
    const { orderId } = e.detail;
    if (selectedId === orderId) {
      renderDrawer(selectedId);
    }
  });

  // ---- Image / PDF preview click handlers ----
  document.addEventListener('click', (event) => {
    let trigger = event.target.closest('[data-image-preview]');
    if (trigger) {
      event.preventDefault();
      const url = trigger.dataset.imagePreview;
      const alt = trigger.dataset.imageAlt || 'Attachment preview';
      openImagePreviewModal(url, alt);
      return;
    }
    trigger = event.target.closest('[data-image-gallery]');
    if (trigger) {
      event.preventDefault();
      const gallery = trigger.dataset.imageGallery;
      const alt = trigger.dataset.imageAlt || 'Attachment preview';
      openImagePreviewModal(gallery, alt);
      return;
    }
    trigger = event.target.closest('[data-pdf-preview]');
    if (trigger) {
      event.preventDefault();
      const url = trigger.dataset.pdfPreview;
      const alt = trigger.dataset.imageAlt || 'PDF Preview';
      openImagePreviewModal(url, alt, true);
      return;
    }
    trigger = event.target.closest('[data-pdf-gallery]');
    if (trigger) {
      event.preventDefault();
      const gallery = trigger.dataset.pdfGallery;
      const alt = trigger.dataset.imageAlt || 'PDF Preview';
      openImagePreviewModal(gallery, alt, true);
      return;
    }
  });

  // Import modal
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

  // Dropzone
  const dz = document.getElementById('importDropzone');
  if (dz) {
    ['dragenter', 'dragover'].forEach(evt =>
      dz.addEventListener(evt, (e) => {
        e.preventDefault();
        dz.classList.add('drag');
      })
    );
    ['dragleave', 'drop'].forEach(evt =>
      dz.addEventListener(evt, (e) => {
        e.preventDefault();
        dz.classList.remove('drag');
      })
    );
    dz.addEventListener('drop', (e) => handleImportFile(e.dataTransfer.files[0]));
  }

  // Search & filters
  ['searchInput', 'statusFilter', 'priorityFilter', 'sortSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener(id === 'searchInput' ? 'input' : 'change', () => {
        setCurrentPage(1);
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
    setCurrentPage(1);
    render();
  });

  // Pagination
  document.getElementById('prevPageBtn')?.addEventListener('click', () => {
    if (page > 1) {
      setCurrentPage(page - 1);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.getElementById('nextPageBtn')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(getFilteredOrders().length / 200));
    if (page < totalPages) {
      setCurrentPage(page + 1);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // ---- Keyboard shortcuts for modals ----
  document.addEventListener('keydown', (e) => {
    const key = e.key;
    
    // ---- 1. Escape key: close topmost modal ----
    if (key === 'Escape') {
      // Change Password modal (z-95)
      const changePasswordModal = document.getElementById('changePasswordModal');
      if (!changePasswordModal.classList.contains('hidden')) {
        e.preventDefault();
        if (typeof window.closeChangePasswordModal === 'function') window.closeChangePasswordModal();
        return;
      }
      
      // Login modal (z-90)
      const loginModal = document.getElementById('loginModal');
      if (!loginModal.classList.contains('hidden')) {
        e.preventDefault();
        closeLoginModal();
        return;
      }
      
      // Image Preview modal (z-80)
      const imageModal = document.getElementById('imagePreviewModal');
      if (!imageModal.classList.contains('hidden')) {
        e.preventDefault();
        closeImagePreviewModal();
        return;
      }
      
      // Confirmation modal (z-75)
      const confirmModal = document.getElementById('confirmModal');
      if (!confirmModal.classList.contains('hidden')) {
        e.preventDefault();
        closeConfirmationModal();
        return;
      }
      
      // Import modal (z-70)
      const importModal = document.getElementById('importModal');
      if (!importModal.classList.contains('hidden')) {
        e.preventDefault();
        closeImportModal();
        return;
      }
      
      // Status modal (z-65)
      const statusModal = document.getElementById('statusModal');
      if (!statusModal.classList.contains('hidden')) {
        e.preventDefault();
        closeStatusModal();
        return;
      }
      
      // Edit modal (z-60)
      const editModal = document.getElementById('editModal');
      if (!editModal.classList.contains('hidden')) {
        e.preventDefault();
        closeEdit();
        return;
      }
      
      // Drawer (z-50)
      if (selectedId) {
        e.preventDefault();
        closeDrawer();
        return;
      }
      
      // Section page (z-35)
      const sectionPage = document.getElementById('sectionPage');
      if (!sectionPage.classList.contains('hidden')) {
        e.preventDefault();
        sectionPage.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        window.location.hash = '#dashboard';
        setActiveNav('dashboard');
        return;
      }
    }
    
    // ---- 2. Arrow keys: navigate image preview ----
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const imageModal = document.getElementById('imagePreviewModal');
      if (imageModal.classList.contains('hidden')) return;
      e.preventDefault();
      
      const items = window._previewItems || [];
      const currentIndex = window._previewCurrentIndex || 0;
      
      if (key === 'ArrowLeft') {
        const prev = currentIndex - 1;
        if (prev >= 0 && prev < items.length) {
          showPreviewItem(prev);
        }
      } else if (key === 'ArrowRight') {
        const next = currentIndex + 1;
        if (next < items.length) {
          showPreviewItem(next);
        }
      }
    }
  });

  // Login enter
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !document.getElementById('loginModal').classList.contains('hidden')) {
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      e.preventDefault();
      login(username, password);
    }
  });
}

// ---- Set active nav link ----
function setActiveNav(page) {
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.remove('bg-black/10', 'text-black', 'font-semibold', 'active');
    el.classList.add('text-black/80');
  });

  const target = document.querySelector(`.nav-link[data-nav="${page}"]`) ||
                 document.querySelector(`.nav-link[data-nav-page="${page}"]`);
  if (target) {
    target.classList.add('bg-black/10', 'text-black', 'font-semibold', 'active');
    target.classList.remove('text-black/80');
  }
}

// ---------- Start ----------
initApp();

export {
  isLoggedIn,
  storedPassword,
  openLoginModal,
  closeLoginModal,
  login,
  logout,
  requireLogin,
  setActiveNav,
  openChangePasswordModal,
  closeChangePasswordModal,
};