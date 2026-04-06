// Tests for lib/guesty.js
// Requirements: AUTH-01, AUTH-02, AUTH-03, AUTH-04, INFRA-04
// Run: node --test tests/guesty.test.js
// Expected state: RED (lib/guesty.js does not exist yet — Plan 02 creates it)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Stub: replace when lib/guesty.js exists
// import { guestyFetch } from '../lib/guesty.js';

describe('BEAPI Token Management (lib/guesty.js)', () => {
  it('AUTH-01: acquires token from booking.guesty.com/oauth2/token with scope=booking_engine:api', async () => {
    // TODO: mock fetch, call guestyFetch, assert token endpoint called with correct scope
    assert.fail('lib/guesty.js not yet implemented');
  });

  it('AUTH-02: reuses cached token on second call within valid window (no second token fetch)', async () => {
    // TODO: mock fetch, call guestyFetch twice, assert token endpoint called exactly once
    assert.fail('lib/guesty.js not yet implemented');
  });

  it('AUTH-03: token endpoint is booking.guesty.com, NOT open-api.guesty.com', async () => {
    // TODO: assert guestyFetch never calls open-api.guesty.com/oauth2/token
    assert.fail('lib/guesty.js not yet implemented');
  });

  it('AUTH-04: clears cached token and retries on 401 response', async () => {
    // TODO: mock fetch to return 401 once then 200, assert retry happened once
    assert.fail('lib/guesty.js not yet implemented');
  });

  it('INFRA-04: retries exactly once on 429 with Retry-After delay, no second retry', async () => {
    // TODO: mock fetch to return 429 once then 200, assert single retry
    assert.fail('lib/guesty.js not yet implemented');
  });
});
