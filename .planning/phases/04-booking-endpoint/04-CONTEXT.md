# Phase 4: Booking Endpoint - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build `POST /api/book` — the instant-book confirmation endpoint. Accepts a quoteId, guest details, Stripe PaymentMethod token (`pm_xxx`), and optional upsell selections. Calls Guesty BEAPI instant-book endpoint, triggers Resend notification to Sebastian if upsells were selected, and returns a confirmation code. This is the most complex endpoint because it coordinates Guesty, Stripe tokens, upsell validation, and email notification in a single request.

</domain>

<decisions>
## Implementation Decisions

### Request Handling
- POST method with JSON body: `{ quoteId, ratePlanId, ccToken, guest: { firstName, lastName, email, phone }, upsells: ["early_checkin", ...] }`
- Validate upsell IDs against `UPSELLS` from `lib/upsells-config.js` — reject unknown IDs with 400
- Validate required fields: quoteId, ccToken, guest (all sub-fields)
- `ccToken` must start with `pm_` (basic format check)

### Guesty Integration
- Call `POST https://booking.guesty.com/api/reservations/quotes/{quoteId}/instant`
- Pass `ccToken` as the payment method token
- Pass `ratePlanId` if provided (from quote response)
- Pass guest details in Guesty's expected format
- Handle Guesty errors: expired quote, payment declined, generic failure → structured error responses

### Upsell Processing
- Fire notification AFTER Guesty confirms (not before — don't email about failed bookings)
- Calculate `upsellTotal` server-side by summing prices from catalog
- Notification is fire-and-forget (never blocks booking response)
- Import `sendUpsellNotification` from `lib/notify.js`

### Response Shape
- Success: `{ success: true, reservationId, confirmationCode, status: "confirmed", upsells: [...], upsellTotal }`
- Confirmation code comes from Guesty's response
- Error: `{ error: "message", code: "QUOTE_EXPIRED"|"PAYMENT_DECLINED"|"BOOKING_FAILED", fallbackUrl }`

### Claude's Discretion
- Exact Guesty instant-book request body field names (research needed — `ccToken` field name in BEAPI)
- Error code mapping from Guesty HTTP status to our error codes
- Test mocking strategy for the multi-step flow

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/guesty.js` — `guestyFetch()` for authenticated Guesty calls
- `lib/upsells-config.js` — `UPSELLS` catalog for ID validation + price lookup
- `lib/notify.js` — `sendUpsellNotification()` fire-and-forget email
- `api/quote.js` — template for POST endpoint with body parsing

### Established Patterns
- setCors() + OPTIONS handling
- Input validation before Guesty call
- FALLBACK_URL in all error responses
- mock.method(globalThis, 'fetch', ...) for testing
- node:test framework

### Integration Points
- Guesty instant-book: `POST https://booking.guesty.com/api/reservations/quotes/{quoteId}/instant`
- Imports: `guestyFetch` from lib/guesty.js, `UPSELLS` from lib/upsells-config.js, `sendUpsellNotification` from lib/notify.js

</code_context>

<specifics>
## Specific Ideas

- The instant-book endpoint is the only write operation in the entire API layer
- A failed Guesty call should never trigger the upsell notification
- The ccToken is single-use — if booking fails, frontend must create a new token

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
