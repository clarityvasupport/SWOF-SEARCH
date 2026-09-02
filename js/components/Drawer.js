// =========================================================
// DRAWER – detail sidebar for a single work order
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
} from '../utils.js';
import { openConfirmationModal, closeConfirmationModal } from './ConfirmModal.js';
import { openEdit } from './EditModal.js';

export let selectedId = null;

export function openDrawer(id) {
  if (!orders.some(o => o.id === id)) return;
  selectedId = id;
  renderDrawer(id);
  document.getElementById('detailDrawer').classList.remove('translate-x-full');
  const b = document.getElementById('drawerBackdrop');
  b.classList.remove('opacity-0', 'pointer-events-none');
  document.body.classList.add('overflow-hidden');
  // Update URL hash
  if (window.location.hash !== `#order/${id}`) {
    window.location.hash = `#order/${id}`;
  }
}

export function closeDrawer() {
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

  // Status badge
  const badge = document.getElementById('drawerStatusBadge');
  badge.textContent = o.status;
  badge.className = `px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusClass(o.status)}`;
  document.getElementById('drawerNumber').textContent = o.id;
  document.getElementById('drawerTitle').textContent = o.title || 'Untitled';
  document.getElementById('drawerCreatedText').textContent =
    `Created ${formatDate(displayValue(o, getSource('created')))}` +
    (getValue('requester') ? ` • Requested by ${getValue('requester')}` : '');

  // Status dropdown
  const dataStatuses = orders.map(o => o.status).filter(Boolean);
  const uniqueStatuses = Array.from(new Set(dataStatuses)).sort();
  const statusOpts = uniqueStatuses.length ? uniqueStatuses : ['Open'];
  const drawerStatus = document.getElementById('drawerStatusSelect');
  drawerStatus.innerHTML = statusOpts.map(s =>
    `<option value="${esc(s)}" ${o.status === s ? 'selected' : ''}>${esc(s)}</option>`
  ).join('');

  // Core details
  const detailFields = [
    { key: 'category', label: fieldConfigs.category?.label || 'Category' },
    { key: 'location', label: fieldConfigs.location?.label || 'Location' },
    { key: 'created', label: fieldConfigs.created?.label || 'Created' },
    { key: 'dueDate', label: fieldConfigs.dueDate?.label || 'Due Date' },
    { key: 'requester', label: fieldConfigs.requester?.label || 'Requester' },
  ];
  const detailsHTML = detailFields.map(f => detailBox(f.label, getValue(f.key), o.id)).join('');

  // Custom fields
  const globalCustomKeys = Object.keys(fieldConfigs).filter(k => k.startsWith('custom_'));
  const globalCustomFields = globalCustomKeys
    .filter(k => fieldConfigs[k].showOnCard !== false)
    .map(k => {
      const cfg = fieldConfigs[k];
      const label = cfg.label || k;
      const source = cfg.source || '';
      const value = source ? displayValue(o, source) : '';
      return { label, value };
    });
  const perOrderFields = (o.customFields || [])
    .filter(f => f.label && (f.value || f._sourceHeader))
    .filter(f => !globalCustomFields.some(g => g.label === f.label))
    .map(f => ({ label: f.label, value: customFieldValue(o, f.label) || f.value || '' }));
  const allCustomFields = [...globalCustomFields, ...perOrderFields];
  const customFieldsHTML = allCustomFields.length
    ? allCustomFields.map(f => detailBox(f.label, f.value, o.id)).join('')
    : '<p class="text-xs text-black/40 col-span-2">No custom fields yet. Click "Add Field" to add one.</p>';

  // Activity
  const activity = (o.activity || [])
    .filter(a => !/prepared for import from|updated by import|import/i.test(String(a.text || '')))
    .slice().reverse()
    .map(a =>
      `<div class="flex gap-3"><div class="w-2 h-2 rounded-full bg-brand-teal mt-1.5 shrink-0"></div><div><p class="text-sm text-black/80">${esc(a.text)}</p><p class="text-[11px] text-black/40 mt-0.5">${esc(a.date)}</p></div></div>`
    ).join('');

  const assigneeValue = getValue('assignee') || 'Unassigned';

  // Build drawer body
  const body = document.getElementById('drawerBody');
  body.innerHTML = `
    <div class="space-y-6 text-black">
      <!-- Priority -->
      <div class="rounded-xl border p-4 ${priorityClass(o.priority).replace('text-', 'border-').split(' ')[0]}">
        <div class="flex items-center justify-between gap-3">
          <div><p class="text-[10px] uppercase tracking-wider font-bold text-black/40">Priority</p><p class="mt-1 font-black ${priorityClass(o.priority).split(' ')[1] || 'text-black/80'}">${esc(o.priority || 'Medium')}</p></div>
          <span class="px-2.5 py-1 rounded-md text-[10px] font-bold ${priorityClass(o.priority)}">${esc(o.priority || 'Medium')}</span>
        </div>
      </div>

      <!-- Description -->
      <section><h3 class="text-sm font-black text-black/80 mb-2">Description</h3><p class="text-sm leading-6 text-black/60 whitespace-pre-wrap">${esc(o.description || 'No description provided.')}</p></section>

      <!-- Core Details -->
      <section>
        <h3 class="text-sm font-black text-black/80 mb-3">Work Order Details</h3>
        <div class="detail-box-grid">
          ${detailsHTML}
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

  // Bind "Add Field" button
  document.getElementById('drawerAddFieldBtn')?.addEventListener('click', function() {
    if (!requireLogin()) return;
    const o2 = orders.find(x => x.id === id);
    if (o2) addDrawerCustomField(o2.id);
  });

  // If there are empty custom fields, render the editor
  const oCurrent = orders.find(x => x.id === id);
  if (oCurrent) {
    const hasEmpty = (oCurrent.customFields || []).some(f => !f.label || !f.value);
    if (hasEmpty) {
      renderDrawerCustomFieldsEditor(oCurrent);
    }
  }

  updateUndoButtons();
}

// ---- Helper: detailBox ----
function detailBox(label, value, orderId) {
  return `<div class="bg-black/5 rounded-lg p-3"><p class="text-[10px] text-black/40 font-semibold">${esc(label)}</p><div class="mt-1 text-sm font-bold text-black/80 break-words">${formatFieldValue(value, orderId)}</div></div>`;
}

// ---- Helper: getAllFieldConfigs ----
function getAllFieldConfigs() {
  const coreFields = [
    'id', 'title', 'status', 'priority', 'category', 'location',
    'assignee', 'requester', 'created', 'dueDate', 'description'
  ];
  const configs = {};
  coreFields.forEach((f) => {
    const fromConfig = displayConfig.fieldConfig?.[f];
    configs[f] = fromConfig
      ? { ...fromConfig, source: fromConfig.source || f }
      : { label: f.charAt(0).toUpperCase() + f.slice(1), source: f, showOnCard: true, showInTable: true };
  });
  if (displayConfig.fieldConfig) {
    Object.keys(displayConfig.fieldConfig).forEach((key) => {
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

// ---- Custom field editor functions ----
export function addDrawerCustomField(orderId) {
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  if (!Array.isArray(o.customFields)) o.customFields = [];
  // Check for existing empty field
  const emptyField = o.customFields.find(f => !f.label && !f.value && !f._sourceHeader);
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
  renderDrawerCustomFieldsEditor(o);
  updateDrawerCustomFieldsDisplay(o);
  renderDrawer(orderId);
  setTimeout(() => {
    const editor = document.getElementById('drawerCustomFieldsEditor');
    if (editor) {
      const inputs = editor.querySelectorAll('input.drawer-field-label');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }
  }, 50);
  saveOrders();
  toast('New field added. Fill in the label and value.', 'info');
}

export function renderDrawerCustomFieldsEditor(o) {
  const editor = document.getElementById('drawerCustomFieldsEditor');
  if (!editor) return;
  const allHeaders = allAvailableHeaders(o);
  const headerOpts = allHeaders
    .map((h) => `<option value="${esc(h)}">${esc(h)}</option>`)
    .join('');

  const fields = o.customFields || [];
  if (!fields.length) {
    editor.innerHTML = `<p class="text-xs text-black/40 italic">No custom fields. Click "Add Field" above.</p>`;
    return;
  }

  let html = '';
  fields.forEach((f, idx) => {
    html += `
      <div class="drawer-custom-field-row" data-field-index="${idx}">
        <div>
          <span class="field-label-sm text-black/40">Label</span>
          <input class="field-input-sm drawer-field-label" data-idx="${idx}" value="${esc(f.label || '')}" placeholder="e.g. Date Transmitted">
        </div>
        <div>
          <span class="field-label-sm text-black/40">Value</span>
          <select class="field-input-sm drawer-field-value-select" data-idx="${idx}">
            <option value="">— Type custom —</option>
            ${headerOpts}
          </select>
          <input class="field-input-sm drawer-field-value-text mt-1 ${f._sourceHeader ? 'hidden' : ''}" data-idx="${idx}" placeholder="Custom value..." value="${esc(f.value || '')}">
        </div>
        <button type="button" class="field-remove-btn drawer-field-remove" data-idx="${idx}" title="Remove field">✕</button>
      </div>
    `;
  });

  editor.innerHTML = html;

  // Bind events
  editor.querySelectorAll('.drawer-field-label').forEach((el) => {
    el.addEventListener('input', function () {
      const idx = parseInt(this.dataset.idx);
      if (o.customFields[idx]) o.customFields[idx].label = this.value;
      saveOrders();
      updateDrawerCustomFieldsDisplay(o);
    });
  });

  editor.querySelectorAll('.drawer-field-value-select').forEach((el) => {
    el.addEventListener('change', function () {
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
        renderDrawerCustomFieldsEditor(o);
      } else {
        textInput.classList.remove('hidden');
        textInput.focus();
        if (o.customFields[idx]) o.customFields[idx]._sourceHeader = '';
      }
    });
  });

  editor.querySelectorAll('.drawer-field-value-text').forEach((el) => {
    el.addEventListener('input', function () {
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

  editor.querySelectorAll('.drawer-field-remove').forEach((el) => {
    el.addEventListener('click', function () {
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
            renderDrawerCustomFieldsEditor(o);
            updateDrawerCustomFieldsDisplay(o);
            toast('Field removed.', 'info');
            closeConfirmationModal();
          },
        });
      }
    });
  });

  editor.querySelectorAll('.drawer-field-value-select').forEach((sel) => {
    if (sel.value) {
      const txt = sel.parentElement.querySelector('.drawer-field-value-text');
      if (txt) txt.classList.add('hidden');
    }
  });
}

export function updateDrawerCustomFieldsDisplay(o) {
  const list = document.getElementById('drawerCustomFieldsList');
  if (!list) return;
  const fields = (o.customFields || []).filter((f) => f.label && (f.value || f._sourceHeader));
  if (!fields.length) {
    list.innerHTML = '<p class="text-xs text-black/40">No custom fields yet. Click "Add Field" to add one.</p>';
    return;
  }
  list.innerHTML = fields
    .map((f) => {
      const actualValue = customFieldValue(o, f.label) || f.value || '';
      return `<div class="custom-field-item bg-black/5 rounded-lg p-2 border border-black/10"><strong class="text-black/60">${esc(f.label)}</strong> <span class="text-black/80">${formatFieldValue(actualValue)}</span></div>`;
    })
    .join('');
}

// ---- Helper: allAvailableHeaders ----
function allAvailableHeaders(o) {
  const headers = new Set();
  if (o && o._importHeaders) o._importHeaders.forEach(h => headers.add(h));
  if (o && o._rawData) Object.keys(o._rawData).forEach(h => headers.add(h));
  return [...headers].filter(Boolean);
}

// ---- Temporary placeholders (will be replaced by app.js) ----
function updateUndoButtons() {
  if (typeof window.updateUndoButtons === 'function') window.updateUndoButtons();
}

function toast(message, type = 'info') {
  if (typeof window.toast === 'function') window.toast(message, type);
}

function requireLogin() {
  if (typeof window.requireLogin === 'function') return window.requireLogin();
  return true;
}