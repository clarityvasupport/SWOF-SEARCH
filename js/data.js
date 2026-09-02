// =========================================================
// DATA LAYER – state, persistence, and sync with KV backend
// =========================================================

import { isHistoryValid, normalize } from './utils.js';  // Added normalize import

// ---------- Storage keys ----------
const STORAGE_KEY = 'wo_dashboard_v3';
const HISTORY_KEY = 'wo_dashboard_history_v3';
const DISPLAY_CONFIG_KEY = 'wo_display_config_v1';
const USERS_KEY = 'wo_users_v1';
const IMPORTED_HEADERS_KEY = 'wo_imported_headers_v1';

// ---------- State variables ----------
export let orders = [];
export let history = [];
export let users = [];
export let displayConfig = {};
export let importedHeaders = [];
export let isOnline = false;

// ---------- Password (internal) ----------
let storedPassword = 'password';

// ---------- Import mapping state (internal) ----------
let importMapping = {};
let importFieldLabels = {};
let importFieldTypes = {};
let importCustomMappings = [];
let importHeaders = [];
let importSourceName = '';

// =========================================================
// LOAD / SAVE FUNCTIONS (same as before)
// =========================================================

export function loadOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let result = raw ? JSON.parse(raw) : [];
    // migration: move dateTransmitted to customFields
    result = result.map(o => {
      if (o.dateTransmitted && o.dateTransmitted.trim()) {
        if (!Array.isArray(o.customFields)) o.customFields = [];
        const exists = o.customFields.some(f => normalize(f.label || '') === normalize('Date Transmitted'));
        if (!exists) {
          o.customFields.push({ label: 'Date Transmitted', value: o.dateTransmitted, _sourceHeader: '' });
        }
        delete o.dateTransmitted;
      }
      return o;
    });
    return result;
  } catch { return []; }
}

export function saveOrders() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    localStorage.setItem('wo_local_timestamp', String(Date.now()));
  } catch {}
  syncSharedStorage();
}

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

export function saveHistory() {
  const compact = history.slice(-10).map(entry => ({
    ...entry,
    timestamp: entry.timestamp || Date.now(),
    data: Array.isArray(entry.data) ? entry.data.map(o => {
      const copy = { ...o };
      delete copy._rawData;
      delete copy._importHeaders;
      if (Array.isArray(copy.activity)) copy.activity = copy.activity.slice(-10);
      if (Array.isArray(copy.customFields)) copy.customFields = copy.customFields.slice(0, 20);
      return copy;
    }) : [],
  }));
  const payload = JSON.stringify(compact);
  if (payload.length > 180000) history = history.slice(-3);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-10))); } catch {}
  syncSharedStorage();
}

export function loadUsers() {
  try { const saved = JSON.parse(localStorage.getItem(USERS_KEY) || 'null'); if (Array.isArray(saved) && saved.length) return saved; } catch {}
  return [];
}

export function saveUsers() {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch {}
  syncSharedStorage();
}

export function loadImportedHeaders() {
  try { const fromStorage = JSON.parse(localStorage.getItem(IMPORTED_HEADERS_KEY) || '[]'); if (Array.isArray(fromStorage)) return fromStorage; } catch {}
  return [];
}

export function saveImportedHeaders() {
  try { localStorage.setItem(IMPORTED_HEADERS_KEY, JSON.stringify(importedHeaders)); } catch {}
  syncSharedStorage();
}

export function loadDisplayConfig() {
  try {
    const fromStorage = JSON.parse(localStorage.getItem(DISPLAY_CONFIG_KEY) || '{}');
    return {
      cardDateSource: 'dueDate',
      cardDateLabel: 'Due Date',
      cardExtraFields: [],
      calendarDateSource: 'created',
      fieldConfig: fromStorage.fieldConfig || {},
      ...fromStorage,
    };
  } catch {
    return { cardDateSource: 'dueDate', cardDateLabel: 'Due Date', cardExtraFields: [], calendarDateSource: 'created', fieldConfig: {} };
  }
}

export function saveDisplayConfig() {
  try {
    localStorage.setItem(DISPLAY_CONFIG_KEY, JSON.stringify(displayConfig));
    localStorage.setItem('wo_local_timestamp', String(Date.now()));
  } catch {}
  syncSharedStorage();
}

// =========================================================
// SNAPSHOT & HISTORY PUSH (NEW)
// =========================================================

/**
 * Creates a clean snapshot of the current orders (for undo history).
 * Removes large raw data and limits arrays.
 */
function snapshot() {
  return orders.map(o => {
    const copy = { ...o };
    delete copy._rawData;
    delete copy._importHeaders;
    if (Array.isArray(copy.activity)) copy.activity = copy.activity.slice(-10);
    if (Array.isArray(copy.customFields)) copy.customFields = copy.customFields.slice(0, 20);
    return copy;
  });
}

/**
 * Push a new history entry with a label and optional data override.
 * The data is saved as a snapshot and trimmed to 10 entries.
 */
export function pushHistory(label, dataOverride = null) {
  const next = {
    label,
    data: dataOverride ?? snapshot(),
    at: new Date().toISOString(),
    timestamp: Date.now(),
  };
  history.push(next);
  if (history.length > 10) history.shift();
  try {
    saveHistory();
  } catch (error) {
    console.warn('History storage quota exceeded; trimming.', error);
    history = history.slice(-3);
    try { saveHistory(); } catch { history = []; }
  }
  // We'll let the caller handle UI updates (undo buttons, etc.)
}

// =========================================================
// CLOUD SYNC (KV backend)
// =========================================================

export async function syncSharedStorage() {
  const payload = {
    orders: Array.isArray(orders) ? orders : [],
    history: Array.isArray(history) ? history : [],
    displayConfig: displayConfig && typeof displayConfig === 'object' ? displayConfig : {},
    users: Array.isArray(users) ? users : [],
    importedHeaders: Array.isArray(importedHeaders) ? importedHeaders : [],
    password: storedPassword || 'password',
    importApiUrl: document.getElementById('importApiUrl')?.value.trim() || loadApiUrl(),
    importMappingConfig: loadMappingConfig() || {},
    _lastUpdated: Date.now()
  };
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('sync failed');
    const data = await res.json();
    isOnline = true;
    updateStorageBadge();
  } catch {
    console.warn('Sync failed – using localStorage fallback.');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      localStorage.setItem(DISPLAY_CONFIG_KEY, JSON.stringify(displayConfig));
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem(IMPORTED_HEADERS_KEY, JSON.stringify(importedHeaders));
    } catch {}
    isOnline = false;
    updateStorageBadge();
  }
}

export async function loadSharedState() {
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    let localTimestamp = 0;
    try { localTimestamp = parseInt(localStorage.getItem('wo_local_timestamp') || '0', 10); } catch {}
    const cloudTimestamp = data._lastUpdated || 0;
    const cloudIsNewer = cloudTimestamp > localTimestamp;
    const localIsEmpty = !orders || orders.length === 0;
    if (cloudIsNewer || localIsEmpty) {
      if (data && data.orders) orders = Array.isArray(data.orders) ? data.orders : orders;
      if (data && data.displayConfig && typeof data.displayConfig === 'object') displayConfig = data.displayConfig;
      if (data && data.users) users = Array.isArray(data.users) ? data.users : users;
      if (data && data.importedHeaders) importedHeaders = Array.isArray(data.importedHeaders) ? data.importedHeaders : importedHeaders;
      if (data && data.password) storedPassword = data.password;
      if (data && data.history) history = Array.isArray(data.history) ? data.history : history;
      if (data && data.importApiUrl) {
        const input = document.getElementById('importApiUrl');
        if (input) input.value = data.importApiUrl;
        saveApiUrl(data.importApiUrl);
      }
      if (data && data.importMappingConfig) {
        const config = data.importMappingConfig;
        importMapping = config.mapping || {};
        importFieldLabels = config.fieldLabels || {};
        importFieldTypes = config.fieldTypes || {};
        importCustomMappings = config.customMappings || [];
        importHeaders = config.headers || [];
        importSourceName = config.sourceName || '';
        saveMappingConfig();
      }
      localStorage.setItem('wo_local_timestamp', String(cloudTimestamp || Date.now()));
    }
    isOnline = true;
    updateStorageBadge();
  } catch {
    console.warn('Fallback to localStorage');
    orders = loadOrders();
    history = loadHistory();
    displayConfig = loadDisplayConfig();
    users = loadUsers();
    importedHeaders = loadImportedHeaders();
    isOnline = false;
    updateStorageBadge();
  }
}

// =========================================================
// PASSWORD HELPERS
// =========================================================

export function getStoredPassword() { return storedPassword; }
export function setStoredPassword(pwd) { storedPassword = pwd; }

// =========================================================
// API URL HELPERS
// =========================================================

export function saveApiUrl(url) {
  try { localStorage.setItem('import_api_url', url.trim()); } catch {}
}

export function loadApiUrl() {
  try { return localStorage.getItem('import_api_url') || ''; } catch { return ''; }
}

// =========================================================
// IMPORT MAPPING CONFIG HELPERS
// =========================================================

export function saveMappingConfig() {
  try {
    const config = {
      mapping: importMapping || {},
      fieldLabels: importFieldLabels || {},
      fieldTypes: importFieldTypes || {},
      customMappings: importCustomMappings || [],
      headers: importHeaders || [],
      sourceName: importSourceName || '',
    };
    localStorage.setItem('import_mapping_config', JSON.stringify(config));
  } catch {}
}

export function loadMappingConfig() {
  try {
    const raw = localStorage.getItem('import_mapping_config');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearMappingConfig() {
  try { localStorage.removeItem('import_mapping_config'); } catch {}
}

// =========================================================
// INTERNAL HELPER – UPDATE STORAGE BADGE
// =========================================================

function updateStorageBadge() {
  const badge = document.getElementById('storageBadge');
  const badgeText = document.getElementById('badgeText');
  const dot = badge?.querySelector('.pulse-dot');
  if (!badge || !badgeText) return;
  if (isOnline) {
    badge.className = 'inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-brand-success/20 text-brand-success text-[10px] font-bold';
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-brand-success pulse-dot';
    badgeText.textContent = 'ONLINE';
  } else {
    badge.className = 'inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 text-red-500 text-[10px] font-bold';
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-red-500 pulse-dot';
    badgeText.textContent = 'LOCAL';
  }
}