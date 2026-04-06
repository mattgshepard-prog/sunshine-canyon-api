// tests/payment-info.test.js
// Requirements: PAY-01, PAY-02
// Run: node --test tests/payment-info.test.js
// Expected state: GREEN (after api/payment-info.js is implemented)

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/payment-info.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const BEAPI_TOKEN_URL = 'https://booking.guesty.com/oauth2/token';

// GET helper — payment-info takes no parameters
function mockReqRes() {
  const headers = {};
  const res = {
    _status: 200, _body: null,
    status(code) { this._status = code; return this; },
    json(b) { this._body = b; return this; },
    setHeader(k, v) { headers[k] = v; },
    end() {},
  };
  return {req: {method: 'GET', headers: {}, query: {}}, res};
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

describe('Successful Payment Info (api/payment-info.js)', () => {
  it('PAY-01, PAY-02: returns 200 with providerType and stripeAccountId from Guesty providerAccountId', async () => {
    const savedKey = process.env.STRIPE_PUBLISHABLE_KEY;
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_abc123';

    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, {providerType: 'stripe', providerAccountId: 'acct_1234567890'});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    const {req, res} = mockReqRes();
    await handler(req, res);
    mock.restoreAll();

    if (savedKey !== undefined) process.env.STRIPE_PUBLISHABLE_KEY = savedKey;
    else delete process.env.STRIPE_PUBLISHABLE_KEY;

    assert.equal(res._status, 200);
    assert.equal(res._body.providerType, 'stripe');
    assert.equal(res._body.stripeAccountId, 'acct_1234567890');
  });

  it('PAY-02: response includes stripePublishableKey when STRIPE_PUBLISHABLE_KEY env var is set', async () => {
    const savedKey = process.env.STRIPE_PUBLISHABLE_KEY;
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_abc123';

    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, {providerType: 'stripe', providerAccountId: 'acct_1234567890'});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    const {req, res} = mockReqRes();
    await handler(req, res);
    mock.restoreAll();

    if (savedKey !== undefined) process.env.STRIPE_PUBLISHABLE_KEY = savedKey;
    else delete process.env.STRIPE_PUBLISHABLE_KEY;

    assert.equal(res._status, 200);
    assert.equal(res._body.stripePublishableKey, 'pk_test_abc123');
  });

  it('PAY-02: response always includes fallbackUrl', async () => {
    const savedKey = process.env.STRIPE_PUBLISHABLE_KEY;
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_abc123';

    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, {providerType: 'stripe', providerAccountId: 'acct_1234567890'});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    const {req, res} = mockReqRes();
    await handler(req, res);
    mock.restoreAll();

    if (savedKey !== undefined) process.env.STRIPE_PUBLISHABLE_KEY = savedKey;
    else delete process.env.STRIPE_PUBLISHABLE_KEY;

    assert.equal(res._status, 200);
    assert.ok(res._body.fallbackUrl);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });
});

describe('Missing Stripe Key Fallback (api/payment-info.js)', () => {
  it('PAY-02: when STRIPE_PUBLISHABLE_KEY is absent, returns 200 (not 500) with stripeAccountId: null and fallbackUrl', async () => {
    // Save and delete the env var
    const saved = process.env.STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_PUBLISHABLE_KEY;

    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, {providerType: 'stripe', providerAccountId: 'acct_1234567890'});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    const {req, res} = mockReqRes();
    await handler(req, res);
    mock.restoreAll();

    // Restore env var
    if (saved !== undefined) process.env.STRIPE_PUBLISHABLE_KEY = saved;

    assert.equal(res._status, 200);  // NOT 500
    assert.equal(res._body.stripeAccountId, null);
    assert.ok(res._body.fallbackUrl);
  });

  it('PAY-02: when STRIPE_PUBLISHABLE_KEY is absent, stripePublishableKey is null', async () => {
    const saved = process.env.STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_PUBLISHABLE_KEY;

    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, {providerType: 'stripe', providerAccountId: 'acct_1234567890'});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    const {req, res} = mockReqRes();
    await handler(req, res);
    mock.restoreAll();

    if (saved !== undefined) process.env.STRIPE_PUBLISHABLE_KEY = saved;

    assert.equal(res._status, 200);
    assert.equal(res._body.stripePublishableKey, null);
  });
});

describe('Error Handling (api/payment-info.js)', () => {
  it('PAY-01: Guesty payment-provider 500 returns 500 with error and fallbackUrl', async () => {
    const savedKey = process.env.STRIPE_PUBLISHABLE_KEY;
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_abc123';

    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(500, {});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    const {req, res} = mockReqRes();
    await handler(req, res);
    mock.restoreAll();

    if (savedKey !== undefined) process.env.STRIPE_PUBLISHABLE_KEY = savedKey;
    else delete process.env.STRIPE_PUBLISHABLE_KEY;

    assert.equal(res._status, 500);
    assert.ok(res._body.error);
    assert.ok(res._body.fallbackUrl);
    assert.equal(res._body.fallbackUrl, FALLBACK_URL);
  });
});
