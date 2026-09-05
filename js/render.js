// =========================================================
// RENDER MODULE – core rendering, pagination, undo, actions
// (v1.3.1 – compact icon‑only filter bar on mobile)
// =========================================================

// ---------- Imports ----------
import {
  orders,
  undoHistory,
  displayConfig,
  users,
  importedHeaders,
  saveOrders,
  saveUndoHistory,
  pushHistory,
  isOnline,
  loadSharedState,
} from './data.js';

import {
  esc,
  normalize,
  formatDate,
  statusClass,
  priorityClass,
  priorityRank,
  nowDate,
  nowStamp,
  isHistoryValid,
  parseDateValue,
  normalizePriority,
  displayValue,
  toast,
} from './utils.js';

import {
  getAllFieldConfigs,
  getAvailableDateFields,
} from './importHelpers.js';

import {
  selectedId,
  openDrawer,
  closeDrawer,
  renderDrawer,
} from './components/Drawer.js';

import {
  openEdit,
  closeEdit,
  editingId,
  deleteFromEdit,
} from './components/EditModal.js';

import {
  openConfirmationModal,
  closeConfirmationModal,
} from './components/ConfirmModal.js';

import {
  openStatusModal,
  closeStatusModal,
} from './components/StatusModal.js';

import { cardHTML } from './components/WorkOrderCard.js';

export { selectedId, editingId };

// ---------- Constants ----------
const PAGE_SIZE = 200;
let currentPage = 1;

// ---------- Helper: get filtered orders ----------
export function getFilteredOrders() {
  const q = normalize(document.getElementById('searchInput')?.value || '');
  const st = document.getElementById('statusFilter')?.value || 'all';
  const pr = document.getElementById('priorityFilter')?.value || 'all';
  const sort = document.getElementById('sortSelect')?.value || 'created_desc';

  let list = orders.filter(o => {
    const hay = normalize([
      o.id, o.title, o.description, o.category, o.location,
      o.assignee, o.requester, o.status, o.priority,
    ].join(' '));
    const matchSearch = !q || hay.includes(q);
    const matchStatus = st === 'all' || o.status === st;
    const matchPriority = pr === 'all' || o.priority === pr;
    return matchSearch && matchStatus && matchPriority;
  });

  const timeOf = v => {
    if (!v) return 0;
    const t = Date.parse(String(v).length <= 10 ? String(v) + 'T00:00:00' : String(v));
    return Number.isNaN(t) ? 0 : t;
  };

  list.sort((a, b) => {
    if (sort === 'created_asc') return timeOf(a.created) - timeOf(b.created);
    if (sort === 'due_asc') return (timeOf(a.dueDate || '9999-12-31') - timeOf(b.dueDate || '9999-12-31'));
    if (sort === 'title_asc') return String(a.title).localeCompare(String(b.title)) || timeOf(b.created) - timeOf(a.created);
    if (sort === 'priority') return priorityRank(a.priority) - priorityRank(b.priority) || timeOf(b.created) - timeOf(a.created);
    if (sort === 'status') return String(a.status).localeCompare(String(b.status)) || timeOf(b.created) - timeOf(a.created);
    return timeOf(b.created) - timeOf(a.created) || (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0);
  });
  return list;
}

// ---------- Main render function ----------
export function render() {
  // Normalize orders in place
  const normalized = orders.filter(Boolean).map((o, i) => ({
    ...o,
    id: String(o.id ?? `WO-${i+1}`).trim() || `WO-${i+1}`,
    title: String(o.title ?? 'Untitled Work Order').trim() || 'Untitled Work Order',
    description: String(o.description ?? '').trim(),
    status: o.status || 'Open',
    priority: normalizePriority(o.priority || 'Medium'),
    category: String(o.category ?? 'General').trim() || 'General',
    location: String(o.location ?? '').trim(),
    assignee: String(o.assignee ?? 'Unassigned').trim() || 'Unassigned',
    requester: String(o.requester ?? '').trim(),
    created: parseDateValue(o.created) || nowDate(),
    dueDate: parseDateValue(o.dueDate),
    activity: Array.isArray(o.activity) ? o.activity : [],
    customFields: Array.isArray(o.customFields) ? o.customFields : [],
    _importHeaders: Array.isArray(o._importHeaders) ? o._importHeaders : [],
    _rawData: o._rawData || {},
  }));

  orders.length = 0;
  orders.push(...normalized);

  initializeDashboardFilters();

  const list = getFilteredOrders();
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);
  const grid = document.getElementById('workOrderGrid');

  let html = '';
  for (const item of pageItems) {
    try { html += cardHTML(item); } catch (err) { console.error(err); }
  }
  grid.innerHTML = html;

  document.getElementById('emptyState').classList.toggle('hidden', list.length !== 0);
  
  // Check which filters are active and build a summary
  const searchVal = document.getElementById('searchInput')?.value?.trim() || '';
  const statusVal = document.getElementById('statusFilter')?.value || 'all';
  const priorityVal = document.getElementById('priorityFilter')?.value || 'all';

  const filterParts = [];
  if (searchVal) filterParts.push(`"${searchVal}"`);
  if (statusVal !== 'all') filterParts.push(`Status: ${statusVal}`);
  if (priorityVal !== 'all') filterParts.push(`Priority: ${priorityVal}`);
  const filterSummary = filterParts.length > 0 ? ` • ${filterParts.join(' • ')}` : '';
  const isFiltered = filterParts.length > 0;

  let resultText;
  if (list.length === 0) {
    resultText = `0 of ${orders.length} work orders${filterSummary}`;
  } else if (isFiltered) {
    resultText = `🔍 ${start+1}–${Math.min(start+PAGE_SIZE, list.length)} of ${list.length} results${filterSummary} • ${orders.length} total work orders`;
  } else {
    resultText = `Showing ${start+1}–${Math.min(start+PAGE_SIZE, list.length)} of ${list.length} work orders • ${orders.length} total`;
  }
  document.getElementById('resultCount').textContent = resultText;

  document.getElementById('pageInfo').textContent = `Page ${currentPage} • ${pageItems.length} of ${list.length}`;
  document.getElementById('prevPageBtn').disabled = currentPage <= 1;
  document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;

  document.getElementById('statTotal').textContent = orders.length;
  document.getElementById('statOpen').textContent = orders.filter(o => o.status === 'Open').length;
  document.getElementById('statProgress').textContent = orders.filter(o => o.status === 'In Progress').length;
  document.getElementById('statCompleted').textContent = orders.filter(o => o.status === 'Completed').length;
  document.getElementById('statOverdue').textContent = orders.filter(o => o.status === 'Overdue').length;

  const statusMap = {};
  orders.forEach(o => { const s = o.status || 'Unknown'; statusMap[s] = (statusMap[s] || 0) + 1; });
  const sortedStatuses = Object.keys(statusMap).sort();
  const summaryList = document.getElementById('statusSummaryList');
  if (summaryList) {
    if (sortedStatuses.length === 0) {
      summaryList.innerHTML = `<div class="flex justify-between"><span class="text-black/60">No orders</span><strong>0</strong></div>`;
    } else {
      summaryList.innerHTML = sortedStatuses.map(s => `
        <div class="flex justify-between items-center gap-2">
          <span class="text-black/60 before:content-[''] before:inline-block before:w-1.5 before:h-1.5 before:bg-black/30 before:rounded-full before:mr-2 truncate text-[10px] max-w-[120px]">${esc(s)}</span>
          <strong class="text-xs flex-shrink-0">${statusMap[s]}</strong>
        </div>
      `).join('');
    }
  }

  document.getElementById('sideTotal').textContent = orders.length;
  document.getElementById('sideUpdated').textContent = 'Just now';
  document.getElementById('bottomResultCount').textContent = list.length
    ? `Showing ${start+1}–${Math.min(start+PAGE_SIZE, list.length)} of ${list.length} work orders`
    : '0 work orders';
  document.getElementById('bottomPageInfo').textContent = `Page ${currentPage} of ${totalPages}`;

  grid.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openDrawer(el.dataset.open)));
  grid.querySelectorAll('[data-status-select]').forEach(el => {
    el.addEventListener('change', function(e) {
      e.stopPropagation();
      changeStatusDirect(this.dataset.statusSelect, this.value);
    });
  });
  grid.querySelectorAll('[data-edit]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openEdit(el.dataset.edit);
    });
  });

  if (!window.isLoggedIn) {
    grid.querySelectorAll('[data-status-select]').forEach(el => {
      el.disabled = true;
      el.classList.add('opacity-50', 'cursor-not-allowed');
    });
  }

  updateUndoButtons();
  toggleEditability();
  updateStorageBadge();

  // =========================================================
  // REFRESH BUTTON – sync from KV
  // =========================================================
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    // Remove old listener to avoid duplicates
    const newRefreshBtn = refreshBtn.cloneNode(true);
    refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
    
    let isSyncing = false;
    newRefreshBtn.addEventListener('click', async function() {
      if (isSyncing) return;
      isSyncing = true;
      const originalText = this.innerHTML;
      this.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-width="1.8" stroke-linecap="round" d="M20 11a8 8 0 0 0-15.3-3M4 5v4h4M4 13a8 8 0 0 0 15.3 3M20 19v-4h-4" />
        </svg>
        <span class="hidden sm:inline">Syncing…</span>
      `;
      this.disabled = true;

      try {
        await loadSharedState();
        render();
        toast('Dashboard synced from cloud.', 'success');
      } catch (err) {
        console.warn('Dashboard sync error:', err);
        toast('Sync failed – using local data.', 'error');
      } finally {
        this.innerHTML = originalText;
        this.disabled = false;
        isSyncing = false;
      }
    });
  }

  // =========================================================
  // MOBILE COMPACT FILTER BAR
  // =========================================================
  initDashboardFilterBar();
}

// ---------- Status change ----------
export function changeStatusDirect(id, newStatus) {
  const o = orders.find(x => x.id === id);
  if (!o || o.status === newStatus) return;
  pushHistory('status change for ' + id);
  const prev = o.status;
  o.status = newStatus;
  o.activity = o.activity || [];
  o.activity.push({ date: nowStamp(), text: `Status changed from ${prev} to ${newStatus}` });
  saveOrders();
  render();
  if (selectedId === id) renderDrawer(id);
  toast(`Status changed to ${newStatus}.`, 'success');
}

// ---------- Undo ----------
export function undoLast() {
  if (!undoHistory.length) return;
  const validHistory = undoHistory.filter(entry => isHistoryValid(entry));
  if (validHistory.length === 0) {
    undoHistory.length = 0;
    saveUndoHistory();
    updateUndoButtons();
    toast('No valid undo actions available (older than 12 hours).', 'info');
    return;
  }
  const last = validHistory.pop();
  undoHistory = validHistory;
  if (!Array.isArray(last?.data)) {
    saveUndoHistory();
    updateUndoButtons();
    toast('Undo is not available for this action.', 'info');
    return;
  }
  orders.length = 0;
  orders.push(...last.data);
  saveOrders();
  saveUndoHistory();
  render();
  if (selectedId) {
    if (orders.some(o => o.id === selectedId)) renderDrawer(selectedId);
    else closeDrawer();
  }
  toast('Undone: ' + last.label, 'success');
  updateUndoButtons();
}

// ---------- Duplicate ----------
export function duplicateSelected() {
  if (!selectedId) return;
  const o = orders.find(x => x.id === selectedId);
  if (!o) return;
  pushHistory('duplicate ' + o.id);
  const copy = structuredClone(o);
  copy.id = nextId();
  copy.title = o.title + ' (Copy)';
  copy.status = 'Open';
  copy.created = nowDate();
  copy.activity = [{ date: nowStamp(), text: `Duplicated from ${o.id}` }];
  orders.unshift(copy);
  saveOrders();
  render();
  openDrawer(copy.id);
  toast(`${copy.id} created from ${o.id}.`, 'success');
}

// ---------- Delete ----------
export function deleteSelected() {
  if (!selectedId) return;
  const o = orders.find(x => x.id === selectedId);
  if (!o) return;
  openConfirmationModal({
    title: 'Delete work order',
    message: `Delete ${o.id} — "${o.title}"? You can use Undo immediately after deletion.`,
    confirmText: 'Delete',
    confirmClass: 'bg-red-600 hover:bg-red-700',
    onConfirm: () => {
      pushHistory('delete ' + o.id);
      const filtered = orders.filter(x => x.id !== selectedId);
      orders.length = 0;
      orders.push(...filtered);
      saveOrders();
      render();
      closeDrawer();
      toast(`🗑️ ${o.id} deleted. Use Undo to restore it.`, 'success');
      closeConfirmationModal();
    },
  });
}

// ---------- New order ----------
function nextId() {
  const nums = orders.map(o => { const m = String(o.id || '').match(/(\d+)$/); return m ? Number(m[1]) : 0; });
  return `WO-${new Date().getFullYear()}-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
}

export function newOrder() {
  const o = {
    id: nextId(),
    title: 'New Work Order',
    description: '',
    status: 'Open',
    priority: 'Medium',
    category: 'General',
    location: '',
    assignee: 'Unassigned',
    requester: '',
    created: nowDate(),
    dueDate: '',
    customFields: [],
    activity: [{ date: nowStamp(), text: 'Work order created' }],
    _importHeaders: importedHeaders.slice(),
    _rawData: {},
  };
  const allConfigs = getAllFieldConfigs();
  const globalCustomKeys = Object.keys(allConfigs).filter(k => k.startsWith('custom_'));
  globalCustomKeys.forEach(k => {
    const cfg = allConfigs[k];
    if (cfg.showOnCard !== false) {
      const label = cfg.label || k;
      const source = cfg.source || '';
      if (!o.customFields.some(f => f.label === label)) {
        o.customFields.push({ label, value: '', _sourceHeader: source });
      }
    }
  });
  pushHistory('before creating ' + o.id);
  orders.unshift(o);
  saveOrders();
  render();
  openEdit(o.id);
}

// ---------- Filter initialisation ----------
function initializeDashboardFilters() {
  const statusEl = document.getElementById('statusFilter');
  const priorityEl = document.getElementById('priorityFilter');
  const sortEl = document.getElementById('sortSelect');

  if (statusEl) {
    const dataStatuses = orders.map(o => o.status).filter(Boolean);
    const uniqueStatuses = Array.from(new Set(dataStatuses)).sort();
    let options = `<option value="all">All Status</option>`;
    uniqueStatuses.forEach(s => {
      options += `<option value="${esc(s)}">${esc(s)}</option>`;
    });
    if (statusEl.innerHTML !== options) {
      statusEl.innerHTML = options;
    }
    const currentVal = statusEl.value;
    if (uniqueStatuses.includes(currentVal) && currentVal !== 'all') {
      statusEl.value = currentVal;
    } else {
      statusEl.value = 'all';
    }
  }

  if (priorityEl && !priorityEl.options.length) {
    priorityEl.innerHTML = `
      <option value="all">All Priority</option>
      <option value="Critical">Critical</option>
      <option value="High">High</option>
      <option value="Medium">Medium</option>
      <option value="Low">Low</option>
    `;
  }

  if (sortEl && !sortEl.options.length) {
    sortEl.innerHTML = `
      <option value="created_desc">Newest Created</option>
      <option value="created_asc">Oldest Created</option>
      <option value="due_asc">Due Soonest</option>
      <option value="title_asc">Title A–Z</option>
      <option value="priority">Priority (High→Low)</option>
      <option value="status">Status (A–Z)</option>
    `;
  }

  if (priorityEl && !priorityEl.value) priorityEl.value = 'all';
  if (sortEl && !sortEl.value) sortEl.value = 'created_desc';
}

// ---------- Undo buttons ----------
function updateUndoButtons() {
  const validCount = undoHistory.filter(entry => isHistoryValid(entry)).length;
  const disabled = validCount === 0;
  ['dashboardUndoBtn', 'mobileUndoBtn', 'drawerUndoBtn', 'modalUndoBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
  const undoCount = document.getElementById('undoCount');
  if (undoCount) undoCount.textContent = validCount > 0 ? `(${validCount})` : '';
}

// ---------- Editability toggle ----------
function toggleEditability() {
  const editActions = [
    'newOrderBtn', 'importTopBtn', 'importSideBtn', 'openImportModalBtn',
    'drawerEditBtn', 'drawerDuplicateBtn', 'drawerDeleteBtn',
    'deleteFromEditBtn', 'addEditCustomFieldBtn', 'clearOrdersBtn',
    'confirmImportBtn', 'settingsReset', 'openChangePasswordBtn',
  ];
  editActions.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (!window.isLoggedIn) {
        el.disabled = true;
        el.classList.add('opacity-50', 'cursor-not-allowed');
      } else {
        el.disabled = false;
        el.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
  });
  document.body.classList.toggle('readonly', !window.isLoggedIn);
}

// ---------- Storage badge ----------
function updateStorageBadge() {
  const badge = document.getElementById('storageBadge');
  const badgeText = document.getElementById('badgeText');
  const dot = badge?.querySelector('.pulse-dot');
  if (!badge || !badgeText) return;
  if (isOnline) {
    badge.className = 'inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-brand-success/20 text-brand-success text-[10px] font-bold';
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-brand-success pulse-dot';
    badgeText.textContent = 'ONLINE';
  } else {
    badge.className = 'inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 text-red-500 text-[10px] font-bold';
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-red-500 pulse-dot';
    badgeText.textContent = 'LOCAL';
  }
}

function setCurrentPage(newPage) {
  currentPage = newPage;
}

// ============================================================
// MOBILE FILTER BAR – compact icon‑only (Dashboard)
// ============================================================

let dashboardExpandedControl = null;

function initDashboardFilterBar() {
  const container = document.getElementById('dashboardFilterBar');
  if (!container) return;
  if (container.dataset.initialized === 'true') return;

  const wrappers = container.querySelectorAll('.filter-control-wrapper');

  wrappers.forEach(wrapper => {
    const iconBtn = wrapper.querySelector('.filter-icon-btn');
    const expandedDiv = wrapper.querySelector('.filter-control-expanded');

    if (!iconBtn || !expandedDiv) return;

    iconBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const controlId = this.dataset.control;

      if (dashboardExpandedControl === controlId) {
        collapseDashboardFilters();
        return;
      }
      expandDashboardFilter(controlId);
    });
  });

  // Click outside to collapse
  document.addEventListener('click', function(e) {
    if (!container.contains(e.target)) {
      collapseDashboardFilters();
    }
  });

  // Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      collapseDashboardFilters();
    }
  });

  // Resize: if screen becomes large, collapse all
  const mediaQuery = window.matchMedia('(min-width: 640px)');
  mediaQuery.addEventListener('change', (mq) => {
    if (mq.matches) {
      collapseDashboardFilters();
    }
  });

  container.dataset.initialized = 'true';
}

function expandDashboardFilter(controlId) {
  collapseDashboardFilters();
  const wrapper = document.querySelector(`#dashboardFilterBar .filter-control-wrapper[data-control="${controlId}"]`);
  if (!wrapper) return;
  const expandedDiv = wrapper.querySelector('.filter-control-expanded');
  if (!expandedDiv) return;
  expandedDiv.classList.remove('hidden');
  dashboardExpandedControl = controlId;
  const input = expandedDiv.querySelector('input, select, textarea');
  if (input) setTimeout(() => input.focus(), 100);
}

function collapseDashboardFilters() {
  document.querySelectorAll('#dashboardFilterBar .filter-control-expanded').forEach(el => {
    el.classList.add('hidden');
  });
  dashboardExpandedControl = null;
}

// ---------- Exports ----------
export { setCurrentPage, currentPage, updateUndoButtons, toggleEditability, initializeDashboardFilters };