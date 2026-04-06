// tests/payment-info.test.js
// Requirements: PAY-01, PAY-02
// Run: node --test tests/payment-info.test.js
// Expected state: RED (api/payment-info.js does not exist yet)

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
    assert.fail('not implemented');
  });

  it('PAY-02: response includes stripePublishableKey when STRIPE_PUBLISHABLE_KEY env var is set', async () => {
    assert.fail('not implemented');
  });

  it('PAY-02: response always includes fallbackUrl', async () => {
    assert.fail('not implemented');
  });
});

describe('Missing Stripe Key Fallback (api/payment-info.js)', () => {
  it('PAY-02: when STRIPE_PUBLISHABLE_KEY is absent, returns 200 (not 500) with stripeAccountId: null and fallbackUrl', async () => {
    assert.fail('not implemented');
  });

  it('PAY-02: when STRIPE_PUBLISHABLE_KEY is absent, stripePublishableKey is null', async () => {
    assert.fail('not implemented');
  });
});

describe('Error Handling (api/payment-info.js)', () => {
  it('PAY-01: Guesty payment-provider 500 returns 500 with error and fallbackUrl', async () => {
    assert.fail('not implemented');
  });
});
