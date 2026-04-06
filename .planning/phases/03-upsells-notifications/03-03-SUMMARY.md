---
phase: 03-upsells-notifications
plan: 03
subsystem: notifications
tags: [resend, email, fire-and-forget, EMAIL-01, EMAIL-02]
dependency_graph:
  requires: [03-01-PLAN.md]
  provides: [lib/notify.js]
  affects: [api/book.js (Phase 4)]
tech_stack:
  added: [resend npm package]
  patterns: [fire-and-forget async, try/catch swallowing, env-var guard, node:test GREEN]
key_files:
  created:
    - lib/notify.js
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Resend SDK uses fetch internally — mock.method(globalThis, fetch) sufficient for test isolation (consistent with Phase 1/2 pattern)"
  - "From address set to notifications@bookings.sunshinecanyon.com per CONTEXT.md discretion"
  - "Email subject: 'New Booking with Add-ons — [confirmationCode]'"
metrics:
  duration: ~1m
  completed: 2026-04-06T22:22:16Z
  tasks_completed: 2
  files_created: 1
---

# Phase 03 Plan 03: Resend Notify Module Summary

**One-liner:** Fire-and-forget Resend email module `lib/notify.js` with env-var guard, itemized upsell body, and void return — turning RED notify tests GREEN.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Install resend npm package | d743997 | package.json, package-lock.json |
| 2 | Create lib/notify.js + turn tests GREEN | f7f932a | lib/notify.js |

## What Was Built

**lib/notify.js** — Fire-and-forget upsell notification email module:
- Exports `sendUpsellNotification({ guest, checkIn, checkOut, confirmationCode, upsells })`
- Returns `undefined` (void) always — never throws, never rejects
- Guard: if `RESEND_API_KEY` missing → `console.error` + early return (no throw)
- Entire send logic wrapped in `try/catch` — network/SDK errors swallowed, logged via `console.error`
- Recipient hardcoded to `seb@sv.partners`
- From: `Sunshine Canyon Bookings <notifications@bookings.sunshinecanyon.com>`
- Subject: `New Booking with Add-ons — {confirmationCode}`
- Plain text body: guest full name + email, check-in/out dates, confirmation code, itemized add-on list with prices, total add-on cost

**package.json** — Added `resend` as first npm dependency (v3+).

## Verification

- `node --test tests/notify.test.js` exits 0 — all 3 tests GREEN
  - EMAIL-01: resolves without throwing when RESEND_API_KEY set — PASS
  - EMAIL-02: does not throw when RESEND_API_KEY missing — PASS
  - EMAIL-01: returns undefined (void) — PASS
- `import('./lib/notify.js')` resolves with `sendUpsellNotification` as a function
- All acceptance criteria met (grep checks for export, recipient, env var, try, early return)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- lib/notify.js: FOUND
- package.json contains "resend": CONFIRMED
- Commit d743997: FOUND
- Commit f7f932a: FOUND
- All 3 tests GREEN: CONFIRMED
