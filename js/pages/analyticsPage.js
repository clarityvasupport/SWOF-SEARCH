// =========================================================
// ANALYTICS – filters and charts (interactive)
// =========================================================

import { orders, displayConfig } from '../data.js';
import { esc, normalize, parseDateValue, displayValue } from '../utils.js';
import { attachRangeDatePicker } from '../components/DatePicker.js';

let pickerInstance = null; // store the picker instance to clean up if needed

export function render() {
  const container = document.getElementById('sectionPageBody');
  const assignees = [...new Set(orders.map(o => o.assignee).filter(a => a && a !== "Unassigned"))];
  const statuses = [...new Set(orders.map(o => o.status))];
  const priorities = [...new Set(orders.map(o => o.priority))];

  container.innerHTML = `
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
      <h3 class="font-black text-white mb-4">Filters</h3>
      <div class="flex flex-wrap items-center gap-3">
        <select id="analyticsStatus" class="rounded-xl border border-white/10 bg-black/40 text-white px-3 py-2 text-sm flex-1 min-w-[120px]"><option value="all">All Status</option>${statuses.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
        <select id="analyticsPriority" class="rounded-xl border border-white/10 bg-black/40 text-white px-3 py-2 text-sm flex-1 min-w-[120px]"><option value="all">All Priority</option>${priorities.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select>
        <select id="analyticsAssignee" class="rounded-xl border border-white/10 bg-black/40 text-white px-3 py-2 text-sm flex-1 min-w-[120px]"><option value="all">All Assignees</option>${assignees.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select>
        <select id="analyticsDateType" class="rounded-xl border border-white/10 bg-black/40 text-white px-3 py-2 text-sm flex-1 min-w-[120px]">
          <option value="created">Created Date</option>
          <option value="dueDate">Due Date</option>
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

  // Use requestAnimationFrame to ensure DOM is fully rendered before attaching picker
  requestAnimationFrame(() => {
    const fromInput = document.getElementById('analyticsDateFrom');
    const toInput = document.getElementById('analyticsDateTo');
    if (fromInput && toInput) {
      // If there's an existing picker instance, destroy it first to avoid duplicates
      if (pickerInstance && typeof pickerInstance.destroy === 'function') {
        pickerInstance.destroy();
      }
      pickerInstance = attachRangeDatePicker(fromInput, toInput);
      console.log('✅ Date picker attached');
    } else {
      console.warn('❌ Date inputs not found for picker');
    }
  });

  // Define renderAnalytics inside so it can access latest DOM
  function renderAnalytics() {
    const statusFilter = document.getElementById('analyticsStatus').value;
    const priorityFilter = document.getElementById('analyticsPriority').value;
    const assigneeFilter = document.getElementById('analyticsAssignee').value;
    const dateType = document.getElementById('analyticsDateType').value;
    const dateFrom = document.getElementById('analyticsDateFrom').value.trim();
    const dateTo = document.getElementById('analyticsDateTo').value.trim();
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
    document.getElementById('analyticsFilterSummary').textContent = summaryText;

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
    if (total === 0) {
      pieContainer.innerHTML = '<p class="text-white/40 text-sm">No data</p>';
      document.getElementById('statusLegend').innerHTML = '';
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
      const legendContainer = document.getElementById('statusLegend');
      legendContainer.innerHTML = pieData.map(d => `
        <div class="flex items-center gap-2 text-white/80">
          <span class="w-3 h-3 rounded-full" style="background:${d.color}"></span>
          <span>${esc(d.label)} (${d.value})</span>
        </div>
      `).join('');
    }

    // Priority chart
    const priorityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    filtered.forEach(o => { if (priorityCounts[o.priority] !== undefined) priorityCounts[o.priority]++; });
    const maxPriority = Math.max(1, ...Object.values(priorityCounts));
    const priorityColors = { Critical: '#EF4444', High: '#F97316', Medium: '#F59E0B', Low: '#7EBF36' };
    const priorityChart = document.getElementById('priorityChart');
    priorityChart.innerHTML = Object.entries(priorityCounts).map(([p, n]) =>
      `<div><div class="flex justify-between text-xs font-bold mb-1"><span class="text-white/60">${esc(p)}</span><span class="text-white">${n}</span></div><div class="h-3 bg-white/10 rounded-full overflow-hidden"><div class="h-full rounded-full chart-bar" style="width:${Math.max(4, (n / maxPriority) * 100)}%; background-color:${priorityColors[p] || '#F69F1A'};"></div></div></div>`
    ).join('');

    // Assignee chart
    const assigneeCounts = {};
    filtered.forEach(o => { const a = o.assignee || 'Unassigned'; assigneeCounts[a] = (assigneeCounts[a] || 0) + 1; });
    const maxAssignee = Math.max(1, ...Object.values(assigneeCounts));
    const assigneeChart = document.getElementById('assigneeChart');
    assigneeChart.innerHTML = Object.entries(assigneeCounts).length ? Object.entries(assigneeCounts).sort((a, b) => b[1] - a[1]).map(([a, n]) =>
      `<div><div class="flex justify-between text-xs font-bold mb-1"><span class="text-white/60">${esc(a)}</span><span class="text-white">${n}</span></div><div class="h-3 bg-white/10 rounded-full overflow-hidden"><div class="h-full rounded-full chart-bar" style="width:${Math.max(4, (n / maxAssignee) * 100)}%; background-color:#326363;"></div></div></div>`
    ).join('') : '<p class="text-white/40 text-sm">No data</p>';
  }

  // Attach event listeners (they are re-created each render)
  document.getElementById('analyticsApplyBtn').addEventListener('click', renderAnalytics);
  document.getElementById('analyticsResetBtn').addEventListener('click', () => {
    document.getElementById('analyticsStatus').value = 'all';
    document.getElementById('analyticsPriority').value = 'all';
    document.getElementById('analyticsAssignee').value = 'all';
    document.getElementById('analyticsDateType').value = 'created';
    document.getElementById('analyticsDateFrom').value = '';
    document.getElementById('analyticsDateTo').value = '';
    renderAnalytics();
  });

  // Initial render after a tiny delay to let the charts container be ready
  setTimeout(renderAnalytics, 100);
}