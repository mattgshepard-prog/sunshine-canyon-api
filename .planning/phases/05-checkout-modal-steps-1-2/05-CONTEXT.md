# Phase 5: Checkout Modal — Steps 1 & 2 - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the frontend checkout drawer with Steps 1 (Quote Display) and 2 (Guest Details + Upsells). The checkout opens from "Book Direct" buttons, fetches a live quote from `/api/quote`, displays the price breakdown, collects guest info, and shows upsell add-ons. When the Stripe key is unavailable, the fallback redirects to the Guesty booking page. All built in vanilla JS/CSS with no framework.

**NOTE:** These files will be created in this API repo and then moved to the `sunshine-canyon-retreat` frontend repo. The frontend repo's `index.html` will need to reference `js/checkout.js` and `css/checkout.css`.

</domain>

<decisions>
## Implementation Decisions

### Modal Architecture
- Slide-up drawer (not full-screen modal) — luxury feel, better on mobile
- Single `js/checkout.js` with state machine (step1 → step2 → step3 → step4)
- Separate `css/checkout.css` — checkout is complex enough to warrant its own file
- Drawer slides up from bottom, covers ~85% of viewport height
- Close button (X) + click-outside to dismiss
- Body scroll lock when drawer is open

### Step 1 — Quote Display
- Fetch quote from `/api/quote` on modal open (after user has dates selected)
- Display: nightly rate breakdown (collapsible per-night details), cleaning fee, taxes, total
- "$50 deposit today. Remaining $X charged 14 days before check-in." prominently displayed
- Cancellation policy text: "Free cancellation up to 14 days before check-in. 50% refund up to 7 days before check-in. Non-refundable after that."
- "Continue to Book" button advances to Step 2
- Loading spinner while quote is fetching

### Step 2 — Guest Details + Upsells
- Form: firstName, lastName, email, phone (all required)
- Validation on blur + on submit — red border + error message for invalid fields
- Email regex validation, phone format validation
- Upsell checkboxes fetched from `/api/upsells` — show name, price, description
- Live-updating upsell total below checkboxes: "Selected add-ons: $X"
- "Continue to Payment" button validates form then advances to Step 3

### Stripe Fallback (UI-11)
- Check `/api/payment-info` for stripePublishableKey
- If null: hide payment form, show "Direct booking payments are being set up. In the meantime, complete your booking through our partner portal." + "Complete Booking →" button linking to Guesty page
- Fallback check happens before Step 3 renders

### Loading & Error States (UI-12, UI-13)
- Spinner overlay during API calls (quote fetch, upsell fetch)
- Disabled buttons during fetch operations
- Error messages: "These dates are no longer available" / "Your quote has expired. Please try again." / generic with "Try again" + fallback link
- All errors include fallback link to Guesty booking page

### Mobile (UI-14)
- Large tap targets (min 44px)
- Readable text (min 16px base)
- No scroll-off (drawer stays within viewport)
- Touch-friendly checkbox/radio inputs

### Claude's Discretion
- Exact color values and typography (should match existing site aesthetic)
- Animation timing for drawer slide
- Specific breakpoint values for responsive layout

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing site `index.html` has calendar picker and "Book Direct" buttons already
- API base URL: `https://sunshine-canyon-api.vercel.app`
- Existing site uses a dark/earth-tone luxury aesthetic

### Established Patterns
- Vanilla JS — no framework
- Single-page site with inline scripts (but spec recommends splitting checkout into separate files)
- `fetch()` for API calls

### Integration Points
- API endpoints: `/api/quote`, `/api/upsells`, `/api/payment-info`
- "Book Direct" button click triggers checkout drawer open
- Date picker already captures checkIn/checkOut dates
- Guest count already captured (or defaults to 2)

</code_context>

<specifics>
## Specific Ideas

- The checkout.js should be self-contained — all state managed internally
- API base URL should be configurable (dev vs prod)
- The drawer should look like it belongs on the existing luxury retreat site

</specifics>

<deferred>
## Deferred Ideas

- Step 3 (Stripe Elements) and Step 4 (Confirmation) — Phase 6
- Apple Pay / Google Pay — v2
- "Add to Calendar" .ics download — v2

</deferred>
