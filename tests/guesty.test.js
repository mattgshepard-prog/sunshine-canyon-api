// Tests for lib/guesty.js
// Requirements: AUTH-01, AUTH-02, AUTH-03, AUTH-04, INFRA-04
// Run: node --test tests/guesty.test.js

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const BEAPI_TOKEN_URL = 'https://booking.guesty.com/oauth2/token';
const TARGET_URL = 'https://booking-api.guesty.com/v1/search';

// Helper: create a mock Response object
function mockResponse(status, body = {}, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  };
}

// Helper: token response
function tokenResp() {
  return mockResponse(200, {access_token: 'test-token-abc', expires_in: 86400});
}

describe('BEAPI Token Management (lib/guesty.js)', () => {
  let guestyFetch;

  // Re-import the module fresh for each test to reset module-level cache
  beforeEach(async () => {
    // Clear the module cache by appending a bust query so Node treats it as a new module
    const {guestyFetch: fn} = await import(`../lib/guesty.js?t=${Date.now()}`);
    guestyFetch = fn;
  });

  it('AUTH-01: acquires token from booking.guesty.com/oauth2/token with scope=booking_engine:api', async () => {
    const calls = [];
    const mockFetch = mock.fn(async (url, opts) => {
      calls.push({url, opts});
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, {});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    await guestyFetch(TARGET_URL);

    const tokenCall = calls.find(c => c.url === BEAPI_TOKEN_URL);
    assert.ok(tokenCall, 'Should call BEAPI token endpoint');
    const body = tokenCall.opts.body;
    assert.ok(body.includes('scope=booking_engine%3Aapi'), `Expected scope=booking_engine%3Aapi in body: ${body}`);

    mock.restoreAll();
  });

  it('AUTH-02: reuses cached token on second call within valid window (no second token fetch)', async () => {
    let tokenCallCount = 0;
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) {
        tokenCallCount++;
        return tokenResp();
      }
      return mockResponse(200, {});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    await guestyFetch(TARGET_URL);
    await guestyFetch(TARGET_URL);

    assert.equal(tokenCallCount, 1, 'Token endpoint should be called exactly once (cache reuse)');

    mock.restoreAll();
  });

  it('AUTH-03: token endpoint is booking.guesty.com, NOT open-api.guesty.com', async () => {
    const calledUrls = [];
    const mockFetch = mock.fn(async (url) => {
      calledUrls.push(url);
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      return mockResponse(200, {});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    await guestyFetch(TARGET_URL);

    const openApiCall = calledUrls.find(u => u.includes('open-api.guesty.com'));
    assert.equal(openApiCall, undefined, 'Should NOT call open-api.guesty.com');

    mock.restoreAll();
  });

  it('AUTH-04: clears cached token and retries on 401 response', async () => {
    let targetCallCount = 0;
    let tokenCallCount = 0;
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) {
        tokenCallCount++;
        return tokenResp();
      }
      // Target URL: first call returns 401, second returns 200
      targetCallCount++;
      if (targetCallCount === 1) return mockResponse(401, {});
      return mockResponse(200, {result: 'ok'});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    const resp = await guestyFetch(TARGET_URL);

    assert.equal(targetCallCount, 2, 'Target URL should be fetched twice (original + retry)');
    assert.equal(tokenCallCount, 2, 'Token should be re-fetched after 401 clears cache');
    assert.equal(resp.status, 200, 'Final response should be 200');

    mock.restoreAll();
  });

  it('INFRA-04: retries exactly once on 429 with Retry-After delay, no second retry', async () => {
    let targetCallCount = 0;
    const mockFetch = mock.fn(async (url) => {
      if (url === BEAPI_TOKEN_URL) return tokenResp();
      // Target URL: first call returns 429 with retry-after: 0 (no actual sleep), second returns 200
      targetCallCount++;
      if (targetCallCount === 1) return mockResponse(429, {}, {'retry-after': '0'});
      return mockResponse(200, {result: 'ok'});
    });
    mock.method(globalThis, 'fetch', mockFetch);

    const resp = await guestyFetch(TARGET_URL);

    assert.equal(targetCallCount, 2, 'Target URL should be fetched twice (original 429 + single retry)');
    assert.equal(resp.status, 200, 'Final response should be 200');

    mock.restoreAll();
  });
});
