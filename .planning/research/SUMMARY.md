# Project Research Summary

**Project:** Sunshine Canyon Direct Booking — Guesty BEAPI + Stripe Checkout
**Domain:** Vacation rental direct booking checkout (single-property, serverless API proxy)
**Researched:** 2026-04-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project replaces a Guesty-hosted external booking page with a branded checkout modal embedded in the existing Sunshine Canyon GitHub Pages site. The API layer (already started as `api/calendar.js` on Vercel) is extended with five new serverless functions that proxy the Guesty Booking Engine API (BEAPI), not the Open API already in use. The canonical booking flow is: get a Guesty quote, tokenize the card client-side via Stripe.js on the connected Stripe account, then pass that `pm_xxx` token to Guesty's instant-book endpoint. Guesty executes the charge. The server never touches raw card data and never interacts with Stripe directly.

The recommended approach is deliberately minimal: Node.js 22 with native fetch, Vercel serverless functions, the Stripe.js CDN Card Element, and Resend for upsell notification emails. No npm packages beyond Resend are needed. The 4-step checkout (Quote Review → Guest Details + Upsells → Payment → Confirmation) is self-contained as a modal/drawer in vanilla JS, consistent with the existing site's zero-framework constraint. A fallback redirect to the Guesty booking page must be built first and activated any time the Stripe publishable key is absent or an unrecoverable API error occurs.

The dominant risks are integration-specific rather than architectural: the Stripe publishable key is not retrievable from the Guesty API (must be stored as an env var), card tokenization must target the listing's connected Stripe account or Guesty will reject the payment method, and the Guesty BEAPI instance must be manually activated and set to instant-book mode before any test bookings will behave correctly. Addressing these three items as explicit pre-flight checks before any payment integration work begins eliminates the highest-probability failure modes.

---

## Key Findings

### Recommended Stack

The project runs on Vercel serverless functions (Node.js 22, pin in `package.json`). Native `fetch` is already used in `calendar.js` and handles all outbound calls to Guesty and (for the Stripe init data) the payment-info endpoint. No HTTP client library is needed. The BEAPI uses a different OAuth2 token endpoint (`booking.guesty.com/oauth2/token`, scope `booking_engine:api`) from the Open API used by `calendar.js` — two separate token caches are required. Token caching uses module-level variables (warm Vercel instance reuse), which is sufficient for single-property low traffic. Resend is the only npm dependency needed, for upsell notification email to Sebastian.

On the frontend, Stripe.js is loaded from the official CDN only (`https://js.stripe.com/v3/`), initialized with both the platform publishable key and `stripeAccount: acct_xxx` to scope tokens to the connected account. `stripe.createPaymentMethod()` (not the legacy `createToken()`) produces the `pm_xxx` token Guesty requires.

**Core technologies:**
- **Node.js 22 + Vercel Functions:** serverless API runtime — already in use, extends cleanly
- **Native fetch (built-in):** all Guesty and payment-info outbound calls — zero dependencies, already the codebase pattern
- **Guesty BEAPI (booking.guesty.com):** quote creation, instant reservation, payment provider lookup
- **Stripe.js v3 (CDN):** client-side card tokenization to connected account — PCI-compliant, required by Guesty BEAPI
- **Resend SDK:** upsell notification email — simplest API, Vercel-native, free tier sufficient

**Do not use:** `stripe` npm package (server never charges Stripe), `node-fetch`/`axios` (native fetch covers it), Vercel KV (module-level caching adequate), Stripe Payment Element (incompatible with Guesty's token handoff model).

### Expected Features

The table-stakes list is well-established by Airbnb/VRBO patterns. Guests expect: real-time availability confirmation, a full line-item price breakdown before payment, cancellation policy display, a minimal guest details form (no account creation), PCI-compliant card entry, booking confirmation screen, and clear deposit schedule transparency ($50 today, remainder 14 days before check-in). Mobile-responsive layout is non-negotiable — 65-70% of travel bookings happen on phones, and Sebastian explicitly tests on iPhone.

Differentiators for direct booking: the branded modal flow (the entire purpose of this project), upsell add-ons (display + Resend email to Sebastian), transparent deposit schedule, and instant-book confirmation. Upsells cannot be added to Guesty quotes via BEAPI; they are display-only with email notification to Sebastian.

**Must have (table stakes):**
- Real-time availability check and price breakdown from Guesty quote
- Cancellation policy and deposit schedule displayed before payment
- Guest details form (first/last name, email, phone — no account creation)
- Stripe Elements card form with loading states and error messages
- Booking confirmation screen with confirmation code
- Fallback redirect to Guesty booking page when Stripe key is absent or API fails
- Mobile-responsive layout with large tap targets

**Should have (differentiators):**
- Upsell add-ons (early check-in, late checkout, welcome basket) with Resend email to Sebastian
- Branded modal/drawer flow — no full-page redirect
- Transparent deposit schedule in the quote display
- Instant-book confirmation (no host approval wait)

**Defer to v2+:**
- Apple Pay / Google Pay wallet buttons — requires Stripe domain verification and adds complexity
- Animated step transitions — basic show/hide sufficient for MVP
- "Saving vs Airbnb" callout inside checkout — price widget already handles this pre-checkout

**Explicit anti-features:** guest account creation, inquiry/approval flow, custom payment scheduling, Stripe Customer object creation (Guesty handles this), admin dashboard, real-time chat, multi-property search.

### Architecture Approach

The system splits cleanly into three layers: a static GitHub Pages frontend with a vanilla JS checkout modal, a Vercel serverless API layer acting as a security proxy to Guesty and Resend, and the external Guesty BEAPI plus Stripe payment tokenization. Shared concerns on the API side live in three library modules: `lib/guesty.js` (BEAPI token lifecycle + HTTP client), `lib/upsells-config.js` (static upsell catalog), and `lib/notify.js` (Resend email dispatch). Five new API endpoints are added alongside the existing `api/calendar.js`. The frontend is split into `checkout.js` (4-step state machine) and `stripe-setup.js` (Stripe.js initialization and PaymentMethod creation).

A critical architectural constraint: the Guesty BEAPI uses two different base hostnames. The availability search endpoint lives at `booking-api.guesty.com/v1`, while all quote, reservation, and payment-provider operations live at `booking.guesty.com`. This split must be handled inside `lib/guesty.js`. The `pm_xxx` PaymentMethod token is single-use — if `/api/book` fails after tokenization, the guest must re-enter card details.

**Major components:**
1. `lib/guesty.js` — BEAPI OAuth2 token cache and HTTP client (foundation for all API routes)
2. `api/quote.js` + `api/book.js` — core booking transaction (quote → instant reservation)
3. `api/payment-info.js` — returns Stripe account ID from Guesty + publishable key from env
4. `checkout.js` (frontend) — 4-step state machine holding quoteId, guestData, selectedUpsells
5. `stripe-setup.js` (frontend) — Stripe.js init with connected account + PaymentMethod creation
6. `lib/notify.js` + `api/upsells.js` — upsell catalog and Resend email notification

### Critical Pitfalls

1. **Stripe publishable key is not in the Guesty API response** — The `GET /listings/{id}/payment-provider` endpoint returns the Stripe connected account ID (`acct_xxx`) but not the publishable key. Store the key as `STRIPE_PUBLISHABLE_KEY` in Vercel env vars. Build the fallback redirect before wiring Stripe Elements, since the key may not be available immediately.

2. **Tokenizing against the wrong Stripe account** — Stripe.js must be initialized with the publishable key and `stripeAccount: acct_xxx` matching the listing's connected account. Using any other key creates a token Guesty cannot charge. Verify the `providerAccountId` from Guesty matches the account owning the publishable key.

3. **Creating a Stripe Customer before passing the token to Guesty** — Guesty creates the Stripe Customer itself during instant booking. Attaching the `pm_xxx` to a Stripe Customer before passing it as `ccToken` invalidates the token. The client-side call ends at `stripe.createPaymentMethod()` — nothing more.

4. **BEAPI instance not activated / set to wrong booking type** — The BEAPI source is inactive in Guesty until a manual direct booking and a first BEAPI reservation are both created. Confirm Sebastian has created a manual direct booking first; then verify the BEAPI instance is set to "instant booking only." Treat this as a pre-flight checklist item, not an implementation detail.

5. **Token renewal exhaustion on cold starts** — Guesty allows only 3 OAuth2 token renewals per 24 hours. Vercel cold starts each fetch a fresh token without sharing state. At low traffic this is unlikely to hit the limit, but deployment cycles and traffic spikes can trigger it. Document the limit, use module-level caching, and monitor auth-endpoint 429 responses.

---

## Implications for Roadmap

The architecture research file provides an explicit dependency-driven build order. The phase structure below follows that order and groups related concerns.

### Phase 1: API Foundation — Token Management + Availability

**Rationale:** Everything else depends on `lib/guesty.js` being correct. The availability endpoint is the simplest Guesty call (read-only) and validates the BEAPI token, listing ID, and CORS headers end-to-end without any payment risk.
**Delivers:** `lib/guesty.js` with BEAPI OAuth2 token cache, `api/availability.js`, CORS headers pattern for all subsequent endpoints, confirmation that `GUESTY_LISTING_ID` is correct.
**Addresses:** Real-time availability check (table stakes).
**Avoids:** Token renewal exhaustion (Pitfall 6), CORS misconfiguration (Pitfall 10), confusion between BEAPI and Open API token endpoints.

### Phase 2: Quote + Payment Info Endpoints

**Rationale:** The quote endpoint is the first write operation and produces the `quoteId` that flows through the rest of the checkout. The payment-info endpoint can be built in parallel since both depend only on `lib/guesty.js`. Together these two endpoints unblock all frontend work.
**Delivers:** `api/quote.js` (returns quoteId + price breakdown), `api/payment-info.js` (returns stripeAccountId from Guesty + publishable key from env var), fallback URL response when key is absent.
**Addresses:** Full price breakdown, deposit schedule transparency, Stripe initialization data.
**Avoids:** Publishable key confusion (Pitfall 1 — key comes from env, not Guesty response), quote-to-price mismatch (Pitfall 13 — quote is authoritative price).

### Phase 3: Upsells Catalog + Resend Email

**Rationale:** No Guesty dependency. Can be built any time after lib/guesty.js exists. Unblocks frontend Step 2 and must be done before `/api/book` to ensure email notification is testable independently.
**Delivers:** `lib/upsells-config.js` (static catalog), `api/upsells.js`, `lib/notify.js`, Resend domain verified and test email confirmed to Sebastian's address.
**Addresses:** Upsell add-on feature (differentiator).
**Avoids:** Resend domain verification failure (Pitfall 14 — verify before wiring into book endpoint).

### Phase 4: Booking Confirmation Endpoint

**Rationale:** Last API route. Depends on lib/guesty.js (token), lib/notify.js (email), and a valid quoteId. BEAPI instance activation and instant-book mode must be confirmed before this phase.
**Delivers:** `api/book.js` — calls Guesty instant book endpoint, fires Resend email if upsells selected, returns confirmationCode + reservationId.
**Addresses:** Instant-book confirmation, upsell notification delivery.
**Avoids:** BEAPI activation gap (Pitfall 4 — pre-flight: confirm manual booking exists in Guesty), booking type mismatch (Pitfall 5 — verify instance is set to instant-only), Stripe Customer creation error (Pitfall 3 — ccToken passed directly, no customer creation), 60-second propagation rule (Pitfall 9 — confirmation screen uses instant-book response directly, no follow-up GET).

### Phase 5: Frontend Checkout — Modal Shell + Steps 1 and 2

**Rationale:** API layer is complete; frontend can now be wired up fully. Steps 1 (quote display) and 2 (guest form + upsells) have no Stripe dependency and can be fully tested and polished before the Stripe publishable key is available.
**Delivers:** Checkout modal/drawer HTML in `index.html`, `checkout.js` state machine (Step 1 quote display + Step 2 guest form + upsell checkboxes), `checkout.css`, fallback path UI.
**Addresses:** Branded experience, mobile-responsive layout, upsell display, cancellation policy display, deposit schedule display, guest details form (all table stakes and differentiators).
**Avoids:** Quote expiry on stale sessions (Pitfall 7 — store expiresAt, offer re-quote silently), race condition on date conflict (Pitfall 8 — explicit error for date-conflict response).

### Phase 6: Frontend — Stripe Elements + End-to-End Test

**Rationale:** Built last because it requires the Stripe publishable key from Sebastian. The fallback path (redirect to Guesty) is already in place from Phase 5, so this phase is not blocking launch.
**Delivers:** `stripe-setup.js` (Stripe.js init with connected account + createPaymentMethod), Step 3 payment UI, Step 4 confirmation screen, end-to-end test confirming reservation in Guesty dashboard.
**Addresses:** PCI-compliant card entry, booking confirmation screen (table stakes).
**Avoids:** Wrong account tokenization (Pitfall 2 — stripeAccount: acct_xxx from payment-info endpoint), Stripe.js CDN requirement (Pitfall 11 — loaded from js.stripe.com only), Mobile Safari scroll-off (Pitfall 12 — test on real iOS device before declaring done), creating Stripe Customer (Pitfall 3).

### Phase Ordering Rationale

- `lib/guesty.js` is built before any API handler because all handlers depend on it. Testing token acquisition in isolation catches BEAPI-vs-OpenAPI scope confusion early.
- Quote and payment-info are grouped because both depend only on the Guesty lib and both unblock the frontend simultaneously.
- Upsells and Resend are decoupled from Guesty, making them low-risk and good to complete before the final booking endpoint.
- The booking endpoint is last on the API side because it depends on all three lib modules and requires Guesty BEAPI activation.
- Frontend phases come after the API is complete so integration can be tested against real endpoints, not mocked responses.
- Stripe Elements is last because the publishable key from Sebastian is a hard external dependency; the fallback path ensures the site is usable even before that key is provided.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Booking Endpoint):** The exact request body shape for `/api/reservations/quotes/:quoteId/instant` (particularly `policy` field and required guest subfields) should be validated against the live Guesty BEAPI reference before implementation starts.
- **Phase 6 (Stripe Elements):** The exact Stripe connected account publishable key (Sebastian's Stripe dashboard) and the `providerAccountId` from `GET /listings/:id/payment-provider` must be confirmed to correspond to the same Stripe account. This cannot be validated without Sebastian's credentials.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Token + Availability):** Pattern is directly mirrored from `api/calendar.js`. Documentation is authoritative. No research phase needed.
- **Phase 3 (Upsells + Resend):** Static config + simple email API. Well-documented, no external unknowns.
- **Phase 5 (Frontend Modal):** Vanilla JS 4-step modal is a well-established UI pattern. No research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core technologies verified against official Vercel, Guesty, and Stripe docs. Resend version number should be verified before install. Module-level token caching relies on Vercel fluid compute instance reuse, which is best-effort. |
| Features | HIGH | Well-established vacation rental checkout patterns from multiple industry sources. Upsell revenue uplift (12-15%) is consistent across vendors. Mobile booking share (65-70%) is well-documented. |
| Architecture | HIGH | Spec document is authoritative. Guesty BEAPI docs confirm dual-hostname behavior, token scope separation, and Stripe tokenization flow. Existing `calendar.js` provides a confirmed implementation pattern. |
| Pitfalls | HIGH | Most pitfalls derived from official Guesty docs (FAQ, tokenization flow, booking type settings). Stripe connected account tokenization risk is well-documented in both Stripe and Guesty official sources. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Stripe publishable key source:** Sebastian must retrieve his Stripe publishable key from his Stripe dashboard and provide it for the `STRIPE_PUBLISHABLE_KEY` Vercel env var. The fallback path handles the window where this key is not yet available, but Phase 6 is blocked until Sebastian provides it.
- **BEAPI instance configuration:** Whether Sebastian's Guesty BEAPI instance is currently set to "instant booking only" has not been confirmed. This is a pre-flight checklist item for Phase 4. If it is set to "request to book," the dashboard setting must be changed before the booking endpoint can be tested.
- **Guesty BEAPI activation state:** Whether the first manual direct booking in Guesty has been created (required to activate the BEAPI source and trigger payment automations) has not been confirmed. Must be verified with Sebastian before end-to-end testing.
- **`pm_xxx` vs PaymentElement on mobile:** PITFALLS.md notes that the Stripe Card Element has known iOS scroll-off issues and suggests considering the Payment Element. However, STACK.md research confirms the Payment Element is incompatible with Guesty's token-handoff model (`createPaymentMethod()` is required). The resolution is to use the Card Element with careful mobile CSS (bottom padding, overflow handling) and test on a real iOS device. This is a UX risk, not an architecture risk.

---

## Sources

### Primary (HIGH confidence)
- [Guesty BEAPI Authentication](https://booking-api-docs.guesty.com/docs/authentication-1)
- [Guesty BEAPI Quick Start](https://booking-api-docs.guesty.com/docs/quick-start)
- [Guesty Booking Flow](https://booking-api-docs.guesty.com/docs/booking-flow)
- [Guesty Stripe Tokenization Flow](https://booking-api-docs.guesty.com/docs/stripe-tokenization-flow)
- [Guesty Create Instant Reservation From Quote](https://booking-api-docs.guesty.com/reference/createinstantreservationfromquote)
- [Guesty Create Reservation Quote](https://booking-api-docs.guesty.com/reference/createreservationquote)
- [Guesty FAQ](https://booking-api-docs.guesty.com/docs/frequently-asked-questions)
- [Stripe.js Initializing](https://docs.stripe.com/js/initializing)
- [Stripe createPaymentMethod](https://docs.stripe.com/js/payment_methods/create_payment_method)
- [Stripe Connect Authentication](https://docs.stripe.com/connect/authentication)
- [Stripe Error Codes](https://docs.stripe.com/error-codes)
- [Vercel Node.js Versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)
- [Resend Node.js SDK](https://resend.com/docs/send-with-nodejs)

### Secondary (MEDIUM confidence)
- [Enso Connect Upsells Data 2025](https://ensoconnect.com/resources/vacation-rental-upsells-data-and-trends-2025) — upsell revenue uplift (12-15%)
- [NowiStay Direct Bookings Guide 2026](https://www.nowistay.com/ressources/direct-bookings-vacation-rental-complete-guide) — direct booking patterns
- [Page Flows VRBO Booking Analysis](https://pageflows.com/resources/vrbo-booking/) — checkout UX patterns

### Tertiary (LOW confidence)
- [Rework Mobile Booking Optimization](https://resources.rework.com/libraries/travel-tour-growth/mobile-booking-optimization) — wallet pay conversion claim (3x); single source, unverified

---

*Research completed: 2026-04-06*
*Ready for roadmap: yes*
