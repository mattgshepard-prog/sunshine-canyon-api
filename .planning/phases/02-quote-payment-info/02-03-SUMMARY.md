---
phase: 02-quote-payment-info
plan: "03"
subsystem: payment-info-api
tags: [payment, stripe, guesty, api, pay-01, pay-02]
dependency_graph:
  requires: [02-01]
  provides: [api/payment-info.js]
  affects: []
tech_stack:
  added: []
  patterns: [graceful-degradation, env-var-fallback, guesty-fetch-wrapper]
key_files:
  created: [api/payment-info.js]
  modified: [tests/payment-info.test.js]
decisions:
  - "Missing STRIPE_PUBLISHABLE_KEY returns HTTP 200 with null values (not 500) — locked decision PAY-02"
  - "Guesty providerAccountId mapped to stripeAccountId with defensive fallback to accountId"
metrics:
  duration: "~3m"
  completed: "2026-04-06T21:46:40Z"
  tasks_completed: 1
  files_changed: 2
---

# Phase 02 Plan 03: Payment Info Endpoint Summary

## One-liner

GET /api/payment-info proxying Guesty payment-provider with graceful null-fallback when STRIPE_PUBLISHABLE_KEY is absent.

## What Was Built

`api/payment-info.js` implements the GET endpoint that:
- Calls Guesty BEAPI at `https://booking.guesty.com/api/listings/{GUESTY_LISTING_ID}/payment-provider`
- Maps `providerAccountId` (or `accountId`) to `stripeAccountId`
- Reads `STRIPE_PUBLISHABLE_KEY` from env — returns it in the response when present
- When `STRIPE_PUBLISHABLE_KEY` is absent: returns HTTP 200 with `stripeAccountId: null` and `stripePublishableKey: null` — never HTTP 500 (PAY-02 locked decision)
- Always includes `fallbackUrl` in every response path (success, fallback, and error)
- CORS headers applied via shared `setCors` pattern matching `api/availability.js`

All 6 stubs in `tests/payment-info.test.js` replaced with real assertions and pass GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing tests for payment-info | 3c93ed1 | tests/payment-info.test.js, api/payment-info.js (stub) |
| 1 (GREEN) | Implement api/payment-info.js | 27891fb | api/payment-info.js |

## Verification

- `node --test tests/payment-info.test.js` — 6/6 pass GREEN
- `node --test tests/guesty.test.js tests/availability.test.js tests/payment-info.test.js` — 15/15 pass GREEN
- `api/payment-info.js` exports default async handler function
- `api/payment-info.js` imports guestyFetch from '../lib/guesty.js'
- `api/payment-info.js` contains `process.env.STRIPE_PUBLISHABLE_KEY || null`
- `api/payment-info.js` has `if (!stripePublishableKey)` branch returning 200 (not 500)
- `api/payment-info.js` maps `data.providerAccountId || data.accountId` to `stripeAccountId`
- `api/payment-info.js` includes `fallbackUrl: FALLBACK_URL` in both branches

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all 6 test stubs are now implemented and passing.

## Notes

- `tests/quote.test.js` fails (pre-existing) because `api/quote.js` is being built in parallel plan 02-02. This is expected and out of scope for this plan.

## Self-Check: PASSED

- `api/payment-info.js` exists: confirmed
- `tests/payment-info.test.js` updated: confirmed
- Commit 3c93ed1 (RED): confirmed
- Commit 27891fb (GREEN): confirmed
- All 6 payment-info tests GREEN: confirmed
- All Phase 1 tests (guesty, availability) GREEN: confirmed
