// =========================================================
// ALL WORK ORDERS – table view with compact icon‑only filter bar (mobile)
// (v1.3.12 – fixed filter bar text and rendering reliability)
// =========================================================

import { orders, displayConfig, saveDisplayConfig, loadOrders, loadSharedState } from '../data.js';
import { esc, normalize, parseDateValue, formatDate, statusClass, getPriorityColor, getAssigneeColor, displayValue, toast } from '../utils.js';
import { getAllFieldConfigs, getAvailableDateFields } from '../importHelpers.js';
import { openDrawer } from '../components/Drawer.js';
import { attachRangeDatePicker } from '../components/DatePicker.js';

let datePickerInstance = null;
let expandedControlId = null;

// ---- Export a wrapper that ensures the DOM is ready ----
export function render() {
  console.log('[allOrders] render() called');
  // Try immediately, then retry if needed.
  if (tryRenderNow()) return;
  console.log('[allOrders] container not found, starting retry loop');
  let attempts = 0;
  const maxAttempts = 30;
  function tryRender() {
    attempts++;
    console.log(`[allOrders] attempt ${attempts}/${maxAttempts}`);
    if (tryRenderNow()) return;
    if (attempts >= maxAttempts) {
      console.error('[allOrders] failed to find #sectionPageBody after', maxAttempts, 'attempts');
      return;
    }
    setTimeout(tryRender, 100);
  }
  setTimeout(tryRender, 50);
}

function tryRenderNow() {
  const container = document.getElementById('sectionPageBody');
  if (container) {
    console.log('[allOrders] container found, rendering immediately');
    _doRender();
    return true;
  }
  return false;
}

// ---- The actual rendering logic ----
function _doRender() {
  console.log('[allOrders] _doRender() started');

  // Ensure section page exists and is visible
  let sectionPage = document.getElementById('sectionPage');
  if (!sectionPage) {
    console.warn('[allOrders] #sectionPage missing – creating it');
    sectionPage = document.createElement('div');
    sectionPage.id = 'sectionPage';
    sectionPage.className = 'fixed left-0 xl:left-[182px] right-0 top-[64px] bottom-0 z-[35] bg-brand-dark text-white overflow-y-auto';
    sectionPage.innerHTML = `
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
    document.body.appendChild(sectionPage);
  }

  // Force visibility
  sectionPage.classList.remove('hidden');
  sectionPage.style.display = 'block';
  sectionPage.style.zIndex = '35';
  sectionPage.style.opacity = '1';
  sectionPage.style.overflowY = 'auto';
  sectionPage.scrollTop = 0;

  // Now get container
  const container = document.getElementById('sectionPageBody');
  if (!container) {
    console.error('[allOrders] container still missing after ensuring section page – aborting');
    return;
  }

  // Destroy any existing picker instance
  if (datePickerInstance) {
    datePickerInstance.destroy();
    datePickerInstance = null;
  }

  // ---- Build fieldConfigs with custom field order ----
  const allConfigs = getAllFieldConfigs();
  const customOrder = displayConfig.customFieldOrder || [];
  const coreKeys = Object.keys(allConfigs).filter(k => !k.startsWith('custom_'));
  const customKeys = Object.keys(allConfigs).filter(k => k.startsWith('custom_'));
  // Sort custom keys by the user-defined order
  const sortedCustomKeys = [...customKeys].sort((a, b) => {
    const idxA = customOrder.indexOf(a);
    const idxB = customOrder.indexOf(b);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
  const orderedKeys = [...coreKeys, ...sortedCustomKeys];
  const fieldConfigs = {};
  orderedKeys.forEach(key => {
    fieldConfigs[key] = allConfigs[key];
  });
  // Now fieldConfigs contains all fields with custom fields in the correct order

  // Build filter dropdowns
  const statuses = [...new Set(orders.map(o => o.status).filter(Boolean))].sort();
  const statusOpts = statuses.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

  const assignees = [...new Set(orders.map(o => o.assignee).filter(a => a && a !== "Unassigned"))];
  const assigneeOpts = assignees.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');

  const tableColumns = Object.keys(fieldConfigs).filter(key => fieldConfigs[key].showInTable !== false);
  const dateFieldOptions = getAvailableDateFields();
  let dateDropdownHTML = "";
  if (dateFieldOptions.length === 0) {
    dateDropdownHTML += `<option value="created">Created Date</option>`;
  } else {
    dateFieldOptions.forEach(f => {
      dateDropdownHTML += `<option value="${esc(f.value)}">${esc(f.label)}</option>`;
    });
  }

  // Table headers with persistent widths
  let headersHTML = "";
  tableColumns.forEach((key) => {
    const cfg = fieldConfigs[key];
    const storedWidth = displayConfig.columnWidths?.[key];
    const widthStyle = storedWidth ? `width:${storedWidth}px;min-width:${storedWidth}px;` : 'min-width:80px;';
    headersHTML += `<th class="px-4 py-3 text-left text-black/70 font-semibold" data-field-key="${esc(key)}" style="${widthStyle}">${esc(cfg.label || key)}</th>`;
  });

  const isMobile = window.innerWidth < 640;

  // ---- Build filter bar ----
  let filterBarHTML;

  if (isMobile) {
    filterBarHTML = `
      <div class="filter-bar-compact flex flex-nowrap items-center justify-around gap-1 p-1 w-full" id="filterBarCompact">
        <!-- Search -->
        <div class="filter-control-wrapper flex-1 flex justify-center" data-control="search">
          <button class="filter-icon-btn w-9 h-9 rounded-lg hover:bg-black/10 flex items-center justify-center transition" data-control="search" title="Search">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" stroke-linecap="round" d="M21 21l-4.5-4.5M16 10.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z" />
            </svg>
          </button>
          <div class="filter-control-expanded hidden absolute left-0 top-full mt-1 z-10 min-w-[200px] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-black/10 p-2">
            <input id="allOrdersSearch" class="w-full rounded-lg border border-black/10 bg-white text-black placeholder:text-black/40 px-3 py-2 text-sm" placeholder="Search...">
          </div>
        </div>

        <!-- Status -->
        <div class="filter-control-wrapper flex-1 flex justify-center" data-control="status">
          <button class="filter-icon-btn w-9 h-9 rounded-lg hover:bg-black/10 flex items-center justify-center transition" data-control="status" title="Status">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" stroke-linecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
          <div class="filter-control-expanded hidden absolute left-0 top-full mt-1 z-10 min-w-[160px] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-black/10 p-2">
            <select id="allOrdersStatus" class="w-full rounded-lg border border-black/10 bg-white text-black px-3 py-2 text-sm">
              <option value="all">All Status</option>
              ${statusOpts}
            </select>
          </div>
        </div>

        <!-- Assignee -->
        <div class="filter-control-wrapper flex-1 flex justify-center" data-control="assignee">
          <button class="filter-icon-btn w-9 h-9 rounded-lg hover:bg-black/10 flex items-center justify-center transition" data-control="assignee" title="Assignee">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" stroke-linecap="round" d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-3a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 12v-1a4 4 0 0 0-2.5-3.7" />
            </svg>
          </button>
          <div class="filter-control-expanded hidden absolute left-0 top-full mt-1 z-10 min-w-[160px] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-black/10 p-2">
            <select id="allOrdersAssignee" class="w-full rounded-lg border border-black/10 bg-white text-black px-3 py-2 text-sm">
              <option value="all">All Assignees</option>
              ${assigneeOpts}
            </select>
          </div>
        </div>

        <!-- Date -->
        <div class="filter-control-wrapper flex-1 flex justify-center" data-control="date">
          <button class="filter-icon-btn w-9 h-9 rounded-lg hover:bg-black/10 flex items-center justify-center transition" data-control="date" title="Date Range">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" stroke-linecap="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <div class="filter-control-expanded hidden absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 min-w-[280px] max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-lg border border-black/10 p-3">
            <div class="flex flex-col sm:flex-row items-center gap-2">
              <span class="text-xs text-black/40">From</span>
              <input id="allOrdersDateFrom" type="text" readonly class="w-full sm:flex-1 border border-black/10 rounded-lg bg-white text-black text-sm py-1.5 px-2 cursor-pointer" placeholder="Start" />
              <span class="text-xs text-black/40">To</span>
              <input id="allOrdersDateTo" type="text" readonly class="w-full sm:flex-1 border border-black/10 rounded-lg bg-white text-black text-sm py-1.5 px-2 cursor-pointer" placeholder="End" />
            </div>
            <select id="allOrdersDateType" class="w-full mt-2 rounded-lg border border-black/10 bg-white text-black px-3 py-1.5 text-sm">
              ${dateDropdownHTML}
            </select>
          </div>
        </div>

        <!-- Refresh (always visible, no expansion) -->
        <button id="allOrdersRefresh" class="w-9 h-9 rounded-lg hover:bg-black/10 text-black/60 flex items-center justify-center transition flex-shrink-0" title="Refresh">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-width="2" stroke-linecap="round" d="M20 11a8 8 0 0 0-15.3-3M4 5v4h4M4 13a8 8 0 0 0 15.3 3M20 19v-4h-4" />
          </svg>
        </button>

        <!-- Clear (always visible, no expansion) -->
        <button id="allOrdersClearFilters" class="w-9 h-9 rounded-lg hover:bg-black/10 text-black/60 flex items-center justify-center transition flex-shrink-0" title="Clear filters">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-width="2" stroke-linecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;
  } else {
    // Desktop: full filter bar
    filterBarHTML = `
      <div class="flex flex-wrap items-center gap-2">
        <input id="allOrdersSearch" class="min-w-[120px] max-w-[180px] rounded-xl border border-black/10 bg-white text-black placeholder:text-black/40 px-3 py-2 text-sm flex-1" placeholder="Search...">

        <select id="allOrdersStatus" class="rounded-xl border border-black/10 bg-white text-black px-2 py-2 text-sm max-w-[120px] flex-1">
          <option value="all">All Status</option>
          ${statusOpts}
        </select>

        <select id="allOrdersAssignee" class="rounded-xl border border-black/10 bg-white text-black px-2 py-2 text-sm max-w-[120px] flex-1">
          <option value="all">All Assignees</option>
          ${assigneeOpts}
        </select>

        <div class="flex items-center gap-1 bg-white border border-black/10 rounded-xl px-2 py-1 whitespace-nowrap flex-wrap sm:flex-nowrap">
          <span class="text-xs text-black/40">From</span>
          <input id="allOrdersDateFrom" type="text" readonly
                 class="border-0 bg-transparent text-black text-sm py-1 px-1 w-[110px] focus:outline-none focus:ring-0 cursor-pointer"
                 placeholder="Start date" />
          <span class="text-xs text-black/40">To</span>
          <input id="allOrdersDateTo" type="text" readonly
                 class="border-0 bg-transparent text-black text-sm py-1 px-1 w-[110px] focus:outline-none focus:ring-0 cursor-pointer"
                 placeholder="End date" />
          <svg class="w-4 h-4 text-black/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <select id="allOrdersDateType" class="rounded-xl border border-black/10 bg-white text-black px-2 py-2 text-sm max-w-[180px] flex-1">
          ${dateDropdownHTML}
        </select>

        <button id="allOrdersRefresh" class="px-3 py-2 rounded-xl bg-brand-teal hover:bg-[#2A5454] text-white text-sm font-bold transition whitespace-nowrap shadow-sm">↻ Refresh</button>
        <button id="allOrdersClearFilters" class="px-3 py-2 rounded-xl bg-black/10 hover:bg-black/20 text-black/70 text-sm font-bold transition whitespace-nowrap">✕ Clear</button>
      </div>
    `;
  }

  // ---- Main HTML ----
  container.innerHTML = `
    <div id="allOrdersContainer" class="bg-white text-black rounded-2xl shadow-sm overflow-hidden">
      <!-- Filter bar -->
      <div class="p-3 border-b border-black/10 relative">
        ${filterBarHTML}
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table id="allOrdersTable" class="w-full min-w-[1000px] text-xs">
          <thead class="bg-black/5"><tr>
            ${headersHTML}
            <th class="px-4 py-3 text-right text-black/60" style="min-width:80px;">Action</th>
          </tr></thead>
          <tbody id="allOrdersBody"></tbody>
        </table>
      </div>
    </div>
  `;

  // ---- NO INJECTED STYLE OVERRIDE ----
  // The global #sectionPageBody rule has been fixed to not force child elements.
  // We rely on proper Tailwind classes in the HTML.

  // ---- FORCE REPAINT ----
  container.style.display = 'none';
  void container.offsetHeight;
  container.style.display = '';

  // ---- Scroll to top ----
  sectionPage.scrollTop = 0;
  container.focus({ preventScroll: false });

  // ---- Attach date picker ----
  const startInput = document.getElementById('allOrdersDateFrom');
  const endInput = document.getElementById('allOrdersDateTo');
  if (startInput && endInput) {
    datePickerInstance = attachRangeDatePicker(startInput, endInput, {
      initialStart: '',
      initialEnd: '',
      onChange: () => {}
    });
  }

  // ---- Init mobile compact filter bar ----
  if (isMobile) {
    initMobileFilterBar();
  }

  // =========================================================
  // PAINT FUNCTION
  // =========================================================
  function paint() {
    const q = normalize(document.getElementById('allOrdersSearch')?.value || '');
    const st = document.getElementById('allOrdersStatus')?.value || 'all';
    const assignee = document.getElementById('allOrdersAssignee')?.value || 'all';
    const dateFrom = document.getElementById('allOrdersDateFrom')?.value || '';
    const dateTo = document.getElementById('allOrdersDateTo')?.value || '';
    const dateType = document.getElementById('allOrdersDateType')?.value || 'created';

    const filteredOrders = orders.filter(o => {
      const search = normalize([o.id, o.title, o.description, o.category, o.location, o.assignee].join(' '));
      const matchesSearch = !q || search.includes(q);
      const matchesStatus = st === 'all' || o.status === st;
      const matchesAssignee = assignee === 'all' || o.assignee === assignee;

      let matchesDate = true;
      if (dateFrom || dateTo) {
        const dateVal = parseDateValue(displayValue(o, dateType));
        const checkDate = (val) => {
          if (!val) return false;
          if (dateFrom && val < dateFrom) return false;
          if (dateTo && val > dateTo) return false;
          return true;
        };
        matchesDate = checkDate(dateVal);
      }
      return matchesSearch && matchesStatus && matchesAssignee && matchesDate;
    }).sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')) || (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0));

    let rowsHTML = "";
    if (filteredOrders.length === 0) {
      rowsHTML = `<tr><td colspan="${tableColumns.length + 1}" class="p-12 text-center text-black/40">No work orders found.</td></tr>`;
    } else {
      filteredOrders.forEach(o => {
        let rowHTML = `<tr class="border-t border-black/10 hover:bg-black/5">`;
        tableColumns.forEach(key => {
          const cfg = fieldConfigs[key];
          let val = displayValue(o, cfg.source);
          if (key === 'status') {
            val = `<span class="px-2 py-1 rounded-full border ${statusClass(val)}">${esc(val)}</span>`;
          } else if (key === 'priority') {
            const colorClass = getPriorityColor(val);
            val = `<span class="px-2 py-1 rounded-md text-[10px] font-bold ${colorClass}">${esc(val)}</span>`;
          } else if (key === 'assignee') {
            const colorClass = getAssigneeColor(val);
            val = `<span class="px-2 py-1 rounded-md text-[10px] font-bold ${colorClass}">${esc(val)}</span>`;
          } else if (key === 'created' || key === 'dueDate' || (key && key.startsWith('custom_'))) {
            val = formatDate(val);
          } else {
            val = esc(val || '—');
          }
          rowHTML += `<td class="px-4 py-3 ${key === 'title' ? 'font-semibold text-black/80' : 'text-black/70'}">${val}</td>`;
        });
        rowHTML += `<td class="px-4 py-3 text-right"><button data-all-open="${esc(o.id)}" class="px-3 py-1.5 rounded-lg bg-brand-teal text-white font-bold hover:bg-[#2A5454] transition shadow-sm">Open</button></td>`;
        rowHTML += `</tr>`;
        rowsHTML += rowHTML;
      });
    }
    document.getElementById('allOrdersBody').innerHTML = rowsHTML;
    document.querySelectorAll('[data-all-open]').forEach(b => b.addEventListener('click', () => openDrawer(b.dataset.allOpen)));
    initColumnResizing();
  }

  // =========================================================
  // COLUMN RESIZING
  // =========================================================
  function initColumnResizing() {
    const table = document.getElementById('allOrdersTable');
    if (!table) return;
    const headers = table.querySelectorAll('thead th');
    let currentResize = null;

    headers.forEach((th, index) => {
      if (index === headers.length - 1) return;
      const oldHandle = th.querySelector('.resize-handle');
      if (oldHandle) oldHandle.remove();

      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.dataset.index = index;
      th.style.position = 'relative';
      th.appendChild(handle);

      handle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        currentResize = { index, startX: e.clientX, startWidth: th.offsetWidth, th };
        th.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      });
    });

    const onMouseMove = function(e) {
      if (!currentResize) return;
      const diff = e.clientX - currentResize.startX;
      const newWidth = Math.max(60, currentResize.startWidth + diff);
      currentResize.th.style.width = newWidth + 'px';
      currentResize.th.style.minWidth = newWidth + 'px';
    };

    const onMouseUp = function() {
      if (currentResize) {
        const th = currentResize.th;
        th.classList.remove('resizing');
        const newWidth = th.offsetWidth;
        const fieldKey = th.dataset.fieldKey;
        if (fieldKey) {
          if (!displayConfig.columnWidths) displayConfig.columnWidths = {};
          displayConfig.columnWidths[fieldKey] = newWidth;
          saveDisplayConfig();
        }
        currentResize = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // =========================================================
  // MOBILE FILTER BAR LOGIC (using event delegation)
  // =========================================================
  function initMobileFilterBar() {
    const compactBar = document.getElementById('filterBarCompact');
    if (!compactBar) return;
    if (compactBar.dataset.initialized === 'true') return;

    compactBar.addEventListener('click', function(e) {
      const iconBtn = e.target.closest('.filter-icon-btn');
      if (!iconBtn) return;
      e.stopPropagation();

      const controlId = iconBtn.dataset.control;
      if (!controlId) return;

      const wrapper = iconBtn.closest('.filter-control-wrapper');
      if (!wrapper) return;

      const expandedDiv = wrapper.querySelector('.filter-control-expanded');
      if (!expandedDiv) return;

      if (expandedControlId === controlId) {
        collapseAll();
        return;
      }

      collapseAll();
      expandedDiv.classList.remove('hidden');
      expandedControlId = controlId;

      const input = expandedDiv.querySelector('input, select, textarea');
      if (input) setTimeout(() => input.focus(), 100);
    });

    document.addEventListener('click', function(e) {
      if (!compactBar.contains(e.target)) {
        collapseAll();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        collapseAll();
      }
    });

    compactBar.dataset.initialized = 'true';
  }

  function collapseAll() {
    document.querySelectorAll('.filter-control-expanded').forEach(el => {
      el.classList.add('hidden');
    });
    expandedControlId = null;
  }

  // =========================================================
  // EVENT BINDINGS
  // =========================================================
  document.getElementById('allOrdersSearch')?.addEventListener('input', paint);
  document.getElementById('allOrdersStatus')?.addEventListener('change', paint);
  document.getElementById('allOrdersAssignee')?.addEventListener('change', paint);
  document.getElementById('allOrdersDateFrom')?.addEventListener('change', paint);
  document.getElementById('allOrdersDateTo')?.addEventListener('change', paint);
  document.getElementById('allOrdersDateType')?.addEventListener('change', paint);

  // Clear filters
  document.getElementById('allOrdersClearFilters')?.addEventListener('click', () => {
    const searchInput = document.getElementById('allOrdersSearch');
    const statusSelect = document.getElementById('allOrdersStatus');
    const assigneeSelect = document.getElementById('allOrdersAssignee');
    const dateFrom = document.getElementById('allOrdersDateFrom');
    const dateTo = document.getElementById('allOrdersDateTo');
    const dateType = document.getElementById('allOrdersDateType');

    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = 'all';
    if (assigneeSelect) assigneeSelect.value = 'all';

    if (datePickerInstance) {
      datePickerInstance.setRange('', '');
    } else {
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
    }

    if (dateType && dateType.options.length) dateType.value = dateType.options[0].value;

    collapseAll();
    paint();
    toast('Filters cleared.', 'info');
  });

  // Refresh – sync from KV
  let isSyncing = false;
  document.getElementById('allOrdersRefresh')?.addEventListener('click', async function() {
    if (isSyncing) return;
    isSyncing = true;

    const originalHTML = this.innerHTML;
    this.innerHTML = `
      <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
    `;
    this.disabled = true;

    try {
      await loadSharedState();
      const freshOrders = orders;
      const newAssignees = [...new Set(freshOrders.map(o => o.assignee).filter(a => a && a !== "Unassigned"))];
      const sel = document.getElementById('allOrdersAssignee');
      if (sel) {
        const currentVal = sel.value;
        sel.innerHTML = `<option value="all">All Assignees</option>${newAssignees.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}`;
        sel.value = currentVal;
      }
      paint();
      toast('Data synced from cloud.', 'success');
    } catch (err) {
      console.warn('Refresh sync error:', err);
      const fallbackOrders = loadOrders();
      orders.length = 0;
      orders.push(...fallbackOrders);
      const newAssignees = [...new Set(fallbackOrders.map(o => o.assignee).filter(a => a && a !== "Unassigned"))];
      const sel = document.getElementById('allOrdersAssignee');
      if (sel) {
        const currentVal = sel.value;
        sel.innerHTML = `<option value="all">All Assignees</option>${newAssignees.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}`;
        sel.value = currentVal;
      }
      paint();
      toast('Sync failed – using local data.', 'error');
    } finally {
      this.innerHTML = originalHTML;
      this.disabled = false;
      isSyncing = false;
    }
  });

  // ---- Resize handler ----
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const newIsMobile = window.innerWidth < 640;
      if (newIsMobile !== isMobile) {
        _doRender();
      }
    }, 250);
  });

  // ---- Initial paint ----
  paint();
  console.log('[allOrders] render complete');
}

// For debugging, expose _doRender globally
window._allOrdersRender = _doRender;