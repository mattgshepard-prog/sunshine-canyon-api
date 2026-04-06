// tests/upsells.test.js
// Requirements: UPSELL-01, UPSELL-02
// Run: node --test tests/upsells.test.js
// Expected state: RED until api/upsells.js and lib/upsells-config.js are implemented

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/upsells.js';

function mockReqRes() {
  const headers = {};
  const res = {
    _status: 200, _body: null,
    status(code) { this._status = code; return this; },
    json(b)      { this._body = b; return this; },
    setHeader(k, v) { headers[k] = v; },
    end() {},
  };
  return { req: { method: 'GET', headers: {}, query: {} }, res };
}

describe('Upsell Catalog Shape (api/upsells.js)', () => {
  it('UPSELL-01: GET /api/upsells returns 200 with an items array', async () => {
    const { req, res } = mockReqRes();
    await handler(req, res);
    assert.equal(res._status, 200);
    assert.ok(Array.isArray(res._body.items));
  });

  it('UPSELL-01: every item has id, name, price, and description fields', async () => {
    const { req, res } = mockReqRes();
    await handler(req, res);
    assert.ok(res._body.items.length > 0);
    for (const item of res._body.items) {
      assert.ok(item.id, 'item.id missing');
      assert.ok(item.name, 'item.name missing');
      assert.equal(typeof item.price, 'number', 'item.price must be a number');
      assert.ok(item.description, 'item.description missing');
    }
  });

  it('UPSELL-02: catalog contains all five expected IDs', async () => {
    const { req, res } = mockReqRes();
    await handler(req, res);
    const ids = res._body.items.map(i => i.id);
    assert.ok(ids.includes('early_checkin'),        'missing early_checkin');
    assert.ok(ids.includes('late_checkout'),         'missing late_checkout');
    assert.ok(ids.includes('airport_shuttle_to'),    'missing airport_shuttle_to');
    assert.ok(ids.includes('airport_shuttle_from'),  'missing airport_shuttle_from');
    assert.ok(ids.includes('stocked_fridge'),        'missing stocked_fridge');
  });
});

describe('CORS and Method Handling (api/upsells.js)', () => {
  it('OPTIONS preflight returns 200', async () => {
    const { req, res } = mockReqRes();
    req.method = 'OPTIONS';
    await handler(req, res);
    assert.equal(res._status, 200);
  });
});
