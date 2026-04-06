// tests/quote.test.js
// Requirements: QUOTE-01, QUOTE-02, QUOTE-03
// Run: node --test tests/quote.test.js
// Expected state: RED (api/quote.js does not exist yet)

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/quote.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const BEAPI_TOKEN_URL = 'https://booking.guesty.com/oauth2/token';

// POST body helper — note: uses `body`, not `query` (quote is POST)
function mockReqRes(body = {}) {
  const headers = {};
  const res = {
    _status: 200, _body: null,
    status(code) { this._status = code; return this; },
    json(b) { this._body = b; return this; },
    setHeader(k, v) { headers[k] = v; },
    end() {},
  };
  return {req: {method: 'POST', headers: {}, body}, res};
}

function mockResponse(status, body = {}) {
  return {
    status, ok: status >= 200 && status < 300,
    headers: {get: () => null},
    json: async () => body,
  };
}

function tokenResp() {
  return mockResponse(200, {access_token: 'test-token', expires_in: 86400});
}

describe('Input Validation (api/quote.js)', () => {
  it('QUOTE-01: missing checkIn returns 400 with error and fallbackUrl', async () => {
    assert.fail('not implemented');
  });

  it('QUOTE-01: missing checkOut returns 400 with error and fallbackUrl', async () => {
    assert.fail('not implemented');
  });

  it('QUOTE-01: checkOut <= checkIn returns 400 with error', async () => {
    assert.fail('not implemented');
  });

  it('QUOTE-01: guests=0 returns 400 with error', async () => {
    assert.fail('not implemented');
  });

  it('QUOTE-01: missing guest.email returns 400 with error and fallbackUrl', async () => {
    assert.fail('not implemented');
  });

  it('QUOTE-01: missing guest.firstName returns 400 with error and fallbackUrl', async () => {
    assert.fail('not implemented');
  });
});

describe('Successful Quote (api/quote.js)', () => {
  it('QUOTE-01, QUOTE-02, QUOTE-03: valid POST body returns 200 with quoteId, expiresAt, and ratePlans array', async () => {
    assert.fail('not implemented');
  });

  it('QUOTE-02: ratePlans array contains entries with days[] per-night breakdown', async () => {
    assert.fail('not implemented');
  });

  it('QUOTE-03: response includes expiresAt timestamp', async () => {
    assert.fail('not implemented');
  });
});

describe('Error Handling (api/quote.js)', () => {
  it('QUOTE-01: Guesty 500 returns 500 with error and fallbackUrl', async () => {
    assert.fail('not implemented');
  });
});
