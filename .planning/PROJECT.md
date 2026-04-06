# Sunshine Canyon Direct Booking

## What This Is

A native booking flow for the Sunshine Canyon Retreat website that replaces the external Guesty booking page. Guests select dates, see pricing, enter details, choose upsell add-ons, pay via Stripe, and receive confirmation — all without leaving the branded site. The API layer (Vercel serverless functions) proxies to the Guesty Booking Engine API, while the frontend (GitHub Pages) handles the multi-step checkout experience.

## Core Value

Guests can book the property directly on the Sunshine Canyon site with a seamless, branded checkout experience — no redirect to Guesty's generic booking page.

## Requirements

### Validated

- ✓ iCal calendar proxy (`/api/calendar`) — existing
- ✓ Custom calendar date picker with availability display — existing (frontend)
- ✓ Price comparison widget (Airbnb vs VRBO vs Direct) — existing (frontend)

### Active

- [ ] OAuth2 token management for Guesty BEAPI (server-side, cached)
- [ ] Listing ID discovery via Guesty search API
- [ ] Real-time availability + pricing lookup (`/api/availability`)
- [ ] Reservation quote creation with price breakdown (`/api/quote`)
- [ ] Stripe payment provider info retrieval (`/api/payment-info`)
- [ ] Instant book reservation confirmation (`/api/book`)
- [ ] Upsell catalog served from API (`/api/upsells`)
- [ ] Upsell notification email to Sebastian via Resend
- [ ] Frontend checkout modal/drawer (4-step flow: Quote → Details + Upsells → Payment → Confirmation)
- [ ] Stripe Elements integration with connected account tokenization
- [ ] Graceful fallback to Guesty booking page when Stripe key unavailable
- [ ] Error handling with retry logic and Guesty fallback
- [ ] Mobile-responsive checkout (Sebastian tests on iPhone)

### Out of Scope

- Stripe Customer creation — Guesty handles customer management
- Payment scheduling/split charges — configured in Guesty dashboard, not via API
- Upsell payment processing — upsells are display + notification only, not charged through this flow
- Real-time chat or guest messaging — not part of booking flow
- Admin dashboard — Sebastian uses Guesty dashboard directly
- OAuth/social login for guests — guests are one-time bookers, no accounts

## Context

- **Two repos:** API layer in `sunshine-canyon-api` (Vercel), frontend in `sunshine-canyon-retreat` (GitHub Pages)
- **Property:** 6186 Sunshine Canyon Drive, Boulder, CO 80302
- **Property manager:** Sebastian Hood (seb@sv.partners, Soundview Partners)
- **Guesty BEAPI:** Booking Engine API at `booking-api.guesty.com/v1` with OAuth2 auth at `booking.guesty.com/oauth2/token`
- **Stripe:** Connected account model — publishable key pending from Sebastian, build with graceful fallback
- **Email:** Resend for notifying Sebastian of upsell selections per booking
- **Existing site:** Single `index.html` with inline CSS/JS on GitHub Pages. Checkout will be split into separate files (`checkout.js`, `stripe-setup.js`, `checkout.css`)
- **Rate limits:** Guesty BEAPI — 5 req/s, 275 req/min, 16,500 req/hr
- **Token limits:** OAuth token lasts 24h, max 3 renewals per 24h per application
- **Deposit model:** $50 deposit today, remainder charged 14 days before check-in (Guesty-managed)
- **Cancellation policy:** Free cancellation 14d+, 50% refund 7-14d, non-refundable after

## Constraints

- **Tech stack (API):** Node.js serverless functions on Vercel — must match existing `/api/calendar` pattern
- **Tech stack (Frontend):** Vanilla HTML/JS/CSS on GitHub Pages — no React, no build tools
- **Payment:** Stripe.js from CDN only (PCI compliance), tokenize client-side, never touch card data server-side
- **Credentials:** Guesty client ID/secret as Vercel env vars only, never in frontend
- **CORS:** API must allow requests from GitHub Pages domain
- **Stripe key:** Pending from Sebastian — frontend must work without it (fallback to Guesty page)
- **Booking type:** Instant book only — no inquiry/approval flow

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Instant book only (no inquiry) | Guest pays, reservation confirmed immediately — simpler UX | — Pending |
| Vanilla JS (no React) | Match existing site pattern, no build tools on GitHub Pages | — Pending |
| Stripe fallback to Guesty page | Stripe key not yet available, site must be bookable immediately | — Pending |
| Resend for email notifications | Modern API, free tier sufficient, simple Vercel integration | — Pending |
| Upsells display-only (not in Guesty) | BEAPI doesn't support custom fees on quotes, email Sebastian instead | — Pending |
| Split checkout into separate JS/CSS files | Checkout logic too substantial for inline in single HTML file | — Pending |
| $50 deposit + remainder at 14 days | Payment scheduling handled by Guesty dashboard, we just display policy | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after initialization*
