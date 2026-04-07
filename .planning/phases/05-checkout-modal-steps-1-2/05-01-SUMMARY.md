---
phase: 05-checkout-modal-steps-1-2
plan: 01
subsystem: frontend
tags: [html, css, checkout, drawer, mobile]
dependency_graph:
  requires: []
  provides: [checkout-html-structure, checkout-css-styles]
  affects: [05-02-checkout-js]
tech_stack:
  added: []
  patterns: [CSS custom properties, slide-up drawer, sticky header, CSS-only spinner animation]
key_files:
  created:
    - frontend/checkout-snippet.html
    - frontend/css/checkout.css
  modified: []
decisions:
  - Single-column form at 479px breakpoint (mobile phones), two-column at 480px+
  - .checkout-actions.single class already applied in HTML for step-1 (single button)
  - CSS custom property naming prefix --co- to avoid collisions with existing site CSS
metrics:
  duration: 116s
  completed: "2026-04-07"
  tasks: 2
  files: 2
---

# Phase 05 Plan 01: Checkout Drawer HTML + CSS Summary

Checkout drawer shell and dark/earth-tone luxury styles establishing all DOM contracts for checkout.js (plan 05-02).

## What Was Built

### Task 1 — checkout-snippet.html

HTML snippet ready to paste before `</body>` in index.html. Includes paste instructions for `<head>` (CSS link) and before `</body>` (JS script).

Key IDs established for checkout.js to target:
- `checkout-overlay` — dimmed background overlay (click to close)
- `checkout-drawer` — root drawer shell
- `checkout-close-btn` — X button in header
- `checkout-step-indicator` — "Step N of 2" text (JS updates)
- `checkout-title` — heading (JS updates per step)
- `checkout-spinner` — loading spinner overlay (toggle `.is-visible`)
- `checkout-error` / `checkout-error-msg` — error banner + message
- `checkout-step-1` through `checkout-step-4` — step containers (JS toggles `.is-active`)
- `quote-nights-breakdown` / `quote-line-items` — JS populates quote rows
- `checkout-deposit-text` / `quote-remaining-balance` — deposit notice
- `checkout-guest-form` — form with firstName, lastName, email, phone fields
- `upsell-list` — JS populates from `/api/upsells`
- `upsell-total-row` / `upsell-total-amount` — live upsell total
- `checkout-payment-fallback` — shown when stripePublishableKey is null
- `stripe-card-element` — Stripe Elements mount point (Phase 6)

### Task 2 — checkout.css

10,743 bytes of plain CSS. No external dependencies.

CSS custom properties in `:root`:
- `--co-accent: #c9a96e` — gold accent
- `--co-drawer-bg: #242418` — drawer background
- `--co-surface: #2e2e20` — input/card surface
- `--co-text: #f0ead6` — primary text
- Full set of 13 design tokens

Key styles:
- `.checkout-drawer` slide-up via `transform: translateY(100%)` → `translateY(0)` with cubic-bezier
- `.checkout-drawer.is-open` triggers the slide
- `.checkout-overlay.is-visible` triggers the dim
- `.checkout-step.is-active` shows steps (display: none → block)
- `@keyframes co-spin` for loading spinner
- `.checkout-spinner-overlay.is-visible` shows spinner over drawer content
- Form inputs: `font-size: 16px` (prevents iOS auto-zoom), `min-height: 44px` (tap targets)
- `.checkout-btn-primary` / `.checkout-btn-secondary` button variants
- Responsive: 680px+ desktop centers panel at 540px wide; 479px- form goes single-column

## Deviations from Plan

None — plan executed exactly as written.

The `.checkout-actions.single` class was pre-applied in the HTML for step-1 (the plan described it as something JS adds, but since step-1 always has exactly one button, pre-applying is correct and harmless).

## Self-Check

Created files:
- frontend/checkout-snippet.html — FOUND
- frontend/css/checkout.css — FOUND

Commits:
- 89022d7 feat(05-01): checkout drawer HTML shell with all step containers
- 8baca01 feat(05-01): checkout drawer CSS with dark/earth-tone luxury styles
