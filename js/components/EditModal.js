// =========================================================
// EDIT MODAL – edit work order form
// =========================================================

import { orders, users, displayConfig, saveOrders, saveDisplayConfig, saveUsers, pushHistory } from '../data.js';
import {
  esc,
  nowDate,
  nowStamp,
  toInputDate,
  normalize,
  displayValue,
  customFieldValue,
  mergeCustomFields,
} from '../utils.js';
import { openConfirmationModal, closeConfirmationModal } from './ConfirmModal.js';
import { render, renderDrawer, selectedId, deleteSelected } from '../render.js';

export let editingId = null;

export function openEdit(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  editingId = id;

  const fieldConfigs = getAllFieldConfigs();
  const getSource = (key) => fieldConfigs[key]?.source || key;
  const getValue = (key) => displayValue(o, getSource(key));

  document.getElementById('editModalTitle').textContent = o.id.startsWith('NEW-') ? 'New Work Order' : 'Edit Work Order';
  document.getElementById('editModalSub').textContent = o.id;

  document.getElementById('formId').value = o.id;
  document.getElementById('formTitle').value = getValue('title') || o.title || '';
  document.getElementById('formStatus').value = getValue('status') || o.status || 'Open';
  document.getElementById('formPriority').value = getValue('priority') || o.priority || 'Medium';
  document.getElementById('formCategory').value = getValue('category') || o.category || '';
  document.getElementById('formLocation').value = getValue('location') || o.location || '';

  // Assignee dropdown
  const assigneeSelect = document.getElementById('formAssignee');
  const names = [
    'Unassigned',
    ...users.filter(u => u.active !== false).map(u => u.name),
    ...orders.map(x => x.assignee || 'Unassigned'),
  ].filter(Boolean);
  const uniqueNames = [...new Set(names)];
  assigneeSelect.innerHTML = uniqueNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  const resolvedAssignee = getValue('assignee') || o.assignee || 'Unassigned';
  assigneeSelect.value = resolvedAssignee;

  document.getElementById('formDueDate').value = toInputDate(getValue('dueDate') || o.dueDate);
  document.getElementById('formCreated').value = toInputDate(getValue('created') || o.created || nowDate());
  document.getElementById('formRequester').value = getValue('requester') || o.requester || '';
  document.getElementById('formDescription').value = getValue('description') || o.description || '';

  renderEditCustomFields(o);

  // Card date source/label
  const cardSource = document.getElementById('cardDateSource');
  const orderCardSource = o.cardDateSource || displayConfig.cardDateSource || 'dueDate';
  const orderCardLabel = o.cardDateLabel || displayConfig.cardDateLabel || 'Due Date';
  if (cardSource) {
    const allHeaders = allAvailableHeaders(o);
    const stdOpts = [
      ['dueDate', 'Due Date'],
      ['created', 'Created Date'],
      ['status', 'Status'],
      ['priority', 'Priority'],
      ['category', 'Category'],
      ['location', 'Location'],
      ['assignee', 'Assigned To'],
      ['requester', 'Requester'],
    ];
    const allOpts = [...stdOpts];
    allHeaders.forEach(h => {
      if (!allOpts.some(x => x[0] === h)) allOpts.push([h, h + ' (Imported)']);
    });
    cardSource.innerHTML = allOpts
      .map(([v, l]) => `<option value="${esc(v)}" ${orderCardSource === v ? 'selected' : ''}>${esc(l)}</option>`)
      .join('');
  }
  const cardLabel = document.getElementById('cardDateLabel');
  if (cardLabel) cardLabel.value = orderCardLabel;

  renderCardExtraChoices(o);

  document.getElementById('editModal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  updateUndoButtons();
}

export function closeEdit() {
  editingId = null;
  document.getElementById('editModal').classList.add('hidden');
  if (!selectedId) document.body.classList.remove('overflow-hidden');
}

export function deleteFromEdit() {
  if (!editingId) return;
  const o = orders.find(x => x.id === editingId);
  if (!o) return;
  openConfirmationModal({
    title: 'Delete work order',
    message: `Delete ${o.id} — "${o.title}"? This can be undone immediately using Undo.`,
    confirmText: 'Delete',
    confirmClass: 'bg-red-600 hover:bg-red-700',
    onConfirm: () => {
      pushHistory('delete ' + o.id);
      orders = orders.filter(x => x.id !== editingId);
      saveOrders();
      render();
      const deletedId = editingId;
      editingId = null;
      document.getElementById('editModal').classList.add('hidden');
      if (selectedId === deletedId) closeDrawer();
      else if (!selectedId) document.body.classList.remove('overflow-hidden');
      toast(`🗑️ ${o.id} deleted. Use Undo to restore it.`, 'success');
      closeConfirmationModal();
    },
  });
}

export function saveForm(e) {
  e.preventDefault();
  const id = editingId;
  const o = orders.find(x => x.id === id);
  if (!o) return;

  pushHistory('before editing ' + id);

  const wrap = document.getElementById('editCustomFields');
  let customFields = [];
  try {
    customFields = JSON.parse(wrap.dataset.fields || '[]');
  } catch {
    customFields = [];
  }
  const labelInputs = wrap.querySelectorAll('.edit-field-label');
  const selectInputs = wrap.querySelectorAll('.edit-field-value-select');
  const textInputs = wrap.querySelectorAll('.edit-field-value-text');
  const newFields = [];
  labelInputs.forEach((el, idx) => {
    const rawLabel = el.value.trim();
    const select = selectInputs[idx];
    const text = textInputs[idx];
    let value = '';
    let sourceHeader = '';
    if (select && select.value) {
      value = displayValue(o, select.value) || '';
      sourceHeader = select.value;
    } else if (text) {
      value = text.value.trim();
    }
    const label = rawLabel || sourceHeader || '';
    if (label || value || sourceHeader) {
      newFields.push({ label, value, _sourceHeader: sourceHeader });
    }
  });
  const finalCustomFields = normalizeCustomFields(newFields.length ? newFields : customFields);
  o.customFields = finalCustomFields;
  if (wrap) wrap.dataset.fields = JSON.stringify(finalCustomFields);

  const assignee = document.getElementById('formAssignee').value.trim() || 'Unassigned';

  Object.assign(o, {
    title: document.getElementById('formTitle').value.trim() || 'Untitled Work Order',
    status: document.getElementById('formStatus').value,
    priority: document.getElementById('formPriority').value,
    category: document.getElementById('formCategory').value.trim(),
    location: document.getElementById('formLocation').value.trim(),
    assignee,
    dueDate: document.getElementById('formDueDate').value,
    created: document.getElementById('formCreated').value || o.created || nowDate(),
    requester: document.getElementById('formRequester').value.trim(),
    description: document.getElementById('formDescription').value.trim(),
    customFields: finalCustomFields,
  });

  const cardSource = document.getElementById('cardDateSource');
  const cardLabel = document.getElementById('cardDateLabel');
  const resolvedCardSource = cardSource ? cardSource.value || 'dueDate' : o.cardDateSource || displayConfig.cardDateSource || 'dueDate';
  const resolvedCardLabel = cardLabel ? cardLabel.value.trim() || 'Due Date' : o.cardDateLabel || displayConfig.cardDateLabel || 'Due Date';
  if (cardSource) {
    displayConfig.cardDateSource = resolvedCardSource;
    o.cardDateSource = resolvedCardSource;
  }
  if (cardLabel) {
    displayConfig.cardDateLabel = resolvedCardLabel;
    o.cardDateLabel = resolvedCardLabel;
  }
  const cardExtraChoices = document.getElementById('cardExtraFieldChoices');
  if (cardExtraChoices) {
    displayConfig.cardExtraFields = [
      ...cardExtraChoices.querySelectorAll('[data-card-extra]:checked'),
    ].map(x => x.dataset.cardExtra).slice(0, 2);
  }
  saveDisplayConfig();

  if (assignee !== 'Unassigned' && !users.some(u => u.name === assignee)) {
    users.push({ id: `USR-${Date.now()}`, name: assignee, active: true });
    saveUsers();
  }
  o.activity = o.activity || [];
  o.activity.push({ date: nowStamp(), text: 'Work order details edited' });
  saveOrders();
  render();
  closeEdit();
  if (selectedId === id) renderDrawer(id);
  toast('✅ Work order saved successfully.', 'success');
}

// ---- Helper: renderEditCustomFields (exported) ----
export function renderEditCustomFields(o) {
  const wrap = document.getElementById('editCustomFields');
  if (!wrap) return;
  const allHeaders = allAvailableHeaders(o);
  const headerOpts = allHeaders.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');

  const allConfigs = getAllFieldConfigs();
  const globalKeys = Object.keys(allConfigs).filter(k => k.startsWith('custom_'));
  const globalFields = globalKeys
    .filter(k => allConfigs[k].showOnCard !== false)
    .map(k => {
      const cfg = allConfigs[k];
      const label = cfg.label || k;
      const source = cfg.source || '';
      const existing = (o.customFields || []).find(f => f.label === label || f._sourceHeader === source);
      if (existing) {
        return { label, value: existing.value || '', _sourceHeader: source };
      } else {
        return { label, value: '', _sourceHeader: source };
      }
    });

  const perOrderFields = (o.customFields || [])
    .filter(f => f.label && !globalFields.some(g => g.label === f.label))
    .map(f => ({ ...f }));

  const mergedFields = globalFields.length ? globalFields : perOrderFields;
  const fields = mergedFields.length ? mergedFields : [{ label: '', value: '', _sourceHeader: '' }];

  let html = '';
  fields.forEach((f, idx) => {
    const selectedHeader = f._sourceHeader || '';
    const resolvedValue = selectedHeader ? displayValue(o, selectedHeader) : f.value || '';
    html += `
      <div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center edit-custom-field-row rounded-xl border border-black/10 bg-white p-2.5" data-field-index="${idx}">
        <input class="field-input-sm edit-field-label" data-idx="${idx}" value="${esc(f.label || selectedHeader || '')}" placeholder="Name">
        <div class="flex items-center gap-2">
          <select class="field-input-sm edit-field-value-select flex-1" data-idx="${idx}">
            <option value="">Header from import</option>
            ${headerOpts}
          </select>
        </div>
        <input class="field-input-sm edit-field-value-text ${selectedHeader ? 'hidden' : ''}" data-idx="${idx}" placeholder="Value (optional)" value="${esc(resolvedValue)}">
        <button type="button" class="w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center field-remove-btn edit-field-remove" data-idx="${idx}" title="Remove field">✕</button>
      </div>
    `;
  });

  wrap.innerHTML = html;

  wrap.querySelectorAll('.edit-field-value-select').forEach((sel) => {
    const idx = parseInt(sel.dataset.idx);
    const field = fields[idx];
    if (field && field._sourceHeader) sel.value = field._sourceHeader;
    if (field && !field._sourceHeader && field.value) sel.value = '';
  });

  wrap.dataset.fields = JSON.stringify(fields);

  // Bind events
  wrap.querySelectorAll('.edit-field-label').forEach((el) => {
    el.addEventListener('input', function () {
      const idx = parseInt(this.dataset.idx);
      const fields2 = getEditCustomFields();
      if (fields2[idx]) fields2[idx].label = this.value;
      wrap.dataset.fields = JSON.stringify(fields2);
      if (editingId) {
        const o2 = orders.find(x => x.id === editingId);
        if (o2 && o2.customFields && o2.customFields[idx]) {
          o2.customFields[idx].label = this.value;
        }
        syncEditCustomFieldsToOrder(o2);
      }
    });
  });

  wrap.querySelectorAll('.edit-field-value-select').forEach((el) => {
    el.addEventListener('change', function () {
      const idx = parseInt(this.dataset.idx);
      const fields2 = getEditCustomFields();
      const o2 = orders.find(x => x.id === editingId);
      const valueText = this.parentElement.parentElement.querySelector('.edit-field-value-text');

      if (fields2[idx]) {
        if (this.value) {
          const resolved = o2 ? displayValue(o2, this.value) : '';
          fields2[idx].value = resolved;
          fields2[idx]._sourceHeader = this.value;
          if (valueText) {
            valueText.value = resolved;
            valueText.classList.add('hidden');
          }
        } else {
          fields2[idx].value = valueText ? valueText.value : '';
          fields2[idx]._sourceHeader = '';
          if (valueText) valueText.classList.remove('hidden');
        }
      }
      wrap.dataset.fields = JSON.stringify(fields2);

      if (o2 && o2.customFields && o2.customFields[idx]) {
        if (this.value) {
          const resolved = o2 ? displayValue(o2, this.value) : '';
          o2.customFields[idx].value = resolved;
          o2.customFields[idx]._sourceHeader = this.value;
        } else {
          o2.customFields[idx].value = valueText ? valueText.value : '';
          o2.customFields[idx]._sourceHeader = '';
        }
      }
      syncEditCustomFieldsToOrder(o2);
    });
  });

  wrap.querySelectorAll('.edit-field-value-text').forEach((el) => {
    el.addEventListener('input', function () {
      const idx = parseInt(this.dataset.idx);
      const fields2 = getEditCustomFields();
      const o2 = orders.find(x => x.id === editingId);
      if (fields2[idx]) {
        fields2[idx].value = this.value.trim();
        fields2[idx]._sourceHeader = '';
      }
      wrap.dataset.fields = JSON.stringify(fields2);
      if (o2 && o2.customFields && o2.customFields[idx]) {
        o2.customFields[idx].value = this.value.trim();
        o2.customFields[idx]._sourceHeader = '';
      }
      syncEditCustomFieldsToOrder(o2);
    });
  });

  wrap.querySelectorAll('.edit-field-remove').forEach((el) => {
    el.addEventListener('click', function () {
      const idx = parseInt(this.dataset.idx);
      const fields2 = getEditCustomFields();
      if (fields2.length > idx) {
        const label = fields2[idx].label || 'this field';
        openConfirmationModal({
          title: 'Remove field',
          message: `Remove "${label}" from this work order?`,
          confirmText: 'Remove',
          confirmClass: 'bg-red-600 hover:bg-red-700',
          onConfirm: () => {
            fields2.splice(idx, 1);
            if (!fields2.length) fields2.push({ label: '', value: '', _sourceHeader: '' });
            const o2 = orders.find(x => x.id === editingId);
            if (o2) o2.customFields = fields2;
            renderEditCustomFields(o2);
            toast('Field removed.', 'info');
            closeConfirmationModal();
          },
        });
      }
    });
  });
}

// ---- Helper: getEditCustomFields ----
function getEditCustomFields() {
  const wrap = document.getElementById('editCustomFields');
  try { return JSON.parse(wrap.dataset.fields || '[]'); } catch { return []; }
}

// ---- Helper: syncEditCustomFieldsToOrder ----
function syncEditCustomFieldsToOrder(o2) {
  const wrap = document.getElementById('editCustomFields');
  if (!wrap || !o2) return;
  try {
    const fields2 = JSON.parse(wrap.dataset.fields || '[]');
    o2.customFields = normalizeCustomFields(fields2);
    wrap.dataset.fields = JSON.stringify(o2.customFields);
  } catch {
    o2.customFields = [];
    wrap.dataset.fields = '[]';
  }
}

// ---- Helper: renderCardExtraChoices ----
function renderCardExtraChoices(o) {
  const wrap = document.getElementById('cardExtraFieldChoices');
  if (!wrap) return;
  const labels = ['category', 'location', 'assignee', 'requester', ...allKnownCustomLabels()];
  const allHeaders = allAvailableHeaders(o);
  const unique = [...new Set([...labels, ...allHeaders])];
  const labelText = { category: 'Category', location: 'Location', assignee: 'Assigned To', requester: 'Requester' };
  wrap.innerHTML = unique
    .map(label =>
      `<label class="flex items-center gap-2 p-2 rounded-lg bg-white border border-black/10 text-[10px] font-bold text-black/70">
        <input type="checkbox" data-card-extra="${esc(label)}" ${displayConfig.cardExtraFields.includes(label) ? 'checked' : ''} class="rounded">
        <span>${esc(labelText[label] || label)}</span>
      </label>`
    )
    .join('');
  wrap.querySelectorAll('[data-card-extra]').forEach(cb =>
    cb.addEventListener('change', () => {
      displayConfig.cardExtraFields = [
        ...wrap.querySelectorAll('[data-card-extra]:checked'),
      ].map(x => x.dataset.cardExtra).slice(0, 2);
      saveDisplayConfig();
    })
  );
}

// ---- Internal helpers ----
function normalizeCustomFields(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(f => f && (String(f.label || '').trim() || String(f.value ?? '').trim() || String(f._sourceHeader || '').trim()))
    .map(f => {
      const sourceHeader = String(f._sourceHeader || '').trim();
      const label = String(f.label || '').trim() || sourceHeader;
      const value = String(f.value ?? '').trim();
      return { label, value, _sourceHeader: sourceHeader };
    })
    .filter(f => f.label || f.value || f._sourceHeader);
}

function allKnownCustomLabels() {
  return [...new Set(orders.flatMap(o => (Array.isArray(o.customFields) ? o.customFields : []).map(f => String(f.label || '').trim()).filter(Boolean)))];
}

function allAvailableHeaders(o) {
  const headers = new Set();
  if (o && o._importHeaders) o._importHeaders.forEach(h => headers.add(h));
  if (o && o._rawData) Object.keys(o._rawData).forEach(h => headers.add(h));
  return [...headers].filter(Boolean);
}

function getAllFieldConfigs() {
  const coreFields = ['id', 'title', 'status', 'priority', 'category', 'location', 'assignee', 'requester', 'created', 'dueDate', 'description'];
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

// ---- Temporary placeholders ----
function toast(message, type = 'info') {
  if (typeof window.toast === 'function') window.toast(message, type);
}
function updateUndoButtons() {
  if (typeof window.updateUndoButtons === 'function') window.updateUndoButtons();
}
function closeDrawer() {
  if (typeof window.closeDrawer === 'function') window.closeDrawer();
}

// ---- Exports ----
export { saveForm, renderEditCustomFields };