// =========================================================
// ACTIVITY LOG
// =========================================================

import { orders } from '../data.js';
import { esc } from '../utils.js';
import { openDrawer } from '../components/Drawer.js';

export function render() {
  const container = document.getElementById('sectionPageBody');
  const acts = orders
    .flatMap(o => (o.activity || [])
      .filter(a => !/prepared for import from|updated by import|import/i.test(String(a.text || '')))
      .map(a => ({ ...a, id: o.id, title: o.title }))
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 100);

  container.innerHTML = `<div class="bg-white/5 border border-white/10 rounded-2xl divide-y divide-white/5">${
    acts.length ? acts.map(a =>
      `<button type="button" data-activity-id="${esc(a.id)}" class="w-full text-left p-4 hover:bg-white/5 transition"><div class="flex gap-3"><span class="w-2 h-2 rounded-full bg-brand-teal mt-2 shrink-0"></span><div><p class="text-sm font-bold text-white/80">${esc(a.text)}</p><p class="text-xs text-white/40 mt-1">${esc(a.id)} · ${esc(a.title)} · ${esc(a.date)}</p></div></div></button>`
    ).join('') : '<div class="p-10 text-center text-sm text-white/40">No activity yet.</div>'
  }</div>`;

  container.querySelectorAll('[data-activity-id]').forEach(b => b.addEventListener('click', () => openDrawer(b.dataset.activityId)));
}