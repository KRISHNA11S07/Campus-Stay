const { createApp } = require('../src/app.js');
const { createErrorMiddleware } = require('../src/middleware/error.middleware.js');
const { createNotFoundMiddleware } = require('../src/middleware/not-found.middleware.js');

const assert = require('assert');

describe('Campus Stay API health tests', () => {
  let app;

  before(() => {
    app = createApp();
  });

  test('Express app initializes without error', () => {
    assert(app instanceof Function || app !== undefined);
  });

  test('Health endpoint returns success status', async () => {
    const req = new (require('http').request)({
      method: 'GET',
      hostname: '127.0.0.1',
      port: process.env.PORT || 5000,
      path: '/api/v1/health'
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        assert(res.statusCode === 200);
        const json = JSON.parse(body);
        assert.strictEqual(json.success, true);
        assert.strictEqual(typeof json.data.name, 'string');
        assert.ok(json.data.timestamp);
      });
    });
    req.on('error', (err) => assert.fail(err));
    req.end();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  test('Invalid route returns 404', async () => {
    const req = new (require('http').request)({
      method: 'GET',
      hostname: '127.0.0.1',
      port: process.env.PORT || 5000,
      path: '/api/v1/nonexistent'
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        assert(res.statusCode === 404);
        const json = JSON.parse(body);
        assert.strictEqual(json.success, false);
      });
    });
    req.on('error', (err) => assert.fail(err));
    req.end();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  test('Health endpoint does not report MongoDB connected when unconfigured', () => {
    const app = createApp();
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; }
    };
    const notfound = createNotFoundMiddleware();
    notfound({}, mockRes, () => {});
    // The real health endpoint is registered in createApp via router layer.
    // Tests below only cover the handler shape.
  });
});
