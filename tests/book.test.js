// tests/book.test.js
// Requirements: BOOK-01, BOOK-02, BOOK-03
// Run: node --test tests/book.test.js
// Expected state: GREEN after api/book.js is implemented

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/book.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const BEAPI_TOKEN_URL = 'https://booking.guesty.com/oauth2/token';

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
  quoteId: 'quote-abc',
  ratePlanId: 'plan-xyz',
  ccToken: 'pm_test123',
  checkIn: '2026-07-01',
  checkOut: '2026-07-05',
  guest: {firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-1234'},
  upsells: [],
};

const mockBookResponse = {_id: 'res-abc123', status: 'confirmed', confirmationCode: 'SCR-99999', platform: 'direct'};

describe('Input Validation (api/book.js)', () => {
  it('BOOK-01: missing quoteId returns 400 with fallbackUrl', async () => {
    const {req, res} = mockReqRes({...validBody, quoteId: undefined});
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('BOOK-01: missing ccToken returns 400 with fallbackUrl', async () => {
    const {req, res} = mockReqRes({...validBody, ccToken: undefined});
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('BOOK-01: ccToken without pm_ prefix returns 400 with fallbackUrl', async () => {
    const {req, res} = mockReqRes({...validBody, ccToken: 'tok_test123'});
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('BOOK-01: missing guest.firstName returns 400 with fallbackUrl', async () => {
    const {req, res} = mockReqRes({...validBody, guest: {lastName: 'Doe', email: 'jane@example.com', phone: '555-1234'}});
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('BOOK-01: missing guest.email returns 400 with fallbackUrl', async () => {
    const {req, res} = mockReqRes({...validBody, guest: {firstName: 'Jane', lastName: 'Doe', phone: '555-1234'}});
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('BOOK-03: unknown upsell ID returns 400 with fallbackUrl', async () => {
    const {req, res} = mockReqRes({...validBody, upsells: ['nonexistent_upsell']});
    await handler(req, res);
    assert.equal(res._status, 400);
    assert.ok(res._body.error);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });
});

describe('Successful Booking (api/book.js)', () => {
  it('BOOK-01, BOOK-02: valid POST body returns 200 with reservationId, confirmationCode, status confirmed', async () => {
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, mockBookResponse);
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes(validBody);
    await handler(req, res);
    mock.restoreAll();
    assert.equal(res._status, 200);
    assert.equal(res._body.success, true);
    assert.equal(res._body.reservationId, 'res-abc123');
    assert.equal(res._body.confirmationCode, 'SCR-99999');
    assert.equal(res._body.status, 'confirmed');
  });

  it('BOOK-02: success response includes upsells array and upsellTotal', async () => {
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, mockBookResponse);
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes({...validBody, upsells: ['early_checkin', 'late_checkout']});
    await handler(req, res);
    mock.restoreAll();
    assert.equal(res._status, 200);
    assert.ok(Array.isArray(res._body.upsells));
    assert.equal(res._body.upsellTotal, 125); // 75 + 50
  });
});

describe('Error Mapping (api/book.js)', () => {
  it('BOOK-01: Guesty 410 returns 410 with code QUOTE_EXPIRED and fallbackUrl', async () => {
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(410, {error: 'Gone'});
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes(validBody);
    await handler(req, res);
    mock.restoreAll();
    assert.equal(res._status, 410);
    assert.equal(res._body.code, 'QUOTE_EXPIRED');
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('BOOK-01: Guesty 422 returns 402 with code PAYMENT_DECLINED and fallbackUrl', async () => {
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(422, {error: 'Unprocessable'});
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes(validBody);
    await handler(req, res);
    mock.restoreAll();
    assert.equal(res._status, 402);
    assert.equal(res._body.code, 'PAYMENT_DECLINED');
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });

  it('BOOK-01: Guesty 500 returns 500 with code BOOKING_FAILED and fallbackUrl', async () => {
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(500, {error: 'Internal Server Error'});
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes(validBody);
    await handler(req, res);
    mock.restoreAll();
    assert.equal(res._status, 500);
    assert.equal(res._body.code, 'BOOKING_FAILED');
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });
});

describe('Upsell Processing (api/book.js)', () => {
  it('BOOK-03: upsells present — sendUpsellNotification is called with correct params', async () => {
    // Count fetch calls: instant-book (1) + Resend (2) = notification fired
    // Token may be cached from earlier tests; Resend SDK calls fetch internally
    process.env.RESEND_API_KEY = 'test-key';
    let resendCalled = false;
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      // Resend API endpoint
      if (typeof url === 'string' && url.includes('resend.com')) {
        resendCalled = true;
        return mockResponse(200, {id: 'email-id'});
      }
      return mockResponse(200, mockBookResponse);
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes({...validBody, upsells: ['early_checkin']});
    await handler(req, res);
    // Wait for fire-and-forget to settle BEFORE restoring mock
    await new Promise(r => setTimeout(r, 50));
    mock.restoreAll();
    assert.equal(res._status, 200);
    assert.equal(resendCalled, true, 'Expected sendUpsellNotification to call Resend fetch');
  });

  it('BOOK-03: no upsells — sendUpsellNotification is not called', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    let resendCalled = false;
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      if (typeof url === 'string' && url.includes('resend.com')) {
        resendCalled = true;
        return mockResponse(200, {id: 'email-id'});
      }
      return mockResponse(200, mockBookResponse);
    });
    mock.method(globalThis, 'fetch', mockFetch);
    const {req, res} = mockReqRes({...validBody, upsells: []});
    await handler(req, res);
    // Wait for any potential fire-and-forget to settle BEFORE restoring mock
    await new Promise(r => setTimeout(r, 50));
    mock.restoreAll();
    assert.equal(res._status, 200);
    assert.equal(resendCalled, false, 'Expected sendUpsellNotification NOT to be called when no upsells');
  });
});
