# Sunshine Canyon Direct Booking

## What This Is

A native booking flow for the Sunshine Canyon Retreat website that replaces the external Guesty booking page. Guests select dates, see a full price breakdown with upsell add-ons, pay via Stripe Elements, and receive instant confirmation — all within a branded slide-up checkout drawer. The API layer (6 Vercel serverless endpoints) proxies to the Guesty Booking Engine API, while the frontend (GitHub Pages vanilla JS) handles the 4-step checkout experience.

## Core Value

Guests can book the property directly on the Sunshine Canyon site with a seamless, branded checkout experience — no redirect to Guesty's generic booking page.

## Requirements

### Validated

- ✓ iCal calendar proxy (`/api/calendar`) — existing
- ✓ Custom calendar date picker with availability display — existing (frontend)
- ✓ Price comparison widget (Airbnb vs VRBO vs Direct) — existing (frontend)
- ✓ OAuth2 token management for Guesty BEAPI — v1.0
- ✓ Listing ID discovery via Guesty search API — v1.0
- ✓ Real-time availability + pricing lookup (`/api/availability`) — v1.0
- ✓ Reservation quote creation with price breakdown (`/api/quote`) — v1.0
- ✓ Stripe payment provider info retrieval (`/api/payment-info`) — v1.0
- ✓ Instant book reservation confirmation (`/api/book`) — v1.0
- ✓ Upsell catalog served from API (`/api/upsells`) — v1.0
- ✓ Upsell notification email to Sebastian via Resend — v1.0
- ✓ Frontend checkout drawer (4-step flow) — v1.0
- ✓ Stripe Elements integration with connected account tokenization — v1.0
- ✓ Graceful fallback to Guesty booking page when Stripe key unavailable — v1.0
- ✓ Error handling with retry logic and Guesty fallback — v1.0
- ✓ Mobile-responsive checkout — v1.0

### Active

(None — v1.0 shipped all planned requirements)

### Out of Scope

- Stripe Customer creation — Guesty handles customer management
- Payment scheduling/split charges — configured in Guesty dashboard, not via API
- Upsell payment processing — upsells are display + notification only, not charged through this flow
- Real-time chat or guest messaging — not part of booking flow
- Admin dashboard — Sebastian uses Guesty dashboard directly
- OAuth/social login for guests — guests are one-time bookers, no accounts
- Apple Pay / Google Pay — deferred to v2 (requires Stripe domain verification)
- Add to Calendar .ics download — deferred to v2
- Guest-facing confirmation email — Guesty handles transactional email

## Context

- **Shipped v1.0** with 5,925 LOC JavaScript across 6 API endpoints + frontend checkout
- **Two repos:** API layer in `sunshine-canyon-api` (Vercel), frontend in `sunshine-canyon-retreat` (GitHub Pages)
- **Property:** 6186 Sunshine Canyon Drive, Boulder, CO 80302
- **Property manager:** Sebastian Hood (seb@sv.partners, Soundview Partners)
- **Tech stack:** Node.js 24.x serverless functions, vanilla JS frontend, Stripe.js CDN, Resend email
- **Dependencies:** 1 npm package (resend) — everything else uses Node.js builtins
- **45 automated tests** across 6 test files (node:test framework)
- **Pending setup:** Stripe publishable key from Sebastian, Resend domain verification, listing ID discovery with live credentials

## Constraints

- **Tech stack (API):** Node.js serverless functions on Vercel
- **Tech stack (Frontend):** Vanilla HTML/JS/CSS on GitHub Pages — no React, no build tools
- **Payment:** Stripe.js from CDN only (PCI compliance), tokenize client-side
- **Credentials:** Guesty client ID/secret as Vercel env vars only
- **CORS:** API allows requests from GitHub Pages domain + localhost
- **Booking type:** Instant book only — no inquiry/approval flow

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Instant book only (no inquiry) | Guest pays, reservation confirmed immediately — simpler UX | ✓ Good |
| Vanilla JS (no React) | Match existing site pattern, no build tools on GitHub Pages | ✓ Good |
| Stripe fallback to Guesty page | Stripe key not yet available, site must be bookable immediately | ✓ Good — site is functional while key is pending |
| Resend for email notifications | Modern API, free tier sufficient, simple Vercel integration | ✓ Good |
| Upsells display-only (not in Guesty) | BEAPI doesn't support custom fees on quotes, email Sebastian instead | ✓ Good |
| Split checkout into separate JS/CSS files | Checkout logic too substantial for inline in single HTML file | ✓ Good — checkout.js is 660+ lines |
| Module-level token caching (not Vercel KV) | Low traffic won't exhaust 3 renewals/24h; fluid compute preserves state | ✓ Good |
| node:test (no Jest/Vitest) | Zero npm test dependencies; 45 tests run in ~1.5s | ✓ Good |
| Single Card Element (not split) | Simpler integration, fewer DOM elements, good enough for single property | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-07 after v1.0 milestone*
