const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../src/app.js');
const { connectDatabase } = require('../src/config/database.js');

describe('CampusStay API', () => {
  let server, base;
  const origin = 'https://campusstay.example.test';
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CLIENT_URL = origin;
    server = createApp().listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  });
  after(() => new Promise(resolve => server.close(resolve)));

  it('reports healthy with a disconnected database', async () => {
    const res = await fetch(base + '/health');
    assert.equal(res.status, 200);
    const result = await res.json();
    assert.equal(result.success, true);
    assert.equal(result.data.database, false);
    assert.ok(result.data.timestamp);
    assert.deepEqual(await connectDatabase({}), {connected:false, status:'disconnected'});
  });

  it('returns 404 for an unknown API route', async () => {
    const res = await fetch(base + '/nonexistent');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).success, false);
  });

  it('allows credentialed CORS only for the configured frontend', async () => {
    const allowed = await fetch(base + '/health', {headers:{Origin:origin}});
    assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
    assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
    const other = await fetch(base + '/health', {headers:{Origin:'https://other.example.test'}});
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  });
});
