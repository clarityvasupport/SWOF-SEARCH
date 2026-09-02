// =========================================================
// IMPORT PAGE – import modal UI logic
// =========================================================

import {
  orders,
  undoHistory,
  users,
  importedHeaders,
  saveOrders,
  saveUndoHistory,
  saveUsers,
  saveImportedHeaders,
  clearMappingConfig,
  displayConfig,
  pushHistory,
} from '../data.js';

import {
  showImportData,
  resetImportCenter,
  applyImport,
  renderImportMapping,
  renderImportPreview,
  detectColumnType,
  makeMappedOrder,
} from '../importHelpers.js';

import {
  toast,
  parseDelimited,
  normalizeApiRows,
  inferMapping,
} from '../utils.js';

import {
  openConfirmationModal,
  closeConfirmationModal,
} from '../components/ConfirmModal.js';

// ---------- Modal open/close ----------
export function openImportModal() {
  resetImportCenter();
  document.getElementById('importModal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

export function closeImportModal() {
  document.getElementById('importModal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

// ---------- File import ----------
export async function handleImportFile(file) {
  if (!file) return;
  const ext = (file.name || "").split(".").pop().toLowerCase();
  const mime = (file.type || "").toLowerCase();
  if (["html", "htm", "xhtml"].includes(ext) || mime.includes("text/html")) {
    toast("Please upload a data file, not an HTML page.", "error");
    return;
  }
  document.getElementById("importFileName").textContent = `Reading: ${file.name}`;
  try {
    if (["csv", "tsv"].includes(ext)) {
      const text = await file.text();
      const parsed = parseDelimited(text);
      if (!parsed.headers.length || !parsed.rows.length) throw new Error("No rows");
      showImportData(parsed.headers, parsed.rows, file.name, "file");
      toast("File loaded successfully. Review the mapping and confirm import.", "success");
    } else if (["xlsx", "xls"].includes(ext) || mime.includes("sheet") || mime.includes("excel")) {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      if (!wb.SheetNames.length) throw new Error("No sheet");
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
      const headers = rows.length ? Object.keys(rows[0]) : [];
      if (!headers.length || !rows.length) throw new Error("No rows");
      showImportData(headers, rows, file.name, "file");
      toast("File loaded successfully. Review the mapping and confirm import.", "success");
    } else {
      throw new Error("Unsupported file type. Use CSV or Excel.");
    }
  } catch (err) {
    console.error(err);
    toast("Could not read that file. Please use a CSV or Excel spreadsheet.", "error");
  }
}

// ---------- API import ----------
export async function handleImportApi() {
  const url = document.getElementById("importApiUrl").value.trim();
  if (!url) {
    toast("Enter an API URL or backend endpoint first.", "error");
    return;
  }
  const button = document.getElementById("importReadApiBtn");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Loading...";
  document.getElementById("importFileName").textContent = `Reading: ${url}`;
  try {
    const { headers, rows } = await fetchApiDataFromUrl(url);
    showImportData(headers, rows, url, "api");
    toast("API data loaded successfully. Review the mapping and confirm import.", "success");
  } catch (err) {
    console.error(err);
    toast("Could not load data from that API endpoint. Use a backend JSON/CSV response, not an HTML page.", "error");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function fetchApiDataFromUrl(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json, text/csv, text/plain, */*" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const text = await response.text();
  if (contentType.includes("text/html") || /<\s*(html|body|doctype)/i.test(text.slice(0, 500))) {
    throw new Error("Endpoint returned HTML instead of data. Please use a backend JSON/CSV endpoint.");
  }
  let rows = [],
    headers = [];
  if (contentType.includes("application/json") || text.trim().startsWith("[") || text.trim().startsWith("{")) {
    const data = JSON.parse(text);
    rows = normalizeApiRows(data);
    if (!rows.length && data && typeof data === "object") {
      const nested = Object.values(data).find(v => Array.isArray(v));
      if (nested) rows = nested;
    }
    if (!rows.length) throw new Error("JSON response did not contain an array of rows.");
    if (rows.every(row => row && typeof row === "object" && !Array.isArray(row))) {
      headers = Object.keys(rows[0]);
    } else if (rows.every(Array.isArray)) {
      headers = rows[0].map((_, idx) => `Column ${idx + 1}`);
      rows = rows.map(row => {
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] ?? ""; });
        return obj;
      });
    } else throw new Error("Unsupported JSON format from API.");
  } else {
    const parsed = parseDelimited(text);
    if (!parsed.headers.length || !parsed.rows.length) throw new Error("No rows returned from API");
    headers = parsed.headers;
    rows = parsed.rows;
  }
  if (!headers.length || !rows.length) throw new Error("No importable data found in the API response.");
  return { headers, rows };
}

// ---------- Paste import ----------
export function handlePasteImport() {
  const parsed = parseDelimited(document.getElementById("importPasteData").value);
  if (!parsed.headers.length || !parsed.rows.length) {
    toast("No readable rows found in the pasted data.", "error");
    return;
  }
  showImportData(parsed.headers, parsed.rows, "pasted data");
  toast("Pasted data loaded successfully. Review the mapping and confirm import.", "success");
}

// ---------- Clear functions ----------
export function clearAllOrders() {
  openConfirmationModal({
    title: "Clear all orders",
    message: "This will permanently remove all current work orders from the dashboard. This action cannot be undone.",
    confirmText: "Clear Orders",
    confirmClass: "bg-red-600 hover:bg-red-700",
    onConfirm: () => {
      orders.length = 0;
      undoHistory.length = 0;
      users.length = 0;
      importedHeaders.length = 0;
      if (displayConfig.fieldConfig) {
        const coreFields = ['id', 'title', 'status', 'priority', 'category', 'location', 'assignee', 'requester', 'created', 'dueDate', 'description'];
        const newFieldConfig = {};
        coreFields.forEach(f => {
          newFieldConfig[f] = { label: f.charAt(0).toUpperCase() + f.slice(1), source: f };
        });
        displayConfig.fieldConfig = newFieldConfig;
      }
      saveOrders();
      saveUndoHistory();
      saveUsers();
      saveImportedHeaders();
      if (typeof window.render === 'function') window.render();
      closeConfirmationModal();
      closeImportModal();
      resetImportCenter();
      toast("Dashboard cleared. All work orders removed.", "error");
    },
  });
}

export function clearAllAndStopSync() {
  openConfirmationModal({
    title: "⚠️ Permanently clear all data",
    message: "This will remove ALL work orders, users, history AND clear the saved API URL. Auto-sync will be disabled on refresh. Are you sure?",
    confirmText: "Clear Everything",
    confirmClass: "bg-red-600 hover:bg-red-700",
    onConfirm: () => {
      orders.length = 0;
      undoHistory.length = 0;
      users.length = 0;
      importedHeaders.length = 0;
      if (displayConfig.fieldConfig) {
        const coreFields = ['id', 'title', 'status', 'priority', 'category', 'location', 'assignee', 'requester', 'created', 'dueDate', 'description'];
        const newFieldConfig = {};
        coreFields.forEach(f => {
          newFieldConfig[f] = { label: f.charAt(0).toUpperCase() + f.slice(1), source: f };
        });
        displayConfig.fieldConfig = newFieldConfig;
      }
      clearMappingConfig();
      localStorage.removeItem("import_api_url");
      document.getElementById("importApiUrl").value = "";
      saveOrders();
      saveUndoHistory();
      saveUsers();
      saveImportedHeaders();
      resetImportCenter(false);
      if (typeof window.render === 'function') window.render();
      closeConfirmationModal();
      closeImportModal();
      toast("✅ All data cleared. Auto-sync disabled. Refresh will NOT restore from API.", "error");
    },
  });
}

// ---------- Dropzone setup ----------
export function setupDropzone() {
  const dz = document.getElementById('importDropzone');
  if (!dz) return;
  ['dragenter', 'dragover'].forEach(evt =>
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.add('drag');
    })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.remove('drag');
    })
  );
  dz.addEventListener('drop', (e) => handleImportFile(e.dataTransfer.files[0]));
  dz.addEventListener('click', () => document.getElementById('importFileInput').click());
}