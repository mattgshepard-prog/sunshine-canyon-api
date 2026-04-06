// Tests for api/availability.js
// Requirements: AVAIL-01, AVAIL-02, INFRA-03
// Run: node --test tests/availability.test.js
// Expected state: GREEN after Plan 04 creates api/availability.js

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/availability.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const BEAPI_TOKEN_URL = 'https://booking.guesty.com/oauth2/token';

// Helper: minimal mock req/res for testing handler directly
function mockReqRes(query = {}) {
  const headers = {};
  const res = {
    _status: 200, _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader(k, v) { headers[k] = v; },
    end() {},
  };
  return { req: { method: 'GET', headers: {}, query }, res };
}

// Helper: create a mock Response object
function mockResponse(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {get: () => null},
    json: async () => body,
  };
}

// Helper: token response
function tokenResp() {
  return mockResponse(200, {access_token: 'test-token', expires_in: 86400});
}

describe('Input Validation (api/availability.js)', () => {
  it('INFRA-03: missing checkIn returns 400 with error and fallbackUrl', async () => {
    const {req, res} = mockReqRes({checkOut: '2026-05-10', guests: '2'});
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('INFRA-03: checkOut <= checkIn returns 400 with error', async () => {
    const {req, res} = mockReqRes({checkIn: '2026-05-10', checkOut: '2026-05-10', guests: '2'});
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error.includes('after'));
  });

  it('INFRA-03: guests=0 returns 400 with error', async () => {
    const {req, res} = mockReqRes({checkIn: '2026-05-01', checkOut: '2026-05-05', guests: '0'});
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
  });

  it('AVAIL-02: valid input returns { available: boolean, listing: object|null }', async () => {
    // Mock globalThis.fetch: token endpoint + search endpoint
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      // BEAPI search call — return one listing result
      return mockResponse(200, {
        results: [{
          id: 'listing-123',
          title: 'Sunshine Canyon Retreat',
          nightlyRates: {'2026-05-01': 350},
        }],
      });
    });
    mock.method(globalThis, 'fetch', mockFetch);

    const {req, res} = mockReqRes({checkIn: '2026-05-01', checkOut: '2026-05-05', guests: '2'});
    await handler(req, res);

    mock.restoreAll();

    assert.equal(res._status, 200);
    assert.ok(typeof res._body.available === 'boolean');
    assert.ok('listing' in res._body);
    if (res._body.available) {
      assert.ok(res._body.listing !== null);
      assert.ok('id' in res._body.listing);
      assert.ok('title' in res._body.listing);
      assert.ok('nightlyRate' in res._body.listing);
    } else {
      assert.equal(res._body.listing, null);
    }
  });
});
