// Tests for api/availability.js
// Requirements: AVAIL-01, AVAIL-02, INFRA-03
// Run: node --test tests/availability.test.js
// Expected state: RED (api/availability.js does not exist yet — Plan 04 creates it)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Stub: replace when api/availability.js exists
// import handler from '../api/availability.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';

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

describe('Input Validation (api/availability.js)', () => {
  it('INFRA-03: missing checkIn returns 400 with error and fallbackUrl', async () => {
    // TODO: call handler with { checkOut: '2026-05-10', guests: '2' }, assert 400 + fallbackUrl
    assert.fail('api/availability.js not yet implemented');
  });

  it('INFRA-03: checkOut <= checkIn returns 400 with error', async () => {
    // TODO: call handler with checkOut same as checkIn, assert 400
    assert.fail('api/availability.js not yet implemented');
  });

  it('INFRA-03: guests=0 returns 400 with error', async () => {
    // TODO: call handler with guests=0, assert 400
    assert.fail('api/availability.js not yet implemented');
  });

  it('AVAIL-02: valid input returns { available: boolean, listing: object|null }', async () => {
    // TODO: mock guestyFetch, call handler with valid dates, assert response shape
    assert.fail('api/availability.js not yet implemented');
  });
});
