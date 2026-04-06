---
phase: 01-api-foundation
plan: 04
subsystem: availability
tags: [guesty, beapi, availability, cors, input-validation, tdd]
dependency_graph:
  requires: [01-02]
  provides: [api/availability.js, GET /api/availability]
  affects: []
tech_stack:
  added: []
  patterns: [dynamic CORS origin allowlist, input validation before rate-limited API call, fallbackUrl in all error responses, mock.method(globalThis, fetch) for integration test mocking]
key_files:
  created:
    - api/availability.js
  modified:
    - tests/availability.test.js
    - vercel.json
decisions:
  - Dynamic CORS origin allowlist in setCors() overrides the vercel.json CDN-level header per request for availability endpoint
  - vercel.json CDN CORS changed from wildcard '*' to 'https://mattgshepard-prog.github.io' as more secure static default
  - mock.module() not available in Node 24.13.1 node:test; used mock.method(globalThis, 'fetch') to intercept both token and search calls for AVAIL-02 test
  - fallbackUrl included in every 400 and 500 error response so frontend can always redirect to Guesty booking page
metrics:
  duration: 8m
  completed: "2026-04-06"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
---

# Phase 01 Plan 04: Availability Endpoint and CORS Update Summary

**One-liner:** GET /api/availability endpoint with multi-origin CORS, input validation, BEAPI search integration, and fallbackUrl in all error responses — all 4 tests GREEN and vercel.json updated to GitHub Pages CDN origin.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement api/availability.js | 3fac0a8 | api/availability.js (created), tests/availability.test.js (updated) |
| 2 | Update vercel.json for multi-origin CORS | d4b2ac4 | vercel.json (modified) |

## What Was Built

### api/availability.js

The first real BEAPI endpoint. Proves the full auth + CORS + credential separation stack end to end.

- `setCors(req, res)` — dynamic origin allowlist: `https://mattgshepard-prog.github.io`, `http://localhost:3000`, `http://localhost:8080`; falls back to `*` for unlisted origins
- `OPTIONS` handler returns 200 immediately with CORS headers (no Guesty call)
- Input validation (INFRA-03) — rejects before burning rate limit:
  - Missing checkIn or checkOut → 400 + fallbackUrl
  - Non-ISO date format (NaN) → 400 + fallbackUrl
  - checkOut <= checkIn → 400 + fallbackUrl
  - guests missing or not a positive integer → 400 + fallbackUrl
- Happy path: calls `guestyFetch(url)` with `booking-api.guesty.com/v1/search?checkIn=...&checkOut=...&adults=N`
  - No results → `{ available: false, listing: null }` (AVAIL-01)
  - Results found → `{ available: true, listing: { id, title, nightlyRate } }` (AVAIL-02)
- Error path: `guestyFetch` throws or returns non-ok → 500 + fallbackUrl
- `GUESTY_CLIENT_ID` and `GUESTY_CLIENT_SECRET` do NOT appear in this file (INFRA-02)

### vercel.json

- `Access-Control-Allow-Origin` changed from `"*"` to `"https://mattgshepard-prog.github.io"` at CDN level
- `api/calendar.js` overrides per-request with `"*"` (unchanged behavior)
- `api/availability.js` overrides per-request via `setCors()` with dynamic allowlist
- `Cache-Control` and route structure preserved unchanged

## Verification Results

```
node --test tests/availability.test.js
✔ INFRA-03: missing checkIn returns 400 with error and fallbackUrl
✔ INFRA-03: checkOut <= checkIn returns 400 with error
✔ INFRA-03: guests=0 returns 400 with error
✔ AVAIL-02: valid input returns { available: boolean, listing: object|null }
pass 4, fail 0

node --test tests/guesty.test.js tests/availability.test.js
pass 9, fail 0  (full suite: 5 guesty + 4 availability)
```

## Decisions Made

1. **mock.module() unavailable — used mock.method(globalThis, 'fetch')**: Node 24.13.1's `node:test` mock object does not expose a `module()` method (only `fn`, `method`, `getter`, `setter`, `property`, `reset`, `restoreAll`). The AVAIL-02 test mocks `globalThis.fetch` to intercept both the BEAPI token acquisition call and the search call, matching the same pattern already used in `tests/guesty.test.js`.

2. **vercel.json CDN CORS set to GitHub Pages domain**: The static CDN-level `Access-Control-Allow-Origin` is now the production domain rather than wildcard. This is the more secure default. Per-function handlers override it at response time, so no existing endpoints are broken.

3. **fallbackUrl in every error response**: All 400 and 500 responses include `fallbackUrl: FALLBACK_URL` so the frontend can always redirect guests to the Guesty booking page when validation or API calls fail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] mock.module() not available in Node 24.13.1**
- **Found during:** Task 1 - TDD GREEN phase (first test run)
- **Issue:** Plan suggested using `mock.module('../lib/guesty.js')` to mock `guestyFetch`. `mock.module` does not exist in Node 24.13.1's `node:test` — only `mock.method`, `mock.fn`, etc. are available.
- **Fix:** Used `mock.method(globalThis, 'fetch', mockFetch)` to intercept the underlying `fetch` calls made by both `getBeapiToken()` and the BEAPI search request. This is the same mocking pattern already established in `tests/guesty.test.js`, keeping the test style consistent.
- **Files modified:** tests/availability.test.js
- **Commit:** 3fac0a8

## Known Stubs

None — `api/availability.js` is fully implemented and tested. No placeholder values, TODO items, or hardcoded empty data remain.

## Self-Check: PASSED

- api/availability.js exists: FOUND
- tests/availability.test.js updated: FOUND
- vercel.json updated: FOUND
- Commit 3fac0a8 exists: FOUND
- Commit d4b2ac4 exists: FOUND
- 4/4 availability tests GREEN: PASSED
- 9/9 full suite tests GREEN: PASSED
