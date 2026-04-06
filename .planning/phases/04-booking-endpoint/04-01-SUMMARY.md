---
phase: 04-booking-endpoint
plan: 01
subsystem: booking
tags: [tdd, red-state, testing, book-endpoint]
dependency_graph:
  requires: []
  provides: [tests/book.test.js]
  affects: [04-02-PLAN.md]
tech_stack:
  added: []
  patterns: [node:test RED stub pattern, mock.method(globalThis fetch)]
key_files:
  created: [tests/book.test.js]
  modified: []
decisions:
  - "RED state via ERR_MODULE_NOT_FOUND (api/book.js missing) — both load failure and assert.fail() are valid RED indicators per plan"
metrics:
  duration: 39s
  completed: "2026-04-06T22:49:33Z"
  tasks_completed: 1
  files_changed: 1
---

# Phase 04 Plan 01: Book Endpoint RED Test Stubs Summary

## One-liner

RED test scaffold for POST /api/book with 13 failing stubs across 4 describe blocks covering input validation, booking success, error mapping, and upsell processing.

## What Was Built

Created `tests/book.test.js` as the Wave 0 anchor for Phase 4. The file establishes the full behavioral contract for `api/book.js` before any implementation exists. All 13 test cases fail with `ERR_MODULE_NOT_FOUND` (api/book.js not yet created), confirming RED state. `node --test tests/book.test.js` exits with code 1.

### Test structure (13 stubs, 4 describe blocks):

**Input Validation (6 tests)**
- BOOK-01: missing quoteId returns 400 with fallbackUrl
- BOOK-01: missing ccToken returns 400 with fallbackUrl
- BOOK-01: ccToken without pm_ prefix returns 400 with fallbackUrl
- BOOK-01: missing guest.firstName returns 400 with fallbackUrl
- BOOK-01: missing guest.email returns 400 with fallbackUrl
- BOOK-03: unknown upsell ID returns 400 with fallbackUrl

**Successful Booking (2 tests)**
- BOOK-01, BOOK-02: valid POST body returns 200 with reservationId, confirmationCode, status confirmed
- BOOK-02: success response includes upsells array and upsellTotal

**Error Mapping (3 tests)**
- BOOK-01: Guesty 410 returns 410 with code QUOTE_EXPIRED and fallbackUrl
- BOOK-01: Guesty 422 returns 402 with code PAYMENT_DECLINED and fallbackUrl
- BOOK-01: Guesty 500 returns 500 with code BOOKING_FAILED and fallbackUrl

**Upsell Processing (2 tests)**
- BOOK-03: upsells present — sendUpsellNotification is called with correct params
- BOOK-03: no upsells — sendUpsellNotification is not called

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write RED test stubs for api/book.js | 797484a | tests/book.test.js |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — the entire file is intentionally RED. All test bodies contain `assert.fail('RED — not yet implemented')`. This is the expected state for plan 04-01. Plan 04-02 will implement `api/book.js` to turn these GREEN.

## Self-Check: PASSED

- tests/book.test.js: FOUND
- Commit 797484a: FOUND
- node --test tests/book.test.js exits non-zero: CONFIRMED (exit code 1)
- 13 it() blocks: CONFIRMED
- 4 describe() blocks: CONFIRMED
