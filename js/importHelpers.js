// =========================================================
// IMPORT HELPERS – functions that depend on data state
// =========================================================

import {
  orders,
  undoHistory,
  users,
  displayConfig,
  importedHeaders,
  saveOrders,
  saveUndoHistory,
  saveUsers,
  saveDisplayConfig,
  pushHistory,
} from './data.js';

import {
  esc,
  normalize,
  formatDate,
  parseDateValue,
  nowDate,
  nowStamp,
  statusClass,
  priorityClass,
  normalizePriority,
  displayValue,
  customFieldValue,
  mergeCustomFields,
  generateStableId,
  resolveRowValueByHeader,
  buildImportCustomFieldsForRow,
  inferMapping,
  toast,
  parseDelimited,
  initials,
  formatFieldValue,
  getStatusAccentClass,
} from './utils.js';

// ---------- Field configuration ----------
export function getFieldConfig(fieldKey) {
  const defaults = {
    id: { label: 'Work Order ID', source: 'id', showOnCard: true, showInTable: true },
    title: { label: 'Title', source: 'title', showOnCard: true, showInTable: true },
    status: { label: 'Status', source: 'status', showOnCard: true, showInTable: true },
    priority: { label: 'Priority', source: 'priority', showOnCard: false, showInTable: true },
    category: { label: 'Category', source: 'category', showOnCard: false, showInTable: false },
    location: { label: 'Location', source: 'location', showOnCard: true, showInTable: true },
    assignee: { label: 'Assigned To', source: 'assignee', showOnCard: true, showInTable: true },
    requester: { label: 'Requester', source: 'requester', showOnCard: false, showInTable: false },
    created: { label: 'Created Date', source: 'created', showOnCard: false, showInTable: true },
    dueDate: { label: 'Due Date', source: 'dueDate', showOnCard: true, showInTable: true },
    description: { label: 'Description', source: 'description', showOnCard: true, showInTable: false },
  };
  const fromConfig = displayConfig.fieldConfig && displayConfig.fieldConfig[fieldKey];
  if (fromConfig) {
    if (!fromConfig.source && defaults[fieldKey]) fromConfig.source = defaults[fieldKey].source;
    return { ...defaults[fieldKey], ...fromConfig };
  }
  return defaults[fieldKey] || { label: fieldKey, source: fieldKey };
}

export function updateFieldConfig(fieldKey, updates) {
  if (!displayConfig.fieldConfig) displayConfig.fieldConfig = {};
  displayConfig.fieldConfig[fieldKey] = { ...displayConfig.fieldConfig[fieldKey], ...updates };
  saveDisplayConfig();
}

export function addCustomFieldConfig(label, source) {
  const allConfigs = getAllFieldConfigs();
  const customKeys = Object.keys(allConfigs).filter(k => k.startsWith('custom_'));
  const newKey = `custom_${customKeys.length + 1}`;
  if (!displayConfig.fieldConfig) displayConfig.fieldConfig = {};
  displayConfig.fieldConfig[newKey] = { label, source, showOnCard: true, showInTable: true };
  saveDisplayConfig();
  return newKey;
}

export function removeCustomFieldConfig(fieldKey) {
  if (displayConfig.fieldConfig && displayConfig.fieldConfig[fieldKey]) {
    delete displayConfig.fieldConfig[fieldKey];
    saveDisplayConfig();
  }
}

export function getAllFieldConfigs() {
  const coreFields = ['id','title','status','priority','category','location','assignee','requester','created','dueDate','description'];
  const configs = {};
  coreFields.forEach(f => {
    configs[f] = getFieldConfig(f);
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

export function getOrderedFieldConfigs() {
  const allConfigs = getAllFieldConfigs();
  const coreKeys = Object.keys(allConfigs);
  if (!displayConfig.tableColumnOrder || displayConfig.tableColumnOrder.length === 0) {
    displayConfig.tableColumnOrder = coreKeys;
    saveDisplayConfig();
  }
  let order = displayConfig.tableColumnOrder.filter(key => allConfigs[key]);
  const existingKeys = new Set(order);
  coreKeys.forEach(key => {
    if (!existingKeys.has(key)) order.push(key);
  });
  const ordered = {};
  order.forEach(key => { if (allConfigs[key]) ordered[key] = allConfigs[key]; });
  return ordered;
}

// ---------- Header and order helpers ----------
export function allAvailableHeaders(o) {
  const headers = new Set();
  orders.forEach(order => {
    if (order._importHeaders) order._importHeaders.forEach(h => headers.add(h));
    if (order._rawData) Object.keys(order._rawData).forEach(h => headers.add(h));
  });
  importedHeaders.forEach(h => headers.add(h));
  if (o && o._importHeaders) o._importHeaders.forEach(h => headers.add(h));
  if (o && o._rawData) Object.keys(o._rawData).forEach(h => headers.add(h));
  return [...headers].filter(Boolean);
}

export function allKnownCustomLabels() {
  return [...new Set(orders.flatMap(o => (Array.isArray(o.customFields) ? o.customFields : []).map(f => String(f.label || '').trim()).filter(Boolean)))];
}

export function ensureFieldInAllOrders(label, source) {
  orders.forEach(o => {
    if (!Array.isArray(o.customFields)) o.customFields = [];
    if (!o.customFields.some(f => f.label === label)) {
      o.customFields.push({ label, value: '', _sourceHeader: source || '' });
    }
  });
  saveOrders();
}

export function getAvailableDateFields() {
  const allConfigs = getAllFieldConfigs();
  const fields = [];
  function fieldHasDateValues(source) {
    if (!source) return false;
    let dateCount = 0, totalCount = 0;
    const sample = orders.slice(0, 500);
    for (const o of sample) {
      const val = displayValue(o, source);
      if (val && typeof val === 'string' && val.trim()) {
        totalCount++;
        if (parseDateValue(val) !== '') dateCount++;
      }
    }
    if (totalCount === 0) return false;
    return (dateCount / totalCount) >= 0.3;
  }
  Object.keys(allConfigs).forEach(key => {
    const cfg = allConfigs[key];
    const source = cfg.source || key;
    if (!source) return;
    if (fieldHasDateValues(source)) {
      fields.push({ key, source, label: cfg.label || key });
    }
  });
  const sourceMap = new Map();
  fields.forEach(f => {
    if (!sourceMap.has(f.source)) sourceMap.set(f.source, { source: f.source, labels: [] });
    sourceMap.get(f.source).labels.push(f.label);
  });
  let grouped = Array.from(sourceMap.values()).map(item => ({ value: item.source, label: item.labels.join(' / ') }));
  const selectedSources = displayConfig.calendarDateFields || [];
  if (selectedSources.length > 0) {
    grouped = grouped.filter(f => selectedSources.includes(f.value));
  }
  const createdIdx = grouped.findIndex(f => f.value === 'created');
  if (createdIdx > 0) { const [created] = grouped.splice(createdIdx, 1); grouped.unshift(created); }
  return grouped;
}

// ---------- Import functions ----------
export function makeMappedOrder(row, i) {
  function get(field) {
    const cfg = displayConfig.fieldConfig?.[field];
    if (!cfg) return '';
    const source = cfg.source || field;
    const val = resolveRowValueByHeader(row, source);
    return val !== undefined && val !== null ? String(val).trim() : '';
  }
  const customFields = [];
  if (displayConfig.fieldConfig) {
    Object.keys(displayConfig.fieldConfig).forEach(key => {
      if (key.startsWith('custom_')) {
        const cfg = displayConfig.fieldConfig[key];
        const source = cfg.source || '';
        const label = cfg.label || source || key;
        const value = source ? resolveRowValueByHeader(row, source) : '';
        if (label) customFields.push({ label, value: String(value || '').trim(), _sourceHeader: source });
      }
    });
  }
  const rawId = get('id');
  const id = rawId || generateStableId(row);
  const rawStatus = get('status') || 'Open';
  const rawPriority = get('priority') || '';
  const dueDate = parseDateValue(get('dueDate'));
  let remarksValue = get('dueDate');
  let finalStatus = rawStatus;
  if (/complete/i.test(remarksValue)) finalStatus = 'Completed';
  else finalStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase() || 'Open';
  return {
    id,
    title: get('title') || 'Untitled Work Order',
    description: get('description') || '',
    status: finalStatus,
    priority: rawPriority ? normalizePriority(rawPriority) : 'Medium',
    category: get('category') || 'General',
    location: get('location') || '',
    assignee: get('assignee') || 'Unassigned',
    requester: get('requester') || '',
    created: parseDateValue(get('created')) || nowDate(),
    dueDate,
    customFields,
    activity: [],
    sourceOrder: i,
    _importHeaders: importedHeaders.slice(),
    _rawData: { ...row },
  };
}

// Global import state
let importHeaders = [];
let importRows = [];
let importSourceName = '';
let importSourceType = 'file';
let importMapping = {};
let importFieldLabels = {};
let importFieldTypes = {};
let importCustomMappings = [];
let importFieldShowOnCard = {};

export function resetImportCenter(keepUrl = false) {
  importHeaders = [];
  importRows = [];
  importSourceName = '';
  importSourceType = 'file';
  importMapping = {};
  importFieldLabels = {};
  importFieldTypes = {};
  importCustomMappings = [];
  importFieldShowOnCard = {};
  const badge = document.getElementById('importSourceBadge');
  if (badge) badge.textContent = 'No data loaded';
  const fileName = document.getElementById('importFileName');
  if (fileName) fileName.textContent = '';
  const rowCount = document.getElementById('importRowCount');
  if (rowCount) rowCount.textContent = '';
  const summary = document.getElementById('importMappingSummary');
  if (summary) summary.textContent = 'Load a file to begin.';
  const mappingArea = document.getElementById('importMappingArea');
  if (mappingArea) mappingArea.classList.add('hidden');
  const previewArea = document.getElementById('importPreviewArea');
  if (previewArea) previewArea.classList.add('hidden');
  const emptyPreview = document.getElementById('importEmptyPreview');
  if (emptyPreview) emptyPreview.classList.remove('hidden');
  const readyBadge = document.getElementById('importReadyBadge');
  if (readyBadge) {
    readyBadge.textContent = 'WAITING';
    readyBadge.className = 'inline-flex items-center px-2 py-1 rounded-full bg-black/10 text-black/50 text-[10px] font-black';
  }
  const confirmBtn = document.getElementById('confirmImportBtn');
  if (confirmBtn) confirmBtn.disabled = true;
  const pasteData = document.getElementById('importPasteData');
  if (pasteData) pasteData.value = '';
  const fileInput = document.getElementById('importFileInput');
  if (fileInput) fileInput.value = '';
  if (!keepUrl) {
    const apiUrl = document.getElementById('importApiUrl');
    if (apiUrl) apiUrl.value = '';
  }
}

export function showImportData(headers, rows, source = 'pasted data', sourceType = 'file') {
  importHeaders = headers.map((h, i) => String(h || `Column ${i+1}`).trim());
  importRows = rows.map(r => {
    const o = {};
    importHeaders.forEach(h => o[h] = r[h] ?? '');
    return o;
  }).filter(r => Object.values(r).some(v => String(v).trim() !== ''));
  importSourceName = source;
  importSourceType = sourceType;

  const inferred = inferMapping(importHeaders, importRows);
  if (!displayConfig.fieldConfig) displayConfig.fieldConfig = {};
  const coreFields = ['id','title','description','status','priority','category','location','assignee','requester','created','dueDate'];
  coreFields.forEach(field => {
    if (!displayConfig.fieldConfig[field]) {
      displayConfig.fieldConfig[field] = { label: field.charAt(0).toUpperCase() + field.slice(1), source: inferred[field] || field, showOnCard: true, showInTable: true };
    } else {
      displayConfig.fieldConfig[field].source = inferred[field] || displayConfig.fieldConfig[field].source || field;
    }
  });
  saveDisplayConfig();

  const badge = document.getElementById('importSourceBadge');
  if (badge) badge.textContent = source;
  const rowCount = document.getElementById('importRowCount');
  if (rowCount) rowCount.textContent = `${importRows.length} rows`;
  const summary = document.getElementById('importMappingSummary');
  if (summary) summary.textContent = `Detected ${importHeaders.length} source columns and ${importRows.length} data rows. Review the mapping and projected cards before confirming.`;
  const mappingArea = document.getElementById('importMappingArea');
  if (mappingArea) mappingArea.classList.remove('hidden');
  const previewArea = document.getElementById('importPreviewArea');
  if (previewArea) previewArea.classList.remove('hidden');
  const emptyPreview = document.getElementById('importEmptyPreview');
  if (emptyPreview) emptyPreview.classList.add('hidden');

  renderImportMapping();
  renderImportPreview();
}

export function detectColumnType(columnName, rows) {
  if (!rows || !rows.length) return 'mapped';
  const values = rows.map(r => String(r[columnName] || '').trim()).filter(v => v !== '');
  if (values.length === 0) return 'mapped';
  const datePatterns = [
    /^\d{4}-\d{1,2}-\d{1,2}$/,
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
    /^\d{1,2}-\d{1,2}-\d{2,4}$/,
    /^[A-Za-z]{3,9}\s+\d{1,2}(?:,|\s)\s*\d{2,4}$/,
    /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}$/,
    /^[A-Za-z]{3,9}\s+\d{1,2}$/,
    /^\d{1,2}\s+[A-Za-z]{3,9}$/,
    /^\d{4}-\d{1,2}-\d{1,2}T\d{2}:\d{2}:\d{2}/,
  ];
  const dateMatch = values.filter(v => datePatterns.some(p => p.test(v))).length;
  const dateRatio = dateMatch / values.length;
  const headerLower = columnName.toLowerCase();
  const dateKeywords = ['date','created','due','transmit','open','close','start','end','deadline','target'];
  const headerBoost = dateKeywords.some(kw => headerLower.includes(kw)) ? 0.2 : 0;
  let confidence = dateRatio + headerBoost;
  if (confidence > 0.45) return 'date';
  const uniqueValues = new Set(values);
  const uniqueRatio = uniqueValues.size / values.length;
  if (uniqueValues.size >= 2 && uniqueValues.size <= 10 && uniqueRatio < 0.5) {
    const maxFrequency = Math.max(...Array.from(uniqueValues).map(v => values.filter(x => x === v).length));
    const freqRatio = maxFrequency / values.length;
    if (freqRatio > 0.25) return 'dropdown';
  }
  return 'mapped';
}

// ---------- Render custom rows (inline) ----------
function renderImportCustomRows() {
  const wrap = document.getElementById('importCustomRows');
  if (!wrap) return;

  let html = '';
  importCustomMappings.forEach((f, i) => {
    html += `
      <div class="import-custom-row grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center" data-custom-index="${i}">
        <input data-custom-label="${i}" class="field-input-sm border-black/10" placeholder="Name" value="${esc(f.label || '')}">
        <select data-custom-source="${i}" class="field-input-sm border-black/10">
          <option value="">Header from import</option>
          ${importHeaders.map(h => `<option value="${esc(h)}" ${f.source === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}
        </select>
        <input data-custom-value="${i}" class="field-input-sm border-black/10" placeholder="Value (optional)" value="${esc(f.value || '')}">
        <button type="button" data-custom-remove="${i}" class="w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center">✕</button>
      </div>
    `;
  });

  wrap.innerHTML = html || '<p class="text-xs text-black/40 italic">No custom fields added yet.</p>';

  wrap.querySelectorAll('[data-custom-label]').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.customLabel);
      if (importCustomMappings[idx]) {
        importCustomMappings[idx].label = e.target.value.trim();
        renderImportMapping();
        renderImportPreview();
      }
    });
  });

  wrap.querySelectorAll('[data-custom-source]').forEach(el => {
    el.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.customSource);
      if (importCustomMappings[idx]) {
        importCustomMappings[idx].source = e.target.value;
        if (!importCustomMappings[idx].label && e.target.value) {
          importCustomMappings[idx].label = e.target.value;
        }
        renderImportMapping();
        renderImportPreview();
      }
    });
  });

  wrap.querySelectorAll('[data-custom-value]').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.customValue);
      if (importCustomMappings[idx]) {
        importCustomMappings[idx].value = e.target.value.trim();
        renderImportPreview();
      }
    });
  });

  wrap.querySelectorAll('[data-custom-remove]').forEach(el => {
    el.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.customRemove);
      if (importCustomMappings.length > idx) {
        importCustomMappings.splice(idx, 1);
        renderImportMapping();
        renderImportPreview();
      }
    });
  });
}

// ---------- Render import mapping ----------
export function renderImportMapping() {
  const allFields = displayConfig.fieldConfig || {};
  const coreFields = ['id','title','description','status','priority','category','location','assignee','requester','created','dueDate'];
  coreFields.forEach(f => {
    if (!allFields[f]) allFields[f] = { label: f.charAt(0).toUpperCase() + f.slice(1), source: f, showOnCard: true, showInTable: true };
  });
  const orderedKeys = [...coreFields, ...Object.keys(allFields).filter(k => k.startsWith('custom_'))];
  const grid = document.getElementById('importMappingGrid');
  if (!grid) return;
  let html = '';
  orderedKeys.forEach((key, idx) => {
    const cfg = allFields[key];
    const isCore = !key.startsWith('custom_');
    const mapped = cfg.source || '';
    const label = cfg.label || key;
    const statusText = mapped ? 'MAPPED' : 'UNMAPPED';
    const statusClass2 = mapped ? 'text-brand-success' : 'text-black/40';
    const required = key === 'title';
    let sourceSelect = `<select data-import-map-field="${key}" class="w-full bg-white border border-black/10 rounded-lg px-2 py-2 text-xs font-semibold text-black/70"><option value="">— Not mapped —</option>`;
    if (importHeaders && importHeaders.length) {
      importHeaders.forEach(h => { sourceSelect += `<option value="${esc(h)}" ${mapped === h ? 'selected' : ''}>${esc(h)}</option>`; });
    }
    sourceSelect += `</select>`;
    const labelInput = `<input data-import-label-field="${key}" class="w-full rounded-md border border-black/10 bg-white px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-black/70 placeholder:text-black/30 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20" value="${esc(label)}" placeholder="Label">`;
    const showOnCard = cfg.showOnCard !== false;
    const visibilityToggle = `<label class="flex items-center gap-1.5 text-[10px] font-bold text-black/60 cursor-pointer"><input type="checkbox" data-visibility="${key}" ${showOnCard ? 'checked' : ''} class="rounded"><span>Show on card</span></label>`;
    const removeBtn = isCore ? '' : `<button data-remove-custom="${key}" class="text-red-500 hover:text-red-700 text-sm font-bold" title="Remove this field">✕</button>`;
    let reorderBtns = '';
    if (orderedKeys.length > 1) {
      reorderBtns = `<div class="flex items-center gap-1"><button data-move-up="${idx}" class="p-1 rounded hover:bg-black/5 text-black/40 disabled:opacity-30" ${idx === 0 ? 'disabled' : ''} title="Move up">↑</button><button data-move-down="${idx}" class="p-1 rounded hover:bg-black/5 text-black/40 disabled:opacity-30" ${idx === orderedKeys.length - 1 ? 'disabled' : ''} title="Move down">↓</button></div>`;
    }
    html += `<div class="bg-black/5 border border-black/10 rounded-xl p-3 relative" data-field-key="${key}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1">${labelInput}</div>
        <div class="flex items-center gap-1 shrink-0">${reorderBtns}${removeBtn}</div>
      </div>
      <div class="flex items-center justify-between mt-2 gap-2">
        <span class="text-[9px] font-black ${statusClass2}">${statusText}${required ? ' • REQUIRED' : ''}</span>
        ${visibilityToggle}
      </div>
      <div class="mt-2 grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2">
        <span class="text-[8px] font-black uppercase tracking-wide text-black/40">Source</span>
        ${sourceSelect}
      </div>
    </div>`;
  });
  grid.innerHTML = html;

  grid.querySelectorAll('[data-import-label-field]').forEach(input => {
    input.addEventListener('change', function() {
      const key = this.dataset.importLabelField;
      const val = this.value.trim();
      if (displayConfig.fieldConfig && displayConfig.fieldConfig[key]) {
        displayConfig.fieldConfig[key].label = val;
        saveDisplayConfig();
        renderImportPreview();
        if (typeof window.render === 'function') window.render();
      }
    });
  });
  grid.querySelectorAll('[data-import-map-field]').forEach(sel => {
    sel.addEventListener('change', function() {
      const key = this.dataset.importMapField;
      const val = this.value;
      if (displayConfig.fieldConfig && displayConfig.fieldConfig[key]) {
        displayConfig.fieldConfig[key].source = val;
        saveDisplayConfig();
        renderImportPreview();
        if (typeof window.render === 'function') window.render();
      }
    });
  });
  grid.querySelectorAll('[data-visibility]').forEach(cb => {
    cb.addEventListener('change', function() {
      const key = this.dataset.visibility;
      const checked = this.checked;
      if (displayConfig.fieldConfig && displayConfig.fieldConfig[key]) {
        displayConfig.fieldConfig[key].showOnCard = checked;
        saveDisplayConfig();
        renderImportPreview();
        if (typeof window.render === 'function') window.render();
      }
    });
  });

  // Add custom field button – inline row (no prompt)
  const addCustomBtn = document.getElementById('addImportCustomBtn');
  if (addCustomBtn) {
    const newBtn = addCustomBtn.cloneNode(true);
    addCustomBtn.parentNode.replaceChild(newBtn, addCustomBtn);
    newBtn.addEventListener('click', function() {
      importCustomMappings.push({ label: '', source: '', value: '' });
      renderImportCustomRows();
      renderImportMapping();
      renderImportPreview();
    });
  }

  grid.querySelectorAll('[data-remove-custom]').forEach(btn => {
    btn.addEventListener('click', function() {
      const key = this.dataset.removeCustom;
      if (!key) return;
      const config = displayConfig.fieldConfig && displayConfig.fieldConfig[key];
      const label = config ? config.label : key;
      if (displayConfig.fieldConfig && displayConfig.fieldConfig[key]) {
        delete displayConfig.fieldConfig[key];
        saveDisplayConfig();
        orders.forEach(o => {
          if (Array.isArray(o.customFields)) {
            o.customFields = o.customFields.filter(f => String(f.label || '').trim() !== label);
          }
        });
        saveOrders();
        renderImportMapping();
        renderImportPreview();
        if (typeof window.render === 'function') window.render();
        toast(`Removed field "${label}"`, 'info');
      }
    });
  });

  renderImportCustomRows();
}

// ---------- Preview card (matches main cardHTML) ----------
function previewCardHTML(o) {
  const fieldConfigs = getAllFieldConfigs();
  const createdConfig = fieldConfigs.created || { label: "Created Date", source: "created", showOnCard: true };

  const idConfig = fieldConfigs.id || { label: "ID", source: "id", showOnCard: true };
  const titleConfig = fieldConfigs.title || { label: "Title", source: "title", showOnCard: true };
  const statusConfig = fieldConfigs.status || { label: "Status", source: "status", showOnCard: true };
  const categoryConfig = fieldConfigs.category || { label: "Category", source: "category", showOnCard: true };
  const locationConfig = fieldConfigs.location || { label: "Location", source: "location", showOnCard: true };
  const dueDateConfig = fieldConfigs.dueDate || { label: "Due Date", source: "dueDate", showOnCard: true };
  const assigneeConfig = fieldConfigs.assignee || { label: "Assigned To", source: "assignee", showOnCard: true };
  const priorityConfig = fieldConfigs.priority || { label: "Priority", source: "priority", showOnCard: true };
  const requesterConfig = fieldConfigs.requester || { label: "Requester", source: "requester", showOnCard: false };
  const descriptionConfig = fieldConfigs.description || { label: "Description", source: "description", showOnCard: true };

  const idVal = displayValue(o, idConfig.source) || o.id || "—";
  const titleVal = displayValue(o, titleConfig.source) || o.title || "Untitled Work Order";
  const statusVal = o.status || "Open";
  const categoryVal = displayValue(o, categoryConfig.source) || o.category || "General";
  const locationVal = displayValue(o, locationConfig.source) || o.location || "—";
  const dueDateVal = displayValue(o, dueDateConfig.source);
  const assigneeVal = displayValue(o, assigneeConfig.source) || o.assignee || "Unassigned";
  const priorityVal = displayValue(o, priorityConfig.source) || o.priority || "Medium";
  const requesterVal = displayValue(o, requesterConfig.source) || o.requester || "";
  const descriptionVal = displayValue(o, descriptionConfig.source) || o.description || "";

  const due = dueDateVal ? formatDate(dueDateVal) : "—";
  const dueLabel = dueDateConfig.label || "Due Date";
  const locationLabel = locationConfig.label || "Location";
  const createdVal = displayValue(o, createdConfig.source);
  const created = formatDate(createdVal || o.created);
  const overdue = o.dueDate && o.status !== "Completed" && o.status !== "Cancelled" && o.dueDate < nowDate();

  const showId = idConfig.showOnCard !== false;
  const showCategory = categoryConfig.showOnCard !== false;
  const showStatus = statusConfig.showOnCard !== false;
  const showTitle = titleConfig.showOnCard !== false;
  const showLocation = locationConfig.showOnCard !== false;
  const showDueDate = dueDateConfig.showOnCard !== false;
  const showAssignee = assigneeConfig.showOnCard !== false;
  const showPriority = priorityConfig.showOnCard !== false;

  // Header
  let headerTopHTML = "";
  if (showId || showCategory) {
    headerTopHTML = `<div class="flex items-center gap-2 mb-2">`;
    if (showId) headerTopHTML += `<span class="text-[11px] font-bold text-black/40">${esc(idVal)}</span>`;
    if (showId && showCategory) headerTopHTML += `<span class="w-1 h-1 rounded-full bg-black/20"></span>`;
    if (showCategory) headerTopHTML += `<span class="text-[11px] text-black/40">${esc(categoryVal)}</span>`;
    headerTopHTML += `</div>`;
  }

  // Title
  let titleHTML = "";
  if (showTitle) {
    titleHTML = `<h3 class="font-black text-black group-hover:text-brand-teal transition truncate">${esc(titleVal)}</h3>`;
  }

  // Status
  let statusHTML = "";
  if (showStatus) {
    statusHTML = `<span class="shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-bold ${statusClass(statusVal)}">${esc(statusVal)}</span>`;
  }

  // Description
  let descriptionHTML = "";
  if (descriptionConfig.showOnCard !== false && descriptionVal) {
    descriptionHTML = `<p class="mt-3 text-sm leading-5 text-black/60 line-clamp-2">${esc(descriptionVal)}</p>`;
  }

  // Location and Due Date
  let locationDueHTML = "";
  if (showLocation || showDueDate) {
    locationDueHTML = `<div class="mt-4 grid grid-cols-2 gap-2 text-xs">`;
    if (showLocation) {
      locationDueHTML += `
        <div class="bg-black/5 rounded-lg p-2.5">
          <p class="text-black/40">${esc(locationLabel)}</p>
          <div class="font-bold text-black/80 mt-0.5 truncate">${formatFieldValue(locationVal)}</div>
        </div>
      `;
    } else {
      locationDueHTML += `<div></div>`;
    }
    if (showDueDate) {
      locationDueHTML += `
        <div class="bg-black/5 rounded-lg p-2.5">
          <p class="text-black/40">${esc(dueLabel)}</p>
          <div class="font-bold ${overdue ? "text-red-600" : "text-black/80"} mt-0.5">${formatFieldValue(due)}</div>
        </div>
      `;
    } else {
      locationDueHTML += `<div></div>`;
    }
    locationDueHTML += `</div>`;
  }

  // Extra fields
  const skipFields = ["id", "title", "status", "location", "dueDate", "assignee", "priority", "category", "created", "requester", "description"];
  const extraFields = Object.keys(fieldConfigs)
    .filter(key => {
      const cfg = fieldConfigs[key];
      return cfg.showOnCard !== false && !skipFields.includes(key);
    })
    .slice(0, 4);

  let extraFieldsHTML = "";
  if (extraFields.length) {
    extraFieldsHTML = `<div class="mt-4 grid grid-cols-2 gap-2 text-xs">`;
    extraFields.forEach(key => {
      const cfg = fieldConfigs[key];
      const val = displayValue(o, cfg.source);
      extraFieldsHTML += `
        <div class="bg-black/5 rounded-lg p-2.5">
          <p class="text-black/40 truncate">${esc(cfg.label || key)}</p>
          <div class="font-bold text-black/80 mt-0.5 truncate">${formatFieldValue(val)}</div>
        </div>
      `;
    });
    extraFieldsHTML += `</div>`;
  }

  // Created line
  let createdLineHTML = '';
  if (createdConfig.showOnCard !== false) {
    let line = `Created ${esc(created)}`;
    if (requesterVal && requesterConfig.showOnCard !== false) {
      line += ` • By ${esc(requesterVal)}`;
    }
    createdLineHTML = `<div class="mt-3 flex items-center gap-2 text-[11px] text-black/40">${line}</div>`;
  }

  // Footer: Assignee and Priority
  let footerHTML = "";
  if (showAssignee || showPriority) {
    footerHTML = `
      <div class="mt-4 pt-4 border-t border-black/10 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center text-[10px] font-black shrink-0">${esc(initials(assigneeVal))}</div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-black/80 truncate">${esc(assigneeVal)}</p>
            <p class="text-[10px] text-black/40">Assigned user</p>
          </div>
        </div>
        ${showPriority ? `<span class="px-2 py-1 rounded-md text-[10px] font-bold ${priorityClass(priorityVal)}">${esc(priorityVal)}</span>` : ''}
      </div>
    `;
  }

  return `
    <article class="bg-white border border-brand-teal/20 rounded-2xl p-5 shadow-sm text-black h-full flex flex-col ${getStatusAccentClass(o.status)}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          ${headerTopHTML}
          ${titleHTML}
        </div>
        ${statusHTML}
      </div>

      ${descriptionHTML}

      ${locationDueHTML}

      ${extraFieldsHTML}

      ${createdLineHTML}

      ${footerHTML}

      <div class="mt-3 flex items-center justify-between">
        <span class="text-[11px] font-bold text-brand-teal opacity-0 group-hover:opacity-100 transition">View details →</span>
        <span class="text-[10px] text-black/30">${o.activity?.length || 0} activity</span>
      </div>
    </article>
  `;
}

// ---------- Render import preview ----------
export function renderImportPreview() {
  const fields = Object.keys(displayConfig.fieldConfig || {});
  const coreFields = ['id','title','status','priority','assignee','location','created','dueDate'];
  coreFields.forEach(f => {
    if (!fields.includes(f)) {
      if (!displayConfig.fieldConfig) displayConfig.fieldConfig = {};
      displayConfig.fieldConfig[f] = { label: f, source: f, showOnCard: true, showInTable: true };
    }
  });
  const fieldKeys = Object.keys(displayConfig.fieldConfig);
  const titleMapped = displayConfig.fieldConfig.title && displayConfig.fieldConfig.title.source;
  const badge = document.getElementById('importReadyBadge');
  const confirm = document.getElementById('confirmImportBtn');
  if (!titleMapped) {
    if (badge) {
      badge.textContent = 'NEEDS MAPPING: Title';
      badge.className = 'inline-flex items-center px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black';
    }
    if (confirm) confirm.disabled = true;
  } else {
    if (badge) {
      badge.textContent = '✓ READY TO IMPORT';
      badge.className = 'inline-flex items-center px-2 py-1 rounded-full bg-brand-success/20 text-brand-success text-[10px] font-black';
    }
    if (confirm) confirm.disabled = !importRows.length || !window.isLoggedIn;
  }
  const previewLimit = 3;
  const previewCount = document.getElementById('importPreviewCount');
  if (previewCount) previewCount.textContent = `Showing first ${Math.min(previewLimit, importRows.length)} of ${importRows.length}`;

  // Build preview orders
  const previewOrders = importRows.slice(0, previewLimit).map((r, i) => makeMappedOrder(r, i));
  const timeOf = (v) => {
    if (!v) return 0;
    const t = Date.parse(String(v).length <= 10 ? String(v) + 'T00:00:00' : String(v));
    return Number.isNaN(t) ? 0 : t;
  };
  previewOrders.sort((a, b) => timeOf(b.created) - timeOf(a.created) || (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0));

  // Preview table
  const visibleFields = fieldKeys.filter(k => {
    const cfg = displayConfig.fieldConfig[k];
    return cfg.source && cfg.showInTable !== false;
  });

  const head = document.getElementById('importPreviewHead');
  if (head) {
    let headHTML = `<tr>`;
    visibleFields.forEach(k => {
      const cfg = displayConfig.fieldConfig[k];
      headHTML += `<th class="px-3 py-2 text-left font-bold text-black/50 whitespace-nowrap">${esc(cfg.label || k)}<div class="text-[9px] font-normal text-black/30">${esc(cfg.source || '—')}</div></th>`;
    });
    headHTML += `</tr>`;
    head.innerHTML = headHTML;
  }

  const body = document.getElementById('importPreviewBody');
  if (body) {
    let bodyHTML = '';
    previewOrders.forEach(o => {
      let rowHTML = `<tr class="border-t border-black/10 hover:bg-black/5">`;
      visibleFields.forEach(k => {
        const cfg = displayConfig.fieldConfig[k];
        let val = displayValue(o, cfg.source);
        val = esc(val || '—');
        rowHTML += `<td class="px-3 py-2 max-w-[200px] truncate text-black/70">${val}</td>`;
      });
      rowHTML += `</tr>`;
      bodyHTML += rowHTML;
    });
    body.innerHTML = bodyHTML;
  }

  // Projected cards
  const cardsContainer = document.getElementById('projectedCards');
  if (cardsContainer) {
    if (previewOrders.length) {
      cardsContainer.innerHTML = previewOrders.map(o => previewCardHTML(o)).join('');
    } else {
      cardsContainer.innerHTML = '<p class="text-sm text-black/40">No rows to preview.</p>';
    }
  }
}

// ---------- Apply import ----------
export function applyImport(skipAuth = false, forceReplace = false, ignoreCheckbox = false) {
  if (!skipAuth && !window.requireLogin) {
    toast('Please log in to import.', 'error');
    return;
  }
  if (!importRows.length) {
    toast('Load a file or paste rows first.', 'error');
    return;
  }
  if (!displayConfig.fieldConfig?.title?.source) {
    toast('Please map the Title column before importing.', 'error');
    return;
  }

  const isApiImport = importSourceType === 'api';
  const replace = forceReplace || (isApiImport ? true : (ignoreCheckbox ? false : document.getElementById('replaceOrdersCheckbox')?.checked || false));

  if (replace) {
    orders.length = 0;
    undoHistory.length = 0;
    toast('🗑️ Existing orders cleared. New import will replace all data.', 'info');
  }

  const incoming = importRows.map((r, i) => makeMappedOrder(r, i));

  if (!isApiImport) {
    pushHistory(`import ${incoming.length} rows`);
  }

  if (replace) {
    orders.length = 0;
    orders.push(...incoming);
  } else {
    const existing = new Map(orders.map((o) => [String(o.id).trim().toLowerCase(), o]));
    let added = 0, updated = 0;
    incoming.forEach((n) => {
      const key = String(n.id).trim().toLowerCase();
      if (existing.has(key)) {
        const old = existing.get(key);
        const merged = { ...old };
        for (let k in n) {
          if (k === 'customFields') {
            merged.customFields = mergeCustomFields(old.customFields, n.customFields);
          } else if (k === 'activity') {
            merged.activity = [...(old.activity || []), ...(n.activity || [])];
          } else if (k === '_rawData' || k === '_importHeaders') {
            merged[k] = n[k];
          } else {
            merged[k] = n[k];
          }
        }
        const idx = orders.findIndex(o => String(o.id).trim().toLowerCase() === key);
        if (idx >= 0) orders[idx] = merged;
        updated++;
      } else {
        orders.push(n);
        added++;
      }
    });
    toast(`Merge complete: ${added} new, ${updated} updated.`, 'success');
  }

  saveOrders();

  const importedAssignees = new Set(orders.map(o => o.assignee).filter(a => a && a !== 'Unassigned'));
  importedAssignees.forEach(name => {
    if (!users.some(u => u.name === name)) {
      users.push({ id: `USR-${Date.now()}-${Math.random().toString(36).substr(2,5)}`, name, active: true });
    }
  });
  saveUsers();

  // Refresh main UI
  if (typeof window.render === 'function') window.render();

  // Reset filters and pagination
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) statusFilter.value = 'all';
  const priorityFilter = document.getElementById('priorityFilter');
  if (priorityFilter) priorityFilter.value = 'all';
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) sortSelect.value = 'created_desc';
  window.currentPage = 1;

  // Uncheck replace checkbox
  const replaceCheckbox = document.getElementById('replaceOrdersCheckbox');
  if (replaceCheckbox) replaceCheckbox.checked = false;

  // ✅ CLOSE THE IMPORT MODAL
  if (typeof window.closeImportModal === 'function') {
    window.closeImportModal();
  }

  // Reset import center (keep URL)
  resetImportCenter(true);

  const msg = replace ?
    `✅ ${incoming.length} orders imported (replaced all).` :
    `✅ ${incoming.length} orders processed (${updated} updated, ${added} new).`;
  toast(msg, 'success');
}