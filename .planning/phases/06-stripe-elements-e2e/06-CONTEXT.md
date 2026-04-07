# Phase 6: Stripe Elements + End-to-End - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Step 3 (Stripe Elements payment form) and Step 4 (confirmation screen) to the existing checkout.js. Step 3 initializes Stripe.js with the connected account, renders a Card Element, requires cancellation policy checkbox, creates a PaymentMethod token, and calls `/api/book`. Step 4 displays the booking confirmation. This completes the full checkout flow.

</domain>

<decisions>
## Implementation Decisions

### Stripe Elements (Step 3)
- Load Stripe.js via `<script src="https://js.stripe.com/v3/"></script>` in checkout-snippet.html
- Initialize in `checkPaymentInfo()` flow — after getting `stripeAccountId` + `stripePublishableKey` from `/api/payment-info`
- `const stripe = Stripe(stripePublishableKey, { stripeAccount: stripeAccountId })`
- Use single Card Element (not individual Number/Expiry/CVC) — simpler, fewer DOM elements
- Mount Card Element to `#card-element` div
- Style Card Element to match dark/earth-tone theme (dark background, light text)
- Cancellation policy checkbox (`#co-policy-checkbox`) must be checked before "Confirm Booking" button activates
- "Confirm Booking" button: create PaymentMethod → call `/api/book` → show confirmation
- Display: "You will be charged $50 today. Remaining balance of $X will be charged 14 days before check-in."

### Confirmation Screen (Step 4)
- Show: confirmation code (large, prominent), dates, guest name, property name, upsells selected with prices, totals
- "Done" button closes drawer and resets state
- "A confirmation email has been sent to [email]" message
- Populated from `/api/book` response

### Error Handling
- Stripe card errors displayed inline below Card Element
- Payment declined: clear message + "Try another card"
- Booking failed: structured error from `/api/book` + fallback link
- Token is single-use — if booking fails, user must re-enter card (Card Element resets)

### Claude's Discretion
- Card Element style object (match existing CSS custom properties)
- Exact layout of confirmation screen
- Animation for step transitions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/js/checkout.js` — existing IIFE with `goToStep()`, `showSpinner()`, `showError()`, `checkPaymentInfo()` already wired
- `frontend/checkout-snippet.html` — Step 3 container with `#card-element`, `#co-policy-checkbox`, `#co-confirm-btn` already in DOM
- `frontend/css/checkout.css` — `.co-step-3`, `.co-step-4` styles already exist

### Established Patterns
- `goToStep(N)` to navigate between steps
- `showSpinner()`/`hideSpinner()` for loading states
- `showError(msg)` for error display
- `el(id)` helper for DOM access
- `API_BASE` constant for API URL prefix

### Integration Points
- `/api/payment-info` — already called by `checkPaymentInfo()` — provides `stripeAccountId` + `stripePublishableKey`
- `/api/book` — POST with `{ quoteId, ratePlanId, ccToken, guest, upsells, checkIn, checkOut }`
- Stripe.js CDN script tag in HTML
- State variables: `quoteData`, `guestData`, `selectedUpsells` already tracked in checkout.js

</code_context>

<specifics>
## Specific Ideas

- The STRIPE_PK placeholder pattern from spec section 6.4 — when key is missing, checkout.js already shows fallback (built in Phase 5)
- Card Element needs custom styling to match dark theme
- PaymentMethod creation: `stripe.createPaymentMethod({ type: 'card', card: cardElement, billing_details: { name, email, phone } })`
- The `pm_xxx` token goes to `/api/book` as `ccToken`

</specifics>

<deferred>
## Deferred Ideas

- Add to Calendar (.ics download) — v2
- Apple Pay / Google Pay — v2
- Guest-facing confirmation email via Resend — v2

</deferred>
