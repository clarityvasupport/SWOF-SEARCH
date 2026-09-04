// =========================================================
// SETTINGS – prototype settings, field config, password
// (v1.2.4 – all fields appear in Reports dropdown)
// =========================================================

import { orders, users, displayConfig, importedHeaders, saveDisplayConfig, loadOrders, saveOrders, pushHistory } from '../data.js';
import { esc, normalize, formatDate, parseDateValue, displayValue, toast } from '../utils.js';
import {
  getAllFieldConfigs,
  allAvailableHeaders,
  allKnownCustomLabels,
  ensureFieldInAllOrders,
  getAvailableDateFields,
  updateFieldConfig,
  removeCustomFieldConfig,
  addCustomFieldConfig,
} from '../importHelpers.js';
import { openConfirmationModal, closeConfirmationModal } from '../components/ConfirmModal.js';

export function render() {
  const container = document.getElementById('sectionPageBody');
  const fieldConfigs = getAllFieldConfigs();
  const allHeaders = allAvailableHeaders();
  const isLoggedIn = window.isLoggedIn || false;

  // ---- Helper: check if a source contains date values (reused) ----
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

  // ---- NEW: build dropdown from ALL field configs ----
  function buildCompletionDateOptions() {
    const allConfigs = getAllFieldConfigs();
    const current = displayConfig.completionDateSource || 'dueDate';
    let html = '';

    // Collect all fields with a source
    const candidates = [];
    Object.keys(allConfigs).forEach(key => {
      const cfg = allConfigs[key];
      const source = cfg.source || key;
      if (!source) return;
      const label = cfg.label || key;
      const isDate = fieldHasDateValues(source);
      candidates.push({ value: source, label, isDate });
    });

    // Sort: date fields first, then alphabetically
    candidates.sort((a, b) => {
      if (a.isDate && !b.isDate) return -1;
      if (!a.isDate && b.isDate) return 1;
      return a.label.localeCompare(b.label);
    });

    if (candidates.length === 0) {
      // Fallback
      html += `<option value="dueDate" ${current === 'dueDate' ? 'selected' : ''}>Due Date (default)</option>`;
    } else {
      candidates.forEach(f => {
        const selected = f.value === current ? 'selected' : '';
        const suffix = f.isDate ? ' (date)' : '';
        html += `<option value="${esc(f.value)}" ${selected}>${esc(f.label)}${suffix}</option>`;
      });
    }
    return html;
  }

  // ---- Reports Configuration HTML ----
  const reportsConfigHTML = `
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5 mt-4">
      <h3 class="font-black text-white">📊 Reports Configuration</h3>
      <p class="text-sm text-white/50 mt-1">Select the date field used for the "Weekly Completion" stat on Reports.</p>
      <div class="mt-3">
        <label class="block text-sm text-white/70 mb-1">Completion Date Field</label>
        <select id="completionDateSource" class="bg-black/30 text-white border border-white/20 rounded-xl px-3 py-2 w-full max-w-xs">
          ${buildCompletionDateOptions()}
        </select>
        <div class="mt-2 flex items-center gap-2">
          <input type="checkbox" id="completionOnlyCompleted" ${displayConfig.completionOnlyCompleted !== false ? 'checked' : ''} />
          <label class="text-sm text-white/70" for="completionOnlyCompleted">Only count orders with status "Completed"</label>
        </div>
        <p class="text-[10px] text-white/30 mt-1">Fields marked "(date)" contain date values. You can select any field.</p>
      </div>
    </div>
  `;

  // ---- Calendar configuration HTML ----
  const calendarConfigHTML = `
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5 mt-4">
      <h3 class="font-black text-white">Calendar Date Fields</h3>
      <p class="text-sm text-white/50 mt-1">Select which fields appear in the Calendar dropdown. Only fields with date values are shown.</p>
      <div id="calendarFieldCheckboxes" class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3"></div>
      <div class="mt-3 flex gap-2">
        <button id="calendarSelectAllBtn" class="px-3 py-1.5 rounded-lg bg-brand-teal/20 text-brand-teal font-bold text-xs hover:bg-brand-teal/30 transition">Select All</button>
        <button id="calendarClearAllBtn" class="px-3 py-1.5 rounded-lg bg-white/10 text-white/60 font-bold text-xs hover:bg-white/20 transition">Clear All</button>
      </div>
    </div>
  `;

  // ---- Field config HTML (unchanged) ----
  let fieldConfigHTML = `<div class="bg-white/5 border border-white/10 rounded-2xl p-5 mt-4">
    <h3 class="font-black text-white">Field Configuration</h3>
    <p class="text-sm text-white/50 mt-1">Customize which fields appear on cards and in the All Work Orders table. Rename fields and map them to different headers.</p>
    <div class="overflow-x-auto mt-4">
      <table class="w-full text-sm">
        <thead><tr class="border-b border-white/10">
          <th class="px-3 py-2 text-left text-white/60">Field</th>
          <th class="px-3 py-2 text-left text-white/60">Label</th>
          <th class="px-3 py-2 text-left text-white/60">Source</th>
          <th class="px-3 py-2 text-center text-white/60">Show on Card</th>
          <th class="px-3 py-2 text-center text-white/60">Show in Table</th>
          <th class="px-3 py-2 text-center text-white/60">Action</th>
        </tr></thead>
        <tbody id="fieldConfigTable">
          ${Object.keys(fieldConfigs).map(key => {
            const cfg = fieldConfigs[key];
            const isCustom = key.startsWith('custom_');
            return `<tr class="border-b border-white/10">
              <td class="px-3 py-2 text-white/70">${esc(cfg.label || key)}</td>
              <td class="px-3 py-2"><input class="field-input-sm bg-black/20 text-white border-white/20" data-field-key="${esc(key)}" data-field-property="label" value="${esc(cfg.label || key)}" placeholder="Label"></td>
              <td class="px-3 py-2"><select class="field-input-sm bg-black/30 text-white border-white/20" data-field-key="${esc(key)}" data-field-property="source"><option value="${esc(cfg.source)}" selected>${esc(cfg.source)}</option>${allHeaders.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('')}</select></td>
              <td class="px-3 py-2 text-center"><input type="checkbox" data-field-key="${esc(key)}" data-field-property="showOnCard" ${cfg.showOnCard !== false ? 'checked' : ''} class="rounded"></td>
              <td class="px-3 py-2 text-center"><input type="checkbox" data-field-key="${esc(key)}" data-field-property="showInTable" ${cfg.showInTable !== false ? 'checked' : ''} class="rounded"></td>
              <td class="px-3 py-2 text-center">${isCustom ? `<button data-remove-field="${esc(key)}" class="text-red-500 hover:text-red-400">✕</button>` : '<span class="text-black/30 text-xs">—</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tbody id="addFieldRow" style="display:none;">
          <tr>
            <td class="px-3 py-2 text-white/70">(new)</td>
            <td class="px-3 py-2"><input id="newFieldLabelInline" class="field-input-sm bg-black/20 text-white border-white/20" placeholder="Label" /></td>
            <td class="px-3 py-2"><select id="newFieldSourceInline" class="field-input-sm bg-black/30 text-white border-white/20"><option value="">— Not mapped —</option>${allHeaders.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('')}</select></td>
            <td class="px-3 py-2 text-center"><input type="checkbox" id="newFieldShowOnCardInline" checked class="rounded" /></td>
            <td class="px-3 py-2 text-center"><input type="checkbox" id="newFieldShowInTableInline" checked class="rounded" /></td>
            <td class="px-3 py-2 text-center"><button id="saveNewFieldInline" class="px-2 py-1 rounded bg-brand-teal text-white text-xs font-bold hover:bg-[#2A5454] transition">Save</button><button id="cancelNewFieldInline" class="px-2 py-1 rounded bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition ml-1">Cancel</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-4 flex flex-wrap gap-2">
      <button id="addFieldConfigBtn" class="px-4 py-2 rounded-xl bg-brand-teal hover:bg-[#2A5454] text-white font-bold text-sm transition">+ Add Field</button>
      <button id="saveFieldConfigBtn" class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition">Save Changes</button>
      <button id="resetFieldConfigBtn" class="px-4 py-2 rounded-xl border border-red-500/30 text-red-400 font-bold text-sm hover:bg-red-500/10 transition">Reset All to Defaults</button>
    </div>
  </div>`;

  // ---- Build the main settings page ----
  container.innerHTML = `<div class="max-w-3xl space-y-4">
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5">
      <h3 class="font-black text-white">Local Data</h3>
      <p class="text-sm text-white/50 mt-1">Work orders and undo history are stored in this browser until a backend is connected.</p>
      <div class="flex flex-wrap gap-2 mt-4">
        <button id="settingsRefresh" class="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-white font-bold text-sm transition">Reload Saved Data</button>
        <button id="settingsReset" class="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 font-bold text-sm hover:bg-red-500/10 transition">Reset Demo Data</button>
      </div>
    </div>
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5">
      <h3 class="font-black text-white">Import Behavior</h3>
      <p class="text-sm text-white/50 mt-1">Existing Work Order IDs are updated; new IDs are added. Imported records are sorted newest-created first.</p>
    </div>
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5">
      <h3 class="font-black text-white">Security</h3>
      <p class="text-sm text-white/50 mt-1">Change your admin password. This will be stored in the cloud (KV) and synced across devices.</p>
      <button id="openChangePasswordBtn" class="mt-4 px-4 py-2.5 rounded-xl bg-brand-teal hover:bg-[#2A5454] text-white font-bold text-sm transition">Change Password</button>
    </div>
    ${reportsConfigHTML}
    ${calendarConfigHTML}
    ${fieldConfigHTML}
  </div>`;

  // ---- Render calendar checkboxes ----
  renderCalendarCheckboxes();

  // ---- Event listeners ----
  document.getElementById('settingsRefresh').addEventListener('click', () => {
    const freshOrders = loadOrders();
    orders.length = 0;
    orders.push(...freshOrders);
    window.render();
    toast('Saved data reloaded.', 'success');
  });

  document.getElementById('settingsReset').addEventListener('click', () => {
    if (!window.requireLogin || !window.requireLogin()) return;
    openConfirmationModal({
      title: 'Reset demo data',
      message: 'Reset all local work-order data to the demo records?',
      confirmText: 'Reset',
      confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: () => {
        pushHistory('before demo reset');
        orders.length = 0;
        window.render();
        toast('Demo data restored.', 'success');
        closeConfirmationModal();
      },
    });
  });

  document.getElementById('openChangePasswordBtn').addEventListener('click', () => {
    if (!window.requireLogin || !window.requireLogin()) return;
    if (typeof window.openChangePasswordModal === 'function') {
      window.openChangePasswordModal();
    } else {
      toast('Change password modal not available.', 'error');
    }
  });

  // ---- Reports Configuration events ----
  const completionSelect = document.getElementById('completionDateSource');
  if (completionSelect) {
    completionSelect.addEventListener('change', function() {
      displayConfig.completionDateSource = this.value;
      saveDisplayConfig();
      toast('Completion date field updated.', 'success');
      const sectionPage = document.getElementById('sectionPage');
      if (!sectionPage.classList.contains('hidden') && document.getElementById('sectionPageTitle').textContent === 'Reports') {
        import('./reports.js').then(m => m.render());
      }
    });
  }

  const completionCheckbox = document.getElementById('completionOnlyCompleted');
  if (completionCheckbox) {
    completionCheckbox.addEventListener('change', function() {
      displayConfig.completionOnlyCompleted = this.checked;
      saveDisplayConfig();
      toast('Completion filter updated.', 'success');
      const sectionPage = document.getElementById('sectionPage');
      if (!sectionPage.classList.contains('hidden') && document.getElementById('sectionPageTitle').textContent === 'Reports') {
        import('./reports.js').then(m => m.render());
      }
    });
  }

  // ---- Field config events (unchanged) ----
  document.addEventListener('change', function(e) {
    const target = e.target;
    if (target.dataset.fieldKey && target.dataset.fieldProperty) {
      const key = target.dataset.fieldKey;
      const property = target.dataset.fieldProperty;
      let value = target.type === 'checkbox' ? target.checked : target.value;
      if (!displayConfig.fieldConfig) displayConfig.fieldConfig = {};
      displayConfig.fieldConfig[key] = {
        ...displayConfig.fieldConfig[key],
        [property]: value,
      };
      window.render();
    }
  });
  document.addEventListener('input', function(e) {
    const target = e.target;
    if (target.dataset.fieldKey && target.dataset.fieldProperty && target.type !== 'checkbox') {
      const key = target.dataset.fieldKey;
      const property = target.dataset.fieldProperty;
      if (!displayConfig.fieldConfig) displayConfig.fieldConfig = {};
      displayConfig.fieldConfig[key] = {
        ...displayConfig.fieldConfig[key],
        [property]: target.value,
      };
      window.render();
    }
  });

  document.getElementById('addFieldConfigBtn').addEventListener('click', function() {
    if (!window.requireLogin || !window.requireLogin()) return;
    const sourceSelect = document.getElementById('newFieldSourceInline');
    const headers = allAvailableHeaders();
    sourceSelect.innerHTML = '<option value="">— Not mapped —</option>' + headers.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
    document.getElementById('newFieldLabelInline').value = '';
    document.getElementById('newFieldShowOnCardInline').checked = true;
    document.getElementById('newFieldShowInTableInline').checked = true;
    document.getElementById('addFieldRow').style.display = '';
  });

  document.getElementById('cancelNewFieldInline').addEventListener('click', function() {
    document.getElementById('addFieldRow').style.display = 'none';
  });

  document.getElementById('saveNewFieldInline').addEventListener('click', function() {
    if (!window.requireLogin || !window.requireLogin()) return;
    const label = document.getElementById('newFieldLabelInline').value.trim();
    if (!label) {
      toast('Please enter a label.', 'error');
      return;
    }
    const labelNorm = normalize(label);
    const duplicate = Object.values(displayConfig.fieldConfig || {}).find(cfg => normalize(cfg.label || '') === labelNorm);
    if (duplicate) {
      toast(`A field named "${label}" already exists. Edit it instead of adding a duplicate.`, 'error');
      return;
    }
    const source = document.getElementById('newFieldSourceInline').value.trim();
    const showOnCard = document.getElementById('newFieldShowOnCardInline').checked;
    const showInTable = document.getElementById('newFieldShowInTableInline').checked;

    const newKey = addCustomFieldConfig(label, source);
    ensureFieldInAllOrders(label, source);

    document.getElementById('addFieldRow').style.display = 'none';
    window.render();
    render();
    toast(`✅ Field "${label}" added to all orders.`, 'success');
  });

  document.addEventListener('click', function(e) {
    const target = e.target.closest('#resetFieldConfigBtn');
    if (target) {
      const btnText = target.textContent.trim();
      if (!btnText.includes('Reset All') && btnText !== 'Reset All to Defaults') {
        if (!window.requireLogin || !window.requireLogin()) return;
        openConfirmationModal({
          title: 'Reset Sources to Defaults',
          message: 'This will change the "Source" dropdown for all core fields back to the default internal names.\n\nYour custom labels and visibility settings will NOT be affected.',
          confirmText: 'Reset Sources',
          confirmClass: 'bg-amber-600 hover:bg-amber-700',
          onConfirm: () => {
            const coreFields = ['id','title','status','priority','category','location','assignee','requester','created','dueDate','description'];
            coreFields.forEach(field => {
              updateFieldConfig(field, { source: field });
            });
            window.render();
            render();
            toast('Field sources reset to defaults.', 'success');
            closeConfirmationModal();
          },
        });
        return;
      } else {
        if (!window.requireLogin || !window.requireLogin()) return;
        openConfirmationModal({
          title: 'Reset All Field Configurations',
          message: 'This will reset all core field labels and sources to defaults, remove ALL custom fields, and reset visibility toggles on cards and tables.\n\nYour work order data will NOT be affected.',
          confirmText: 'Reset All',
          confirmClass: 'bg-red-600 hover:bg-red-700',
          onConfirm: () => {
            const coreFields = ['id','title','status','priority','category','location','assignee','requester','created','dueDate','description'];
            const defaultLabels = {
              id: 'Work Order ID',
              title: 'Title',
              status: 'Status',
              priority: 'Priority',
              category: 'Category',
              location: 'Location',
              assignee: 'Assigned To',
              requester: 'Requester',
              created: 'Created Date',
              dueDate: 'Due Date',
              description: 'Description'
            };
            const defaultShowOnCard = {
              id: true, title: true, status: true, priority: false,
              category: false, location: true, assignee: true,
              requester: false, created: false, dueDate: true,
              description: true
            };
            const defaultShowInTable = {
              id: true, title: true, status: true, priority: true,
              category: false, location: true, assignee: true,
              requester: false, created: true, dueDate: true,
              description: false
            };
            coreFields.forEach(field => {
              displayConfig.fieldConfig[field] = {
                label: defaultLabels[field] || field.charAt(0).toUpperCase() + field.slice(1),
                source: field,
                showOnCard: defaultShowOnCard[field] !== undefined ? defaultShowOnCard[field] : true,
                showInTable: defaultShowInTable[field] !== undefined ? defaultShowInTable[field] : true,
              };
            });
            Object.keys(displayConfig.fieldConfig).forEach(key => {
              if (key.startsWith('custom_')) delete displayConfig.fieldConfig[key];
            });
            orders.forEach(o => {
              if (Array.isArray(o.customFields)) {
                o.customFields = o.customFields.filter(f => !f.label || !f._sourceHeader);
              }
            });
            saveOrders();
            saveDisplayConfig();
            window.render();
            render();
            toast('✅ Field configuration reset to defaults. Custom fields removed.', 'success');
            closeConfirmationModal();
          },
        });
      }
    }
  });

  document.addEventListener('click', function(e) {
    const target = e.target.closest('[data-remove-field]');
    if (target) {
      if (!window.requireLogin || !window.requireLogin()) return;
      const key = target.dataset.removeField;
      const config = displayConfig.fieldConfig && displayConfig.fieldConfig[key];
      const label = config ? config.label : key;
      openConfirmationModal({
        title: 'Remove Field Permanently',
        message: `Remove field "${label}" from ALL work orders and settings? This cannot be undone easily.`,
        confirmText: 'Remove',
        confirmClass: 'bg-red-600 hover:bg-red-700',
        onConfirm: () => {
          orders.forEach(o => {
            if (Array.isArray(o.customFields)) {
              o.customFields = o.customFields.filter(f => String(f.label || '').trim() !== label);
            }
          });
          saveOrders();
          removeCustomFieldConfig(key);
          window.render();
          render();
          toast(`✅ Removed field "${label}" from all orders.`, 'info');
          closeConfirmationModal();
        },
      });
    }
  });

  document.getElementById('saveFieldConfigBtn').addEventListener('click', function() {
    if (this.dataset.saving === 'true') return;
    if (!window.requireLogin || !window.requireLogin()) return;
    this.dataset.saving = 'true';
    saveDisplayConfig();
    window.render();
    render();
    toast('Field configuration saved.', 'success');
    setTimeout(() => delete this.dataset.saving, 1000);
  });
}

// ---- Render calendar checkboxes (unchanged) ----
function renderCalendarCheckboxes() {
  const container = document.getElementById('calendarFieldCheckboxes');
  if (!container) return;

  if (!window.isLoggedIn) {
    container.innerHTML = `<div class="col-span-full text-sm text-white/40">🔒 <button id="loginToManageCalendarFields" class="text-brand-teal hover:underline font-bold">Log in</button> to manage calendar date fields.</div>`;
    document.getElementById('loginToManageCalendarFields')?.addEventListener('click', () => {
      if (typeof window.openLoginModal === 'function') window.openLoginModal();
    });
    return;
  }

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
    if (source && fieldHasDateValues(source)) {
      fields.push({ key, source, label: cfg.label || key });
    }
  });
  const sourceMap = new Map();
  fields.forEach(f => {
    if (!sourceMap.has(f.source)) sourceMap.set(f.source, { source: f.source, labels: [] });
    sourceMap.get(f.source).labels.push(f.label);
  });
  const groupedFields = Array.from(sourceMap.values()).map(item => ({ source: item.source, label: item.labels.join(' / ') }));

  if (groupedFields.length === 0) {
    container.innerHTML = '<p class="text-xs text-white/40">No date fields found. Import data with date columns or configure fields.</p>';
    return;
  }

  if (!displayConfig.calendarDateFields) {
    displayConfig.calendarDateFields = groupedFields.map(f => f.source);
    saveDisplayConfig();
  }

  const selectedSources = displayConfig.calendarDateFields || [];
  let html = '';
  groupedFields.forEach(f => {
    const checked = selectedSources.includes(f.source) ? 'checked' : '';
    html += `<label class="flex items-center gap-2 text-sm text-white/80 cursor-pointer"><input type="checkbox" class="calendar-field-checkbox" data-source="${esc(f.source)}" ${checked} /> ${esc(f.label)}</label>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('.calendar-field-checkbox').forEach(cb => {
    cb.addEventListener('change', function() {
      const source = this.dataset.source;
      if (!displayConfig.calendarDateFields) displayConfig.calendarDateFields = [];
      if (this.checked) {
        if (!displayConfig.calendarDateFields.includes(source)) displayConfig.calendarDateFields.push(source);
      } else {
        displayConfig.calendarDateFields = displayConfig.calendarDateFields.filter(s => s !== source);
      }
      saveDisplayConfig();
      const sectionPage = document.getElementById('sectionPage');
      if (!sectionPage.classList.contains('hidden') && document.getElementById('sectionPageTitle').textContent === 'Calendar') {
        import('./calendar.js').then(m => m.render());
      }
    });
  });

  document.getElementById('calendarSelectAllBtn')?.addEventListener('click', () => {
    if (!window.isLoggedIn) { toast('Please log in to manage calendar fields.', 'warning'); return; }
    const allSources = groupedFields.map(f => f.source);
    displayConfig.calendarDateFields = allSources;
    saveDisplayConfig();
    renderCalendarCheckboxes();
    const sectionPage = document.getElementById('sectionPage');
    if (!sectionPage.classList.contains('hidden') && document.getElementById('sectionPageTitle').textContent === 'Calendar') {
      import('./calendar.js').then(m => m.render());
    }
    toast('All date fields selected for calendar.', 'info');
  });

  document.getElementById('calendarClearAllBtn')?.addEventListener('click', () => {
    if (!window.isLoggedIn) { toast('Please log in to manage calendar fields.', 'warning'); return; }
    displayConfig.calendarDateFields = [];
    saveDisplayConfig();
    renderCalendarCheckboxes();
    const sectionPage = document.getElementById('sectionPage');
    if (!sectionPage.classList.contains('hidden') && document.getElementById('sectionPageTitle').textContent === 'Calendar') {
      import('./calendar.js').then(m => m.render());
    }
    toast('Calendar fields cleared.', 'info');
  });
}