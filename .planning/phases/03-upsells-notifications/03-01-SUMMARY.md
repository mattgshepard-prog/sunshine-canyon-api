---
phase: 03-upsells-notifications
plan: 01
subsystem: tests
tags: [tdd, red-phase, upsells, notifications, resend]
dependency_graph:
  requires: []
  provides: [tests/upsells.test.js, tests/notify.test.js]
  affects: [03-02-PLAN.md, 03-03-PLAN.md]
tech_stack:
  added: []
  patterns: [node:test built-in, mock.method(globalThis, fetch), env-var save/restore]
key_files:
  created:
    - tests/upsells.test.js
    - tests/notify.test.js
  modified: []
decisions:
  - "Mock fetch via mock.method(globalThis, 'fetch') consistent with Phase 1/2 pattern — Resend SDK uses fetch internally"
  - "upsells tests require no fetch mocking — endpoint serves static config, no external calls"
metrics:
  duration: ~2m
  completed: 2026-04-06T22:19:46Z
  tasks_completed: 2
  files_created: 2
---

# Phase 03 Plan 01: RED Test Stubs for Upsells + Notify Summary

**One-liner:** RED test stubs for `api/upsells.js` (catalog shape + 5 IDs) and `lib/notify.js` (fire-and-forget Resend notification, void return) using node:test built-in.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Write RED test stubs for api/upsells.js | 6118c65 | tests/upsells.test.js |
| 2 | Write RED test stubs for lib/notify.js | 36d3c1e | tests/notify.test.js |

## What Was Built

**tests/upsells.test.js** — 4 test cases covering:
- UPSELL-01: GET /api/upsells returns 200 with items array
- UPSELL-01: Every item has id, name, price (number), and description fields
- UPSELL-02: Catalog contains all 5 expected IDs (early_checkin, late_checkout, airport_shuttle_to, airport_shuttle_from, stocked_fridge)
- CORS: OPTIONS preflight returns 200

**tests/notify.test.js** — 3 test cases covering:
- EMAIL-01: Resolves without throwing when RESEND_API_KEY is set and Resend returns 200
- EMAIL-02: Does not throw when RESEND_API_KEY is missing (fire-and-forget, never blocks)
- EMAIL-01: Returns undefined (void — not a value-bearing promise)

Both files exit non-zero (RED state) until their respective implementations exist.

## Verification

- `node --test tests/upsells.test.js` exits 1 (RED — ERR_MODULE_NOT_FOUND for api/upsells.js)
- `node --test tests/notify.test.js` exits 1 (RED — ERR_MODULE_NOT_FOUND for lib/notify.js)
- All UPSELL-01, UPSELL-02, EMAIL-01, EMAIL-02 requirement tags present in test files
- No production files created in this plan

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- tests/upsells.test.js: FOUND
- tests/notify.test.js: FOUND
- Commit 6118c65: FOUND
- Commit 36d3c1e: FOUND
- Both tests exit non-zero: CONFIRMED
