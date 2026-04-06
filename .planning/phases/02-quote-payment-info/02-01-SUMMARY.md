---
phase: 02-quote-payment-info
plan: 01
subsystem: tests
tags: [tdd, red-state, quote, payment-info, node-test]
dependency_graph:
  requires: []
  provides: [tests/quote.test.js, tests/payment-info.test.js]
  affects: [02-02-PLAN.md, 02-03-PLAN.md]
tech_stack:
  added: []
  patterns: [node:test RED stub pattern, assert.fail not-implemented stubs]
key_files:
  created:
    - tests/quote.test.js
    - tests/payment-info.test.js
  modified: []
decisions: []
metrics:
  duration: 60s
  completed: 2026-04-06
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 02 Plan 01: RED Test Stubs for Quote and Payment Info Summary

## One-liner

RED-state node:test stubs for api/quote.js (10 cases) and api/payment-info.js (6 cases) using assert.fail('not implemented') — Nyquist compliance before Wave 2 implementation.

## What Was Built

Two failing test files establish the verification contract for Phase 2 endpoints before any implementation begins. Both files fail due to missing api modules, which is the expected RED state.

**tests/quote.test.js** — 10 named `it()` stubs across 3 describe blocks:
- `Input Validation`: 6 stubs covering missing checkIn, missing checkOut, checkOut <= checkIn, guests=0, missing guest.email, missing guest.firstName
- `Successful Quote`: 3 stubs covering 200 response shape, ratePlans with days[] breakdown, expiresAt timestamp
- `Error Handling`: 1 stub covering Guesty 500 passthrough

**tests/payment-info.test.js** — 6 named `it()` stubs across 3 describe blocks:
- `Successful Payment Info`: 3 stubs covering providerType + stripeAccountId, stripePublishableKey env var, fallbackUrl always present
- `Missing Stripe Key Fallback`: 2 stubs covering graceful 200 response when STRIPE_PUBLISHABLE_KEY absent
- `Error Handling`: 1 stub covering Guesty 500 passthrough

## Verification Results

| Test | Exit Code | State |
|------|-----------|-------|
| quote.test.js | 1 | RED (module-not-found) |
| payment-info.test.js | 1 | RED (module-not-found) |
| guesty.test.js + availability.test.js | 0 | GREEN (unaffected) |

## Commits

| Task | Hash | Description |
|------|------|-------------|
| Task 1 | 30cce1c | test(02-01): add RED stub tests for api/quote.js |
| Task 2 | 3de2c9e | test(02-01): add RED stub tests for api/payment-info.js |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

Both test files are intentional stubs — their assert.fail('not implemented') bodies are the design intent of this plan. They will be wired in plans 02-02 (quote implementation) and 02-03 (payment-info implementation).

## Self-Check: PASSED
