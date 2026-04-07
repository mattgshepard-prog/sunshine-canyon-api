---
phase: 05-checkout-modal-steps-1-2
plan: 02
subsystem: frontend
tags: [javascript, checkout, state-machine, vanilla-js, upsells, form-validation, stripe-fallback]
dependency_graph:
  requires: [checkout-html-structure, checkout-css-styles]
  provides: [checkout-js-state-machine, window.checkoutOpen]
  affects: [06-stripe-elements]
tech_stack:
  added: []
  patterns: [IIFE state machine, fetch API, Intl.DateTimeFormat, DOM manipulation, event delegation]
key_files:
  created:
    - frontend/js/checkout.js
  modified: []
decisions:
  - Complete IIFE written atomically with all Task 1 and Task 2 functions in a single commit (both tasks targeted same file)
  - spinnerDisabledButtons Set tracks which buttons spinner disabled to avoid re-enabling btn-continue-to-step2 prematurely
  - upsell failure is non-blocking — empty upsellItems hides the section, booking can continue
  - escapeHtml helper added to sanitize upsell name/description/id in generated HTML (Rule 2 - security)
  - Book Direct button wiring uses window.selectedCheckIn/selectedCheckOut from existing site date picker with alert fallback
metrics:
  duration: 7m
  completed: "2026-04-06"
  tasks: 2
  files: 1
---

# Phase 05 Plan 02: Checkout.js State Machine Summary

Self-contained IIFE state machine driving the checkout drawer: open/close, quote fetch + render, form validation, upsells, payment-info check, and Stripe fallback routing.

## What Was Built

### Task 1 — State machine skeleton, open/close, quote rendering

`frontend/js/checkout.js` (519 lines) — plain vanilla JS IIFE, no imports, no build tools.

**Configuration:**
- `API_BASE = 'https://sunshine-canyon-api.vercel.app'`
- `FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96'`

**State object:** checkIn, checkOut, guests, quote, selectedRatePlan, guest, selectedUpsells, upsellItems, paymentInfo, currentStep (0=closed)

**Core functions:**
- `openDrawer()` — adds `is-open`/`is-visible` classes, sets `document.body.style.overflow = 'hidden'`, aria-hidden false
- `closeDrawer()` — removes classes, clears overflow, then calls `resetDrawer()` after 350ms transition
- `showSpinner(msg)` — shows `.checkout-spinner-overlay.is-visible`, disables all `.checkout-btn` elements, tracks them in `spinnerDisabledButtons` Set
- `hideSpinner()` — removes visible class, re-enables only spinner-disabled buttons (never re-enables `btn-continue-to-step2`)
- `goToStep(n)` — hides all `.checkout-step` elements, shows target step, updates step indicator and title
- `fetchQuote()` — POST `/api/quote` with placeholder guest, sets `state.quote` and `state.selectedRatePlan` on success
- `renderStep1()` — builds nightly breakdown rows and line items using `Intl.DateTimeFormat` for dates, sets remaining balance span
- `window.checkoutOpen({ checkIn, checkOut, guests })` — validates params, sets state, opens drawer, fetches quote

**DOMContentLoaded bindings:** checkout-close-btn, checkout-overlay click, escape key, btn-continue-to-step2, btn-back-to-step1, checkout-guest-form submit, and all four blur validators.

### Task 2 — Step 2 form validation, upsells, payment-info, fallback

All Step 2 functions appended in same file:

- `enterStep2()` — calls `fetchUpsells()` on first entry, else `renderUpsells()` from cache
- `fetchUpsells()` — GET `/api/upsells`, non-blocking failure (empty array, section hidden)
- `renderUpsells()` — generates `.upsell-item` HTML with checkbox per upsell, attaches change listeners
- `toggleUpsell(id, checked)` — updates `state.selectedUpsells`, toggles `.is-selected`, calls `updateUpsellTotal()`
- `updateUpsellTotal()` — sums selected upsell prices, shows/hides `upsell-total-row`
- `validateField(fieldId, errorId, validatorFn)` — adds/removes `has-error` class and hidden error span
- `validateRequired(val)`, `validateEmail(val)`, `validatePhone(val)` — pure validator functions
- `validateGuestForm()` — runs all four field validators, returns true only if all pass
- `handleGuestFormSubmit(event)` — prevents default, validates, stores guest state, shows spinner, calls `checkPaymentInfo()`
- `checkPaymentInfo()` — GET `/api/payment-info`, advances to step 3, shows `checkout-payment-fallback` when `stripePublishableKey === null`

**Book Direct wiring:** `.book-direct-btn, [data-checkout-open]` selectors read `window.selectedCheckIn`/`window.selectedCheckOut`/`window.selectedGuests` from the existing site date picker. Alert shown if dates not set.

## Deviations from Plan

### Auto-added functionality

**1. [Rule 2 - Security] Added escapeHtml helper for upsell HTML generation**
- **Found during:** Task 2 renderUpsells implementation
- **Issue:** Upsell item name, description, and id are rendered directly into innerHTML — without escaping, a malicious API response could inject HTML/JS
- **Fix:** Added `escapeHtml(str)` function that escapes &, <, >, ", ' characters. Applied to all upsell fields in `renderUpsells()`
- **Files modified:** frontend/js/checkout.js
- **Commit:** e2fe7e4

**2. [Rule 2 - Missing functionality] `hideSpinner` re-enables only spinner-tracked buttons**
- **Found during:** Task 1 spinner implementation
- **Issue:** Plan spec required tracking which buttons the spinner disabled using a local Set, so `btn-continue-to-step2` is never re-enabled by spinner (only by quote success)
- **Fix:** `spinnerDisabledButtons` Set at module level tracks buttons by id; `hideSpinner` skips re-enabling `btn-continue-to-step2`
- **Files modified:** frontend/js/checkout.js
- **Commit:** e2fe7e4

## Known Stubs

None. All functions are fully wired. Step 3 Stripe Elements mount is intentionally left as a comment "Phase 6 will initialize Stripe Elements here" — this is the correct state for Phase 5. The fallback path (stripePublishableKey === null) is fully functional.

## Self-Check

Created files:
- frontend/js/checkout.js — FOUND

Commits:
- e2fe7e4 feat(05-02): checkout.js state machine — open/close, spinner, quote rendering, step nav

## Self-Check: PASSED
