// =========================================================
// ANALYTICS – filters and charts (interactive)
// (v1.3.2 – fixed null element errors in renderAnalytics)
// =========================================================

import { orders, displayConfig } from '../data.js';
import { esc, normalize, parseDateValue, displayValue } from '../utils.js';
import { attachRangeDatePicker } from '../components/DatePicker.js';

let pickerInstance = null; // store the picker instance to clean up if needed
let expandedControlId = null;

export function render() {
  const container = document.getElementById('sectionPageBody');
  if (!container) {
    console.warn('[Analytics] container #sectionPageBody not found');
    return;
  }

  const assignees = [...new Set(orders.map(o => o.assignee).filter(a => a && a !== "Unassigned"))];
  const statuses = [...new Set(orders.map(o => o.status))];
  const priorities = [...new Set(orders.map(o => o.priority))];

  const isMobile = window.innerWidth < 640;

  // Build status options
  const statusOpts = statuses.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  const priorityOpts = priorities.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  const assigneeOpts = assignees.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');

  // Date type options
  const dateTypeOpts = `
    <option value="created">Created Date</option>
    <option value="dueDate">Due Date</option>
  `;

  let filterBarHTML;

  if (isMobile) {
    // ---- Mobile: compact icon-only ----
    filterBarHTML = `
      <div class="filter-bar-compact flex items-center gap-2 p-1 relative" id="filterBarCompact">
        <!-- Status -->
        <div class="filter-control-wrapper" data-control="status">
          <button class="filter-icon-btn" data-control="status" title="Status">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" stroke-linecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
          <div class="filter-control-expanded hidden absolute left-0 top-full mt-1 z-10 min-w-[160px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/10 p-2">
            <select id="analyticsStatus" class="w-full rounded-lg border border-white/10 bg-transparent text-white px-3 py-2 text-sm">
              <option value="all">All Status</option>
              ${statusOpts}
            </select>
          </div>
        </div>

        <!-- Priority -->
        <div class="filter-control-wrapper" data-control="priority">
          <button class="filter-icon-btn" data-control="priority" title="Priority">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" stroke-linecap="round" d="M5 9l7-4 7 4v10l-7 4-7-4V9z" />
            </svg>
          </button>
          <div class="filter-control-expanded hidden absolute left-0 top-full mt-1 z-10 min-w-[160px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/10 p-2">
            <select id="analyticsPriority" class="w-full rounded-lg border border-white/10 bg-transparent text-white px-3 py-2 text-sm">
              <option value="all">All Priority</option>
              ${priorityOpts}
            </select>
          </div>
        </div>

        <!-- Assignee -->
        <div class="filter-control-wrapper" data-control="assignee">
          <button class="filter-icon-btn" data-control="assignee" title="Assignee">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" stroke-linecap="round" d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-3a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 12v-1a4 4 0 0 0-2.5-3.7" />
            </svg>
          </button>
          <div class="filter-control-expanded hidden absolute left-0 top-full mt-1 z-10 min-w-[160px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/10 p-2">
            <select id="analyticsAssignee" class="w-full rounded-lg border border-white/10 bg-transparent text-white px-3 py-2 text-sm">
              <option value="all">All Assignees</option>
              ${assigneeOpts}
            </select>
          </div>
        </div>

        <!-- Date Type -->
        <div class="filter-control-wrapper" data-control="dateType">
          <button class="filter-icon-btn" data-control="dateType" title="Date Type">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" stroke-linecap="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <div class="filter-control-expanded hidden absolute left-0 top-full mt-1 z-10 min-w-[160px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/10 p-2">
            <select id="analyticsDateType" class="w-full rounded-lg border border-white/10 bg-transparent text-white px-3 py-2 text-sm">
              ${dateTypeOpts}
            </select>
          </div>
        </div>

        <!-- Date Range -->
        <div class="filter-control-wrapper" data-control="dateRange">
          <button class="filter-icon-btn" data-control="dateRange" title="Date Range">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" stroke-linecap="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              <path stroke-width="2" stroke-linecap="round" d="M8 12h8m-8 4h4" />
            </svg>
          </button>
          <div class="filter-control-expanded hidden absolute left-0 top-full mt-1 z-10 min-w-[280px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/10 p-3">
            <div class="flex items-center gap-2">
              <span class="text-xs text-white/60">From</span>
              <input id="analyticsDateFrom" type="text" readonly class="flex-1 border border-white/10 rounded-lg bg-transparent text-white text-sm py-1.5 px-2 cursor-pointer placeholder:text-white/40" placeholder="Start" />
              <span class="text-xs text-white/60">To</span>
              <input id="analyticsDateTo" type="text" readonly class="flex-1 border border-white/10 rounded-lg bg-transparent text-white text-sm py-1.5 px-2 cursor-pointer placeholder:text-white/40" placeholder="End" />
            </div>
          </div>
        </div>

        <!-- Apply button (compact) -->
        <button id="analyticsApplyBtn" class="p-1.5 rounded-lg hover:bg-white/10 text-white transition" title="Apply filters">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-width="2" stroke-linecap="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>

        <!-- Reset button (compact) -->
        <button id="analyticsResetBtn" class="p-1.5 rounded-lg hover:bg-white/10 text-white/60 transition" title="Reset filters">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-width="2" stroke-linecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;
  } else {
    // ---- Desktop: full filter bar ----
    filterBarHTML = `
      <div class="flex flex-wrap items-center gap-3">
        <select id="analyticsStatus" class="rounded-xl border border-white/10 bg-black/40 text-white px-3 py-2 text-sm flex-1 min-w-[120px]">
          <option value="all">All Status</option>
          ${statusOpts}
        </select>
        <select id="analyticsPriority" class="rounded-xl border border-white/10 bg-black/40 text-white px-3 py-2 text-sm flex-1 min-w-[120px]">
          <option value="all">All Priority</option>
          ${priorityOpts}
        </select>
        <select id="analyticsAssignee" class="rounded-xl border border-white/10 bg-black/40 text-white px-3 py-2 text-sm flex-1 min-w-[120px]">
          <option value="all">All Assignees</option>
          ${assigneeOpts}
        </select>
        <select id="analyticsDateType" class="rounded-xl border border-white/10 bg-black/40 text-white px-3 py-2 text-sm flex-1 min-w-[120px]">
          ${dateTypeOpts}
        </select>
        <div class="flex-1 min-w-[140px] relative">
          <input id="analyticsDateFrom" type="text" placeholder="From" class="w-full rounded-xl border border-white/10 bg-black/40 text-white placeholder:text-white/50 px-3 py-2 text-sm" />
        </div>
        <div class="flex-1 min-w-[140px] relative">
          <input id="analyticsDateTo" type="text" placeholder="To" class="w-full rounded-xl border border-white/10 bg-black/40 text-white placeholder:text-white/50 px-3 py-2 text-sm" />
        </div>
        <button id="analyticsApplyBtn" class="px-4 py-2 rounded-xl bg-brand-teal hover:bg-[#2A5454] text-white text-sm font-bold transition">Apply Filters</button>
        <button id="analyticsResetBtn" class="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10 text-white text-sm font-bold transition">Reset</button>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
      <h3 class="font-black text-white mb-4">Filters</h3>
      ${filterBarHTML}
      <div id="analyticsFilterSummary" class="mt-3 text-sm text-white/60"></div>
    </div>

    <div id="analyticsCharts" class="grid lg:grid-cols-2 gap-5">
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 class="font-black text-white mb-4">Status Distribution</h3>
        <div id="statusPieChart" class="flex flex-col items-center"></div>
        <div id="statusLegend" class="mt-3 grid grid-cols-2 gap-1 text-xs"></div>
      </div>
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 class="font-black text-white mb-4">Priority Distribution</h3>
        <div id="priorityChart" class="chart-container space-y-2"></div>
      </div>
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5 lg:col-span-2">
        <h3 class="font-black text-white mb-4">Orders by Assignee</h3>
        <div id="assigneeChart" class="chart-container space-y-2"></div>
      </div>
    </div>
  `;

  // ---- Attach date picker (if inputs exist) ----
  const fromInput = document.getElementById('analyticsDateFrom');
  const toInput = document.getElementById('analyticsDateTo');
  if (fromInput && toInput) {
    if (pickerInstance && typeof pickerInstance.destroy === 'function') {
      pickerInstance.destroy();
    }
    pickerInstance = attachRangeDatePicker(fromInput, toInput);
  }

  // ---- Mobile compact logic ----
  if (isMobile) {
    initMobileFilterBar();
  }

  // ---- Render charts ----
  function renderAnalytics() {
    // Safely get all filter elements – guard against missing elements
    const statusEl = document.getElementById('analyticsStatus');
    const priorityEl = document.getElementById('analyticsPriority');
    const assigneeEl = document.getElementById('analyticsAssignee');
    const dateTypeEl = document.getElementById('analyticsDateType');
    const dateFromEl = document.getElementById('analyticsDateFrom');
    const dateToEl = document.getElementById('analyticsDateTo');

    if (!statusEl || !priorityEl || !assigneeEl || !dateTypeEl || !dateFromEl || !dateToEl) {
      console.warn('[Analytics] One or more filter elements not found – skipping render.');
      return;
    }

    const statusFilter = statusEl.value;
    const priorityFilter = priorityEl.value;
    const assigneeFilter = assigneeEl.value;
    const dateType = dateTypeEl.value;
    const dateFrom = dateFromEl.value.trim();
    const dateTo = dateToEl.value.trim();
    const source = dateType === 'created' ? (displayConfig.fieldConfig?.created?.source || 'created') : (displayConfig.fieldConfig?.dueDate?.source || 'dueDate');

    const normStatus = statusFilter !== 'all' ? normalize(statusFilter) : null;
    const normPriority = priorityFilter !== 'all' ? normalize(priorityFilter) : null;
    const normAssignee = assigneeFilter !== 'all' ? normalize(assigneeFilter) : null;

    let filtered = orders.filter(o => {
      const matchStatus = normStatus ? normalize(o.status) === normStatus : true;
      const matchPriority = normPriority ? normalize(o.priority) === normPriority : true;
      const matchAssignee = normAssignee ? normalize(o.assignee) === normAssignee : true;
      let matchDate = true;
      if (dateFrom || dateTo) {
        const dateVal = parseDateValue(displayValue(o, source));
        if (dateVal) {
          if (dateFrom && dateVal < dateFrom) matchDate = false;
          if (dateTo && dateVal > dateTo) matchDate = false;
        } else {
          matchDate = false;
        }
      }
      return matchStatus && matchPriority && matchAssignee && matchDate;
    });

    const parts = [];
    if (statusFilter !== 'all') parts.push(`Status: ${statusFilter}`);
    if (priorityFilter !== 'all') parts.push(`Priority: ${priorityFilter}`);
    if (assigneeFilter !== 'all') parts.push(`Assignee: ${assigneeFilter}`);
    if (dateFrom) parts.push(`From: ${dateFrom}`);
    if (dateTo) parts.push(`To: ${dateTo}`);
    const summaryText = parts.length ? `Showing: ${parts.join(' | ')}` : 'Showing: all orders';
    const summaryEl = document.getElementById('analyticsFilterSummary');
    if (summaryEl) summaryEl.textContent = summaryText;

    // Status Pie Chart
    const statusCounts = {};
    filtered.forEach(o => statusCounts[o.status] = (statusCounts[o.status] || 0) + 1);
    const total = filtered.length;
    const colors = {
      'Open': '#3B82F6',
      'In Progress': '#F59E0B',
      'On Hold': '#8B5CF6',
      'Pending': '#9CA3AF',
      'On Process': '#FCD34D',
      'Completed': '#7EBF36',
      'Overdue': '#EF4444',
      'Cancelled': '#6B7280'
    };
    const sortedStatuses = Object.keys(statusCounts).sort();
    const pieData = sortedStatuses.map(s => ({ label: s, value: statusCounts[s], color: colors[s] || '#F69F1A' }));

    const pieContainer = document.getElementById('statusPieChart');
    const legendContainer = document.getElementById('statusLegend');
    if (pieContainer) {
      if (total === 0) {
        pieContainer.innerHTML = '<p class="text-white/40 text-sm">No data</p>';
        if (legendContainer) legendContainer.innerHTML = '';
      } else {
        const radius = 80;
        const cx = 100, cy = 100;
        let cumulative = 0;
        let paths = '';
        pieData.forEach((d, i) => {
          const percent = d.value / total;
          const startAngle = cumulative * 2 * Math.PI;
          cumulative += percent;
          const endAngle = cumulative * 2 * Math.PI;
          const x1 = cx + radius * Math.sin(startAngle);
          const y1 = cy - radius * Math.cos(startAngle);
          const x2 = cx + radius * Math.sin(endAngle);
          const y2 = cy - radius * Math.cos(endAngle);
          const largeArc = percent > 0.5 ? 1 : 0;
          const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          paths += `<path d="${path}" fill="${d.color}" stroke="#1a1a2e" stroke-width="2" />`;
        });
        pieContainer.innerHTML = `
          <svg viewBox="0 0 200 200" class="w-48 h-48">
            ${paths}
            <circle cx="100" cy="100" r="45" fill="#1a1a2e" />
            <text x="100" y="96" text-anchor="middle" fill="white" font-size="18" font-weight="bold">${total}</text>
            <text x="100" y="114" text-anchor="middle" fill="#aaa" font-size="10">orders</text>
          </svg>
        `;
        if (legendContainer) {
          legendContainer.innerHTML = pieData.map(d => `
            <div class="flex items-center gap-2 text-white/80">
              <span class="w-3 h-3 rounded-full" style="background:${d.color}"></span>
              <span>${esc(d.label)} (${d.value})</span>
            </div>
          `).join('');
        }
      }
    }

    // Priority chart
    const priorityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    filtered.forEach(o => { if (priorityCounts[o.priority] !== undefined) priorityCounts[o.priority]++; });
    const maxPriority = Math.max(1, ...Object.values(priorityCounts));
    const priorityColors = { Critical: '#EF4444', High: '#F97316', Medium: '#F59E0B', Low: '#7EBF36' };
    const priorityChart = document.getElementById('priorityChart');
    if (priorityChart) {
      priorityChart.innerHTML = Object.entries(priorityCounts).map(([p, n]) =>
        `<div><div class="flex justify-between text-xs font-bold mb-1"><span class="text-white/60">${esc(p)}</span><span class="text-white">${n}</span></div><div class="h-3 bg-white/10 rounded-full overflow-hidden"><div class="h-full rounded-full chart-bar" style="width:${Math.max(4, (n / maxPriority) * 100)}%; background-color:${priorityColors[p] || '#F69F1A'};"></div></div></div>`
      ).join('');
    }

    // Assignee chart
    const assigneeCounts = {};
    filtered.forEach(o => { const a = o.assignee || 'Unassigned'; assigneeCounts[a] = (assigneeCounts[a] || 0) + 1; });
    const maxAssignee = Math.max(1, ...Object.values(assigneeCounts));
    const assigneeChart = document.getElementById('assigneeChart');
    if (assigneeChart) {
      assigneeChart.innerHTML = Object.entries(assigneeCounts).length ?
        Object.entries(assigneeCounts).sort((a, b) => b[1] - a[1]).map(([a, n]) =>
          `<div><div class="flex justify-between text-xs font-bold mb-1"><span class="text-white/60">${esc(a)}</span><span class="text-white">${n}</span></div><div class="h-3 bg-white/10 rounded-full overflow-hidden"><div class="h-full rounded-full chart-bar" style="width:${Math.max(4, (n / maxAssignee) * 100)}%; background-color:#326363;"></div></div></div>`
        ).join('') :
        '<p class="text-white/40 text-sm">No data</p>';
    }
  }

  // ===== Mobile: control expansion logic =====
  function initMobileFilterBar() {
    const wrappers = document.querySelectorAll('.filter-control-wrapper');
    const compactBar = document.getElementById('filterBarCompact');

    wrappers.forEach(wrapper => {
      const iconBtn = wrapper.querySelector('.filter-icon-btn');
      const expandedDiv = wrapper.querySelector('.filter-control-expanded');

      if (!iconBtn || !expandedDiv) return;

      iconBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const controlId = this.dataset.control;

        if (expandedControlId === controlId) {
          collapseAll();
          return;
        }
        expandControl(controlId);
      });
    });

    document.addEventListener('click', function(e) {
      if (!compactBar) return;
      if (!compactBar.contains(e.target)) {
        collapseAll();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        collapseAll();
      }
    });
  }

  function expandControl(controlId) {
    collapseAll();
    const wrapper = document.querySelector(`.filter-control-wrapper[data-control="${controlId}"]`);
    if (!wrapper) return;
    const expandedDiv = wrapper.querySelector('.filter-control-expanded');
    if (!expandedDiv) return;
    expandedDiv.classList.remove('hidden');
    expandedControlId = controlId;
    const input = expandedDiv.querySelector('input, select, textarea');
    if (input) setTimeout(() => input.focus(), 100);
  }

  function collapseAll() {
    document.querySelectorAll('.filter-control-expanded').forEach(el => el.classList.add('hidden'));
    expandedControlId = null;
  }

  // ---- Event listeners ----
  const applyBtn = document.getElementById('analyticsApplyBtn');
  const resetBtn = document.getElementById('analyticsResetBtn');
  if (applyBtn) applyBtn.addEventListener('click', renderAnalytics);
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const statusEl = document.getElementById('analyticsStatus');
      const priorityEl = document.getElementById('analyticsPriority');
      const assigneeEl = document.getElementById('analyticsAssignee');
      const dateTypeEl = document.getElementById('analyticsDateType');
      const dateFromEl = document.getElementById('analyticsDateFrom');
      const dateToEl = document.getElementById('analyticsDateTo');
      if (statusEl) statusEl.value = 'all';
      if (priorityEl) priorityEl.value = 'all';
      if (assigneeEl) assigneeEl.value = 'all';
      if (dateTypeEl) dateTypeEl.value = 'created';
      if (dateFromEl) dateFromEl.value = '';
      if (dateToEl) dateToEl.value = '';
      collapseAll();
      renderAnalytics();
    });
  }

  // ---- Resize handler ----
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const newIsMobile = window.innerWidth < 640;
      if (newIsMobile !== isMobile) {
        render(); // re-render
      }
    }, 250);
  });

  // ---- Initial render ----
  setTimeout(renderAnalytics, 100);
}