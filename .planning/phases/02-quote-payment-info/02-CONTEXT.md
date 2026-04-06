# Phase 2: Quote + Payment Info - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build two API endpoints: `POST /api/quote` (creates a Guesty reservation quote with full price breakdown) and `GET /api/payment-info` (returns Stripe connected account ID + publishable key). Both use `lib/guesty.js` from Phase 1. Together they provide everything the frontend needs to display pricing and initialize Stripe.js.

</domain>

<decisions>
## Implementation Decisions

### Quote Endpoint
- POST method (creates a quote resource in Guesty)
- Pass through Guesty's rate plan structure: `quoteId`, `expiresAt`, `ratePlans[]` (each with `days[]` and `totals`), matching spec section 5.3
- Return all rate plans from Guesty — let frontend display or auto-select
- Request body: `{ checkIn, checkOut, guests, guest: { firstName, lastName, email, phone } }`
- Calls `POST https://booking.guesty.com/api/reservations/quotes`
- Include `fallbackUrl` in all error responses (consistent with Phase 1 pattern)
- Input validation: require all fields, validate date formats, validate guest object shape

### Payment Info Endpoint
- GET method, no parameters needed (uses hardcoded `GUESTY_LISTING_ID`)
- Returns `{ providerType, stripeAccountId, stripePublishableKey, fallbackUrl }` in one response
- `stripePublishableKey` comes from `STRIPE_PUBLISHABLE_KEY` env var (safe — it's a public key)
- When `STRIPE_PUBLISHABLE_KEY` is missing: return `stripeAccountId: null, stripePublishableKey: null` with `fallbackUrl` — NOT an error
- Calls `GET https://booking.guesty.com/api/listings/{GUESTY_LISTING_ID}/payment-provider`
- No caching — lightweight single call

### Claude's Discretion
- Error message wording for validation failures
- Exact JSON field naming beyond what spec defines
- Test structure and mocking approach (follow Phase 1 patterns)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/guesty.js` — `guestyFetch(path, options)` with auto-auth and 401 retry
- `api/availability.js` — template for new endpoints (CORS, validation, error pattern)
- `api/calendar.js` — original pattern reference

### Established Patterns
- Import `guestyFetch` from `../lib/guesty.js`
- `setCors(req, res)` function for CORS handling
- Input validation before any Guesty call
- `FALLBACK_URL` constant in every route
- `fallbackUrl` in all error responses
- `node:test` with `mock.method(globalThis, 'fetch', ...)` for testing

### Integration Points
- `lib/guesty.js` handles auth transparently — routes just call `guestyFetch()`
- Guesty base URL for quotes: `https://booking.guesty.com/api/reservations/quotes`
- Guesty base URL for payment provider: `https://booking.guesty.com/api/listings/{id}/payment-provider`
- `GUESTY_LISTING_ID` env var (set in Phase 1)
- `STRIPE_PUBLISHABLE_KEY` env var (pending from Sebastian — must handle gracefully)

</code_context>

<specifics>
## Specific Ideas

- Quote endpoint is the most data-rich response — needs nightly rate breakdown, cleaning fee, taxes, total per rate plan
- Payment info is the simplest endpoint — one Guesty call + one env var read
- Both endpoints are read-only (no state changes in Guesty for payment-info; quote creation is idempotent-ish)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
