// =========================================================
// ALL WORK ORDERS – table view
// =========================================================

import { orders, displayConfig, saveDisplayConfig, loadOrders } from '../data.js';
import { esc, normalize, parseDateValue, formatDate, statusClass, getPriorityColor, getAssigneeColor, displayValue, toast } from '../utils.js';
import { getAllFieldConfigs, getOrderedFieldConfigs, getAvailableDateFields } from '../importHelpers.js';
import { openDrawer } from '../components/Drawer.js';

// This file exports a function named 'render' – do NOT import 'render' from elsewhere.

export function render() {
  const container = document.getElementById('sectionPageBody');
  const fieldConfigs = getOrderedFieldConfigs();

  // Build dynamic options
  const statuses = [...new Set(orders.map(o => o.status).filter(Boolean))].sort();
  const statusOpts = statuses.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

  const assignees = [...new Set(orders.map(o => o.assignee).filter(a => a && a !== "Unassigned"))];
  const assigneeOpts = assignees.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');

  const tableColumns = Object.keys(fieldConfigs).filter(key => fieldConfigs[key].showInTable !== false);
  const dateFieldOptions = getAvailableDateFields();

  let headersHTML = "";
  tableColumns.forEach((key) => {
    const cfg = fieldConfigs[key];
    headersHTML += `<th class="px-4 py-3 text-left text-black/60" data-field-key="${esc(key)}" style="min-width:80px;">${esc(cfg.label || key)}</th>`;
  });

  let dateDropdownHTML = "";
  if (dateFieldOptions.length === 0) {
    dateDropdownHTML += `<option value="created">Created Date</option>`;
  } else {
    dateFieldOptions.forEach(f => {
      dateDropdownHTML += `<option value="${esc(f.value)}">${esc(f.label)}</option>`;
    });
  }

  // Build the HTML
  container.innerHTML = `
    <div class="bg-white text-black border border-black/10 rounded-2xl shadow-sm overflow-hidden">
      <div class="p-3 border-b border-black/10 overflow-x-auto">
        <div class="flex flex-nowrap items-center gap-2 min-w-max">
          <input id="allOrdersSearch" class="min-w-[120px] max-w-[180px] rounded-xl border border-black/10 bg-white text-black placeholder:text-black/40 px-3 py-2 text-sm" placeholder="Search...">
          <select id="allOrdersStatus" class="rounded-xl border border-black/10 bg-white text-black px-2 py-2 text-sm max-w-[120px]">
            <option value="all">All Status</option>
            ${statusOpts}
          </select>
          <select id="allOrdersAssignee" class="rounded-xl border border-black/10 bg-white text-black px-2 py-2 text-sm max-w-[120px]">
            <option value="all">All Assignees</option>
            ${assigneeOpts}
          </select>
          <div class="flex items-center gap-1 bg-white border border-black/10 rounded-xl px-2 py-1 whitespace-nowrap">
            <span class="text-xs text-black/40">From</span>
            <input id="allOrdersDateFrom" type="date" class="border-0 bg-transparent text-black text-sm py-1 px-1 w-[110px] focus:outline-none focus:ring-0">
            <span class="text-xs text-black/40">To</span>
            <input id="allOrdersDateTo" type="date" class="border-0 bg-transparent text-black text-sm py-1 px-1 w-[110px] focus:outline-none focus:ring-0">
          </div>
          <select id="allOrdersDateType" class="rounded-xl border border-black/10 bg-white text-black px-2 py-2 text-sm max-w-[180px]">
            ${dateDropdownHTML}
          </select>
          <button id="allOrdersRefresh" class="px-3 py-2 rounded-xl bg-brand-teal hover:bg-[#2A5454] text-white text-sm font-bold transition whitespace-nowrap">↻ Refresh</button>
          <button id="allOrdersClearFilters" class="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 text-black/60 text-sm font-bold transition whitespace-nowrap">✕ Clear</button>
        </div>
      </div>
      <div class="overflow-x-auto"><table id="allOrdersTable" class="w-full min-w-[1000px] text-xs"><thead class="bg-black/5"><tr>
        ${headersHTML}
        <th class="px-4 py-3 text-right text-black/60" style="min-width:80px;">Action</th>
      </tr></thead><tbody id="allOrdersBody"></tbody></table></div>
    </div>
  `;

  // Paint function
  function paint() {
    const q = normalize(document.getElementById('allOrdersSearch').value);
    const st = document.getElementById('allOrdersStatus').value;
    const assignee = document.getElementById('allOrdersAssignee').value;
    const dateFrom = document.getElementById('allOrdersDateFrom').value;
    const dateTo = document.getElementById('allOrdersDateTo').value;
    const dateType = document.getElementById('allOrdersDateType').value;

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
        rowHTML += `<td class="px-4 py-3 text-right"><button data-all-open="${esc(o.id)}" class="px-3 py-1.5 rounded-lg bg-brand-teal/20 text-brand-teal font-bold hover:bg-brand-teal/30 transition">Open</button></td>`;
        rowHTML += `</tr>`;
        rowsHTML += rowHTML;
      });
    }
    document.getElementById('allOrdersBody').innerHTML = rowsHTML;
    document.querySelectorAll('[data-all-open]').forEach(b => b.addEventListener('click', () => openDrawer(b.dataset.allOpen)));
    initColumnResizing();
  }

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
        currentResize.th.classList.remove('resizing');
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

  // Bind events
  document.getElementById('allOrdersSearch').addEventListener('input', paint);
  document.getElementById('allOrdersStatus').addEventListener('change', paint);
  document.getElementById('allOrdersAssignee').addEventListener('change', paint);
  document.getElementById('allOrdersDateFrom').addEventListener('change', paint);
  document.getElementById('allOrdersDateTo').addEventListener('change', paint);
  document.getElementById('allOrdersDateType').addEventListener('change', paint);
  document.getElementById('allOrdersClearFilters').addEventListener('click', () => {
    document.getElementById('allOrdersSearch').value = '';
    document.getElementById('allOrdersStatus').value = 'all';
    document.getElementById('allOrdersAssignee').value = 'all';
    document.getElementById('allOrdersDateFrom').value = '';
    document.getElementById('allOrdersDateTo').value = '';
    const dt = document.getElementById('allOrdersDateType');
    if (dt.options.length) dt.value = dt.options[0].value;
    paint();
    toast('Filters cleared.', 'info');
  });
  document.getElementById('allOrdersRefresh').addEventListener('click', () => {
    // Refresh orders and rebuild assignee dropdown
    const freshOrders = loadOrders();
    // Update the orders array in data.js (since it's imported by reference)
    // But we have a local copy; we can update the shared orders array.
    // Since orders is imported from data.js, we can assign to orders.
    // However, orders is a const import, but the array itself is mutable.
    // We'll just use the loadOrders function and then trigger a global render.
    // We need to update the global orders in data.js. We can do:
    // orders.length = 0; orders.push(...freshOrders); but this is messy.
    // Instead, we can just call window.render() which will reload from localStorage.
    // The render() function in app.js will call loadOrders again.
    // So we just call window.render() and then repaint.
    window.render(); // this will reload from data and re-render the main grid.
    // Then we need to update our dropdown and repaint.
    // Reload the orders from data.js (the import is a reference, but we can re-assign)
    // Actually, we can just use the freshOrders.
    const newAssignees = [...new Set(freshOrders.map(o => o.assignee).filter(a => a && a !== "Unassigned"))];
    const sel = document.getElementById('allOrdersAssignee');
    const currentVal = sel.value;
    sel.innerHTML = `<option value="all">All Assignees</option>${newAssignees.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}`;
    sel.value = currentVal;
    paint();
    toast('All Work Orders refreshed.', 'success');
  });

  paint();
}