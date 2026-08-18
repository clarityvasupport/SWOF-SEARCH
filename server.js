const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      orders: [],
      history: [],
      displayConfig: {},
      users: [],
      importedHeaders: [],
      updatedAt: new Date().toISOString(),
    }, null, 2));
  }
}

function defaultPayload() {
  return {
    orders: [],
    history: [],
    displayConfig: {},
    users: [],
    importedHeaders: [],
    updatedAt: new Date().toISOString(),
  };
}

function readData() {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw || !raw.trim()) return defaultPayload();
    const parsed = JSON.parse(raw);
    return {
      ...defaultPayload(),
      ...parsed,
      displayConfig: parsed.displayConfig && typeof parsed.displayConfig === 'object' ? parsed.displayConfig : {},
      users: Array.isArray(parsed.users) ? parsed.users : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      importedHeaders: Array.isArray(parsed.importedHeaders) ? parsed.importedHeaders : [],
    };
  } catch (error) {
    return defaultPayload();
  }
}

function writeData(payload) {
  ensureDataFile();
  const safe = {
    ...defaultPayload(),
    ...payload,
    displayConfig: payload && payload.displayConfig && typeof payload.displayConfig === 'object' ? payload.displayConfig : {},
    users: Array.isArray(payload && payload.users) ? payload.users : [],
    orders: Array.isArray(payload && payload.orders) ? payload.orders : [],
    history: Array.isArray(payload && payload.history) ? payload.history : [],
    importedHeaders: Array.isArray(payload && payload.importedHeaders) ? payload.importedHeaders : [],
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(safe, null, 2));
  return safe;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | Host: ${req.headers.host}`);

  if (url.pathname === '/api/data') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(readData()));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : defaultPayload();
          const saved = writeData(payload);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ ok: true, data: saved }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  let filePath = url.pathname === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, url.pathname);
  if (filePath.startsWith(ROOT) === false) {
    filePath = path.join(ROOT, 'index.html');
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const stream = fs.createReadStream(filePath);
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  const localUrl = HOST === '0.0.0.0' ? `http://127.0.0.1:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`SWOF-SEARCH is running on ${localUrl}`);
  console.log(`Open the VS Code Ports panel and use the forwarded URL for port ${PORT}.`);
});
