// =========================================================
// DRAWER – detail sidebar
// =========================================================

import { orders, saveOrders, displayConfig } from '../data.js';
import {
  esc,
  formatDate,
  statusClass,
  priorityClass,
  initials,
  nowStamp,
  displayValue,
  parseDateValue,
  formatFieldValue,
  normalize,
  customFieldValue,
  detectionCache,
  detectionPromises,
} from '../utils.js';
import { openConfirmationModal, closeConfirmationModal } from './ConfirmModal.js';
import { openEdit } from './EditModal.js';

export let selectedId = null;

export function openDrawer(id) {
  if (selectedId === id) {
    renderDrawer(id);
    return;
  }
  if (!orders.some(o => o.id === id)) return;
  selectedId = id;
  renderDrawer(id);
  document.getElementById('detailDrawer').classList.remove('translate-x-full');
  const b = document.getElementById('drawerBackdrop');
  b.classList.remove('opacity-0', 'pointer-events-none');
  document.body.classList.add('overflow-hidden');
  const newHash = `#order/${id}`;
  if (window.location.hash !== newHash) {
    window.location.hash = newHash;
  }
}

export function closeDrawer() {
  if (selectedId === null) return;
  selectedId = null;
  document.getElementById('detailDrawer').classList.add('translate-x-full');
  document.getElementById('drawerBackdrop').classList.add('opacity-0', 'pointer-events-none');
  document.body.classList.remove('overflow-hidden');
  if (window.location.hash.startsWith('#order/')) {
    const currentPage = document.querySelector('[data-nav].active')?.dataset?.nav || 'dashboard';
    window.location.hash = currentPage === 'dashboard' ? '#dashboard' : `#${currentPage}`;
  }
}

export function renderDrawer(id) {
  const o = orders.find(x => x.id === id);
  if (!o) {
    closeDrawer();
    return;
  }

  const fieldConfigs = getAllFieldConfigs();
  const getSource = (key) => fieldConfigs[key]?.source || key;
  const getValue = (key) => displayValue(o, getSource(key));

  // ---- HEADER ----
  document.getElementById('drawerNumber').textContent = o.id;
  document.getElementById('drawerCategory').textContent = getValue('category') || 'Uncategorized';
  document.getElementById('drawerCreatedText').textContent =
    `Created ${formatDate(displayValue(o, getSource('created')))}` +
    (getValue('requester') ? ` • Requested by ${getValue('requester')}` : '');

  // Status badge in header (upper right)
  const statusBadge = document.getElementById('drawerStatusBadge');
  statusBadge.textContent = o.status;
  statusBadge.className = `px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusClass(o.status)}`;

  // Status dropdown (footer)
  const dataStatuses = orders.map(o => o.status).filter(Boolean);
  const uniqueStatuses = Array.from(new Set(dataStatuses)).sort();
  const statusOpts = uniqueStatuses.length ? uniqueStatuses : ['Open'];
  const drawerStatus = document.getElementById('drawerStatusSelect');
  drawerStatus.innerHTML = statusOpts.map(s =>
    `<option value="${esc(s)}" ${o.status === s ? 'selected' : ''}>${esc(s)}</option>`
  ).join('');

  // ---- BODY ----
  const priorityBadge = `<span class="px-3 py-1.5 rounded-md text-xs font-bold ${priorityClass(o.priority)}">${esc(o.priority || 'Medium')}</span>`;
  const priorityBg = priorityClass(o.priority).split(' ').filter(c => c.startsWith('bg-')).join(' ') || 'bg-gray-100';

  const titleValue = esc(o.title || 'Untitled');
  const descriptionValue = esc((o.description || 'No description provided.').trim());

  // ---- Build detail grid (Location, Due Date, Remarks) with deduplication ----
  const gridItems = [];

  const addGridItem = (key, defaultValue) => {
    const label = fieldConfigs[key]?.label || defaultValue;
    const value = getValue(key);
    if (value && value.trim() !== '') {
      gridItems.push({ label, value });
    }
  };

  addGridItem('location', 'Location');
  addGridItem('dueDate', 'Due Date');
  addGridItem('remarks', 'Remarks');

  // Deduplicate by label (e.g., if dueDate label is "Remarks" and there's a remarks field with same label)
  const seenLabels = new Set();
  const uniqueGridItems = gridItems.filter(item => {
    if (seenLabels.has(item.label)) return false;
    seenLabels.add(item.label);
    return true;
  });

  const detailsGridHTML = uniqueGridItems.map(item => detailBox(item.label, item.value, o.id)).join('');

  // ---- CUSTOM FIELDS ----
  const globalCustomKeys = Object.keys(fieldConfigs).filter(k => k.startsWith('custom_'));
  const globalCustomFields = globalCustomKeys
    .filter(k => fieldConfigs[k].showOnCard !== false)
    .map(k => {
      const cfg = fieldConfigs[k];
      const label = cfg.label || k;
      const source = cfg.source || '';
      const value = source ? displayValue(o, source) : '';
      return { label, value };
    })
    .filter(f => f.label && f.value);

  const perOrderFields = (o.customFields || [])
    .filter(f => {
      const hasLabel = f.label && f.label.trim() !== '';
      const hasValue = (f.value && f.value.trim() !== '') || (f._sourceHeader && f._sourceHeader.trim() !== '');
      return hasLabel && hasValue;
    })
    .filter(f => !globalCustomFields.some(g => g.label === f.label))
    .map(f => ({
      label: f.label,
      value: customFieldValue(o, f.label) || f.value || ''
    }))
    .filter(f => f.label && f.value);

  const allCustomFields = [];
  const seenCustomLabels = new Set();
  [...globalCustomFields, ...perOrderFields].forEach(f => {
    if (!seenCustomLabels.has(f.label)) {
      seenCustomLabels.add(f.label);
      allCustomFields.push(f);
    }
  });

  const customFieldsHTML = allCustomFields.length
    ? allCustomFields.map(f => detailBox(f.label, f.value, o.id)).join('')
    : '<p class="text-xs text-black/40 col-span-2">No custom fields yet. Click "Add Field" to add one.</p>';

  // ---- ACTIVITY ----
  const activity = (o.activity || [])
    .filter(a => !/prepared for import from|updated by import|import/i.test(String(a.text || '')))
    .slice().reverse()
    .map(a =>
      `<div class="flex gap-3"><div class="w-2 h-2 rounded-full bg-brand-teal mt-1.5 shrink-0"></div><div><p class="text-sm text-black/80">${esc(a.text)}</p><p class="text-[11px] text-black/40 mt-0.5">${esc(a.date)}</p></div></div>`
    ).join('');

  const assigneeValue = getValue('assignee') || 'Unassigned';

  // ---- Build Drawer Body ----
  const body = document.getElementById('drawerBody');
  body.innerHTML = `
    <div class="space-y-6 text-black">
      <!-- Priority Row with background colour -->
      <div class="p-3 rounded-xl ${priorityBg} border border-black/5 flex items-center justify-between">
        <span class="text-xs font-bold text-black/60">Priority</span>
        ${priorityBadge}
      </div>

      <!-- Work Order Details -->
      <section>
        <h3 class="text-sm font-black text-black/80 mb-3">Work Order Details</h3>
        <div class="space-y-3">
          <!-- Title (plain) -->
          <div>
            <p class="text-[10px] text-black/40 font-semibold">Title</p>
            <div id="drawerDetailTitle" class="mt-1 text-sm font-bold text-black/80 break-words overflow-hidden transition-all max-h-[3rem]">
              ${titleValue}
            </div>
            <button id="drawerTitleExpandBtn" class="text-xs font-bold text-brand-teal hover:underline mt-1">Show more</button>
          </div>

          <!-- Description (expandable) -->
          <div>
            <p class="text-[10px] text-black/40 font-semibold">Description</p>
            <div id="drawerDetailDescription" class="mt-1 text-sm text-black/80 whitespace-pre-wrap overflow-hidden transition-all max-h-[3rem]">${descriptionValue}</div>
            <button id="drawerDescExpandBtn" class="text-xs font-bold text-brand-teal hover:underline mt-1">Show more</button>
          </div>

          <!-- Grid for Location, Due Date, Remarks -->
          <div class="detail-box-grid">
            ${detailsGridHTML}
          </div>
        </div>
      </section>

      <!-- Custom Fields -->
      <section>
        <h3 class="text-sm font-black text-black/80 mb-3">Custom Fields</h3>
        <div class="detail-box-grid" id="drawerCustomFieldsList">
          ${customFieldsHTML}
        </div>
        <button id="drawerAddFieldBtn" class="mt-3 text-xs font-bold text-brand-teal hover:underline transition">
          + Add Field
        </button>
        <div id="drawerCustomFieldsEditor" class="mt-3 space-y-2"></div>
      </section>

      <!-- Assigned User -->
      <section class="pt-4 border-t border-black/10">
        <h3 class="text-sm font-black text-black/80 mb-3">Assigned User</h3>
        <div class="flex items-center gap-3 p-3 rounded-xl border border-black/10 bg-black/5">
          <div class="w-11 h-11 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center font-black text-sm">${esc(initials(assigneeValue))}</div>
          <div><p class="text-sm font-bold text-black/80">${esc(assigneeValue)}</p><p class="text-xs text-black/40">Assigned technician / responsible user</p></div>
        </div>
      </section>

      <!-- Activity -->
      <section class="pt-4 border-t border-black/10">
        <h3 class="text-sm font-black text-black/80 mb-3">Activity</h3>
        <div class="space-y-4">${activity || '<p class="text-sm text-black/40">No activity recorded.</p>'}</div>
      </section>
    </div>
  `;

    // ---- Title Expand/Collapse ----
  const expandBtn = document.getElementById('drawerTitleExpandBtn');
  const titleDiv = document.getElementById('drawerDetailTitle');
  if (expandBtn && titleDiv) {
    let expanded = false;
    const isOverflowing = titleDiv.scrollHeight > titleDiv.clientHeight;
    if (!isOverflowing) {
      expandBtn.style.display = 'none';
    } else {
      expandBtn.addEventListener('click', () => {
        expanded = !expanded;
        titleDiv.style.maxHeight = expanded ? '1000px' : '3rem';
        expandBtn.textContent = expanded ? 'Show less' : 'Show more';
      });
    }
  }

  // ---- Description Expand/Collapse ----
  const descExpandBtn = document.getElementById('drawerDescExpandBtn');
  const descDiv = document.getElementById('drawerDetailDescription');
  if (descExpandBtn && descDiv) {
    let descExpanded = false;
    // Check if content overflows (has more than ~2 lines)
    const isDescOverflowing = descDiv.scrollHeight > descDiv.clientHeight;
    if (!isDescOverflowing) {
      descExpandBtn.style.display = 'none';
    } else {
      descExpandBtn.addEventListener('click', () => {
        descExpanded = !descExpanded;
        descDiv.style.maxHeight = descExpanded ? '1000px' : '3rem';
        descExpandBtn.textContent = descExpanded ? 'Show less' : 'Show more';
      });
    }
  }

  // ---- Add Field button ----
  document.getElementById('drawerAddFieldBtn')?.addEventListener('click', function() {
    if (!window.requireLogin || !window.requireLogin()) return;
    const o2 = orders.find(x => x.id === id);
    if (o2) addDrawerCustomField(o2.id);
  });

  // ---- Show editor if there are empty fields ----
  const oCurrent = orders.find(x => x.id === id);
  if (oCurrent) {
    const emptyFields = (oCurrent.customFields || []).filter(f => {
      const hasLabel = f.label && f.label.trim() !== '';
      const hasValue = f.value && f.value.trim() !== '';
      const hasSource = f._sourceHeader && f._sourceHeader.trim() !== '';
      return !hasLabel && !hasValue && !hasSource;
    });
    if (emptyFields.length) {
      renderDrawerCustomFieldsEditor(oCurrent, emptyFields);
    } else {
      const editor = document.getElementById('drawerCustomFieldsEditor');
      if (editor) editor.innerHTML = '';
    }
  }

  // ---- Auto‑refresh detection after a short delay ----
  setTimeout(() => {
    if (selectedId === id) {
      let hasPending = false;
      const allValues = [...Object.values(o._rawData || {}), ...(o.customFields || []).map(f => f.value)];
      for (const val of allValues) {
        if (typeof val === 'string' && val.includes('animate-spin') && val.includes('Detecting file type')) {
          hasPending = true;
          break;
        }
      }
      if (hasPending) {
        renderDrawer(id);
      }
    }
  }, 2500);

  if (typeof window.updateUndoButtons === 'function') window.updateUndoButtons();
}

// ---- Helper functions ----
function detailBox(label, value, orderId) {
  return `<div class="bg-black/5 rounded-lg p-3"><p class="text-[10px] text-black/40 font-semibold">${esc(label)}</p><div class="mt-1 text-sm font-bold text-black/80 break-words">${formatFieldValue(value, orderId)}</div></div>`;
}

function getAllFieldConfigs() {
  const coreFields = ['id','title','status','priority','category','location','assignee','requester','created','dueDate','description','remarks'];
  const configs = {};
  coreFields.forEach(f => {
    const fromConfig = displayConfig.fieldConfig?.[f];
    configs[f] = fromConfig
      ? { ...fromConfig, source: fromConfig.source || f }
      : { label: f.charAt(0).toUpperCase() + f.slice(1), source: f, showOnCard: true, showInTable: true };
  });
  if (displayConfig.fieldConfig) {
    Object.keys(displayConfig.fieldConfig).forEach(key => {
      if (key.startsWith('custom_')) {
        const cfg = displayConfig.fieldConfig[key];
        configs[key] = {
          label: cfg.label || key,
          source: cfg.source || `custom:${cfg.label}`,
          showOnCard: cfg.showOnCard !== undefined ? cfg.showOnCard : true,
          showInTable: cfg.showInTable !== undefined ? cfg.showInTable : true,
        };
      }
    });
  }
  return configs;
}

// ---- Add/Edit/Remove custom fields ----
export function addDrawerCustomField(orderId) {
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  if (!Array.isArray(o.customFields)) o.customFields = [];
  const emptyField = o.customFields.find(f => {
    const hasLabel = f.label && f.label.trim() !== '';
    const hasValue = f.value && f.value.trim() !== '';
    const hasSource = f._sourceHeader && f._sourceHeader.trim() !== '';
    return !hasLabel && !hasValue && !hasSource;
  });
  if (emptyField) {
    toast('There is already an empty field. Fill it or remove it first.', 'info');
    setTimeout(() => {
      const editor = document.getElementById('drawerCustomFieldsEditor');
      const inputs = editor?.querySelectorAll('.drawer-field-label');
      if (inputs) {
        for (const inp of inputs) {
          if (!inp.value.trim()) {
            inp.focus();
            break;
          }
        }
      }
    }, 50);
    return;
  }
  o.customFields.push({ label: '', value: '', _sourceHeader: '' });
  saveOrders();
  renderDrawer(orderId);
  toast('New field added. Fill in the label and value.', 'info');
  setTimeout(() => {
    const editor = document.getElementById('drawerCustomFieldsEditor');
    const inputs = editor?.querySelectorAll('.drawer-field-label');
    if (inputs && inputs.length) {
      inputs[inputs.length - 1].focus();
    }
  }, 50);
}

export function renderDrawerCustomFieldsEditor(o, emptyFields) {
  const editor = document.getElementById('drawerCustomFieldsEditor');
  if (!editor) return;
  if (!emptyFields) {
    emptyFields = (o.customFields || []).filter(f => {
      const hasLabel = f.label && f.label.trim() !== '';
      const hasValue = f.value && f.value.trim() !== '';
      const hasSource = f._sourceHeader && f._sourceHeader.trim() !== '';
      return !hasLabel && !hasValue && !hasSource;
    });
  }
  if (!emptyFields.length) {
    editor.innerHTML = '';
    return;
  }
  const allHeaders = allAvailableHeaders(o);
  const headerOpts = allHeaders.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');

  let html = '';
  emptyFields.forEach((f) => {
    const originalIndex = o.customFields.indexOf(f);
    html += `
      <div class="drawer-custom-field-row" data-field-index="${originalIndex}">
        <div>
          <span class="field-label-sm text-black/40">Label</span>
          <input class="field-input-sm drawer-field-label" data-idx="${originalIndex}" value="${esc(f.label || '')}" placeholder="e.g. Date Transmitted">
        </div>
        <div>
          <span class="field-label-sm text-black/40">Value</span>
          <select class="field-input-sm drawer-field-value-select" data-idx="${originalIndex}">
            <option value="">— Type custom —</option>
            ${headerOpts}
          </select>
          <input class="field-input-sm drawer-field-value-text mt-1 ${f._sourceHeader ? 'hidden' : ''}" data-idx="${originalIndex}" placeholder="Custom value..." value="${esc(f.value || '')}">
        </div>
        <button type="button" class="field-remove-btn drawer-field-remove" data-idx="${originalIndex}" title="Remove field">✕</button>
      </div>
    `;
  });

  editor.innerHTML = html;

  editor.querySelectorAll('.drawer-field-label').forEach(el => {
    el.addEventListener('input', function() {
      const idx = parseInt(this.dataset.idx);
      if (o.customFields[idx]) {
        o.customFields[idx].label = this.value;
        saveOrders();
        updateDrawerCustomFieldsDisplay(o);
      }
    });
  });

  editor.querySelectorAll('.drawer-field-value-select').forEach(el => {
    el.addEventListener('change', function() {
      const idx = parseInt(this.dataset.idx);
      const textInput = this.parentElement.querySelector('.drawer-field-value-text');
      if (this.value) {
        const val = displayValue(o, this.value);
        if (o.customFields[idx]) {
          o.customFields[idx].value = val;
          o.customFields[idx]._sourceHeader = this.value;
        }
        textInput.classList.add('hidden');
        textInput.value = val || '';
        updateDrawerCustomFieldsDisplay(o);
        saveOrders();
        renderDrawer(o.id);
      } else {
        textInput.classList.remove('hidden');
        textInput.focus();
        if (o.customFields[idx]) o.customFields[idx]._sourceHeader = '';
      }
    });
  });

  editor.querySelectorAll('.drawer-field-value-text').forEach(el => {
    el.addEventListener('input', function() {
      const idx = parseInt(this.dataset.idx);
      if (o.customFields[idx]) {
        o.customFields[idx].value = this.value;
        o.customFields[idx]._sourceHeader = '';
      }
      saveOrders();
      updateDrawerCustomFieldsDisplay(o);
    });
    const idx = parseInt(el.dataset.idx);
    if (o.customFields[idx] && o.customFields[idx].value && !o.customFields[idx]._sourceHeader) {
      el.classList.remove('hidden');
      const sel = el.parentElement.querySelector('.drawer-field-value-select');
      if (sel) sel.value = '';
    }
  });

  editor.querySelectorAll('.drawer-field-remove').forEach(el => {
    el.addEventListener('click', function() {
      const idx = parseInt(this.dataset.idx);
      if (o.customFields && o.customFields.length > idx) {
        const label = o.customFields[idx].label || 'this field';
        openConfirmationModal({
          title: 'Remove field',
          message: `Remove "${label}" from this work order?`,
          confirmText: 'Remove',
          confirmClass: 'bg-red-600 hover:bg-red-700',
          onConfirm: () => {
            o.customFields.splice(idx, 1);
            saveOrders();
            renderDrawer(o.id);
            toast('Field removed.', 'info');
            closeConfirmationModal();
          },
        });
      }
    });
  });

  editor.querySelectorAll('.drawer-field-value-select').forEach(sel => {
    if (sel.value) {
      const txt = sel.parentElement.querySelector('.drawer-field-value-text');
      if (txt) txt.classList.add('hidden');
    }
  });
}

export function updateDrawerCustomFieldsDisplay(o) {
  const list = document.getElementById('drawerCustomFieldsList');
  if (!list) return;
  const fieldConfigs = getAllFieldConfigs();
  const globalCustomKeys = Object.keys(fieldConfigs).filter(k => k.startsWith('custom_'));
  const globalCustomFields = globalCustomKeys
    .filter(k => fieldConfigs[k].showOnCard !== false)
    .map(k => {
      const cfg = fieldConfigs[k];
      const label = cfg.label || k;
      const source = cfg.source || '';
      const value = source ? displayValue(o, source) : '';
      return { label, value };
    })
    .filter(f => f.label && f.value);
  const perOrderFields = (o.customFields || [])
    .filter(f => {
      const hasLabel = f.label && f.label.trim() !== '';
      const hasValue = (f.value && f.value.trim() !== '') || (f._sourceHeader && f._sourceHeader.trim() !== '');
      return hasLabel && hasValue;
    })
    .filter(f => !globalCustomFields.some(g => g.label === f.label))
    .map(f => ({
      label: f.label,
      value: customFieldValue(o, f.label) || f.value || ''
    }))
    .filter(f => f.label && f.value);
  const allCustomFields = [];
  const seenLabels = new Set();
  [...globalCustomFields, ...perOrderFields].forEach(f => {
    if (!seenLabels.has(f.label)) {
      seenLabels.add(f.label);
      allCustomFields.push(f);
    }
  });

  if (!allCustomFields.length) {
    list.innerHTML = '<p class="text-xs text-black/40">No custom fields yet. Click "Add Field" to add one.</p>';
    return;
  }
  list.innerHTML = allCustomFields
    .map(f => {
      const actualValue = customFieldValue(o, f.label) || f.value || '';
      return `<div class="custom-field-item bg-black/5 rounded-lg p-2 border border-black/10"><strong class="text-black/60">${esc(f.label)}</strong> <span class="text-black/80">${formatFieldValue(actualValue)}</span></div>`;
    })
    .join('');
}

function allAvailableHeaders(o) {
  const headers = new Set();
  if (o && o._importHeaders) o._importHeaders.forEach(h => headers.add(h));
  if (o && o._rawData) Object.keys(o._rawData).forEach(h => headers.add(h));
  return [...headers].filter(Boolean);
}

function toast(message, type = 'info') {
  if (typeof window.toast === 'function') window.toast(message, type);
}