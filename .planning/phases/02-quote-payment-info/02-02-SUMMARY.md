---
phase: 02-quote-payment-info
plan: 02
subsystem: api
tags: [quote, validation, guesty-beapi, tdd]
dependency_graph:
  requires: [02-01]
  provides: [api/quote.js, POST /api/quote endpoint]
  affects: [frontend checkout step 1]
tech_stack:
  added: []
  patterns: [guestyFetch passthrough, CORS handler, input validation before API call]
key_files:
  created: [api/quote.js]
  modified: [tests/quote.test.js]
decisions:
  - guests=0 check uses parsed integer (parseInt) matching availability.js pattern
  - checkOut <= checkIn error message includes word "after" to match test assertion
  - Defensive quoteId extraction uses data._id || data.quoteId per Guesty BEAPI variance
metrics:
  duration: 76s
  completed: 2026-04-06
  tasks: 1
  files: 2
---

# Phase 02 Plan 02: Quote Endpoint Summary

**One-liner:** POST /api/quote validates guest details, calls Guesty BEAPI reservations/quotes, and returns quoteId, expiresAt, and ratePlans array with per-night days[] breakdown.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing tests for quote endpoint | 7f1263e | tests/quote.test.js |
| 1 (GREEN) | Implement POST /api/quote handler | 75b0466 | api/quote.js |

## What Was Built

`api/quote.js` — a Vercel serverless function handling `POST /api/quote` with:

- **CORS** — same allowed origins pattern as availability.js (GitHub Pages + localhost)
- **Input validation** — checkIn, checkOut required; checkOut must be after checkIn; guests must be positive integer; guest object must include firstName, lastName, email, phone
- **Guesty BEAPI call** — via `guestyFetch(QUOTES_URL, { method: 'POST', body: ... })` with field renaming: `checkIn` → `checkInDateLocalized`, `checkOut` → `checkOutDateLocalized`, `guests` → `guestsCount`
- **Response passthrough** — returns `{ quoteId: data._id || data.quoteId, expiresAt, ratePlans }`
- **Error handling** — non-ok Guesty response returns 500 with fallbackUrl; caught exceptions return 500

`tests/quote.test.js` — all 10 stubs replaced with real assertions:
- 6 validation tests (no fetch mock needed)
- 3 success tests (fetch mocked for token + quotes endpoints)
- 1 error test (Guesty 500 scenario)

## Test Results

```
tests 10
pass  10
fail  0
```

Phase 1 tests (guesty.test.js, availability.test.js) — all 9 still GREEN.

Note: `node --test tests/*.test.js` fails due to payment-info.test.js referencing `api/payment-info.js` which is built in plan 02-03 (next plan). This is pre-existing and expected.

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the provided code template verbatim. Validation order (checkIn/checkOut first, then date parse, then direction check, then guests count, then guest sub-fields) ensures correct 400 responses for all test cases.

## Known Stubs

None — all ratePlans data is passed through from Guesty BEAPI response, not hardcoded.

## Self-Check

- [x] api/quote.js exists
- [x] tests/quote.test.js updated
- [x] Commits 7f1263e (RED) and 75b0466 (GREEN) exist
- [x] api/quote.js does NOT contain JSON.parse(req.body)
- [x] api/quote.js contains QUOTES_URL = 'https://booking.guesty.com/api/reservations/quotes'
- [x] api/quote.js contains checkInDateLocalized and checkOutDateLocalized
- [x] api/quote.js contains data._id || data.quoteId
- [x] api/quote.js imports guestyFetch from '../lib/guesty.js'
