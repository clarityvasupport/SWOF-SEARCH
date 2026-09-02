// =========================================================
// WORK ORDER CARD – renders a single card for the dashboard
// =========================================================

import { displayConfig, orders } from '../data.js';
import {
  esc,
  formatDate,
  statusClass,
  priorityClass,
  getStatusAccentClass,
  getAssigneeColor,
  getPriorityColor,
  initials,
  displayValue,
  normalizePriority,
  nowDate,
  parseDateValue,
  formatFieldValue,
} from '../utils.js';

// ---- Helper: get all field configurations ----
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
  // custom fields
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

// ---- Main card rendering function ----
export function cardHTML(o) {
  const fieldConfigs = getAllFieldConfigs();
  const createdConfig = fieldConfigs.created || { label: 'Created Date', source: 'created', showOnCard: true };

  // --- Get configured fields ---
  const idConfig = fieldConfigs.id || { label: 'ID', source: 'id', showOnCard: true };
  const titleConfig = fieldConfigs.title || { label: 'Title', source: 'title', showOnCard: true };
  const statusConfig = fieldConfigs.status || { label: 'Status', source: 'status', showOnCard: true };
  const categoryConfig = fieldConfigs.category || { label: 'Category', source: 'category', showOnCard: true };
  const locationConfig = fieldConfigs.location || { label: 'Location', source: 'location', showOnCard: true };
  const dueDateConfig = fieldConfigs.dueDate || { label: 'Due Date', source: 'dueDate', showOnCard: true };
  const assigneeConfig = fieldConfigs.assignee || { label: 'Assigned To', source: 'assignee', showOnCard: true };
  const priorityConfig = fieldConfigs.priority || { label: 'Priority', source: 'priority', showOnCard: true };
  const requesterConfig = fieldConfigs.requester || { label: 'Requester', source: 'requester', showOnCard: false };
  const descriptionConfig = fieldConfigs.description || { label: 'Description', source: 'description', showOnCard: true };

  // --- Get values using configured sources ---
  const idVal = displayValue(o, idConfig.source) || o.id || '—';
  const titleVal = displayValue(o, titleConfig.source) || o.title || 'Untitled Work Order';
  const statusVal = o.status || 'Open';
  const categoryVal = displayValue(o, categoryConfig.source) || o.category || 'General';
  const locationVal = displayValue(o, locationConfig.source) || o.location || '—';
  const dueDateVal = displayValue(o, dueDateConfig.source);
  const assigneeVal = displayValue(o, assigneeConfig.source) || o.assignee || 'Unassigned';
  const priorityVal = displayValue(o, priorityConfig.source) || o.priority || 'Medium';
  const requesterVal = displayValue(o, requesterConfig.source) || o.requester || '';
  const descriptionVal = displayValue(o, descriptionConfig.source) || o.description || '';

  const due = dueDateVal ? formatDate(dueDateVal) : '—';
  const dueLabel = dueDateConfig.label || 'Due Date';
  const locationLabel = locationConfig.label || 'Location';
  const createdVal = displayValue(o, createdConfig.source);
  const created = formatDate(createdVal || o.created);
  const overdue = o.dueDate && o.status !== 'Completed' && o.status !== 'Cancelled' && o.dueDate < nowDate();
  const disabledAttr = !isLoggedIn ? 'disabled="disabled"' : '';

  // --- DYNAMIC STATUS OPTIONS: ONLY from the data (raw values) ---
  const dataStatuses = orders.map((o) => o.status).filter(Boolean);
  const uniqueStatuses = Array.from(new Set(dataStatuses)).sort();
  const statusOpts = uniqueStatuses.length ? uniqueStatuses : ['Open'];

  // --- Determine if the status field is a dropdown or header ---
  const statusType = statusConfig.type || 'mapped';
  const isStatusDropdown = (statusType === 'dropdown');

  // --- Description ---
  let descriptionHTML = '';
  if (descriptionConfig.showOnCard !== false && descriptionVal) {
    descriptionHTML = `<p class="mt-3 text-sm leading-5 text-black/60 line-clamp-2">${esc(descriptionVal)}</p>`;
  }

  // --- Created line with requester ---
  let createdLineHTML = '';
  if (createdConfig.showOnCard !== false) {
    let line = `Created ${esc(created)}`;
    if (requesterVal && requesterConfig.showOnCard !== false) {
      line += ` • By ${esc(requesterVal)}`;
    }
    createdLineHTML = `<div class="mt-3 flex items-center gap-2 text-[11px] text-black/40">${line}</div>`;
  }

  // --- Header: ID and Category ---
  let headerTopHTML = '';
  const showId = idConfig.showOnCard !== false;
  const showCategory = categoryConfig.showOnCard !== false;
  if (showId || showCategory) {
    headerTopHTML = `<div class="flex items-center gap-2 mb-2">`;
    if (showId) headerTopHTML += `<span class="text-[11px] font-bold text-black/40">${esc(idVal)}</span>`;
    if (showId && showCategory) headerTopHTML += `<span class="w-1 h-1 rounded-full bg-black/20"></span>`;
    if (showCategory) headerTopHTML += `<span class="text-[11px] text-black/40">${esc(categoryVal)}</span>`;
    headerTopHTML += `</div>`;
  }

  // --- Title ---
  let titleHTML = '';
  if (titleConfig.showOnCard !== false) {
    titleHTML = `<h3 class="font-black text-black group-hover:text-brand-teal transition truncate">${esc(titleVal)}</h3>`;
  }

  // --- Status badge or dropdown ---
  let statusHTML = '';
  if (statusConfig.showOnCard !== false) {
    if (isStatusDropdown) {
      const optionsHTML = statusOpts.map((s) =>
        `<option value="${esc(s)}" ${statusVal === s ? 'selected' : ''}>${esc(s)}</option>`
      ).join('');
      const currentStatusClass = statusClass(statusVal);
      statusHTML = `
        <div class="status-dropdown-wrap shrink-0" onclick="event.stopPropagation();">
          <select data-status-select="${esc(o.id)}" class="status-dropdown-trigger ${currentStatusClass.replace('border-', '')}" ${disabledAttr}>
            ${optionsHTML}
          </select>
        </div>
      `;
    } else {
      statusHTML = `<span class="shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-bold ${statusClass(statusVal)}">${esc(statusVal)}</span>`;
    }
  }

  // --- Location and Due Date boxes (using formatFieldValue) ---
  let locationDueHTML = '';
  const showLocation = locationConfig.showOnCard !== false;
  const showDueDate = dueDateConfig.showOnCard !== false;
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
          <div class="font-bold ${overdue ? 'text-red-600' : 'text-black/80'} mt-0.5">${formatFieldValue(due)}</div>
        </div>
      `;
    } else {
      locationDueHTML += `<div></div>`;
    }
    locationDueHTML += `</div>`;
  }

  // --- Extra fields (grid) – using formatFieldValue ---
  const skipFields = ['id', 'title', 'status', 'location', 'dueDate', 'assignee', 'priority', 'category', 'created', 'requester', 'description'];
  const extraFields = Object.keys(fieldConfigs)
    .filter((key) => {
      const cfg = fieldConfigs[key];
      return cfg.showOnCard !== false && !skipFields.includes(key);
    })
    .slice(0, 4);

  let extraFieldsHTML = '';
  if (extraFields.length) {
    extraFieldsHTML = `<div class="mt-4 grid grid-cols-2 gap-2 text-xs">`;
    extraFields.forEach((key) => {
      const cfg = fieldConfigs[key];
      const val = displayValue(o, cfg.source);
      const formatted = formatFieldValue(val);
      extraFieldsHTML += `
        <div class="bg-black/5 rounded-lg p-2.5">
          <p class="text-black/40 truncate">${esc(cfg.label || key)}</p>
          <div class="font-bold text-black/80 mt-0.5 truncate">${formatted}</div>
        </div>
      `;
    });
    extraFieldsHTML += `</div>`;
  }

  // --- Footer: Assignee and Priority ---
  let footerHTML = '';
  const showAssignee = assigneeConfig.showOnCard !== false;
  const showPriority = priorityConfig.showOnCard !== false;
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

  // --- Build the card ---
  return `
    <article data-open="${esc(o.id)}" class="group bg-white border border-black/10 rounded-2xl p-5 cursor-pointer shadow-sm hover:shadow-soft hover:-translate-y-0.5 hover:border-brand-teal/30 transition-all text-black h-full flex flex-col ${getStatusAccentClass(o.status)}">
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