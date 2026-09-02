// =========================================================
// ANALYTICS – filters and charts
// =========================================================

import { orders, displayConfig } from '../data.js';
import { esc, parseDateValue, displayValue } from '../utils.js';

export function render() {
  const container = document.getElementById('sectionPageBody');
  const assignees = [...new Set(orders.map(o => o.assignee).filter(a => a && a !== "Unassigned"))];
  const statuses = [...new Set(orders.map(o => o.status))];
  const priorities = [...new Set(orders.map(o => o.priority))];

  container.innerHTML = `
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
      <h3 class="font-black text-white mb-4">Filters</h3>
      <div class="flex flex-wrap gap-3">
        <select id="analyticsStatus" class="rounded-xl border border-white/10 bg-white/5 text-white px-3 py-2 text-sm"><option value="all">All Status</option>${statuses.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
        <select id="analyticsPriority" class="rounded-xl border border-white/10 bg-white/5 text-white px-3 py-2 text-sm"><option value="all">All Priority</option>${priorities.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select>
        <select id="analyticsAssignee" class="rounded-xl border border-white/10 bg-white/5 text-white px-3 py-2 text-sm"><option value="all">All Assignees</option>${assignees.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select>
        <select id="analyticsDateType" class="rounded-xl border border-white/10 bg-white/5 text-white px-3 py-2 text-sm">
          <option value="created">Created Date</option>
          <option value="dueDate">Due Date</option>
        </select>
        <input id="analyticsDateFrom" type="date" class="rounded-xl border border-white/10 bg-white/5 text-white px-3 py-2 text-sm" placeholder="From" />
        <input id="analyticsDateTo" type="date" class="rounded-xl border border-white/10 bg-white/5 text-white px-3 py-2 text-sm" placeholder="To" />
        <button id="analyticsApplyBtn" class="px-4 py-2 rounded-xl bg-brand-teal hover:bg-[#2A5454] text-white text-sm font-bold transition">Apply Filters</button>
        <button id="analyticsResetBtn" class="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10 text-white text-sm font-bold transition">Reset</button>
      </div>
    </div>
    <div id="analyticsCharts" class="grid lg:grid-cols-2 gap-5">
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5"><h3 class="font-black text-white mb-4">Status Distribution</h3><div id="statusChart" class="chart-container space-y-2"></div></div>
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5"><h3 class="font-black text-white mb-4">Priority Distribution</h3><div id="priorityChart" class="chart-container space-y-2"></div></div>
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5 lg:col-span-2"><h3 class="font-black text-white mb-4">Orders by Assignee</h3><div id="assigneeChart" class="chart-container space-y-2"></div></div>
    </div>
  `;

  function renderAnalytics() {
    const statusFilter = document.getElementById('analyticsStatus').value;
    const priorityFilter = document.getElementById('analyticsPriority').value;
    const assigneeFilter = document.getElementById('analyticsAssignee').value;
    const dateType = document.getElementById('analyticsDateType').value;
    const dateFrom = document.getElementById('analyticsDateFrom').value;
    const dateTo = document.getElementById('analyticsDateTo').value;
    const source = dateType === 'created' ? (displayConfig.fieldConfig?.created?.source || 'created') : (displayConfig.fieldConfig?.dueDate?.source || 'dueDate');

    let filtered = orders.filter(o => {
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchPriority = priorityFilter === 'all' || o.priority === priorityFilter;
      const matchAssignee = assigneeFilter === 'all' || o.assignee === assigneeFilter;
      let matchDate = true;
      if (dateFrom || dateTo) {
        const dateVal = parseDateValue(displayValue(o, source));
        if (dateFrom && dateVal < dateFrom) matchDate = false;
        if (dateTo && dateVal > dateTo) matchDate = false;
      }
      return matchStatus && matchPriority && matchAssignee && matchDate;
    });

    // Status chart
    const statusCounts = {};
    filtered.forEach(o => statusCounts[o.status] = (statusCounts[o.status] || 0) + 1);
    const maxStatus = Math.max(1, ...Object.values(statusCounts));
    const statusColors = { Open: '#3B82F6', 'In Progress': '#F59E0B', 'On Hold': '#8B5CF6', Completed: '#7EBF36', Overdue: '#EF4444', Cancelled: '#6B7280' };
    const statusChart = document.getElementById('statusChart');
    statusChart.innerHTML = Object.entries(statusCounts).length ? Object.entries(statusCounts).map(([s, n]) =>
      `<div><div class="flex justify-between text-xs font-bold mb-1"><span class="text-white/60">${esc(s)}</span><span class="text-white">${n}</span></div><div class="h-3 bg-white/10 rounded-full overflow-hidden"><div class="h-full rounded-full chart-bar" style="width:${Math.max(4, (n / maxStatus) * 100)}%; background-color:${statusColors[s] || '#F69F1A'};"></div></div></div>`
    ).join('') : '<p class="text-white/40 text-sm">No data matching filters.</p>';

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
    ).join('') : '<p class="text-white/40 text-sm">No data matching filters.</p>';
  }

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
  setTimeout(renderAnalytics, 50);
}