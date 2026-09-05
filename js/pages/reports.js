// =========================================================
// REPORTS – comprehensive status, priority, assignee summary
// (v1.2.3 – configurable completion date source)
// =========================================================

import { orders, displayConfig } from '../data.js';
import { esc, parseDateValue, nowDate, displayValue, toast } from '../utils.js';

export function render() {
  const container = document.getElementById('sectionPageBody');

  // --- Weekly stats (activity) ---
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay() + 1);
  currentWeekStart.setHours(0, 0, 0, 0);
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
  currentWeekEnd.setHours(23, 59, 59, 999);

  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(currentWeekEnd);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

  function isDateInRange(dateStr, start, end) {
    const d = parseDateValue(dateStr);
    if (!d) return false;
    const dt = new Date(d + 'T00:00:00');
    return dt >= start && dt <= end;
  }

  const thisWeekCreated = orders.filter(o => isDateInRange(o.created, currentWeekStart, currentWeekEnd)).length;
  const lastWeekCreated = orders.filter(o => isDateInRange(o.created, lastWeekStart, lastWeekEnd)).length;
  const activityChange = lastWeekCreated === 0 ? 100 : ((thisWeekCreated - lastWeekCreated) / lastWeekCreated * 100);
  const activityTrend = activityChange >= 0 ? '+' : '';
  const activityPercent = activityChange.toFixed(0);

  // =========================================================
  // 📊 CONFIGURABLE COMPLETION DATE (v1.2.3)
  // =========================================================
  const completionSource = displayConfig.completionDateSource || 'dueDate'; // fallback to dueDate
  const onlyCompleted = displayConfig.completionOnlyCompleted !== false; // default true

  function getCompletionDate(o) {
    // Use the configured source to get a date value
    const val = displayValue(o, completionSource);
    return val ? parseDateValue(val) : null;
  }

  const thisWeekCompleted = orders.filter(o => {
    // Optionally filter by status
    if (onlyCompleted && o.status?.toLowerCase() !== 'completed') return false;
    const compDate = getCompletionDate(o);
    return compDate && isDateInRange(compDate, currentWeekStart, currentWeekEnd);
  }).length;

  const lastWeekCompleted = orders.filter(o => {
    if (onlyCompleted && o.status?.toLowerCase() !== 'completed') return false;
    const compDate = getCompletionDate(o);
    return compDate && isDateInRange(compDate, lastWeekStart, lastWeekEnd);
  }).length;

  const completionChange = lastWeekCompleted === 0 ? 100 : ((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted * 100);
  const completionTrend = completionChange >= 0 ? '+' : '';
  const completionPercent = completionChange.toFixed(0);

  // --- Status counts ---
  const statusCounts = {};
  orders.forEach(o => { const s = o.status || 'Unknown'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  const total = orders.length;

  // Priority counts
  const priorityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  orders.forEach(o => { if (priorityCounts[o.priority] !== undefined) priorityCounts[o.priority]++; });

  // Top assignees
  const assigneeCounts = {};
  orders.forEach(o => { const a = o.assignee || 'Unassigned'; assigneeCounts[a] = (assigneeCounts[a] || 0) + 1; });
  const topAssignees = Object.entries(assigneeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ---- Weekly summary cards ----
  const weeklyHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <div class="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p class="text-xs text-white">📈 Weekly Activity</p>
        <p class="text-2xl font-black text-sky-400">${thisWeekCreated} orders added</p>
        <p class="text-sm font-bold ${activityChange >= 0 ? 'text-blue-400' : 'text-rose-400'}">${activityTrend}${activityPercent}% from last week</p>
      </div>
      <div class="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p class="text-xs text-white">✅ Weekly Completion</p>
        <p class="text-2xl font-black text-emerald-400">${thisWeekCompleted} orders completed</p>
        <p class="text-sm font-bold ${completionChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${completionTrend}${completionPercent}% from last week</p>
        <p class="text-[10px] text-white/30 mt-1">Using field: <span class="font-mono">${esc(completionSource)}</span></p>
      </div>
    </div>
  `;

  // ---- Dynamic status cards ----
  const statusCards = Object.entries(statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => `
      <div class="bg-white/5 border border-white/10 rounded-2xl p-4 flex-1 min-w-[100px]">
        <p class="text-xs text-white/40">${esc(status)}</p>
        <p class="text-2xl font-black text-white">${count}</p>
      </div>
    `).join('');

  const summaryCards = `
    <div class="flex flex-wrap gap-4 mb-5">
      <div class="bg-white/5 border border-white/10 rounded-2xl p-4 flex-1 min-w-[100px]">
        <p class="text-xs text-white/40">Total Orders</p>
        <p class="text-2xl font-black text-white">${total}</p>
      </div>
      ${statusCards}
    </div>
  `;

  // ---- Priority summary ----
  const prioritySummary = `
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
      <h4 class="font-black text-white mb-3">Priority Breakdown</h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${Object.entries(priorityCounts).map(([p, n]) => `
          <div class="bg-black/20 rounded-xl p-3 text-center">
            <p class="text-xs text-white/40">${esc(p)}</p>
            <p class="text-xl font-black text-white">${n}</p>
            <p class="text-[10px] text-white/30">${total ? ((n/total)*100).toFixed(1) : 0}%</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // ---- Top assignees ----
  const assigneeSummary = topAssignees.length ? `
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
      <h4 class="font-black text-white mb-3">Top 5 Assignees</h4>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        ${topAssignees.map(([a, n]) => `
          <div class="bg-black/20 rounded-xl p-3 text-center">
            <p class="text-xs text-white/60 truncate">${esc(a)}</p>
            <p class="text-xl font-black text-white">${n}</p>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  // ---- Detailed status table ----
  const sortedStatuses = Object.keys(statusCounts).sort();
  const rows = sortedStatuses.map(s => {
    const count = statusCounts[s];
    const percent = total ? ((count / total) * 100).toFixed(1) : 0;
    const barWidth = Math.max(4, percent);
    return `<tr class="border-t border-white/5">
      <td class="px-2 py-2 md:px-4 md:py-3 font-semibold text-white/80 text-xs md:text-sm">${esc(s)}</td>
      <td class="px-2 py-2 md:px-4 md:py-3 text-right text-white text-xs md:text-sm">${count}</td>
      <td class="px-2 py-2 md:px-4 md:py-3 text-right text-white/70 text-xs md:text-sm">${percent}%</td>
      <td class="px-2 py-2 md:px-4 md:py-3 min-w-[60px]"><div class="h-2 bg-white/10 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${barWidth}%; background-color:#326363;"></div></div></td>
    </tr>`;
  }).join('');

  const tableHTML = `
    <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div class="p-5 font-black text-white border-b border-white/10">Status Distribution (Detailed)</div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-white/5">
            <tr>
              <th class="px-2 py-2 md:px-4 md:py-3 text-left text-white/60 text-xs md:text-sm">Status</th>
              <th class="px-2 py-2 md:px-4 md:py-3 text-right text-white/60 text-xs md:text-sm">Count</th>
              <th class="px-2 py-2 md:px-4 md:py-3 text-right text-white/60 text-xs md:text-sm">Share</th>
              <th class="px-2 py-2 md:px-4 md:py-3 text-left text-white/60 text-xs md:text-sm">Distribution</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = `
    ${weeklyHTML}
    ${summaryCards}
    ${prioritySummary}
    ${assigneeSummary}
    ${tableHTML}
  `;
}