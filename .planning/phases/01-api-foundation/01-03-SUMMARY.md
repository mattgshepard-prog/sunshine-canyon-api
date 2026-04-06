---
phase: 01-api-foundation
plan: 03
subsystem: scripts
tags: [listing-discovery, guesty-beapi, cli-script]
dependency_graph:
  requires: [01-02]
  provides: [scripts/discover-listing.js]
  affects: []
tech_stack:
  added: []
  patterns: [guestyFetch wrapper reuse, ES module top-level await]
key_files:
  created: [scripts/discover-listing.js]
  modified: []
decisions:
  - "Relative import path ../lib/guesty.js from scripts/ to lib/ — no path aliases needed"
  - "Date window set 7-9 days out to avoid affecting results with near-term bookings"
metrics:
  duration: "1m"
  completed: "2026-04-06"
  tasks_completed: 1
  files_changed: 1
---

# Phase 01 Plan 03: Listing ID Discovery Script Summary

**One-liner:** CLI script using guestyFetch to call booking-api.guesty.com/v1/search and print listing IDs for GUESTY_LISTING_ID env var setup.

## What Was Built

`scripts/discover-listing.js` — a one-time CLI script that:
1. Authenticates with Guesty BEAPI (via `lib/guesty.js` — no inline token logic)
2. Calls `https://booking-api.guesty.com/v1/search` with a 7-9 day forward date window
3. Prints each result's `id` and `title` (using `l.id` per BEAPI convention, not `l._id`)
4. Provides a "Next step: Set GUESTY_LISTING_ID" prompt for the developer

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create scripts/discover-listing.js | 09f2f61 | scripts/discover-listing.js |

## Verification

All static checks passed:
- `booking-api.guesty.com/v1/search` present in URL construction
- `import { guestyFetch } from '../lib/guesty.js'` — no inline token logic
- `l.id` used (not `l._id`)
- `GUESTY_CLIENT_ID=` present only in comment (not in code — credentials go via lib/guesty.js)
- `Next step: Set GUESTY_LISTING_ID` guidance present in output

Integration verification (live API call with real credentials) will confirm LIST-01 and LIST-02.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — script is complete and functional. No placeholder data.

## Self-Check: PASSED

- [x] `scripts/discover-listing.js` exists
- [x] Commit 09f2f61 exists in git log
- [x] All acceptance criteria verified via grep and node static check
