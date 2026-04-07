---
phase: 06-stripe-elements-e2e
plan: 01
subsystem: frontend
tags: [stripe, checkout, payment, confirmation]
dependency_graph:
  requires: [05-02]
  provides: [stripe-elements-step3, confirmation-step4]
  affects: [frontend/checkout-snippet.html, frontend/js/checkout.js, frontend/css/checkout.css]
tech_stack:
  added: [Stripe.js v3 CDN]
  patterns: [Stripe CardElement, PaymentMethod token flow, IIFE state machine extension]
key_files:
  modified:
    - frontend/checkout-snippet.html
    - frontend/js/checkout.js
    - frontend/css/checkout.css
decisions:
  - Stripe.js loaded from CDN before checkout.js to ensure global Stripe() available at init time
  - Policy checkbox wired inside initStripeElements() so it resets cleanly on each drawer open
  - Card element cleared on booking failure (single-use token) with checkbox reset for retry
  - renderStep4() uses UTC timezone for date formatting to avoid off-by-one from local timezone
  - goToStep() totalSteps logic: steps 1-2 show "of 2", steps 3-4 show "of 4" (progressive disclosure)
metrics:
  duration: 181s
  completed: 2026-04-07T12:26:47Z
  tasks_completed: 3
  files_modified: 3
---

# Phase 06 Plan 01: Stripe Elements + Confirmation Screen Summary

Stripe CardElement payment form (Step 3) and booking confirmation screen (Step 4) wired into the existing checkout IIFE, with policy checkbox gate, inline card error display, PaymentMethod token creation, /api/book POST, and confirmation code rendering.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update checkout-snippet.html — Step 3 form + Step 4 confirmation + Stripe.js tag | 43d51de | frontend/checkout-snippet.html |
| 2 | Add Step 3+4 CSS to checkout.css | 755d314 | frontend/css/checkout.css |
| 3 | Add initStripeElements(), submitPayment(), renderStep4() to checkout.js | f443cfa | frontend/js/checkout.js |

## What Was Built

**checkout-snippet.html:**
- Stripe.js CDN script tag added to install comment block (before checkout.js)
- Step 3: `#stripe-elements-form` with `#card-element`, `#card-errors`, `#co-policy-checkbox`, `#co-confirm-btn` (disabled), `#btn-back-to-step2`, `#co-charge-notice`
- Step 4: `#co-confirmation-code`, `#co-confirmation-email-notice`, `#co-confirmation-details`, `#co-confirmation-upsells`, `#co-confirmation-total`, `#btn-confirmation-done`

**checkout.css (appended, no existing rules modified):**
- `.co-charge-notice` — accent-bordered deposit notice
- `.co-card-label`, `.co-card-element` — Stripe card input container with focus/invalid states
- `.co-card-errors` — inline error display
- `.co-policy-row`, `.co-policy-checkbox`, `.co-policy-label` — cancellation policy checkbox row
- `.co-confirmation-*` — full confirmation screen: icon, heading, code block, details, upsells, total

**checkout.js (targeted edits to IIFE):**
- `state.stripeInstance`, `state.cardElement` added to module state
- `STEP_TITLES[4]` = 'Booking Confirmed!'
- `goToStep()` shows "Step N of 4" for steps 3 and 4
- `checkPaymentInfo()` else-branch calls `initStripeElements(key, accountId)`
- `initStripeElements()`: shows form, populates charge notice, mounts CardElement with brand styles, wires policy checkbox → confirm button disabled state
- `submitPayment()`: validates stripe ready, calls `createPaymentMethod`, POSTs to `/api/book`, handles errors with card.clear() + checkbox reset, calls `renderStep4()` on success
- `renderStep4()`: populates confirmation code, email notice, property/guest/date details, upsells list, grand total
- DOMContentLoaded wires `btn-back-to-step2` → goToStep(2), `co-confirm-btn` → submitPayment, `btn-confirmation-done` → closeDrawer

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All DOM elements are populated by JavaScript at runtime from real API response data.

## Self-Check: PASSED

- FOUND: frontend/checkout-snippet.html
- FOUND: frontend/js/checkout.js
- FOUND: frontend/css/checkout.css
- FOUND commit: 43d51de (checkout-snippet.html)
- FOUND commit: 755d314 (checkout.css)
- FOUND commit: f443cfa (checkout.js)
