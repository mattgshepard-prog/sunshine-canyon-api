// tests/quote.test.js
// Requirements: QUOTE-01, QUOTE-02, QUOTE-03
// Run: node --test tests/quote.test.js
// Expected state: GREEN after api/quote.js is implemented

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

const validBody = {
  checkIn: '2026-05-01',
  checkOut: '2026-05-05',
  guests: 2,
  guest: {firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-1234'},
};

const mockQuoteResponse = {
  _id: 'quote-abc123',
  expiresAt: '2026-05-01T12:00:00.000Z',
  ratePlans: [{
    days: [{date: '2026-05-01', price: 350}, {date: '2026-05-02', price: 350}],
    totals: {accommodation: 700, cleaningFee: 150, taxes: 85, total: 935},
  }],
};

describe('Input Validation (api/quote.js)', () => {
  it('QUOTE-01: missing checkIn returns 400 with error and fallbackUrl', async () => {
    const {req, res} = mockReqRes({
      checkOut: '2026-05-05', guests: 2,
      guest: {firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-1234'},
    });
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('QUOTE-01: missing checkOut returns 400 with error and fallbackUrl', async () => {
    const {req, res} = mockReqRes({
      checkIn: '2026-05-01', guests: 2,
      guest: {firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-1234'},
    });
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('QUOTE-01: checkOut <= checkIn returns 400 with error', async () => {
    const {req, res} = mockReqRes({
      checkIn: '2026-05-05', checkOut: '2026-05-01', guests: 2,
      guest: {firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-1234'},
    });
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error.includes('after'));
  });

  it('QUOTE-01: guests=0 returns 400 with error', async () => {
    const {req, res} = mockReqRes({
      checkIn: '2026-05-01', checkOut: '2026-05-05', guests: 0,
      guest: {firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-1234'},
    });
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
  });

  it('QUOTE-01: missing guest.email returns 400 with error and fallbackUrl', async () => {
    const {req, res} = mockReqRes({
      checkIn: '2026-05-01', checkOut: '2026-05-05', guests: 2,
      guest: {firstName: 'Jane', lastName: 'Doe', phone: '555-1234'},
    });
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('QUOTE-01: missing guest.firstName returns 400 with error and fallbackUrl', async () => {
    const {req, res} = mockReqRes({
      checkIn: '2026-05-01', checkOut: '2026-05-05', guests: 2,
      guest: {lastName: 'Doe', email: 'jane@example.com', phone: '555-1234'},
    });
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });
});

describe('Successful Quote (api/quote.js)', () => {
  it('QUOTE-01, QUOTE-02, QUOTE-03: valid POST body returns 200 with quoteId, expiresAt, and ratePlans array', async () => {
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, mockQuoteResponse);
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes(validBody);
    await handler(req, res);
    mock.restoreAll();
    assert.equal(res._status, 200);
    assert.ok(res._body.quoteId);
    assert.ok(res._body.expiresAt);
    assert.ok(Array.isArray(res._body.ratePlans));
  });

  it('QUOTE-02: ratePlans array contains entries with days[] per-night breakdown', async () => {
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, mockQuoteResponse);
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes(validBody);
    await handler(req, res);
    mock.restoreAll();
    assert.equal(res._status, 200);
    assert.ok(Array.isArray(res._body.ratePlans));
    assert.ok(res._body.ratePlans.length > 0);
    assert.ok(Array.isArray(res._body.ratePlans[0].days));
    assert.ok(res._body.ratePlans[0].days.length > 0);
  });

  it('QUOTE-03: response includes expiresAt timestamp', async () => {
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, mockQuoteResponse);
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes(validBody);
    await handler(req, res);
    mock.restoreAll();
    assert.equal(res._status, 200);
    assert.ok(res._body.expiresAt);
  });
});

describe('Error Handling (api/quote.js)', () => {
  it('QUOTE-01: Guesty 500 returns 500 with error and fallbackUrl', async () => {
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(500, {error: 'Internal Server Error'});
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes(validBody);
    await handler(req, res);
    mock.restoreAll();
    assert.equal(res._status, 500);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });
});
