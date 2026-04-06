# Requirements: Sunshine Canyon Direct Booking

**Defined:** 2026-04-06
**Core Value:** Guests can book the property directly on the Sunshine Canyon site with a seamless, branded checkout experience

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Token Management

- [x] **AUTH-01**: Server-side OAuth2 token acquisition from Guesty BEAPI (`booking.guesty.com/oauth2/token`)
- [x] **AUTH-02**: Token caching with module-level variable (reuse until 5 min before expiry)
- [x] **AUTH-03**: Separate token management for BEAPI scope (`booking_engine:api`) vs existing Open API scope
- [x] **AUTH-04**: Automatic token refresh on 401 response with single retry

### Listing Discovery

- [x] **LIST-01**: One-time listing ID discovery via Guesty `/v1/search` API
- [x] **LIST-02**: Listing ID stored as `GUESTY_LISTING_ID` Vercel environment variable

### Availability

- [x] **AVAIL-01**: Real-time availability check for given check-in/check-out dates and guest count
- [x] **AVAIL-02**: Returns availability status and nightly rate from Guesty search endpoint

### Quote

- [ ] **QUOTE-01**: Create reservation quote with full price breakdown (nightly rates, cleaning, fees, taxes, total)
- [ ] **QUOTE-02**: Quote includes rate plan details and per-night pricing
- [ ] **QUOTE-03**: Quote response includes expiry timestamp

### Payment Info

- [ ] **PAY-01**: Retrieve Stripe connected account ID (`acct_xxx`) from Guesty payment provider endpoint
- [ ] **PAY-02**: Return provider type and account ID to frontend for Stripe.js initialization

### Booking

- [ ] **BOOK-01**: Confirm instant book reservation via Guesty BEAPI with `ccToken` (pm_xxx)
- [ ] **BOOK-02**: Return confirmation code, reservation ID, and booking status to frontend
- [ ] **BOOK-03**: Include upsell selections in booking request context

### Upsells

- [ ] **UPSELL-01**: Serve upsell catalog from API (id, name, price, description) — server-side config
- [ ] **UPSELL-02**: Upsell pricing updateable without frontend redeployment

### Email Notifications

- [ ] **EMAIL-01**: Send upsell notification email to Sebastian (seb@sv.partners) via Resend on booking with upsells
- [ ] **EMAIL-02**: Email includes guest name, dates, confirmation code, and itemized upsell selections with prices

### Frontend — Checkout Flow

- [ ] **UI-01**: Checkout modal/drawer opens from "Book Direct" buttons on existing site
- [ ] **UI-02**: Step 1 — Quote display with full price breakdown (nightly rates, cleaning, taxes, total)
- [ ] **UI-03**: Step 1 — Deposit schedule display ("$50 today, remainder 14 days before check-in")
- [ ] **UI-04**: Step 1 — Cancellation policy text display
- [ ] **UI-05**: Step 2 — Guest details form (first name, last name, email, phone) with validation
- [ ] **UI-06**: Step 2 — Upsell add-ons section with checkboxes and running total
- [ ] **UI-07**: Step 3 — Stripe Elements card input (Card Number, Expiry, CVC)
- [ ] **UI-08**: Step 3 — PaymentMethod token creation (`pm_xxx`) via Stripe.js on connected account
- [ ] **UI-09**: Step 3 — Cancellation policy agreement checkbox (required before confirm)
- [ ] **UI-10**: Step 4 — Confirmation screen with booking code, summary, and upsell confirmation
- [ ] **UI-11**: Graceful fallback to Guesty booking page when Stripe publishable key unavailable
- [ ] **UI-12**: Loading/processing states during API calls (spinners, disabled buttons)
- [ ] **UI-13**: Error handling with user-friendly messages (payment declined, dates unavailable, quote expired)
- [ ] **UI-14**: Mobile-responsive layout (Sebastian tests on iPhone)

### Infrastructure

- [ ] **INFRA-01**: CORS headers allowing requests from GitHub Pages domain
- [x] **INFRA-02**: Guesty credentials stored as Vercel environment variables (never in frontend)
- [x] **INFRA-03**: Input validation on all API routes before passing to Guesty
- [x] **INFRA-04**: Rate limit awareness (5 req/s, 275 req/min) with 429 retry logic

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Payments

- **PAY-V2-01**: Apple Pay / Google Pay wallet buttons via Stripe Payment Request API
- **PAY-V2-02**: Guest-facing confirmation email via Resend (in addition to Guesty's transactional email)

### Enhanced UX

- **UX-V2-01**: "Add to Calendar" .ics download from confirmation screen
- **UX-V2-02**: "You're saving $X by booking direct" messaging reinforcing price comparison widget
- **UX-V2-03**: Multi-language support for international guests

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Guest account creation / login | One-time bookers — forced registration kills conversion |
| Inquiry / approval flow | Instant book only — no host approval step |
| Custom payment scheduling | Guesty dashboard handles deposit + remainder split |
| Upsell payment processing | BEAPI doesn't support custom fees; display + notify only |
| Stripe Customer creation | Guesty manages customer records; duplicating causes errors |
| Admin dashboard | Sebastian uses Guesty dashboard directly |
| Real-time chat | Not part of booking conversion |
| Multi-property search | Single-property site |
| Review collection | Post-stay concern, not checkout |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| LIST-01 | Phase 1 | Complete |
| LIST-02 | Phase 1 | Complete |
| AVAIL-01 | Phase 1 | Complete |
| AVAIL-02 | Phase 1 | Complete |
| QUOTE-01 | Phase 2 | Pending |
| QUOTE-02 | Phase 2 | Pending |
| QUOTE-03 | Phase 2 | Pending |
| PAY-01 | Phase 2 | Pending |
| PAY-02 | Phase 2 | Pending |
| BOOK-01 | Phase 4 | Pending |
| BOOK-02 | Phase 4 | Pending |
| BOOK-03 | Phase 4 | Pending |
| UPSELL-01 | Phase 3 | Pending |
| UPSELL-02 | Phase 3 | Pending |
| EMAIL-01 | Phase 3 | Pending |
| EMAIL-02 | Phase 3 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 5 | Pending |
| UI-03 | Phase 5 | Pending |
| UI-04 | Phase 5 | Pending |
| UI-05 | Phase 5 | Pending |
| UI-06 | Phase 5 | Pending |
| UI-07 | Phase 6 | Pending |
| UI-08 | Phase 6 | Pending |
| UI-09 | Phase 6 | Pending |
| UI-10 | Phase 6 | Pending |
| UI-11 | Phase 5 | Pending |
| UI-12 | Phase 5 | Pending |
| UI-13 | Phase 5 | Pending |
| UI-14 | Phase 5 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap creation*
