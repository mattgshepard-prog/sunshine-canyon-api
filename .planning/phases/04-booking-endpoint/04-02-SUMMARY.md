---
phase: 04-booking-endpoint
plan: 02
subsystem: booking-endpoint
tags: [booking, guesty, instant-book, upsells, notifications, fire-and-forget]
dependency_graph:
  requires: [04-01, lib/guesty.js, lib/notify.js, lib/upsells-config.js]
  provides: [api/book.js, POST /api/book]
  affects: [frontend checkout confirmation step]
tech_stack:
  added: []
  patterns:
    - fire-and-forget notification via sendUpsellNotification (no await)
    - Guesty BEAPI instant-book via guestyFetch POST /quotes/{quoteId}/instant
    - Resend fetch-call counting for notification spy testing
key_files:
  created:
    - api/book.js
  modified:
    - tests/book.test.js
decisions:
  - "Notification spy uses Resend fetch-call counting (resend.com URL detection) rather than mock.method on ES module named export — avoids live binding issue"
  - "Fire-and-forget wait: await new Promise(r => setTimeout(r, 50)) BEFORE mock.restoreAll() to catch Resend SDK fetch call within the mock window"
  - "Token caching between tests is accepted behavior — tests check resendCalled boolean flag, not raw fetch call counts"
metrics:
  duration: 127s
  completed: 2026-04-06
  tasks_completed: 2
  files_created: 1
  files_modified: 1
requirements:
  - BOOK-01
  - BOOK-02
  - BOOK-03
---

# Phase 04 Plan 02: Booking Endpoint Implementation Summary

**One-liner:** POST /api/book instant-book handler with Guesty BEAPI integration, server-side upsell enrichment, and fire-and-forget notification email.

## What Was Built

### api/book.js (90 lines)

The only write endpoint in the API layer. Validates inbound POST body, calls Guesty BEAPI instant-book, maps error codes, enriches upsell selections server-side, and fires a notification email to Sebastian when add-ons are present.

Key implementation details:
- `setCors()` copied verbatim from `api/quote.js` — consistent CORS across all POST endpoints
- Validation order: quoteId → ccToken → pm_ prefix check → checkIn/checkOut → guest fields → upsell IDs
- Upsell enrichment uses `UPSELLS.find()` to look up name and price from catalog (server-authoritative, not client-supplied prices)
- Guesty request body only includes `ratePlanId` when truthy (conditional inclusion prevents BEAPI 400)
- Error mapping: 410 → QUOTE_EXPIRED, 402/422 → PAYMENT_DECLINED, all other non-ok → BOOKING_FAILED
- `sendUpsellNotification()` called without `await` — fire-and-forget pattern, notification failure never fails the booking
- Success response: `{ success: true, reservationId, confirmationCode, status: 'confirmed', upsells: [...ids], upsellTotal }`

### tests/book.test.js (220 lines)

Replaced all 13 `assert.fail('RED — not yet implemented')` stubs with real handler calls and assertions. Full suite of 45 tests passes with zero regressions.

Test coverage:
- 6 input validation tests (quoteId, ccToken, pm_ prefix, guest fields, unknown upsell IDs)
- 2 successful booking tests (200 response shape, upsellTotal calculation)
- 3 error mapping tests (410, 422→402, 500)
- 2 notification spy tests (present/absent upsells)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Notification spy approach adjusted for ES module live binding**
- **Found during:** Task 2 (notification spy tests)
- **Issue:** First attempt used fetch call count (>= 3 including token call), but token was cached from earlier tests, making counts unpredictable. Also, `mock.restoreAll()` was called before the fire-and-forget Resend fetch had a chance to execute.
- **Fix:** (1) Switched from counting total fetches to a boolean `resendCalled` flag detected by URL pattern `url.includes('resend.com')`. (2) Moved `mock.restoreAll()` to AFTER a 50ms setTimeout to ensure the Resend SDK's async fetch fires while the mock is still active.
- **Files modified:** tests/book.test.js
- **Commit:** 1b397f1

## Known Stubs

None — all response data is wired from real Guesty mock responses. `upsellTotal` is computed server-side from `UPSELLS` catalog prices. No hardcoded empty values flow to UI rendering.

## Verification Results

```
node --test tests/book.test.js
  tests 13 | pass 13 | fail 0

node --test tests/*.test.js
  tests 45 | pass 45 | fail 0
```

Spot-checks on api/book.js:
- `guestyFetch` present (import + call)
- `sendUpsellNotification` present without `await` prefix on fire-and-forget call
- `UPSELLS` present (import + map + find)
- All three error codes present: QUOTE_EXPIRED, PAYMENT_DECLINED, BOOKING_FAILED
- `pm_` prefix check present
- `fallbackUrl` in all error responses

## Self-Check: PASSED
