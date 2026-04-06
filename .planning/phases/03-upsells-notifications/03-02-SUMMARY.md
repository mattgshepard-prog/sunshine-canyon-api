---
phase: 03-upsells-notifications
plan: 02
subsystem: upsells-catalog
tags: [upsells, catalog, api, tdd, green-phase]
dependency_graph:
  requires: [03-01]
  provides: [lib/upsells-config.js, api/upsells.js]
  affects: [03-03-PLAN.md, Phase-4-book-endpoint]
tech_stack:
  added: []
  patterns: [static-config-import, setCors-pattern, synchronous-handler]
key_files:
  created:
    - lib/upsells-config.js
    - api/upsells.js
  modified: []
decisions:
  - "UPSELLS array exported as named export (not default) so Phase 4 api/book.js can import alongside other config"
  - "Synchronous handler (not async) since no external calls — purely reads from static config"
  - "Airport shuttle names use 'Arrival'/'Departure' suffix to be clearer than 'to'/'from' while keeping IDs canonical"
metrics:
  duration: ~40s
  completed: 2026-04-06T22:22:07Z
  tasks_completed: 2
  files_created: 2
---

# Phase 03 Plan 02: Upsell Catalog Config + GET /api/upsells Summary

**One-liner:** Static upsell catalog in lib/upsells-config.js with 5 add-ons (early_checkin, late_checkout, airport_shuttle_to, airport_shuttle_from, stocked_fridge) served via synchronous GET /api/upsells handler — all 4 RED test stubs turned GREEN.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create lib/upsells-config.js — catalog array | ace5bd0 | lib/upsells-config.js |
| 2 | Create api/upsells.js + turn tests GREEN | e6f7bd3 | api/upsells.js |

## What Was Built

**lib/upsells-config.js** — Pure static config with no imports. Named export `UPSELLS` array of 5 objects. Each has id (string), name (string), price (positive integer USD), description (1-2 sentence string). IDs match spec exactly: early_checkin, late_checkout, airport_shuttle_to, airport_shuttle_from, stocked_fridge. Prices: 75, 50, 100, 100, 150.

**api/upsells.js** — Synchronous GET handler (no async needed — no external calls). Imports UPSELLS from lib/upsells-config.js. Returns `{ items: UPSELLS }` on GET with 200. OPTIONS preflight returns 200. Non-GET/OPTIONS returns 405. CORS applied via setCors() pattern matching api/availability.js exactly.

## Verification

- `node --test tests/upsells.test.js`: 4/4 tests pass (exit 0 — GREEN)
  - UPSELL-01: GET /api/upsells returns 200 with an items array — PASS
  - UPSELL-01: every item has id, name, price, and description fields — PASS
  - UPSELL-02: catalog contains all five expected IDs — PASS
  - OPTIONS preflight returns 200 — PASS

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — UPSELLS array is fully populated with real prices and descriptions. No placeholder data.

## Self-Check: PASSED

- lib/upsells-config.js: FOUND
- api/upsells.js: FOUND
- Commit ace5bd0: FOUND
- Commit e6f7bd3: FOUND
- node --test tests/upsells.test.js exit 0: CONFIRMED
