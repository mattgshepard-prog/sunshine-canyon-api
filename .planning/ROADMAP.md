# Roadmap: Sunshine Canyon Direct Booking

## Overview

Six phases build the checkout system from the ground up. The API layer is completed first — token management, availability, quotes, payment info, upsells, and the booking endpoint — then the frontend checkout modal is wired up against real endpoints. Stripe Elements is last because the publishable key is pending from Sebastian; the fallback redirect keeps the site bookable throughout.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: API Foundation** - Token management, listing discovery, availability endpoint, and CORS/infrastructure wiring (completed 2026-04-06)
- [x] **Phase 2: Quote + Payment Info** - Price breakdown quote endpoint and Stripe account retrieval (unblocks all frontend work) (completed 2026-04-06)
- [x] **Phase 3: Upsells + Notifications** - Upsell catalog endpoint and Resend email notification to Sebastian (completed 2026-04-06)
- [ ] **Phase 4: Booking Endpoint** - Instant reservation confirmation via Guesty BEAPI
- [ ] **Phase 5: Checkout Modal — Steps 1 & 2** - Branded modal shell, quote display, guest form, upsell add-ons, fallback path
- [ ] **Phase 6: Stripe Elements + End-to-End** - Card tokenization, payment step, confirmation screen, full booking test

## Phase Details

### Phase 1: API Foundation
**Goal**: The Guesty BEAPI token lifecycle is working, the listing ID is confirmed, and a real availability request round-trips through the serverless function — proving CORS, credentials, and BEAPI scope separation are correct before any write operations
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, LIST-01, LIST-02, AVAIL-01, AVAIL-02, INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. A call to `/api/availability` with valid check-in/check-out dates returns availability status and nightly rate from Guesty
  2. The same call made with an expired token automatically retries with a fresh token and succeeds (401 retry)
  3. The BEAPI token is reused across warm Vercel invocations (module-level cache) and does not trigger a new OAuth request within its valid window
  4. The GitHub Pages frontend domain receives a valid CORS response from all API routes
  5. Guesty credentials exist only in Vercel environment variables and are never present in any API response
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Test scaffolds + package.json ES module config (Wave 0)
- [x] 01-02-PLAN.md — lib/guesty.js BEAPI token cache and guestyFetch wrapper
- [x] 01-03-PLAN.md — scripts/discover-listing.js one-time listing ID discovery
- [x] 01-04-PLAN.md — api/availability.js endpoint + vercel.json CORS update

### Phase 2: Quote + Payment Info
**Goal**: The frontend can fetch a full line-item price quote and the Stripe connected account ID in a single phase — everything needed to initialize Stripe.js and display a complete price breakdown
**Depends on**: Phase 1
**Requirements**: QUOTE-01, QUOTE-02, QUOTE-03, PAY-01, PAY-02
**Success Criteria** (what must be TRUE):
  1. A call to `/api/quote` returns a quote with nightly rate breakdown, cleaning fee, taxes, total, and expiry timestamp
  2. A call to `/api/payment-info` returns the Stripe connected account ID (`acct_xxx`) retrieved from Guesty and the publishable key from the environment variable
  3. When `STRIPE_PUBLISHABLE_KEY` is absent from the environment, `/api/payment-info` returns a fallback URL pointing to the Guesty booking page instead of an error
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — RED test stubs for quote and payment-info (Wave 1)
- [x] 02-02-PLAN.md — api/quote.js implementation + GREEN tests (Wave 2)
- [x] 02-03-PLAN.md — api/payment-info.js implementation + GREEN tests (Wave 2)

### Phase 3: Upsells + Notifications
**Goal**: The upsell catalog is served from the API and Sebastian receives an email with itemized upsell selections whenever a booking includes them — both independently testable before the booking endpoint exists
**Depends on**: Phase 1
**Requirements**: UPSELL-01, UPSELL-02, EMAIL-01, EMAIL-02
**Success Criteria** (what must be TRUE):
  1. A call to `/api/upsells` returns the catalog with id, name, price, and description for each add-on
  2. Upsell prices can be updated in `lib/upsells-config.js` without redeploying the frontend
  3. When a test booking fires the notification path, Sebastian receives an email at seb@sv.partners via Resend containing guest name, dates, confirmation code, and itemized upsell selections with prices
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — RED test stubs for upsells endpoint and notify module (Wave 1)
- [x] 03-02-PLAN.md — lib/upsells-config.js + api/upsells.js + GREEN tests (Wave 2)
- [x] 03-03-PLAN.md — lib/notify.js + resend install + GREEN tests (Wave 2)

### Phase 4: Booking Endpoint
**Goal**: A guest can confirm an instant-book reservation through `/api/book`, which charges via the Guesty BEAPI using the Stripe PaymentMethod token, notifies Sebastian if upsells were selected, and returns a confirmation code
**Depends on**: Phase 2, Phase 3
**Requirements**: BOOK-01, BOOK-02, BOOK-03
**Success Criteria** (what must be TRUE):
  1. A call to `/api/book` with a valid quoteId, guest details, and `pm_xxx` token creates a confirmed reservation in the Guesty dashboard
  2. The response includes a confirmation code, reservation ID, and booking status that the frontend can display
  3. When the booking request includes upsell selections, Sebastian receives the Resend notification email within the same request lifecycle
  4. A failed booking attempt (invalid token, expired quote) returns a structured error the frontend can present without a generic crash
**Plans**: TBD

### Phase 5: Checkout Modal — Steps 1 & 2
**Goal**: Guests can open a branded checkout modal from the existing site, review a full price breakdown, enter their details, and select upsell add-ons — all without a Stripe key, with the fallback redirect active throughout
**Depends on**: Phase 2, Phase 3
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-11, UI-12, UI-13, UI-14
**Success Criteria** (what must be TRUE):
  1. Clicking "Book Direct" on the existing site opens the checkout modal without a page reload
  2. Step 1 displays a complete price breakdown (nightly rates, cleaning, taxes, total), the $50 deposit schedule, and cancellation policy text pulled from the live `/api/quote` response
  3. Step 2 presents a guest details form (first name, last name, email, phone) with validation that prevents advancing with missing or malformed input
  4. Step 2 displays upsell add-ons with checkboxes and a running total that updates as items are selected or deselected
  5. When the Stripe publishable key is absent, the modal presents a clear fallback that redirects to the Guesty booking page rather than showing a broken payment form
  6. The modal is fully usable on iPhone (large tap targets, no scroll-off, readable text) and API call states show loading spinners with disabled buttons during in-flight requests
**Plans**: TBD
**UI hint**: yes

### Phase 6: Stripe Elements + End-to-End
**Goal**: Guests can enter card details in a PCI-compliant Stripe Elements form, tokenize against the connected account, confirm their booking, and land on a confirmation screen with their booking code — validated end-to-end in the Guesty dashboard
**Depends on**: Phase 4, Phase 5
**Requirements**: UI-07, UI-08, UI-09, UI-10
**Success Criteria** (what must be TRUE):
  1. Step 3 renders a Stripe Elements card form (Number, Expiry, CVC) initialized with the connected account ID from `/api/payment-info`
  2. Clicking "Confirm Booking" creates a `pm_xxx` PaymentMethod token scoped to the correct Stripe connected account and passes it to `/api/book`
  3. The cancellation policy agreement checkbox is required before the confirm button activates
  4. Step 4 displays the booking confirmation code, reservation summary, and upsell selections from the API response
  5. A full end-to-end test booking appears as a confirmed reservation in the Guesty dashboard with the correct guest details
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. API Foundation | 4/4 | Complete   | 2026-04-06 |
| 2. Quote + Payment Info | 3/3 | Complete   | 2026-04-06 |
| 3. Upsells + Notifications | 3/3 | Complete   | 2026-04-06 |
| 4. Booking Endpoint | 0/TBD | Not started | - |
| 5. Checkout Modal — Steps 1 & 2 | 0/TBD | Not started | - |
| 6. Stripe Elements + End-to-End | 0/TBD | Not started | - |
