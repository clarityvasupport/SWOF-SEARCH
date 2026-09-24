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

// ---- Receipt print preferences ----
const PRINT_PREFS_KEY = 'wo_receipt_print_prefs';
const PAPER_SIZES = {
  letter: { portrait: { w: 8.5, h: 11 }, landscape: { w: 11, h: 8.5 } },
  legal:  { portrait: { w: 8.5, h: 14 }, landscape: { w: 14, h: 8.5 } },
  a4:     { portrait: { w: 8.27, h: 11.69 }, landscape: { w: 11.69, h: 8.27 } }
};

function loadPrintPrefs() {
  try { return JSON.parse(localStorage.getItem(PRINT_PREFS_KEY)) || {}; } catch { return {}; }
}
function savePrintPrefs(prefs) {
  try { localStorage.setItem(PRINT_PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

// ---- Live values that feed the PDF (the single source of truth) ----
const receiptValues = {
  receiptNo: '',
  receiptDate: '',
  receivedFrom: '',
  address: '',
  sumWords: '',
  amount: '0.00',
  purpose: '',
  contractor: '',
};

let _receiptZoom = 80;
let _receiptPdfBlob = null;
let _receiptPdfUrl = null;
let _originalReceiptValues = { ...receiptValues };
let _receiptPreviewTimer = null;
let _receiptPdfRenderTask = null;

function applyReceiptZoom(zoomPct) {
  const slider = document.getElementById('receiptZoomSlider');
  const label  = document.getElementById('receiptZoomValue');
  const pct = Math.max(25, Math.min(200, Number(zoomPct) || 80));
  _receiptZoom = pct;
  if (slider) slider.value = String(pct);
  if (label)  label.textContent = pct + '%';
  sizeReceiptIframe();

  // Persist zoom
  const p = loadPrintPrefs();
  p.zoom = pct;
  savePrintPrefs(p);
}

function sizeReceiptIframe() {
  const iframe = document.getElementById('receiptPdfPreview');
  const canvas = document.getElementById('receiptPdfCanvas');
  const paperSize   = document.getElementById('paperSizeSelect')?.value || 'letter';
  const orientation = document.getElementById('orientationSelect')?.value || 'portrait';
  const dims = PAPER_SIZES[paperSize]?.[orientation] || PAPER_SIZES.letter.portrait;
  const dpi = 96;
  const effZoom = _receiptZoom / 100;
  const w = (dims.w * dpi * effZoom) + 'px';
  const h = (dims.h * dpi * effZoom) + 'px';
  if (iframe) { iframe.style.width = w; iframe.style.height = h; }
  if (canvas) { canvas.style.width = w; canvas.style.height = h; }

  // On mobile the visible preview is the <canvas>. Repaint it at the
  // new size. PDF.js cancels any in-flight render, so a rapid zoom
  // drag doesn't queue up a dozen paints.
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  if (isMobile && _receiptPdfBlob && canvas && canvas.style.display !== 'none') {
    renderReceiptPdfToCanvas();
  }
}

// Render the current receipt PDF blob onto the canvas element. This
// is the mobile fallback path — mobile browsers show an "Open PDF"
// card instead of inline-rendering the PDF, so we paint the first
// page with PDF.js into a canvas at the current zoom / DPR.
async function renderReceiptPdfToCanvas() {
  const canvas = document.getElementById('receiptPdfCanvas');
  if (!canvas || !_receiptPdfBlob || !window.pdfjsLib) return;

  // Cancel any in-flight render so consecutive calls don't race.
  if (_receiptPdfRenderTask) {
    try { _receiptPdfRenderTask.cancel(); } catch {}
    _receiptPdfRenderTask = null;
  }

  try {
    const buf = await _receiptPdfBlob.arrayBuffer();
    const pdfDoc = await window.pdfjsLib.getDocument({ data: buf }).promise;
    if (!pdfDoc || pdfDoc.numPages < 1) return;
    const page = await pdfDoc.getPage(1);

    // Read the CSS display size that sizeReceiptIframe() just set.
    const cssW = parseFloat(canvas.style.width)  || 816;
    const dpr  = window.devicePixelRatio || 1;

    const baseVp = page.getViewport({ scale: 1 });
    const scale  = (cssW * dpr) / baseVp.width;
    const viewport = page.getViewport({ scale });

    canvas.width  = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    _receiptPdfRenderTask = page.render({ canvasContext: ctx, viewport });
    await _receiptPdfRenderTask.promise;
    _receiptPdfRenderTask = null;
  } catch (err) {
    if (err && err.name === 'RenderingCancelledException') return;
    console.error('PDF canvas render failed:', err);
  }
}

// Debounced refresh of the receipt PDF preview. Called on every
// keystroke in the field-editor accordion so the preview updates
// "live" without thrashing the blob / iframe on each character.
function scheduleReceiptPreviewRefresh(delay = 120) {
  if (_receiptPreviewTimer) clearTimeout(_receiptPreviewTimer);
  if (delay <= 0) {
    _receiptPreviewTimer = null;
    updateReceiptPdfPreview();
    return;
  }
  _receiptPreviewTimer = setTimeout(() => {
    _receiptPreviewTimer = null;
    updateReceiptPdfPreview();
  }, delay);
}

// Wire the receipt-field editor accordion. Every input writes into
// receiptValues (the single source of truth for the PDF) and triggers
// a debounced preview refresh. It NEVER touches the Work Order itself.
function wireReceiptFieldEditors() {
  const fieldMap = {
    receiptEditNo:         'receiptNo',
    receiptEditDate:       'receiptDate',
    receiptEditReceived:   'receivedFrom',
    receiptEditAddress:    'address',
    receiptEditAmount:     'amount',
    receiptEditPurpose:    'purpose',
    receiptEditContractor: 'contractor',
  };

  Object.entries(fieldMap).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const fresh = el.cloneNode(true);
    el.parentNode.replaceChild(fresh, el);
    fresh.value = receiptValues[key] || '';
    fresh.addEventListener('input', () => {
      receiptValues[key] = fresh.value;
      // Amount is the source of truth; the "sum of pesos" line is
      // always derived from it, so recompute on every keystroke.
      if (key === 'amount') {
        const amountNum = parseFloat(String(fresh.value).replace(/,/g, '')) || 0;
        receiptValues.sumWords = numberToWords(amountNum);
      }
      scheduleReceiptPreviewRefresh();
    });
  });

  const resetBtn = document.getElementById('receiptResetEditsBtn');
  if (resetBtn) {
    const fresh = resetBtn.cloneNode(true);
    resetBtn.parentNode.replaceChild(fresh, resetBtn);
    fresh.addEventListener('click', () => {
      Object.assign(receiptValues, _originalReceiptValues);
      Object.entries(fieldMap).forEach(([elId, key]) => {
        const el = document.getElementById(elId);
        if (el) el.value = receiptValues[key] || '';
      });
      scheduleReceiptPreviewRefresh(0);
      if (typeof window.toast === 'function') {
        window.toast('Receipt fields reset to Work Order values.', 'info');
      }
    });
  }
}

function applyReceiptLayout() {
  const paperSize   = document.getElementById('paperSizeSelect')?.value || 'letter';
  const orientation = document.getElementById('orientationSelect')?.value || 'portrait';
  const margin      = document.getElementById('marginSelect')?.value || '0.5';
  const font        = document.getElementById('fontFamilySelect')?.value || "'Times New Roman', Times, serif";
  const fontSize    = document.getElementById('fontSizeSelect')?.value || '12';
  const centerH     = document.getElementById('centerHorizontal')?.checked ?? true;
  const centerV     = document.getElementById('centerVertical')?.checked ?? false;

  const info = document.getElementById('receiptPageInfo');
  if (info) {
    const pretty = s => s.charAt(0).toUpperCase() + s.slice(1);
    info.textContent = `${pretty(paperSize)} · ${pretty(orientation)} · ${margin}" margins`;
  }

  const zoomNow = document.getElementById('receiptZoomSlider')?.value || '80';
  _receiptZoom = Number(zoomNow);
  sizeReceiptIframe();

  savePrintPrefs({ paperSize, orientation, margin, font, fontSize, centerH, centerV, zoom: Number(zoomNow) });

  // Regenerate the PDF and refresh the iframe.
  updateReceiptPdfPreview();
}

// ---- Build the PDF purely from text/vector primitives ----
function buildReceiptPdf() {
  if (!window.jspdf) return null;

  const paperSize     = document.getElementById('paperSizeSelect')?.value || 'letter';
  const orientation   = document.getElementById('orientationSelect')?.value || 'portrait';
  const marginIn      = parseFloat(document.getElementById('marginSelect')?.value || '0.5');
  const fontFamilyCSS = document.getElementById('fontFamilySelect')?.value || "'Times New Roman', Times, serif";
  const fontSizePt    = parseFloat(document.getElementById('fontSizeSelect')?.value || '12');
  const centerV       = document.getElementById('centerVertical')?.checked ?? false;

      // jsPDF ships with three built-in families: times, helvetica, courier.
    // Map every exposed CSS font to its nearest built-in counterpart.
    let pdfFont = 'times';
    if (/courier/i.test(fontFamilyCSS)) {
      pdfFont = 'courier';
    } else if (/arial|helvetica|verdana|trebuchet|segoe|calibri|tahoma|sans/i.test(fontFamilyCSS)) {
      pdfFont = 'helvetica';
    }
    // Everything else (Times, Georgia, Garamond, Palatino, Book Antiqua, Cambria)
    // falls through to 'times'.

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation, unit: 'in', format: paperSize });
  pdf.setLineWidth(0.008);

  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const left = marginIn;
  const right = pdfW - marginIn;
  const contentW = right - left;
  const contentH = pdfH - marginIn * 2;

  const lineH  = fontSizePt / 72;
  const labelPt = fontSizePt * 0.8;
  const rowGap = lineH * 1.45;

  const receiptNo      = receiptValues.receiptNo || '';
  const receiptDate    = receiptValues.receiptDate || '';
  const receivedFrom   = receiptValues.receivedFrom || '';
  const addressText    = receiptValues.address || '';
  const sumWords       = receiptValues.sumWords || '';
  const amountText     = receiptValues.amount || '0.00';
  const purposeText    = receiptValues.purpose || '';
  const contractorText = receiptValues.contractor || '';

  const headerH = lineH * 3.5;
  const totalContentH =
    headerH + 0.35 +
    lineH * 2.4 + 0.2 +
    rowGap * 4 +
    0.5 + lineH * 3.5;

  let y = marginIn + 0.15;
  if (centerV && totalContentH < contentH) {
    y = marginIn + (contentH - totalContentH) / 2;
  }

  // ---- Header box ----
  const headerBoxW = 3.2;
  const headerBoxH = headerH;
  const headerX    = right - headerBoxW;

  pdf.setFillColor(209, 213, 219);
  pdf.setDrawColor(209, 213, 219);
  pdf.rect(headerX, y, headerBoxW, headerBoxH, 'F');

  pdf.setFont(pdfFont, 'bold');
  pdf.setTextColor(0, 0, 0);

  const headerLine1 = 'ACKNOWLEDGEMENT';
  const headerLine2 = 'RECEIPT';
  let headerFontSize = fontSizePt * 1.6;
  pdf.setFontSize(headerFontSize);
  while (
    Math.max(pdf.getTextWidth(headerLine1), pdf.getTextWidth(headerLine2)) > headerBoxW - 0.2 &&
    headerFontSize > 8
  ) {
    headerFontSize -= 0.5;
    pdf.setFontSize(headerFontSize);
  }
  pdf.text(headerLine1, headerX + headerBoxW / 2, y + headerBoxH * 0.45, { align: 'center' });
  pdf.text(headerLine2, headerX + headerBoxW / 2, y + headerBoxH * 0.82, { align: 'center' });

  y += headerBoxH + 0.35;

  // ---- NO / DATE ----
  const metaW = 2.8;
  const metaX = right - metaW;

  pdf.setFont(pdfFont, 'normal');
  pdf.setFontSize(fontSizePt);
  pdf.text('NO:', metaX, y + lineH);
  const noLineStart = metaX + 0.35;
  pdf.setFont(pdfFont, 'bold');
  pdf.text(String(receiptNo), (noLineStart + right) / 2, y + lineH, { align: 'center' });
  pdf.setDrawColor(0, 0, 0);
  pdf.line(noLineStart, y + lineH + 0.02, right, y + lineH + 0.02);

  pdf.setFont(pdfFont, 'normal');
  pdf.text('DATE:', metaX, y + lineH * 2.3);
  const dateLineStart = metaX + 0.55;
  pdf.setFont(pdfFont, 'bold');
  pdf.text(String(receiptDate), (dateLineStart + right) / 2, y + lineH * 2.3, { align: 'center' });
  pdf.line(dateLineStart, y + lineH * 2.3 + 0.02, right, y + lineH * 2.3 + 0.02);

  y += lineH * 2.4 + 0.25;

  // ---- Received from ... with address ----
  pdf.setFont(pdfFont, 'italic');
  pdf.setFontSize(labelPt);
  const lblReceived = 'Received from';
  pdf.text(lblReceived, left, y + lineH);
  const wReceived = pdf.getTextWidth(lblReceived);

  const lblWithAddr = 'with address';
  pdf.text(lblWithAddr, right, y + lineH, { align: 'right' });
  const wWithAddr = pdf.getTextWidth(lblWithAddr);

  const recValX = left + wReceived + 0.15;
  const recValW = right - wWithAddr - 0.15 - recValX;

  pdf.setFont(pdfFont, 'bold');
  pdf.setFontSize(fontSizePt);
  pdf.text(String(receivedFrom).toUpperCase(), recValX + recValW / 2, y + lineH, { align: 'center', maxWidth: recValW });
  pdf.line(recValX, y + lineH + 0.02, recValX + recValW, y + lineH + 0.02);

  y += rowGap;

  // ---- Address (full-width underline) ----
  pdf.setFont(pdfFont, 'bold');
  pdf.setFontSize(fontSizePt);
  pdf.text(String(addressText).toUpperCase(), left + contentW / 2, y + lineH, { align: 'center', maxWidth: contentW });
  pdf.line(left, y + lineH + 0.02, right, y + lineH + 0.02);

  y += rowGap;

  // ---- Sum of pesos ----
  pdf.setFont(pdfFont, 'italic');
  pdf.setFontSize(labelPt);
  const lblSum = 'the sum of pesos';
  pdf.text(lblSum, left, y + lineH);
  const wSum = pdf.getTextWidth(lblSum);

  const lblPhp = '(Php';
  const wPhp   = pdf.getTextWidth(lblPhp);
  const wClose = pdf.getTextWidth(')');

  const amountW = 1.0;
  const sumValX = left + wSum + 0.12;
  const sumValW = right - amountW - wPhp - wClose - 0.3 - sumValX;

  pdf.setFont(pdfFont, 'bold');
  pdf.setFontSize(fontSizePt);
  pdf.text(String(sumWords).toUpperCase(), sumValX + sumValW / 2, y + lineH, { align: 'center', maxWidth: sumValW });
  pdf.line(sumValX, y + lineH + 0.02, sumValX + sumValW, y + lineH + 0.02);

  const phpX = sumValX + sumValW + 0.12;
  pdf.setFont(pdfFont, 'normal');
  pdf.setFontSize(labelPt);
  pdf.text(lblPhp, phpX, y + lineH);

  const amtX = phpX + wPhp + 0.05;
  pdf.setFont(pdfFont, 'bold');
  pdf.setFontSize(fontSizePt);
  pdf.text(String(amountText), amtX + amountW / 2, y + lineH, { align: 'center' });
  pdf.line(amtX, y + lineH + 0.02, amtX + amountW, y + lineH + 0.02);

  pdf.setFont(pdfFont, 'normal');
  pdf.setFontSize(labelPt);
  pdf.text(')', amtX + amountW + 0.05, y + lineH);

  y += rowGap;

  // ---- Purpose ----
  pdf.setFont(pdfFont, 'italic');
  pdf.setFontSize(labelPt);
  const lblPurpose = 'in full / partial payment of';
  pdf.text(lblPurpose, left, y + lineH);
  const wPurpose = pdf.getTextWidth(lblPurpose);

  const purposeX = left + wPurpose + 0.12;
  const purposeW = right - purposeX;

  pdf.setFont(pdfFont, 'bold');
  pdf.setFontSize(fontSizePt);
  pdf.text(String(purposeText).toUpperCase(), purposeX + purposeW / 2, y + lineH, { align: 'center', maxWidth: purposeW });
  pdf.line(purposeX, y + lineH + 0.02, purposeX + purposeW, y + lineH + 0.02);

  // ---- Footer ----
  const footerY = y + rowGap * 4.85;
  const boxSize = lineH * 0.9;

  pdf.setFont(pdfFont, 'normal');
  pdf.setFontSize(fontSizePt);
  pdf.setDrawColor(0, 0, 0);
  pdf.setTextColor(0, 0, 0);

  ['CASH', 'CHECK', 'BANK'].forEach((label, i) => {
    const cy = footerY + i * lineH * 1.9;
    pdf.rect(left, cy, boxSize, boxSize, 'S');
    pdf.text(label, left + boxSize + 0.1, cy + boxSize * 0.72);
  });

  const sigX = pdfW * 0.52;
  const sigW = right - sigX;

  pdf.setFont(pdfFont, 'italic');
  pdf.setFontSize(labelPt);
  pdf.text('By:', sigX, footerY + lineH * 1.4);
  const wBy = pdf.getTextWidth('By:');

  const conX = sigX + wBy + 0.12;
  const conW = right - conX;
  pdf.setFont(pdfFont, 'bold');
  pdf.setFontSize(fontSizePt);
  pdf.text(String(contractorText).toUpperCase(), conX + conW / 2, footerY + lineH * 1.4, { align: 'center', maxWidth: conW });
  pdf.setDrawColor(0, 0, 0);
  pdf.line(conX, footerY + lineH * 1.4 + 0.02, right, footerY + lineH * 1.4 + 0.02);

  pdf.setFont(pdfFont, 'italic');
  pdf.setFontSize(labelPt);
  pdf.text('Authorized Signature', sigX + sigW / 2, footerY + lineH * 2.6, { align: 'center' });

  return pdf;
}

// ---- Regenerate the PDF and update the iframe preview ----
function updateReceiptPdfPreview() {
  const pdf = buildReceiptPdf();
  if (!pdf) return;

  if (_receiptPdfUrl) {
    try { URL.revokeObjectURL(_receiptPdfUrl); } catch {}
    _receiptPdfUrl = null;
  }

  _receiptPdfBlob = pdf.output('blob');
  _receiptPdfUrl = URL.createObjectURL(_receiptPdfBlob);

  const iframe = document.getElementById('receiptPdfPreview');
  const canvas = document.getElementById('receiptPdfCanvas');
  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  if (isMobile && canvas) {
    // Mobile browsers refuse to inline-render PDFs inside an <iframe>.
    // Hide the iframe and paint the blob onto a canvas with PDF.js.
    if (iframe) {
      iframe.style.display = 'none';
      iframe.src = 'about:blank';
    }
    canvas.style.display = 'block';
    // sizeReceiptIframe will trigger the canvas paint on mobile
    // (its mobile branch calls renderReceiptPdfToCanvas).
    sizeReceiptIframe();
  } else {
    // Desktop: the browser's native PDF viewer inside the iframe.
    if (canvas) canvas.style.display = 'none';
    if (iframe) {
      iframe.style.display = 'block';
      // #toolbar=0 hides the PDF viewer chrome; view=Fit fits the whole page.
      iframe.src = _receiptPdfUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=Fit';
    }
  }
}

export function openDrawer(id) {
  // ---- DUPLICATE RESOLUTION: ensure the ID is unique ----
  const matchingOrders = orders.filter(o => o.id === id);
  if (matchingOrders.length > 1) {
    // Keep the first order as the "canonical" one.
    let duplicatesFixed = 0;
    let counter = 2;
    for (let i = 1; i < matchingOrders.length; i++) {
      const dup = matchingOrders[i];
      // Generate a clean unique ID: base-2, base-3, etc.
      let newId;
      let found = false;
      while (!found) {
        newId = `${id}-${counter}`;
        if (!orders.some(o => o.id === newId)) {
          found = true;
        } else {
          counter++;
        }
      }
      // Store the base ID for display purposes
      dup._baseDisplayId = id;
      dup.id = newId;
      duplicatesFixed++;
      counter++; // increment for the next duplicate
    }
    if (duplicatesFixed > 0) {
      saveOrders();
      // ---- NEW: Refresh the dashboard grid to update data-open attributes ----
      if (typeof window.render === 'function') {
        window.render();
      }
      // ---- END NEW ----
      if (typeof toast === 'function') {
        toast(`🔧 Resolved ${duplicatesFixed} duplicate ID(s) by reassigning new unique IDs.`, 'info');
      }
      // Re‑fetch matching orders – now there should be only one (the first one)
      const remaining = orders.filter(o => o.id === id);
      if (remaining.length === 0) {
        return;
      }
      // Continue with the drawer for the original id.
    }
  }
  // ---- End duplicate resolution ----

  // ---- Original openDrawer logic (unchanged) ----
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
  document.getElementById('drawerNumber').textContent = o._baseDisplayId || o.id;
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
  // The shared helper is the single source of truth for
  // custom-field ordering and value resolution.

  const allCustomFields = buildOrderedDrawerCustomFields(
    o,
    fieldConfigs
  );

  const customFieldsHTML = allCustomFields.length
    ? allCustomFields
        .map(f => detailBox(f.label, f.value, o.id))
        .join('')
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

  // ---- PRINT RECEIPT ----
  document.getElementById('drawerPrintBtn')?.addEventListener('click', () => openReceiptModal(id));
}

// ---- RECEIPT MODAL LOGIC ----
// ---- RECEIPT MODAL LOGIC ----
export function openReceiptModal(orderId) {
  const o = orders.find(x => x.id === orderId);
  if (!o) return;

    const getCustomFieldValue = (order, fieldName) => {
    if (!fieldName) return '';
    const search = String(fieldName).toLowerCase().trim();

    const lookup = (term) => {
      if (!term) return '';
      const t = String(term).toLowerCase().trim();
      if (!t) return '';

      // 1. customFields by label or _sourceHeader
      const cf = (order.customFields || []).find(f => {
        const l = String(f.label || '').toLowerCase().trim();
        const s = String(f._sourceHeader || '').toLowerCase().trim();
        return l === t || s === t;
      });
      if (cf && cf.value !== undefined && cf.value !== null && String(cf.value).trim() !== '') {
        return String(cf.value).trim();
      }

      // 2. _rawData
      if (order._rawData) {
        const key = Object.keys(order._rawData).find(k => String(k).toLowerCase().trim() === t);
        if (key && order._rawData[key] !== undefined && order._rawData[key] !== null && String(order._rawData[key]).trim() !== '') {
          return String(order._rawData[key]).trim();
        }
      }
      return '';
    };

    // Direct lookup
    let v = lookup(search);
    if (v) return v;

    // Look up the field in fieldConfig and try its source/label/key
    const fc = displayConfig.fieldConfig || {};
    const key = Object.keys(fc).find(k => {
      const c = fc[k];
      const l = String(c.label || '').toLowerCase().trim();
      const s = String(c.source || '').toLowerCase().trim();
      return l === search || s === search || k.toLowerCase() === search;
    });

    if (key) {
      const c = fc[key];
      v = lookup(c.source) || lookup(c.label) || lookup(key);
      if (v) return v;

      // Last resort: use displayValue with the mapped source
      if (c.source && typeof displayValue === 'function') {
        const dv = displayValue(order, c.source);
        if (dv !== undefined && dv !== null && String(dv).trim() !== '') {
          return String(dv).trim();
        }
      }
    }

    return '';
  };

  const config = displayConfig.receiptConfig || { amountField: 'Amount', addressField: 'Address', contractorField: 'Contractor' };
  const amountStr = getCustomFieldValue(o, config.amountField) || '0';
  const amountNum = parseFloat(String(amountStr).replace(/,/g, '')) || 0;

      receiptValues.receiptNo    = o._baseDisplayId || o.id;
  receiptValues.receiptDate  = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  receiptValues.receivedFrom = o.location || '';
  receiptValues.address      = getCustomFieldValue(o, config.addressField) || '';
  receiptValues.sumWords     = numberToWords(amountNum);
  receiptValues.amount       = amountNum.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  receiptValues.purpose      = o.title || '';
  receiptValues.contractor   = getCustomFieldValue(o, config.contractorField) || '';

  // Snapshot the original Work-Order-derived values so the
  // "Reset to Work Order Values" button can restore them.
  _originalReceiptValues = { ...receiptValues };

  // ---- Restore previous print preferences ----
  const prefs = loadPrintPrefs();
  if (prefs.paperSize) document.getElementById('paperSizeSelect').value = prefs.paperSize;
  if (prefs.orientation) document.getElementById('orientationSelect').value = prefs.orientation;
  if (prefs.margin) document.getElementById('marginSelect').value = prefs.margin;
  if (prefs.font) document.getElementById('fontFamilySelect').value = prefs.font;
  if (prefs.fontSize) document.getElementById('fontSizeSelect').value = prefs.fontSize;
    document.getElementById('centerHorizontal').checked = prefs.centerH !== false;
  document.getElementById('centerVertical').checked = prefs.centerV === true;

  // ---- Zoom controls wiring ----
  const zoomSliderEl  = document.getElementById('receiptZoomSlider');
  const zoomOutEl     = document.getElementById('zoomOutReceiptBtn');
  const zoomInEl      = document.getElementById('zoomInReceiptBtn');
  const zoomResetEl   = document.getElementById('resetReceiptZoomBtn');

  if (zoomSliderEl) {
    const fresh = zoomSliderEl.cloneNode(true);
    zoomSliderEl.parentNode.replaceChild(fresh, zoomSliderEl);
        fresh.value = String(prefs.zoom || 80);
    fresh.addEventListener('input', () => applyReceiptZoom(fresh.value));
  }
  if (zoomOutEl) {
    const fresh = zoomOutEl.cloneNode(true);
    zoomOutEl.parentNode.replaceChild(fresh, zoomOutEl);
        fresh.addEventListener('click', () => {
      const cur = Number(document.getElementById('receiptZoomSlider')?.value || 80);
      applyReceiptZoom(Math.max(25, cur - 10));
    });
  }
  if (zoomInEl) {
    const fresh = zoomInEl.cloneNode(true);
    zoomInEl.parentNode.replaceChild(fresh, zoomInEl);
    fresh.addEventListener('click', () => {
      const cur = Number(document.getElementById('receiptZoomSlider')?.value || 80);
      applyReceiptZoom(Math.min(200, cur + 10));
    });
  }
  if (zoomResetEl) {
    const fresh = zoomResetEl.cloneNode(true);
    zoomResetEl.parentNode.replaceChild(fresh, zoomResetEl);
    fresh.addEventListener('click', () => applyReceiptZoom(100));
  }

  // ---- Attach layout listeners (idempotent, replaced each time) ----
  const attachChange = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const fresh = el.cloneNode(true);
    el.parentNode.replaceChild(fresh, el);
    fresh.addEventListener('change', applyReceiptLayout);
    fresh.addEventListener('input', applyReceiptLayout);
  };
  ['paperSizeSelect', 'orientationSelect', 'marginSelect', 'fontFamilySelect', 'fontSizeSelect', 'centerHorizontal', 'centerVertical'].forEach(attachChange);

  // ---- Address modal wiring ----
  const openAddrBtn = document.getElementById('openAddressModalBtn');
  if (openAddrBtn) {
    const fresh = openAddrBtn.cloneNode(true);
    openAddrBtn.parentNode.replaceChild(fresh, openAddrBtn);
    fresh.addEventListener('click', () => openAddressModal());
  }

  const saveAddrBtn = document.getElementById('saveAddressBtn');
  if (saveAddrBtn) {
    const fresh = saveAddrBtn.cloneNode(true);
    saveAddrBtn.parentNode.replaceChild(fresh, saveAddrBtn);
    fresh.addEventListener('click', () => handleSaveAddress(false));
  }

    const applyAddrBtn = document.getElementById('applyAddressToAllBtn');
  if (applyAddrBtn) {
    const fresh = applyAddrBtn.cloneNode(true);
    applyAddrBtn.parentNode.replaceChild(fresh, applyAddrBtn);
    fresh.addEventListener('click', () => handleSaveAddress(true));
  }

  // ---- Save Preferences button ----
  const savePrefsBtn = document.getElementById('saveReceiptPrefsBtn');
  if (savePrefsBtn) {
    const fresh = savePrefsBtn.cloneNode(true);
    savePrefsBtn.parentNode.replaceChild(fresh, savePrefsBtn);
    fresh.addEventListener('click', () => {
      // applyReceiptLayout already persists every setting through savePrintPrefs().
      applyReceiptLayout();
      if (typeof window.toast === 'function') {
        window.toast('Receipt preferences saved.', 'success');
      }
    });
  }

  // ---- Reset to Defaults button ----
  const resetPrefsBtn = document.getElementById('resetReceiptPrefsBtn');
  if (resetPrefsBtn) {
    const fresh = resetPrefsBtn.cloneNode(true);
    resetPrefsBtn.parentNode.replaceChild(fresh, resetPrefsBtn);
    fresh.addEventListener('click', () => {
      // Wipe the stored preferences and restore every control to its default.
      try { localStorage.removeItem(PRINT_PREFS_KEY); } catch {}

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };
      setVal('paperSizeSelect', 'letter');
      setVal('orientationSelect', 'portrait');
      setVal('marginSelect', '0.5');
      setVal('fontFamilySelect', "'Times New Roman', Times, serif");
      setVal('fontSizeSelect', '12');

      const chkH = document.getElementById('centerHorizontal');
      if (chkH) chkH.checked = true;
      const chkV = document.getElementById('centerVertical');
      if (chkV) chkV.checked = false;

      const zs = document.getElementById('receiptZoomSlider');
      if (zs) zs.value = '80';
      const zv = document.getElementById('receiptZoomValue');
      if (zv) zv.textContent = '80%';
      _receiptZoom = 80;

      applyReceiptLayout();
      if (typeof window.toast === 'function') {
        window.toast('Receipt preferences reset to defaults.', 'info');
      }
    });
  }

    // ---- Mobile settings sidebar wiring ----
  const sidebarEl       = document.getElementById('receiptSidebar');
  const sidebarBackdrop = document.getElementById('receiptSidebarBackdrop');
  const sidebarToggle   = document.getElementById('receiptSidebarToggle');

  const setSidebarOpen = (open) => {
    sidebarEl?.classList.toggle('open', open);
    sidebarBackdrop?.classList.toggle('open', open);
  };
  // Always start closed so the preview is what MASTER sees first.
  setSidebarOpen(false);

  if (sidebarToggle) {
    const fresh = sidebarToggle.cloneNode(true);
    sidebarToggle.parentNode.replaceChild(fresh, sidebarToggle);
    fresh.addEventListener('click', () => {
      setSidebarOpen(!sidebarEl?.classList.contains('open'));
    });
  }
  if (sidebarBackdrop) {
    const fresh = sidebarBackdrop.cloneNode(true);
    sidebarBackdrop.parentNode.replaceChild(fresh, sidebarBackdrop);
    fresh.addEventListener('click', () => setSidebarOpen(false));
  }

    // ---- Wire the receipt-field editor accordion ----
  wireReceiptFieldEditors();

  applyReceiptLayout();

  document.getElementById('receiptModal').classList.remove('hidden');

  // After the modal is painted, re-fit the preview. This is what
  // makes the paper fit the viewport on phones (clientWidth was 0
  // while the modal was still display:none). The initial zoom on
  // mobile is display-only — it is NOT persisted, and MASTER can
  // still freely zoom / pan afterwards.
  requestAnimationFrame(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      const canvas = document.getElementById('receiptPreviewCanvas');
      if (canvas && canvas.clientWidth > 0) {
        const paperSize   = document.getElementById('paperSizeSelect')?.value || 'letter';
        const orientation = document.getElementById('orientationSelect')?.value || 'portrait';
        const dims = PAPER_SIZES[paperSize]?.[orientation] || PAPER_SIZES.letter.portrait;
        const cs   = window.getComputedStyle(canvas);
        const padL = parseFloat(cs.paddingLeft) || 0;
        const padR = parseFloat(cs.paddingRight) || 0;
        const availW = canvas.clientWidth - padL - padR;
        const fitZoom = Math.max(25, Math.min(200, Math.floor((availW / (dims.w * 96)) * 100)));
        if (fitZoom > 0) {
          _receiptZoom = fitZoom;
          const slider = document.getElementById('receiptZoomSlider');
          if (slider) slider.value = String(fitZoom);
          const label = document.getElementById('receiptZoomValue');
          if (label) label.textContent = fitZoom + '%';
        }
      }
    }
    sizeReceiptIframe();
  });
}

// ---- Address inner modal ----
export function openAddressModal() {
  const modal = document.getElementById('addressModal');
  const input = document.getElementById('addressModalInput');
  // Pull the current value from receiptValues — the single source of
  // truth for the PDF preview — so the modal always reflects what the
  // receipt currently shows (from the Work Order, the sidebar
  // accordion, or a previous save here). This replaces the stale
  // `receiptAddress` element lookup that no longer exists in the DOM.
  if (input) input.value = receiptValues.address || '';
  modal?.classList.remove('hidden');
  setTimeout(() => input?.focus(), 80);
}

export function closeAddressModal() {
  document.getElementById('addressModal')?.classList.add('hidden');
}

function handleSaveAddress(applyToAll) {
  const address = document.getElementById('addressModalInput')?.value?.trim() || '';
  const o = orders.find(x => x.id === selectedId);
  if (!o) { closeAddressModal(); return; }

  const config = displayConfig.receiptConfig || { addressField: 'Address' };
  const fieldName = config.addressField || 'Address';

  // Update this order
  if (!o.customFields) o.customFields = [];
  const norm = fieldName.toLowerCase();
  let f = o.customFields.find(cf =>
    String(cf.label || '').toLowerCase() === norm ||
    String(cf._sourceHeader || '').toLowerCase() === norm
  );
  if (f) f.value = address;
  else o.customFields.push({ label: fieldName, value: address, _sourceHeader: '' });

  if (o._rawData && fieldName) o._rawData[fieldName] = address;

        // Update the live value that feeds the PDF, then re-render the preview.
  receiptValues.address = address;
  // Keep the sidebar "Edit Fields → Address" input in sync so the
  // accordion reflects the new value the moment the modal is saved.
  const sidebarAddr = document.getElementById('receiptEditAddress');
  if (sidebarAddr) sidebarAddr.value = address;
  updateReceiptPdfPreview();

  if (applyToAll) {
    const location = o.location;
    let count = 0;
    orders.forEach(order => {
      if (order.id === o.id || order.location !== location) return;
      if (!order.customFields) order.customFields = [];
      let cf = order.customFields.find(c =>
        String(c.label || '').toLowerCase() === norm ||
        String(c._sourceHeader || '').toLowerCase() === norm
      );
      if (cf) cf.value = address;
      else order.customFields.push({ label: fieldName, value: address, _sourceHeader: '' });
      if (order._rawData && fieldName) order._rawData[fieldName] = address;
      count++;
    });
    saveOrders();
    if (typeof window.toast === 'function') window.toast(`Address applied to ${count} other order(s) in "${location}".`, 'success');
  } else {
    saveOrders();
    if (typeof window.toast === 'function') window.toast('Address saved.', 'success');
  }

  closeAddressModal();
}

export function closeReceiptModal() {
  document.getElementById('receiptModal').classList.add('hidden');
  // Reset the mobile settings sidebar so it always starts closed next time.
  document.getElementById('receiptSidebar')?.classList.remove('open');
  document.getElementById('receiptSidebarBackdrop')?.classList.remove('open');

  // Kill any pending debounced preview refresh so it can't fire
  // after the modal has been dismissed.
  if (_receiptPreviewTimer) {
    clearTimeout(_receiptPreviewTimer);
    _receiptPreviewTimer = null;
  }

  // Cancel any in-flight canvas render.
  if (_receiptPdfRenderTask) {
    try { _receiptPdfRenderTask.cancel(); } catch {}
    _receiptPdfRenderTask = null;
  }

  if (_receiptPdfUrl) {
    try { URL.revokeObjectURL(_receiptPdfUrl); } catch {}
    _receiptPdfUrl = null;
    _receiptPdfBlob = null;
  }
  const iframe = document.getElementById('receiptPdfPreview');
  if (iframe) iframe.src = 'about:blank';

  // Wipe the canvas buffer so stale pixels don't flash on the next open.
  const canvas = document.getElementById('receiptPdfCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
  }
}

export function printReceipt() {
  const paperSize = document.getElementById('paperSizeSelect')?.value || 'letter';
  const orientation = document.getElementById('orientationSelect')?.value || 'portrait';

  const style = document.createElement('style');
  style.id = 'receipt-print-page-rule';
  style.innerHTML = `@page { size: ${paperSize} ${orientation}; margin: 0; }`;
  document.head.appendChild(style);

  window.print();

  setTimeout(() => {
    const el = document.getElementById('receipt-print-page-rule');
    if (el) el.remove();
  }, 1500);
}

export async function downloadReceiptPDF() {
  // Make sure the cached blob is fresh.
  if (!_receiptPdfBlob) {
    updateReceiptPdfPreview();
  }
  if (!_receiptPdfBlob) {
    toast('PDF is still generating. Please try again in a moment.', 'error');
    return;
  }

  const a = document.createElement('a');
  a.href = _receiptPdfUrl;
  a.download = `Acknowledgement_Receipt_${selectedId || 'Order'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('Receipt downloaded as PDF.', 'success');
}

// ---- NUMBER TO WORDS CONVERTER ----
function numberToWords(num) {
  if (isNaN(num) || num === 0) return 'ZERO PHILIPPINE PESOS';
  const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
  const b = ['', '', 'TWENTY ', 'THIRTY ', 'FORTY ', 'FIFTY ', 'SIXTY ', 'SEVENTY ', 'EIGHTY ', 'NINETY '];
  const g = ['', 'THOUSAND ', 'MILLION ', 'BILLION ', 'TRILLION '];
  let n = Math.floor(num);
  let str = '';
  let group = 0;
  while (n > 0) {
    let temp = n % 1000;
    let currentGroup = '';
    if (temp > 0) {
      let hundred = Math.floor(temp / 100);
      let rest = temp % 100;
      if (hundred > 0) currentGroup += a[hundred] + 'HUNDRED ';
      if (rest > 0) {
        if (rest < 20) currentGroup += a[rest];
        else currentGroup += b[Math.floor(rest / 10)] + a[rest % 10];
      }
      str = currentGroup + g[group] + str;
    }
    n = Math.floor(n / 1000);
    group++;
  }
  return str.trim() + ' PHILIPPINE PESOS';
}

// Expose to window for inline onclick
window.openReceiptModal = openReceiptModal;
window.closeReceiptModal = closeReceiptModal;
window.printReceipt = printReceipt;
window.downloadReceiptPDF = downloadReceiptPDF;
window.openAddressModal = openAddressModal;
window.closeAddressModal = closeAddressModal;

// Re-fit the receipt preview whenever the viewport changes size
// (phone rotation, browser resize, on-screen keyboard, etc.).
window.addEventListener('resize', () => {
  const modal = document.getElementById('receiptModal');
  if (!modal || modal.classList.contains('hidden')) return;

  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  if (isMobile && _receiptPdfBlob) {
    // Mobile canvas path: re-fit and repaint at the new viewport size.
    sizeReceiptIframe();
    return;
  }

  // Desktop iframe path.
  const iframe = document.getElementById('receiptPdfPreview');
  if (!iframe || !iframe.src || iframe.src === 'about:blank') return;
  sizeReceiptIframe();
});

/**
 * Refresh only the custom fields section of the drawer
 * – used by Settings after reordering fields.
 * Now rebuilds the entire drawer to ensure all changes apply.
 */
export function refreshDrawerCustomFields() {
  if (selectedId === null) return;
  renderDrawer(selectedId);
}

// =========================================================
// SHARED CUSTOM FIELD BUILDER
// =========================================================
//
// This is the single source of truth for custom-field
// display order inside the Drawer.
//
// Priority:
//   1. displayConfig.customFieldOrder
//   2. Any configured custom fields missing from that order
//   3. Per-work-order custom fields that are not globally configured
//
// The stored o.customFields array is NOT used to determine
// the order of globally configured fields.
//

function buildOrderedDrawerCustomFields(o, fieldConfigs = getAllFieldConfigs()) {
  if (!o) return [];

  const customOrder = Array.isArray(displayConfig.customFieldOrder)
    ? displayConfig.customFieldOrder
    : [];

  // -------------------------------------------------------
  // ALL GLOBALLY CONFIGURED CUSTOM FIELD LABELS
  // -------------------------------------------------------
  //
  // Drawer visibility is intentionally independent of
  // showOnCard. The "showOnCard" setting controls cards only.
  // Configured custom fields must still appear in the Drawer.
  //
  const globalCustomKeys = Object.keys(fieldConfigs)
    .filter(key => key.startsWith('custom_'));

  const globallyConfiguredLabels = new Set(
    globalCustomKeys
      .map(key => String(fieldConfigs[key]?.label || key).trim().toLowerCase())
      .filter(Boolean)
  );

  // -------------------------------------------------------
  // ORDER GLOBAL CUSTOM FIELDS USING SETTINGS ORDER
  // -------------------------------------------------------

  const orderedKeys = customOrder.filter(key =>
    globalCustomKeys.includes(key)
  );

  // Include configured fields that are not yet present in
  // customFieldOrder, preserving their configuration order.
  const unorderedKeys = globalCustomKeys.filter(key =>
    !customOrder.includes(key)
  );

  const finalKeys = [
    ...orderedKeys,
    ...unorderedKeys,
  ];

  // -------------------------------------------------------
  // BUILD GLOBAL CUSTOM FIELDS
  // -------------------------------------------------------
  //
  // Do NOT filter by cfg.showOnCard here.
  // Drawer fields must follow Settings order regardless
  // of whether they are shown on the work-order cards.
  //
  const globalCustomFields = [];

  finalKeys.forEach(key => {
    const cfg = fieldConfigs[key];
    if (!cfg) return;

    const label = String(cfg.label || key).trim();
    const source = String(cfg.source || '').trim();

    if (!label) return;

    let value = source
      ? displayValue(o, source)
      : '';

    // If the mapped source has no value, fall back to the
    // matching custom field on this specific work order.
    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ''
    ) {
      const fallbackValue = customFieldValue(o, label);
      if (
        fallbackValue !== undefined &&
        fallbackValue !== null &&
        String(fallbackValue).trim() !== ''
      ) {
        value = fallbackValue;
      }
    }

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      globalCustomFields.push({
        key,
        label,
        value: String(value).trim(),
      });
    }
  });

  // -------------------------------------------------------
  // PER-ORDER CUSTOM FIELDS
  // -------------------------------------------------------
  //
  // Only append fields that are not globally configured.
  // This prevents globally configured fields from appearing
  // a second time in their old insertion order.
  //
  const perOrderFields = (
    Array.isArray(o.customFields)
      ? o.customFields
      : []
  )
    .filter(field => {
      if (!field) return false;

      const label = String(field.label || '').trim();
      const value = String(field.value ?? '').trim();
      const source = String(field._sourceHeader || '').trim();

      return !!label && (!!value || !!source);
    })
    .filter(field => {
      const label = String(field.label || '')
        .trim()
        .toLowerCase();

      return !globallyConfiguredLabels.has(label);
    })
    .map(field => {
      const label = String(field.label || '').trim();

      const resolvedValue = customFieldValue(o, label);

      const finalValue =
        resolvedValue !== undefined &&
        resolvedValue !== null &&
        String(resolvedValue).trim() !== ''
          ? resolvedValue
          : field.value || '';

      return {
        key: null,
        label,
        value: String(finalValue).trim(),
      };
    })
    .filter(field => field.label && field.value);

  // -------------------------------------------------------
  // FINAL DEDUPLICATION
  // -------------------------------------------------------

  const result = [];
  const seenLabels = new Set();

  [...globalCustomFields, ...perOrderFields].forEach(field => {
    const normalizedLabel = String(field.label || '')
      .trim()
      .toLowerCase();

    if (!normalizedLabel) return;
    if (seenLabels.has(normalizedLabel)) return;

    seenLabels.add(normalizedLabel);
    result.push(field);
  });

  return result;
}

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

  if (!list || !o) return;

  const fieldConfigs = getAllFieldConfigs();

  // -------------------------------------------------------
  // USE THE EXACT SAME BUILDER AS renderDrawer()
  // -------------------------------------------------------
  //
  // This prevents the live-update path from using a
  // different ordering/value-resolution system.
  //

  const allCustomFields = buildOrderedDrawerCustomFields(
    o,
    fieldConfigs
  );

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------

  if (!allCustomFields.length) {
    list.innerHTML = `
      <p class="text-xs text-black/40 col-span-2">
        No custom fields yet. Click "Add Field" to add one.
      </p>
    `;
    return;
  }

  list.innerHTML = allCustomFields
    .map(field =>
      detailBox(
        field.label,
        field.value,
        o.id
      )
    )
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