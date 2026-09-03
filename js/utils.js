// =========================================================
// UTILITY FUNCTIONS – pure helpers, no DOM, no side effects
// =========================================================

// ---------- String / sanitization ----------
export function esc(v = '') {
  return String(v).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[m]));
}

export function normalize(v = '') {
  return String(v)
    .toLowerCase()
    .trim()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function toTitleCase(str) {
  if (!str) return str;
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

// ---------- Date / time ----------
export function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

export function nowStamp() {
  const d = new Date();
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

export function toInputDate(v) {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

export function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v + (String(v).length <= 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function parseDateValue(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && window.XLSX && XLSX.SSF) {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d && d.d >= 1 && d.d <= 31 && d.m >= 1 && d.m <= 12) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch (_) {}
  }
  const s = String(v).trim();
  if (!s) return '';
  let datePart = s;
  const timeSeparator = s.search(/[ T]/);
  if (timeSeparator !== -1) datePart = s.slice(0, timeSeparator).trim();
  const mdyMatch = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    let month = parseInt(mdyMatch[1], 10);
    let day = parseInt(mdyMatch[2], 10);
    let year = parseInt(mdyMatch[3], 10);
    if (month > 12 && day <= 12) { [month, day] = [day, month]; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }
  const d = new Date(s);
  if (!isNaN(d)) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  return '';
}

// ---------- Status / priority / assignee helpers ----------
export function statusClass(s) {
  return ({
    Open: 'bg-blue-50 text-blue-700 border-blue-100',
    'In Progress': 'bg-amber-50 text-amber-700 border-amber-100',
    'On Hold': 'bg-violet-50 text-violet-700 border-violet-100',
    Completed: 'bg-brand-success/20 text-brand-success border-brand-success/30',
    Overdue: 'bg-red-50 text-red-700 border-red-100',
    Cancelled: 'bg-black/5 text-black/50 border-black/10',
    pending: 'bg-gray-100 text-gray-700 border-gray-200',
    'On Process': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  }[s] || 'bg-black/5 text-black/60 border-black/10');
}

export function priorityClass(p) {
  return ({
    Critical: 'bg-red-50 text-red-700',
    High: 'bg-orange-50 text-orange-700',
    Medium: 'bg-amber-50 text-amber-700',
    Low: 'bg-brand-success/20 text-brand-success',
  }[p] || 'bg-black/5 text-black/60');
}

export function priorityRank(p) {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[p] ?? 9;
}

export function normalizePriority(v) {
  const n = normalize(v);
  if (/critical|urgent|emergency/.test(n)) return 'Critical';
  if (/high|major/.test(n)) return 'High';
  if (/low|minor/.test(n)) return 'Low';
  return 'Medium';
}

export function getPriorityColor(priority) {
  const normalized = normalizePriority(priority);
  const colors = {
    Critical: 'bg-red-600 text-white',
    High: 'bg-orange-500 text-white',
    Medium: 'bg-yellow-400 text-black',
    Low: 'bg-green-500 text-white',
  };
  return colors[normalized] || 'bg-gray-400 text-white';
}

export function getAssigneeColor(name) {
  if (!name || name === 'Unassigned') return 'assignee-color-default';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % 12 + 1;
  return `assignee-color-${colorIndex}`;
}

export function getStatusAccentClass(status) {
  const s = String(status || '').toLowerCase().trim();
  const base = 'border-l-[4px] hover:border-l-[15px] transition-all duration-300 ease-out hover:shadow-2xl hover:-translate-y-1';
  if (s.includes('completed') || s.includes('done') || s.includes('finished')) {
    return `${base} border-l-green-500 hover:border-l-green-400 hover:shadow-[inset_0_0_20px_rgba(34,197,94,0.4),0_20px_40px_-12px_rgba(34,197,94,0.3)]`;
  }
  if (s.includes('approved') || s.includes('accepted')) {
    return `${base} border-l-blue-500 hover:border-l-blue-400 hover:shadow-[inset_0_0_20px_rgba(59,130,246,0.4),0_20px_40px_-12px_rgba(59,130,246,0.3)]`;
  }
  if (s.includes('cancelled') || s.includes('canceled')) {
    return `${base} border-l-red-500 hover:border-l-red-400 hover:shadow-[inset_0_0_20px_rgba(239,68,68,0.4),0_20px_40px_-12px_rgba(239,68,68,0.3)]`;
  }
  if (s.includes('disapproved') || s.includes('rejected')) {
    return `${base} border-l-red-600 hover:border-l-red-500 hover:shadow-[inset_0_0_20px_rgba(220,38,38,0.4),0_20px_40px_-12px_rgba(220,38,38,0.3)]`;
  }
  if (s.includes('in progress') || s.includes('progress') || s.includes('ongoing')) {
    return `${base} border-l-blue-400 hover:border-l-blue-300 hover:shadow-[inset_0_0_20px_rgba(96,165,250,0.4),0_20px_40px_-12px_rgba(96,165,250,0.3)]`;
  }
  // NEW: pending → grey
  if (s.includes('pending')) {
    return `${base} border-l-gray-400 hover:border-l-gray-300 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)]`;
  }
  // NEW: On Process → yellow (keep same as on hold)
  if (s.includes('on process') || s.includes('on hold') || s.includes('waiting')) {
    return `${base} border-l-yellow-500 hover:border-l-yellow-400 hover:shadow-[inset_0_0_20px_rgba(234,179,8,0.4),0_20px_40px_-12px_rgba(234,179,8,0.3)]`;
  }
  if (s.includes('overdue') || s.includes('late')) {
    return `${base} border-l-red-600 hover:border-l-red-500 hover:shadow-[inset_0_0_20px_rgba(220,38,38,0.4),0_20px_40px_-12px_rgba(220,38,38,0.3)]`;
  }
  if (s.includes('incomplete attachment') || s.includes('attachment')) {
    return `${base} border-l-purple-400 hover:border-l-purple-300 hover:shadow-[inset_0_0_20px_rgba(168,85,247,0.4),0_20px_40px_-12px_rgba(168,85,247,0.3)]`;
  }
  if (s.includes('open') || s.includes('new') || s.includes('created')) {
    return `${base} border-l-gray-400 hover:border-l-gray-300 hover:shadow-[inset_0_0_20px_rgba(156,163,175,0.2),0_20px_40px_-12px_rgba(0,0,0,0.1)]`;
  }
  return `${base} border-l-gray-300 hover:border-l-gray-200 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)]`;
}

// ---------- Initials ----------
export function initials(name = 'Unassigned') {
  const a = String(name || 'Unassigned').trim().split(/\s+/).filter(Boolean);
  if (!a.length) return 'UN';
  if (a.length === 1) return a[0].slice(0, 2).toUpperCase();
  return a.slice(0, 2).map((x) => x[0]).join('').toUpperCase();
}

// ---------- History ----------
export function isHistoryValid(entry) {
  if (!entry || !entry.timestamp) return false;
  const now = Date.now();
  const twelveHours = 12 * 60 * 60 * 1000;
  return now - entry.timestamp <= twelveHours;
}

// ---------- Field mapping / import helpers ----------
export const FIELD_DEFS = {
  id: ['id','work order','work order no','work order number','wo','wo no','wo number','ticket','ticket no','request no','request number','job no','job number','reference'],
  title: ['title','subject','work order title','job title','request','request title','issue','problem','task','summary'],
  description: ['description','details','detail','remarks','remark','notes','note','scope','work description','problem description'],
  status: ['status','state','work order status','wo status','stage','progress'],
  priority: ['priority','urgency','severity','criticality','importance'],
  category: ['category','type','work type','request type','discipline','trade','classification'],
  location: ['location','site','area','room','building','branch','facility','place','work location'],
  assignee: ['assigned to','assigned','assignee','technician','technician name','assigned user','responsible','owner','person assigned','staff'],
  requester: ['requester','requested by','requestor','reported by','created by','submitted by','requested user'],
  created: ['created','created date','date created','date opened','opened','open date','request date','submitted date','creation date'],
  dueDate: ['due','due date','target date','deadline','date due','completion date','target completion','required by'],
};

export function headerFieldScore(field, header) {
  const h = normalize(header);
  const aliases = FIELD_DEFS[field] || [];
  let best = 0;
  aliases.forEach((a) => {
    const n = normalize(a);
    if (h === n) best = Math.max(best, 120);
    else if (h.includes(n) || n.includes(h)) best = Math.max(best, 85);
    else {
      const ht = new Set(h.split(' '));
      const nt = n.split(' ');
      const overlap = nt.filter((x) => ht.has(x)).length;
      if (overlap) best = Math.max(best, 45 + overlap * 12);
    }
  });
  return best;
}

export function contentScore(field, header, rows) {
  const vals = rows.slice(0, 80).map((r) => String(r[header] ?? '').trim()).filter(Boolean);
  if (!vals.length) return 0;
  const ratio = (re) => vals.filter((v) => re.test(v)).length / vals.length;
  const avg = vals.reduce((s, v) => s + v.length, 0) / vals.length;
  const numericRatio = vals.filter((v) => /^-?\d+(?:\.\d+)?$/.test(v)).length / vals.length;
  if (field === 'status') {
    const statusWords = [
      /^(open|new|created|submitted|raised)$/i,
      /^(in progress|progress|ongoing|working|started|active)$/i,
      /^(on hold|hold|pending|waiting|paused|suspended)$/i,
      /^(complete|completed|done|finished|closed|resolved|approved)$/i,
      /^(overdue|late|past due|delayed)$/i,
      /^(cancel|cancelled|void|terminated)$/i,
    ];
    let score = 0;
    statusWords.forEach((p) => {
      const matchRatio = ratio(p);
      if (matchRatio > 0.2) score += matchRatio * 50;
    });
    const headerNorm = normalize(header);
    if (/status|state|stage|phase|progress/.test(headerNorm)) score += 30;
    const uniqueVals = new Set(vals);
    if (uniqueVals.size >= 2 && uniqueVals.size <= 8) score += 20;
    return Math.min(score, 100);
  }
  if (field === 'id') return Math.max(ratio(/^(?:WO|W0|JOB|REQ|TKT|SR)[-_# ]?\d+/i) * 90, ratio(/^\d{3,}$/) * 55);
  if (field === 'priority') return ratio(/^(critical|urgent|emergency|high|major|medium|normal|low|minor)$/i) * 95;
  if (field === 'created')
    return Math.max(
      ratio(/created|opened|submitted|request date|creation date|date opened/i) * 70,
      ratio(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/) * 65,
      ratio(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/) * 60,
      ratio(/^[A-Za-z]{3,9}\s+\d{1,2}(?:,|\s)/) * 55
    );
  if (field === 'dueDate')
    return Math.max(
      ratio(/due|deadline|target|completion|required by/i) * 75,
      ratio(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/) * 45,
      ratio(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/) * 40
    );
  if (field === 'location')
    return Math.max(
      ratio(/room|office|branch|site|building|floor|pantry|warehouse|area|facility|store|hallway/i) * 75,
      avg >= 4 && avg <= 45 ? 22 : 0
    );
  if (field === 'assignee') return Math.max(ratio(/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/) * 65, 0);
  if (field === 'requester') return ratio(/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/) * 35;
  if (field === 'description') return (avg >= 25 ? 55 : avg >= 15 ? 40 : 0) + (numericRatio < 0.25 ? 10 : 0);
  if (field === 'title') return (avg >= 8 ? 45 : avg >= 4 ? 30 : 0) + (numericRatio < 0.25 ? 12 : 0);
  if (field === 'category') return ratio(/hvac|plumbing|electrical|civil|carpentry|mechanical|fire|security|it|network|cleaning|facilities|maintenance/i) * 80;
  return 0;
}

export function inferMapping(headers, rows) {
  const mapping = {};
  const used = new Set();
  const candidates = [];
  Object.keys(FIELD_DEFS).forEach((field) =>
    headers.forEach((h, i) => {
      const score = headerFieldScore(field, h);
      if (score >= 82) candidates.push({ field, h, i, score });
    })
  );
  candidates.sort((a, b) => b.score - a.score);
  candidates.forEach((c) => {
    if (!mapping[c.field] && !used.has(c.i)) {
      mapping[c.field] = c.h;
      used.add(c.i);
    }
  });
  Object.keys(FIELD_DEFS).forEach((field) => {
    if (mapping[field]) return;
    const candidates2 = headers.map((h, i) => ({ h, i, score: contentScore(field, h, rows) })).sort((a, b) => b.score - a.score);
    const pick = candidates2.find((c) => c.score >= (field === 'title' ? 38 : 45) && !used.has(c.i));
    if (pick) {
      mapping[field] = pick.h;
      used.add(pick.i);
    }
  });
  if (!mapping.title) {
    const candidates3 = headers.map((h, i) => {
      const vals = rows.slice(0, 80).map((r) => String(r[h] ?? '').trim()).filter(Boolean);
      const avg = vals.length ? vals.reduce((s, v) => s + v.length, 0) / vals.length : 0;
      const textRatio = vals.length ? vals.filter((v) => /[A-Za-z]/.test(v)).length / vals.length : 0;
      const uniqueRatio = vals.length ? new Set(vals).size / vals.length : 0;
      return { h, i, score: Math.min(avg, 60) * 0.7 + textRatio * 25 + uniqueRatio * 10 };
    }).sort((a, b) => b.score - a.score);
    const pick = candidates3.find((c) => !used.has(c.i));
    if (pick) {
      mapping.title = pick.h;
      used.add(pick.i);
    }
  }
  if (!mapping.status) {
    const statusCandidates = headers.map((h, i) => {
      const vals = rows.slice(0, 80).map((r) => String(r[h] ?? '').trim()).filter(Boolean);
      if (!vals.length) return { h, i, score: 0 };
      let score = 0;
      const statusKeywords = [
        /completed|approved|accepted|finished|done|closed|resolved/,
        /cancelled|canceled|void|terminated|disapproved|rejected/,
        /overdue|late|past due/,
        /in progress|progress|ongoing|working|started|active/,
        /on hold|hold|pending|waiting|paused|suspended/,
        /open|new|created|submitted|raised/,
      ];
      vals.forEach(v => {
        const lower = v.toLowerCase();
        statusKeywords.forEach(pattern => { if (pattern.test(lower)) score += 15; });
      });
      const hLower = h.toLowerCase();
      if (/status|state|stage|phase|progress/.test(hLower)) score += 30;
      const uniqueVals = new Set(vals);
      if (uniqueVals.size >= 2 && uniqueVals.size <= 10) score += 20;
      return { h, i, score };
    }).sort((a, b) => b.score - a.score);
    const pick = statusCandidates.find((c) => c.score >= 40 && !used.has(c.i));
    if (pick) {
      mapping.status = pick.h;
      used.add(pick.i);
    }
  }
  return mapping;
}

// ---------- Row / value resolvers ----------
export function resolveRowValueByHeader(row, source) {
  if (!row || !source) return '';
  const sourceKey = String(source).trim();
  if (!sourceKey) return '';
  if (row[sourceKey] !== undefined) return row[sourceKey];
  const direct = Object.keys(row).find((key) => String(key).trim() === sourceKey);
  if (direct !== undefined) return row[direct];
  const normalizedSource = normalize(sourceKey);
  const normalizedMatch = Object.keys(row).find((key) => normalize(String(key)) === normalizedSource);
  if (normalizedMatch !== undefined) return row[normalizedMatch];
  const partialMatch = Object.keys(row).find(
    (key) => normalize(String(key)).includes(normalizedSource) || normalizedSource.includes(normalize(String(key)))
  );
  return partialMatch !== undefined ? row[partialMatch] : '';
}

export function findMatchingHeaderValue(o, source) {
  const sourceValue = String(source || '').trim();
  if (!sourceValue) return '';
  const raw = o && o._rawData ? o._rawData : {};
  const keys = Object.keys(raw);
  const directMatch = keys.find((k) => String(k).trim() === sourceValue);
  if (directMatch !== undefined) return raw[directMatch];
  const normalizedSource = normalize(sourceValue);
  const normalizedMatch = keys.find((k) => normalize(String(k)) === normalizedSource);
  if (normalizedMatch !== undefined) return raw[normalizedMatch];
  return '';
}

export function customFieldValue(o, label) {
  const target = String(label || '').trim();
  const targetNorm = normalize(target);
  const candidates = (o.customFields || []).filter(
    (x) =>
      String(x.label || '').trim() === target || normalize(String(x.label || '')) === targetNorm
  );
  if (!candidates.length) return '';
  for (const f of candidates) {
    if (String(f.value ?? '').trim()) return String(f.value);
    if (f._sourceHeader) {
      const rawData = o._rawData || {};
      if (rawData[f._sourceHeader] !== undefined && String(rawData[f._sourceHeader]).trim() !== '') {
        return String(rawData[f._sourceHeader]);
      }
      const normalizedSource = normalize(f._sourceHeader);
      const keys = Object.keys(rawData);
      const normalizedMatch = keys.find((k) => normalize(String(k)) === normalizedSource);
      if (normalizedMatch !== undefined && String(rawData[normalizedMatch]).trim() !== '') {
        return String(rawData[normalizedMatch]);
      }
    }
  }
  return '';
}

export function displayValue(o, source) {
  if (!source) return '';
  if (source.startsWith('custom:')) {
    const customLabel = source.replace('custom:', '');
    return customFieldValue(o, customLabel);
  }
  if (source === 'id') return o.id;
  if (source === 'title') return o.title;
  if (source === 'status') return o.status;
  if (source === 'priority') return o.priority;
  if (source === 'category') return o.category;
  if (source === 'location') return o.location;
  if (source === 'assignee') return o.assignee;
  if (source === 'requester') return o.requester;
  if (source === 'created') return o.created;
  if (source === 'dueDate') return o.dueDate;
  const rawValue = findMatchingHeaderValue(o, source);
  if (rawValue !== undefined && rawValue !== '') return rawValue;
  if (o._rawData && o._rawData[source] !== undefined) return o._rawData[source];
  return '';
}

// ---------- Merge custom fields ----------
export function mergeCustomFields(existing = [], incoming = []) {
  const map = new Map();
  [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])].forEach((field) => {
    if (!field || !field.label) return;
    const key = `${String(field.label || '').trim()}::${String(field._sourceHeader || '').trim()}`;
    map.set(key, {
      label: String(field.label || '').trim(),
      value: String(field.value ?? '').trim(),
      _sourceHeader: String(field._sourceHeader || '').trim(),
    });
  });
  return [...map.values()].filter((f) => f.label && (f.value || f._sourceHeader));
}

export function buildImportCustomFieldsForRow(row, customMappings) {
  const fields = customMappings
    .map((f) => {
      if (!f) return null;
      const source = String(f.source || '').trim();
      const label = String(f.label || source || '').trim();
      if (!label) return null;
      const sourceValue = resolveRowValueByHeader(row, source);
      const rawValue = String(f.value ?? '').trim();
      const resolvedValue = rawValue ? rawValue : String(sourceValue ?? '').trim();
      return { label, value: resolvedValue, _sourceHeader: source };
    })
    .filter((f) => f && f.label && (f.value || f._sourceHeader));
  return fields;
}

export function generateStableId(row) {
  const fields = ['title', 'location', 'assignee', 'requester', 'category', 'created', 'description'];
  const combined = fields.map((f) => String(row[f] || '').trim()).join('|');
  if (!combined) return `EMPTY-${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash = hash & hash;
  }
  const stableId = Math.abs(hash).toString(36);
  return `STABLE-${stableId}`;
}

export function normalizeApiRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const candidates = [payload.data, payload.rows, payload.items, payload.result];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export function parseCSVLine(line, delimiter) {
  const out = [];
  let cur = '', quote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quote = !quote;
    } else if (c === delimiter && !quote) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function parseDelimited(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((x) => x.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const first = lines[0];
  let delimiter = '\t';
  if (first.includes('\t')) delimiter = '\t';
  else if (first.includes('|')) delimiter = '|';
  else if (first.includes(',')) delimiter = ',';
  else delimiter = /\s{2,}/;
  const splitLine = (line) => {
    if (delimiter instanceof RegExp) return line.split(delimiter).map((x) => x.trim());
    return parseCSVLine(line, delimiter);
  };
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = vals[i] ?? ''));
    return obj;
  });
  return { headers, rows };
}

// ---------- Drive / media helpers ----------
export function extractDriveFileId(url) {
  if (!url) return null;
  const text = String(url).trim();
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{10,})/i,
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/i,
    /[?&]id=([a-zA-Z0-9_-]{10,})/i,
    /[?&]export=view&id=([a-zA-Z0-9_-]{10,})/i,
    /thumbnail\?id=([a-zA-Z0-9_-]{10,})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  if (/^[a-zA-Z0-9_-]{10,}$/.test(text)) return text;
  return null;
}

export function driveThumbUrl(fileId, size = 400) {
  return `https://drive.google.com/thumbnail?sz=w${size}&id=${fileId}`;
}

export function driveViewUrl(fileId) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export function driveFallbackUrl(fileId, size = 1600) {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${size}`;
}

export function getPdfViewerUrl(url) {
  const fileId = extractDriveFileId(url);
  if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
  if (url.includes('/preview') || url.includes('/embed')) return url;
  if (url.includes('/view') && url.includes('drive.google.com')) return url.replace('/view', '/preview');
  return url;
}

export function isPdfUrl(value) {
  const text = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(text)) return false;
  if (/\.pdf(\?.*)?$/i.test(text)) return true;
  if (/\.pdf/i.test(text)) return true;
  if (/dropbox\.com\/s\/[^\/]+\/[^\/]+\.pdf/i.test(text)) return true;
  return false;
}

export function isImageUrl(value) {
  const text = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(text)) return false;
  return (
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(text) ||
    /drive\.google\.com\/thumbnail\?sz=w\d+&id=/i.test(text) ||
    /drive\.google\.com\/uc\?export=view&id=/i.test(text) ||
    /lh3\.googleusercontent\.com\/d\//i.test(text)
  );
}

export function parseMultipleUrls(text) {
  if (!text) return [];
  const raw = String(text).trim();
  return raw.split(/[,;\n\r]+|(?:\s{2,})/).map(s => s.trim()).filter(Boolean).filter(url => /^https?:\/\//i.test(url));
}

export function normalizeThumbnailMediaUrl(value) {
  const text = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(text)) return text;
  const id = extractDriveFileId(text);
  if (id) return driveThumbUrl(id, 400);
  return text;
}

export function normalizeFullMediaUrl(value) {
  const text = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(text)) return text;
  const id = extractDriveFileId(text);
  if (id) {
    // Use 4096px for high resolution – change to 2048 if needed
    return driveFallbackUrl(id, 2048);
  }
  return text;
}

// =========================================================
// FORMAT FIELD VALUE (with detection caches)
// =========================================================

export const detectionCache = new Map();
export const pdfToastShown = new Set();
export const detectionPromises = new Map();

export function detectFileTypeFromDrive(url, callback) {
  const fileId = extractDriveFileId(url);
  if (!fileId) {
    callback(isPdfUrl(url) ? 'pdf' : 'image');
    return;
  }
  const thumbUrl = driveThumbUrl(fileId, 200);
  const img = new Image();
  let timeoutId = setTimeout(() => {
    img.src = '';
    callback('pdf');
  }, 3000);
  img.onload = function() {
    clearTimeout(timeoutId);
    if (img.width <= 64 && img.height <= 64) {
      callback('pdf');
    } else {
      callback('image');
    }
  };
  img.onerror = function() {
    clearTimeout(timeoutId);
    callback('pdf');
  };
  img.src = thumbUrl;
}

export function getDriveFileTypeAsync(fileId, url, orderId) {
  if (detectionCache.has(fileId) && detectionCache.get(fileId) !== 'pending') {
    return Promise.resolve(detectionCache.get(fileId));
  }
  if (detectionPromises.has(fileId)) {
    return detectionPromises.get(fileId);
  }
  const promise = new Promise((resolve) => {
    detectFileTypeFromDrive(url, (type) => {
      detectionCache.set(fileId, type);
      detectionPromises.delete(fileId);
      if (orderId) {
        document.dispatchEvent(new CustomEvent('drive-detection-complete', { detail: { orderId } }));
      }
      resolve(type);
    });
  });
  detectionPromises.set(fileId, promise);
  detectionCache.set(fileId, 'pending');
  return promise;
}

export function formatFieldValue(value, orderId) {
  const text = String(value ?? '').trim();
  if (!text) return '—';

  // Date detection
  const dateObj = new Date(text);
  if (!isNaN(dateObj) && 
      (/^\d{4}-\d{2}-\d{2}/.test(text) || text.includes('T') || /^\d{4}\/\d{2}\/\d{2}/.test(text))) {
    return formatDate(text);
  }

  // URL detection
  if (/^https?:\/\//i.test(text)) {
    const urls = parseMultipleUrls(text);
    if (urls.length === 0) return esc(text);

    // SINGLE URL
    if (urls.length === 1) {
      const fileId = extractDriveFileId(urls[0]);
      if (fileId) {
        const cached = detectionCache.get(fileId);
        if (cached === 'pdf') {
          return `<button type="button" data-pdf-preview="${esc(getPdfViewerUrl(urls[0]))}" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 font-bold hover:bg-red-100 transition shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" stroke-linecap="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path stroke-width="2" stroke-linecap="round" d="M15 3v5a1 1 0 001 1h5" /></svg>
            View PDF
          </button>`;
        } else if (cached === 'image') {
          const thumbUrl = normalizeThumbnailMediaUrl(urls[0]);
          return `<button type="button" data-image-preview="${esc(normalizeFullMediaUrl(urls[0]))}" class="inline-flex rounded-lg border border-black/10 bg-white p-1 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-teal/30">
            <img src="${esc(thumbUrl)}" alt="Attachment preview" class="h-24 w-auto max-w-full rounded-md object-cover" />
          </button>`;
        } else if (cached === 'pending') {
          return `<div class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-500">
            <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
            Detecting file type…
          </div>`;
        } else {
          getDriveFileTypeAsync(fileId, urls[0], orderId);
          return `<div class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-500">
            <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
            Detecting file type…
          </div>`;
        }
      }
      return `<a href="${esc(text)}" target="_blank" rel="noopener noreferrer" class="text-brand-teal font-bold underline underline-offset-2 break-all hover:text-brand-teal/80">${esc(text)}</a>`;
    }

    // MULTIPLE URLS
    let allKnown = true;
    const types = urls.map((u) => {
      const fid = extractDriveFileId(u);
      if (fid) {
        const cached = detectionCache.get(fid);
        if (!cached || cached === 'pending') {
          allKnown = false;
          return 'pending';
        }
        return cached;
      }
      return isPdfUrl(u) ? 'pdf' : 'image';
    });

    if (!allKnown) {
      urls.forEach((u) => {
        const fid = extractDriveFileId(u);
        if (fid && !detectionCache.has(fid)) {
          getDriveFileTypeAsync(fid, u, orderId);
        }
      });
      return `<div class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 text-sm">
        <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        Detecting ${urls.length} files...
      </div>`;
    }

    const hasImage = types.some((t) => t === 'image');
    if (hasImage) {
      const firstImageUrl = urls.find((u, idx) => types[idx] === 'image') || urls[0];
      const thumbUrl = normalizeThumbnailMediaUrl(firstImageUrl);
      const fullPreviews = urls.map((u) => normalizeFullMediaUrl(u) || u);
      return `<button type="button" data-image-gallery="${esc(JSON.stringify(fullPreviews))}" data-image-alt="Attachments" class="inline-flex rounded-lg border border-black/10 bg-white p-1 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-teal/30">
        <div class="relative">
          <img src="${esc(thumbUrl)}" alt="Attachment preview" class="h-24 w-auto max-w-full rounded-md object-cover" />
          <span class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">+${urls.length - 1}</span>
        </div>
      </button>`;
    } else {
      const viewerUrls = urls.map((u) => getPdfViewerUrl(u));
      return `<button type="button" data-pdf-gallery="${esc(JSON.stringify(viewerUrls))}" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 font-bold hover:bg-red-100 transition shadow-sm text-sm">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-width="2" stroke-linecap="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <path stroke-width="2" stroke-linecap="round" d="M15 3v5a1 1 0 001 1h5" />
        </svg>
        View Documents
        <span class="bg-red-200 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-black">${urls.length}</span>
      </button>`;
    }
  }

  return esc(text);
}

// =========================================================
// UI HELPERS (toast, image preview)
// =========================================================

export let imagePreviewZoom = 1;
export let imagePreviewTranslate = { x: 0, y: 0 };

export function toast(message, type = 'info') {
  const colors = {
    success: 'border-emerald-500 bg-emerald-500 text-black',
    error: 'border-red-500 bg-red-500 text-black',
    info: 'border-slate-300 bg-slate-300 text-black',
  };
  const el = document.createElement('div');
  el.className = `toast border rounded-xl shadow-soft px-4 py-3 text-sm font-semibold flex items-center justify-between ${colors[type] || colors.info}`;
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  el.appendChild(textSpan);
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.className = 'ml-3 text-black/50 hover:text-black/80 transition text-base leading-none';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  el.appendChild(closeBtn);
  const stack = document.getElementById('toastStack');
  stack.appendChild(el);
  let timer = setTimeout(() => { dismissToast(el); }, 3500);
  function dismissToast(element) {
    clearTimeout(timer);
    if (element.classList.contains('toast-out')) return;
    element.classList.add('toast-out');
    element.addEventListener('animationend', function onEnd() {
      element.removeEventListener('animationend', onEnd);
      if (element.parentNode) element.remove();
    });
  }
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissToast(el);
  });
  el.addEventListener('click', (e) => {
    if (e.target === closeBtn) return;
    dismissToast(el);
  });
  return el;
}

let loadingToastElement = null;

export function showLoadingToast(message) {
  hideLoadingToast();
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast border rounded-xl shadow-soft px-4 py-3 text-sm font-semibold flex items-center justify-between bg-slate-300 text-black';
  const spinner = document.createElement('span');
  spinner.className = 'inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2';
  spinner.style.animation = 'spin 0.8s linear infinite';
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  textSpan.className = 'flex-1';
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.className = 'ml-3 text-black/50 hover:text-black/80 transition text-base leading-none';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); hideLoadingToast(); });
  el.appendChild(spinner);
  el.appendChild(textSpan);
  el.appendChild(closeBtn);
  stack.appendChild(el);
  loadingToastElement = el;
}

export function hideLoadingToast() {
  if (loadingToastElement) {
    loadingToastElement.classList.add('toast-out');
    loadingToastElement.addEventListener('animationend', function onEnd() {
      this.removeEventListener('animationend', onEnd);
      if (this.parentNode) this.remove();
    });
    loadingToastElement = null;
  }
}

// ---- Image preview state ----
let imagePreviewDrag = null;
let imageLoadingCount = 0;

function applyImagePreviewTransform() {
  const image = document.getElementById('imagePreviewModalImg');
  if (!image) return;
  imagePreviewZoom = Math.min(Math.max(imagePreviewZoom, 1), 4);
  const viewport = document.getElementById('imagePreviewModalViewport');
  if (image.complete && image.naturalWidth > 0 && viewport) {
    const viewRect = viewport.getBoundingClientRect();
    const displayWidth = image.offsetWidth * imagePreviewZoom;
    const displayHeight = image.offsetHeight * imagePreviewZoom;
    const maxX = Math.max(0, (displayWidth - viewRect.width) / 2);
    const maxY = Math.max(0, (displayHeight - viewRect.height) / 2);
    imagePreviewTranslate.x = Math.min(Math.max(imagePreviewTranslate.x, -maxX), maxX);
    imagePreviewTranslate.y = Math.min(Math.max(imagePreviewTranslate.y, -maxY), maxY);
  }
  image.style.transform = `translate(${imagePreviewTranslate.x}px, ${imagePreviewTranslate.y}px) scale(${imagePreviewZoom})`;
  image.style.transformOrigin = 'center center';
}
export { applyImagePreviewTransform };

export function setImagePreviewZoom(level) {
  const image = document.getElementById('imagePreviewModalImg');
  if (!image) return;
  imagePreviewZoom = Math.min(Math.max(level, 1), 4);
  applyImagePreviewTransform();
  const zoomValue = document.getElementById('imagePreviewZoomValue');
  if (zoomValue) zoomValue.textContent = `${Math.round(imagePreviewZoom * 100)}%`;
}

export function resetImagePreviewZoom() {
  imagePreviewTranslate.x = 0;
  imagePreviewTranslate.y = 0;
  imagePreviewZoom = 1;
  applyImagePreviewTransform();
  const zoomValue = document.getElementById('imagePreviewZoomValue');
  if (zoomValue) zoomValue.textContent = '100%';
}

export function closeImagePreviewModal() {
  const modal = document.getElementById('imagePreviewModal');
  if (!modal) return;
  modal.classList.add('hidden');

  const iframe = document.getElementById('pdfPreviewIframe');
  if (iframe) {
    if (iframe._spinnerTimeout) {
      clearTimeout(iframe._spinnerTimeout);
      delete iframe._spinnerTimeout;
    }
    iframe.src = '';
    iframe.style.display = 'none';
  }

  const image = document.getElementById('imagePreviewModalImg');
  if (image) {
    image.onerror = null;
    image.src = '';
  }

  // Reset counter and hide spinner
  imageLoadingCount = 0;
  const spinner = document.getElementById('imagePreviewSpinner');
  if (spinner) spinner.classList.add('hidden');

  window._previewItems = [];
  window._previewCurrentIndex = 0;
  window._previewAlt = '';
  imagePreviewTranslate.x = 0;
  imagePreviewTranslate.y = 0;
  imagePreviewZoom = 1;
  document.body.classList.remove('overflow-hidden');
}

// ---- Spinner management ----
function getSpinnerElement() {
  let spinner = document.getElementById('imagePreviewSpinner');
  if (!spinner) {
    const viewport = document.getElementById('imagePreviewModalViewport');
    if (!viewport) return null;
    spinner = document.createElement('div');
    spinner.id = 'imagePreviewSpinner';
    spinner.className = 'absolute inset-0 flex items-center justify-center bg-black/30 z-10 hidden';
    spinner.innerHTML = `
      <div class="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl flex items-center gap-4">
        <svg class="animate-spin h-8 w-8 text-brand-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <span class="text-sm font-bold text-black">Loading…</span>
      </div>
    `;
    viewport.appendChild(spinner);
  }
  return spinner;
}

function showImageSpinner() {
  imageLoadingCount++;
  const spinner = getSpinnerElement();
  if (spinner) spinner.classList.remove('hidden');
}

function hideImageSpinner() {
  imageLoadingCount--;
  if (imageLoadingCount <= 0) {
    imageLoadingCount = 0;
    const spinner = document.getElementById('imagePreviewSpinner');
    if (spinner) spinner.classList.add('hidden');
  }
}

// ---- Open image preview modal ----
export function openImagePreviewModal(srcOrGallery, alt = 'Attachment preview', isPdf = false) {
  const modal = document.getElementById('imagePreviewModal');
  const image = document.getElementById('imagePreviewModalImg');
  const iframe = document.getElementById('pdfPreviewIframe');
  const viewport = document.getElementById('imagePreviewModalViewport');
  const counter = document.getElementById('imagePreviewCounter');
  const prevBtn = document.getElementById('imagePreviewPrevBtn');
  const nextBtn = document.getElementById('imagePreviewNextBtn');
  const thumbnails = document.getElementById('imagePreviewThumbnails');
  const zoomControls = document.getElementById('imagePreviewZoomControls');

  if (!modal || !viewport) return;

  let items = [];
  if (typeof srcOrGallery === 'string' && srcOrGallery.startsWith('[')) {
    try {
      const parsed = JSON.parse(srcOrGallery);
      items = parsed.map(url => ({ url, type: isPdfUrl(url) ? 'pdf' : 'image' }));
    } catch {
      items = [{ url: srcOrGallery, type: isPdf ? 'pdf' : 'image' }];
    }
  } else if (Array.isArray(srcOrGallery)) {
    items = srcOrGallery.map(url => ({ url, type: isPdfUrl(url) ? 'pdf' : 'image' }));
  } else {
    items = [{ url: String(srcOrGallery), type: isPdf ? 'pdf' : 'image' }];
  }
  items = items.filter(item => item.url && item.url.trim());

  if (!items.length) {
    toast('No items to preview.', 'error');
    return;
  }

  window._previewItems = items;
  window._previewCurrentIndex = 0;
  window._previewAlt = alt || 'Attachment preview';

  // Show first item
  showPreviewItem(0);

  if (counter) {
    counter.textContent = items.length > 1 ? `1 / ${items.length}` : '';
  }
  if (prevBtn) prevBtn.style.display = items.length > 1 ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = items.length > 1 ? 'flex' : 'none';

  renderThumbnails(items);
  updateZoomControlsVisibility(items[0].type === 'image');

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

export function showPreviewItem(index) {
  const items = window._previewItems || [];
  if (!items.length) return;
  if (index < 0) index = 0;
  if (index >= items.length) index = items.length - 1;
  window._previewCurrentIndex = index;

  const item = items[index];
  const image = document.getElementById('imagePreviewModalImg');
  const iframe = document.getElementById('pdfPreviewIframe');
  const counter = document.getElementById('imagePreviewCounter');
  const prevBtn = document.getElementById('imagePreviewPrevBtn');
  const nextBtn = document.getElementById('imagePreviewNextBtn');
  const zoomControls = document.getElementById('imagePreviewZoomControls');
  const thumbnails = document.getElementById('imagePreviewThumbnails');

  if (counter) counter.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
  if (prevBtn) prevBtn.style.display = items.length > 1 && index > 0 ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = items.length > 1 && index < items.length - 1 ? 'flex' : 'none';

  // Reset zoom/pan
  imagePreviewTranslate.x = 0;
  imagePreviewTranslate.y = 0;
  imagePreviewZoom = 1;
  image.style.transform = 'translate(0px, 0px) scale(1)';
  const zoomValue = document.getElementById('imagePreviewZoomValue');
  if (zoomValue) zoomValue.textContent = '100%';

  // Hide both, but do NOT clear image.src
  image.style.display = 'none';
  iframe.style.display = 'none';
  iframe.src = '';

  const isImage = item.type === 'image';
  updateZoomControlsVisibility(isImage);

  // Set spinner text
  const spinner = document.getElementById('imagePreviewSpinner');
  if (spinner) {
    const textSpan = spinner.querySelector('span');
    if (textSpan) textSpan.textContent = isImage ? 'Loading image…' : 'Loading PDF…';
  }

  // Clear any pending PDF timeout
  if (iframe._spinnerTimeout) {
    clearTimeout(iframe._spinnerTimeout);
    delete iframe._spinnerTimeout;
  }

  // Show spinner (increments counter)
  showImageSpinner();

  if (isImage) {
    image.style.display = 'block';
    image.alt = window._previewAlt || `Attachment ${index + 1}`;

    // Remove old handlers to avoid race conditions
    image.onload = null;
    image.onerror = null;

    // High-res URL
    const fullUrl = normalizeFullMediaUrl(item.url);
    image.src = fullUrl;

    image.onload = function() {
      hideImageSpinner();
      applyImagePreviewTransform();
    };

    image.onerror = function() {
      // Fallback to direct Google Drive view
      const fileId = extractDriveFileId(item.url);
      if (fileId) {
        const altUrl = driveViewUrl(fileId);
        if (altUrl !== fullUrl) {
          image.src = altUrl;
          image.onerror = function() {
            hideImageSpinner();
            image.style.display = 'none';
            image.alt = 'Image could not be loaded';
            toast('Failed to load image.', 'error');
          };
          image.onload = function() {
            hideImageSpinner();
            applyImagePreviewTransform();
          };
          return;
        }
      }
      hideImageSpinner();
      image.style.display = 'none';
      image.alt = 'Image could not be loaded';
      toast('Failed to load image.', 'error');
    };

    // If already loaded (cached), hide spinner after a microtask
    if (image.complete && image.naturalWidth > 0) {
      // The onload might not fire, so we need to hide manually,
      // but we also need to ensure the spinner counter is decremented.
      // The showImageSpinner incremented it, so we call hideImageSpinner.
      // We also want to apply transform.
      hideImageSpinner();
      setTimeout(applyImagePreviewTransform, 50);
    }
  } else {
    // PDF
    iframe.style.display = 'block';
    iframe.src = getPdfViewerUrl(item.url);

    iframe.onload = function() {
      hideImageSpinner();
    };

    // Fallback timeout (5 seconds)
    iframe._spinnerTimeout = setTimeout(() => {
      hideImageSpinner();
    }, 5000);
  }

  // Update thumbnails highlight
  if (thumbnails) {
    const thumbs = thumbnails.querySelectorAll('.thumbnail-item');
    thumbs.forEach((el, i) => {
      el.classList.toggle('ring-2', i === index);
      el.classList.toggle('ring-brand-teal', i === index);
    });
    const activeThumb = thumbs[index];
    if (activeThumb) {
      activeThumb.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }
}

function renderThumbnails(items) {
  const container = document.getElementById('imagePreviewThumbnails');
  if (!container) return;
  if (items.length <= 1) {
    container.innerHTML = '';
    return;
  }
  let html = '';
  items.forEach((item, index) => {
    const isImage = item.type === 'image';
    const thumbUrl = isImage ? normalizeThumbnailMediaUrl(item.url) : '';
    const icon = isImage ? '' : `<svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="1.5" stroke-linecap="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path stroke-width="1.5" stroke-linecap="round" d="M15 3v5a1 1 0 001 1h5" /></svg>`;
    html += `
      <button type="button" data-thumb-index="${index}" class="thumbnail-item flex-shrink-0 w-16 h-16 rounded-lg border-2 border-transparent hover:border-brand-teal/50 overflow-hidden bg-white/80 flex items-center justify-center transition-all duration-150 ${index === 0 ? 'ring-2 ring-brand-teal' : ''}">
        ${isImage ? `<img src="${esc(thumbUrl)}" alt="Thumbnail" class="w-full h-full object-cover" />` : icon}
      </button>
    `;
  });
  container.innerHTML = html;
  container.querySelectorAll('.thumbnail-item').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.thumbIndex);
      if (!isNaN(idx) && idx >= 0 && idx < items.length) {
        showPreviewItem(idx);
      }
    });
  });
}

function updateZoomControlsVisibility(show) {
  const controls = document.getElementById('imagePreviewZoomControls');
  if (controls) {
    controls.style.display = show ? 'flex' : 'none';
  }
}

// ---- Helper: loadDriveImage (used by formatFieldValue) ----
export function loadDriveImage(imgEl, sourceUrl, { size = 2048, onFail } = {}) {
  const fileId = extractDriveFileId(sourceUrl);
  if (!fileId) {
    imgEl.src = sourceUrl || '';
    imgEl.onerror = () => onFail?.(imgEl);
    return;
  }
  const candidates = [
    driveFallbackUrl(fileId, size),
    driveViewUrl(fileId),
    driveThumbUrl(fileId, Math.min(size, 400)),
  ];
  let idx = 0;
  const tryNext = () => {
    if (idx >= candidates.length) {
      imgEl.onerror = null;
      onFail?.(imgEl);
      return;
    }
    imgEl.src = candidates[idx];
    idx += 1;
  };
  imgEl.onerror = () => { tryNext(); };
  imgEl.onload = () => { imgEl.style.display = 'block'; };
  tryNext();
}