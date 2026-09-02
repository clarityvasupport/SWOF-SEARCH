// =========================================================
// DATA LAYER – state, persistence, and sync with KV backend
// =========================================================

import { isHistoryValid, normalize } from './utils.js';

// ---------- Storage keys ----------
const STORAGE_KEY = 'wo_dashboard_v3';
const HISTORY_KEY = 'wo_dashboard_history_v3';
const DISPLAY_CONFIG_KEY = 'wo_display_config_v1';
const USERS_KEY = 'wo_users_v1';
const IMPORTED_HEADERS_KEY = 'wo_imported_headers_v1';

// ---------- State variables (mutable) ----------
export let orders = [];
export let undoHistory = [];  // ✅ renamed from 'history'
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
// LOAD / SAVE FUNCTIONS
// =========================================================

export function loadOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let result = raw ? JSON.parse(raw) : [];
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

export function loadUndoHistory() {  // ✅ renamed
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

export function saveUndoHistory() {  // ✅ renamed
  const compact = undoHistory.slice(-10).map(entry => ({
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
  if (payload.length > 180000) undoHistory = undoHistory.slice(-3);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(undoHistory.slice(-10))); } catch {}
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
// SNAPSHOT & HISTORY PUSH
// =========================================================

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

export function pushHistory(label, dataOverride = null) {
  const next = {
    label,
    data: dataOverride ?? snapshot(),
    at: new Date().toISOString(),
    timestamp: Date.now(),
  };
  undoHistory.push(next);
  if (undoHistory.length > 10) undoHistory.shift();
  try {
    saveUndoHistory();
  } catch (error) {
    console.warn('History storage quota exceeded; trimming.', error);
    undoHistory = undoHistory.slice(-3);
    try { saveUndoHistory(); } catch { undoHistory = []; }
  }
}

// =========================================================
// CLOUD SYNC (KV backend)
// =========================================================

export async function syncSharedStorage() {
  const payload = {
    orders: Array.isArray(orders) ? orders : [],
    history: Array.isArray(undoHistory) ? undoHistory : [],
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
      localStorage.setItem(HISTORY_KEY, JSON.stringify(undoHistory));
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
      if (data && data.orders) {
        orders.length = 0;
        orders.push(...data.orders);
      }
      if (data && data.displayConfig && typeof data.displayConfig === 'object') {
        Object.assign(displayConfig, data.displayConfig);
      }
      if (data && data.users) {
        users.length = 0;
        users.push(...data.users);
      }
      if (data && data.importedHeaders) {
        importedHeaders.length = 0;
        importedHeaders.push(...data.importedHeaders);
      }
      if (data && data.password) storedPassword = data.password;
      if (data && data.history) {
        undoHistory.length = 0;
        undoHistory.push(...data.history);
      }
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
    const loadedOrders = loadOrders();
    orders.length = 0;
    orders.push(...loadedOrders);
    const loadedHistory = loadUndoHistory();
    undoHistory.length = 0;
    undoHistory.push(...loadedHistory);
    const loadedConfig = loadDisplayConfig();
    Object.assign(displayConfig, loadedConfig);
    const loadedUsers = loadUsers();
    users.length = 0;
    users.push(...loadedUsers);
    const loadedHeaders = loadImportedHeaders();
    importedHeaders.length = 0;
    importedHeaders.push(...loadedHeaders);
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