// =========================================================
// REPORTS – status distribution
// =========================================================

import { orders } from '../data.js';
import { esc } from '../utils.js';

export function render() {
  const container = document.getElementById('sectionPageBody');
  const statusCounts = {};
  orders.forEach(o => { const s = o.status || 'Unknown'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  const sortedStatuses = Object.keys(statusCounts).sort();

  const rows = sortedStatuses.map(s =>
    `<tr class="border-t border-white/5"><td class="px-4 py-3 font-semibold text-white/70">${esc(s)}</td><td class="px-4 py-3 text-right text-white">${statusCounts[s]}</td><td class="px-4 py-3 text-right text-white/70">${orders.length ? ((statusCounts[s] / orders.length) * 100).toFixed(1) : 0}%</td></tr>`
  ).join('');

  container.innerHTML = `
    <div class="grid md:grid-cols-3 gap-4 mb-5">
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5"><p class="text-xs text-white/40">Total</p><p class="text-3xl font-black text-white mt-1">${orders.length}</p></div>
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5"><p class="text-xs text-white/40">Open + In Progress</p><p class="text-3xl font-black text-white mt-1">${(statusCounts.Open || 0) + (statusCounts['In Progress'] || 0)}</p></div>
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5"><p class="text-xs text-white/40">Completed</p><p class="text-3xl font-black text-white mt-1">${statusCounts.Completed || 0}</p></div>
    </div>
    <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"><div class="p-5 font-black text-white">Status Distribution</div><table class="w-full text-sm"><thead class="bg-white/5"><tr><th class="px-4 py-3 text-left text-white/60">Status</th><th class="px-4 py-3 text-right text-white/60">Count</th><th class="px-4 py-3 text-right text-white/60">Share</th></tr></thead><tbody>${rows}</tbody></table></div>
  `;
}