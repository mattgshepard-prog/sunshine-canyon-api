---
phase: 01-api-foundation
plan: 02
subsystem: auth
tags: [guesty, beapi, token-cache, oauth2, tdd]
dependency_graph:
  requires: [01-01]
  provides: [lib/guesty.js, guestyFetch]
  affects: [01-03, 01-04]
tech_stack:
  added: []
  patterns: [module-level token cache, fetch mock with node:test, ES module cache busting for TDD isolation]
key_files:
  created:
    - lib/guesty.js
  modified:
    - tests/guesty.test.js
decisions:
  - 429 retry guard uses retried=true flag (same as 401) to prevent infinite recursion on double-429
  - Module cache-busting via query string (?t=timestamp) used in tests to reset module-level token state between test cases
  - retryAfter=0 used in INFRA-04 test to avoid actual setTimeout delay while preserving retry logic coverage
metrics:
  duration: 90s
  completed: "2026-04-06"
  tasks_completed: 1
  files_created: 1
  files_modified: 1
---

# Phase 01 Plan 02: BEAPI Token Cache and guestyFetch Wrapper Summary

**One-liner:** BEAPI OAuth2 token management in `lib/guesty.js` with 5-minute buffer caching, 401 auto-retry, and 429 backoff using `booking.guesty.com/oauth2/token` with `scope=booking_engine:api`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement lib/guesty.js — BEAPI token cache and guestyFetch wrapper | 64e9abf | lib/guesty.js (created), tests/guesty.test.js (updated) |

## What Was Built

`lib/guesty.js` is the shared BEAPI authentication layer for all current and future API routes. It provides:

- `getBeapiToken()` — acquires OAuth2 tokens from `https://booking.guesty.com/oauth2/token` with `scope=booking_engine:api`, caches with 5-minute buffer (300000ms) to protect the 3-renewals/24h limit
- `guestyFetch(path, options)` — attaches `Authorization: Bearer {token}` header, handles 401 by clearing cache and retrying once with a fresh token, handles 429 by waiting `Retry-After` seconds and retrying once
- All 5 tests GREEN: AUTH-01, AUTH-02, AUTH-03, AUTH-04, INFRA-04

## Verification Results

```
node --test tests/guesty.test.js
✔ AUTH-01: acquires token from booking.guesty.com/oauth2/token with scope=booking_engine:api
✔ AUTH-02: reuses cached token on second call within valid window (no second token fetch)
✔ AUTH-03: token endpoint is booking.guesty.com, NOT open-api.guesty.com
✔ AUTH-04: clears cached token and retries on 401 response
✔ INFRA-04: retries exactly once on 429 with Retry-After delay, no second retry
pass 5, fail 0
```

## Decisions Made

1. **429 guard via retried flag**: The `guestyFetch` function uses `retried=true` for both 401 and 429 retries. This ensures a 429 on the retry call returns without further retrying, matching the must-have truth: "a second 429 in the same call does not retry again".

2. **Module cache-busting in tests**: ES module state (cachedToken, tokenExpiry) is module-level. To isolate tests, each `beforeEach` re-imports `lib/guesty.js` with a unique `?t=timestamp` query string so Node treats it as a fresh module. This is the standard pattern for testing ES modules with stateful module-level variables without an external test framework.

3. **INFRA-04 zero-delay**: The 429 retry test uses `retry-after: 0` so the test completes immediately without real sleep, while still exercising the full retry code path including the `setTimeout` call.

## Deviations from Plan

None — plan executed exactly as written. The provided implementation matched the plan spec and all 5 tests passed on first run.

## Known Stubs

None — `lib/guesty.js` is fully implemented and tested. No placeholder values or TODO items remain.

## Self-Check: PASSED

- lib/guesty.js exists: FOUND
- tests/guesty.test.js updated: FOUND
- Commit 64e9abf exists: FOUND
- 5/5 tests GREEN: PASSED
