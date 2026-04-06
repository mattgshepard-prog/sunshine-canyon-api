# Phase 3: Upsells + Notifications - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the upsell catalog endpoint (`GET /api/upsells`) and the Resend email notification module (`lib/notify.js`). The catalog serves upsell items from a config file. The notification module sends Sebastian an email with guest details and itemized upsell selections whenever a booking includes add-ons. Both are independently testable before the booking endpoint exists.

</domain>

<decisions>
## Implementation Decisions

### Upsell Catalog
- Store config in `lib/upsells-config.js` — importable by both `/api/upsells` and `/api/book`
- Export array: `[{ id, name, price, description }]` matching spec section 5.6
- IDs: `early_checkin`, `late_checkout`, `airport_shuttle_to`, `airport_shuttle_from`, `stocked_fridge`
- Prices updatable without frontend redeployment (server-side config)
- Validate upsell IDs against catalog on book endpoint (Phase 4) — reject unknown IDs

### Resend Email
- Use `resend` npm package (first npm dependency) — `npm install resend`
- `lib/notify.js` exports `sendUpsellNotification({ guest, checkIn, checkOut, confirmationCode, upsells })`
- Recipient: seb@sv.partners (hardcoded — single property manager)
- Plain text email format — guest name, dates, confirmation code, itemized upsell list with prices, total
- Fire-and-forget: log errors but never block booking confirmation
- `RESEND_API_KEY` env var required in Vercel

### Claude's Discretion
- Email subject line wording
- Exact text formatting of the email body
- Test mocking approach for Resend (mock the Resend class or mock fetch)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/availability.js` — template for GET endpoint pattern (CORS, validation, error shape)
- `lib/guesty.js` — not needed for upsells but notify.js follows similar module pattern

### Established Patterns
- `export default` for route handlers
- `setCors()` for CORS handling
- `FALLBACK_URL` constant in routes
- `node:test` with `mock.method()` for testing

### Integration Points
- `lib/upsells-config.js` imported by `api/upsells.js` (this phase) and `api/book.js` (Phase 4)
- `lib/notify.js` imported by `api/book.js` (Phase 4)
- `RESEND_API_KEY` env var needed in Vercel

</code_context>

<specifics>
## Specific Ideas

- Upsells endpoint is the simplest in the project — returns a static JSON array
- Notify module is standalone — can be tested independently of the booking flow
- This phase adds the first npm dependency (resend) — need to run npm install

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
