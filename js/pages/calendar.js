// =========================================================
// CALENDAR – date‑grouped view
// =========================================================

import { orders, displayConfig, saveDisplayConfig } from '../data.js';
import { esc, displayValue, parseDateValue, formatDate } from '../utils.js';
import { getAvailableDateFields, getAllFieldConfigs } from '../importHelpers.js';

let calendarMonthOffset = 0;

export function render() {
  const container = document.getElementById('sectionPageBody');
  const availableDateFields = getAvailableDateFields();
  let source = displayConfig.calendarDateSource || 'created';
  const sourceExists = availableDateFields.some(f => f.value === source);
  if (!sourceExists) {
    source = availableDateFields[0]?.value || 'created';
    displayConfig.calendarDateSource = source;
    saveDisplayConfig();
  }

  function renderCalendar() {
    const titleSource = displayConfig.fieldConfig?.title?.source || 'title';
    const now = new Date();
    const month = now.getMonth() + calendarMonthOffset;
    const year = now.getFullYear() + Math.floor(month / 12);
    const adjustedMonth = ((month % 12) + 12) % 12;
    const adjustedYear = year - (month < 0 ? 1 : 0);
    const days = new Date(adjustedYear, adjustedMonth + 1, 0).getDate();
    const firstDay = new Date(adjustedYear, adjustedMonth, 1).getDay();

    const events = orders
      .map(o => {
        const rawDate = displayValue(o, source);
        const parsed = parseDateValue(rawDate);
        const displayTitle = displayValue(o, titleSource) || o.title || 'Untitled';
        return { ...o, _date: parsed, _displayTitle: displayTitle };
      })
      .filter(o => o._date && o._date.startsWith(`${adjustedYear}-${String(adjustedMonth + 1).padStart(2, '0')}`))
      .sort((a, b) => (a._date || '').localeCompare(b._date || ''));

    const monthName = new Date(adjustedYear, adjustedMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    let html = `<div class="bg-white/5 text-white border border-white/10 rounded-2xl p-5">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <button id="calendarPrevBtn" class="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition">←</button>
          <h3 class="font-black text-white">${monthName}</h3>
          <button id="calendarNextBtn" class="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition">→</button>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-white/40">${events.length} orders</span>
          <select id="calendarDateSource" class="rounded-xl border border-white/20 bg-black/20 text-white px-3 py-2 text-sm">
            ${availableDateFields.map(f => `<option value="${f.value}" ${f.value === source ? 'selected' : ''}>${f.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-7 gap-2 text-center text-xs font-bold text-white/40 mb-2">
        ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x => `<div>${x}</div>`).join('')}
      </div>
      <div class="grid grid-cols-7 gap-2">
        ${Array.from({ length: firstDay }, () => '<div></div>').join('')}
        ${Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const key = `${adjustedYear}-${String(adjustedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const ds = events.filter(o => o._date === key);
          return `<button type="button" data-calendar-date="${key}" class="min-h-24 text-left p-2 rounded-xl border ${ds.length ? 'border-brand-teal/30 bg-brand-teal/10' : 'border-white/10 bg-white/5'} hover:border-brand-teal/50 transition"><span class="text-xs font-black text-white/70">${day}</span>${
            ds.slice(0, 3).map(o => `<span class="block mt-2 text-[10px] font-bold text-white/60 truncate">${esc(o.id)}</span>`).join('')
          }${ds.length > 3 ? `<span class="text-[9px] text-brand-teal">${ds.length - 3} more</span>` : ''}</button>`;
        }).join('')}
      </div>
    </div>`;
    container.innerHTML = html;

    // Bind events
    document.querySelectorAll('[data-calendar-date]').forEach(b => {
      b.addEventListener('click', function() {
        const date = this.dataset.calendarDate;
        document.querySelector('[data-nav="orders"]').click();
        setTimeout(() => {
          const dateFrom = document.getElementById('allOrdersDateFrom');
          const dateTo = document.getElementById('allOrdersDateTo');
          if (dateFrom) { dateFrom.value = date; dateFrom.dispatchEvent(new Event('change', { bubbles: true })); }
          if (dateTo) { dateTo.value = date; dateTo.dispatchEvent(new Event('change', { bubbles: true })); }
          const sourceVal = displayConfig.calendarDateSource || 'created';
          const dateType = document.getElementById('allOrdersDateType');
          if (dateType) {
            let found = false;
            for (let i = 0; i < dateType.options.length; i++) {
              if (dateType.options[i].value === sourceVal) { dateType.value = sourceVal; found = true; break; }
            }
            if (!found && dateType.options.length) dateType.value = dateType.options[0].value;
            dateType.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const searchInput = document.getElementById('allOrdersSearch');
          if (searchInput) { searchInput.value = ''; searchInput.dispatchEvent(new Event('input', { bubbles: true })); }
          toast(`📅 Filtering orders on ${date}`, 'info');
        }, 150);
      });
    });

    document.getElementById('calendarPrevBtn')?.addEventListener('click', () => { calendarMonthOffset--; renderCalendar(); });
    document.getElementById('calendarNextBtn')?.addEventListener('click', () => { calendarMonthOffset++; renderCalendar(); });
    document.getElementById('calendarDateSource')?.addEventListener('change', function() {
      displayConfig.calendarDateSource = this.value;
      saveDisplayConfig();
      calendarMonthOffset = 0;
      renderCalendar();
    });
  }

  renderCalendar();
}