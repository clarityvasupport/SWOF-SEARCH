const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: raw,
          });
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

test('shared data API persists state across requests', async (t) => {
  const write = JSON.stringify({
    orders: [{ id: 'WO-TEST-1', title: 'Shared import test' }],
    users: [{ id: 'U-1', name: 'Shared User', active: true }],
    displayConfig: { cardDateSource: 'dueDate' },
    importedHeaders: ['Test Header'],
    history: [],
  });

  const first = await request('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: write,
  });

  assert.equal(first.statusCode, 200, 'write should succeed');

  const second = await request('/api/data');
  assert.equal(second.statusCode, 200, 'read should succeed');

  const data = JSON.parse(second.body);
  assert.equal(data.orders[0].id, 'WO-TEST-1');
  assert.equal(data.users[0].name, 'Shared User');
  assert.deepEqual(data.importedHeaders, ['Test Header']);
});
