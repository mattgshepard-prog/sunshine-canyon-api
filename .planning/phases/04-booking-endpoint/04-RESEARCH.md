# Phase 4: Booking Endpoint - Research

**Researched:** 2026-04-06
**Domain:** Guesty BEAPI instant-book, Node.js serverless, fire-and-forget notifications
**Confidence:** HIGH

## Summary

Phase 4 builds `POST /api/book` — the only write operation in this API layer. It converts a Guesty BEAPI quote into a confirmed instant reservation, then optionally fires an upsell notification email to Sebastian. The handler coordinates three systems in sequence: input validation, Guesty BEAPI instant-book call, and fire-and-forget Resend email.

The critical research question was the exact request body shape for `POST /api/reservations/quotes/{quoteId}/instant`. This is now fully verified: the field name for the Stripe token is `ccToken` (confirmed against the official BEAPI reference docs), and the required fields are `ratePlanId`, `ccToken`, and `guest` (with `firstName`, `lastName`, `email`). The `policy` object is optional. The response returns `_id` (reservation ID), `confirmationCode`, and `status: "confirmed"`.

All existing project patterns apply: `guestyFetch()` from `lib/guesty.js`, `mock.method(globalThis, 'fetch', ...)` for test isolation, and the FALLBACK_URL in every error response. The `sendUpsellNotification()` from `lib/notify.js` is already implemented and tested — Phase 4 only calls it, never modifies it.

**Primary recommendation:** Use the verified BEAPI request body shape (ccToken, ratePlanId, guest), map Guesty HTTP status codes to our three error codes, fire the upsell notification after a confirmed response, never before.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Request Handling**
- POST method with JSON body: `{ quoteId, ratePlanId, ccToken, guest: { firstName, lastName, email, phone }, upsells: ["early_checkin", ...] }`
- Validate upsell IDs against `UPSELLS` from `lib/upsells-config.js` — reject unknown IDs with 400
- Validate required fields: quoteId, ccToken, guest (all sub-fields)
- `ccToken` must start with `pm_` (basic format check)

**Guesty Integration**
- Call `POST https://booking.guesty.com/api/reservations/quotes/{quoteId}/instant`
- Pass `ccToken` as the payment method token
- Pass `ratePlanId` if provided (from quote response)
- Pass guest details in Guesty's expected format
- Handle Guesty errors: expired quote, payment declined, generic failure → structured error responses

**Upsell Processing**
- Fire notification AFTER Guesty confirms (not before — don't email about failed bookings)
- Calculate `upsellTotal` server-side by summing prices from catalog
- Notification is fire-and-forget (never blocks booking response)
- Import `sendUpsellNotification` from `lib/notify.js`

**Response Shape**
- Success: `{ success: true, reservationId, confirmationCode, status: "confirmed", upsells: [...], upsellTotal }`
- Confirmation code comes from Guesty's response
- Error: `{ error: "message", code: "QUOTE_EXPIRED"|"PAYMENT_DECLINED"|"BOOKING_FAILED", fallbackUrl }`

### Claude's Discretion
- Exact Guesty instant-book request body field names (research needed — `ccToken` field name in BEAPI)
- Error code mapping from Guesty HTTP status to our error codes
- Test mocking strategy for the multi-step flow

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOOK-01 | Confirm instant book reservation via Guesty BEAPI with `ccToken` (pm_xxx) | Verified: BEAPI field name is `ccToken`, required fields are ratePlanId + ccToken + guest. Response contains `_id` + `confirmationCode`. |
| BOOK-02 | Return confirmation code, reservation ID, and booking status to frontend | Verified: Guesty response has `_id` (reservationId), `confirmationCode` (string), `status: "confirmed"`. |
| BOOK-03 | Include upsell selections in booking request context | Handled post-Guesty: upsells are NOT sent to BEAPI (not supported); they are validated server-side and passed to `sendUpsellNotification()` after confirmation. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fetch` | Node 24.13.1 (runtime) | HTTP to Guesty BEAPI | Already used throughout — no dependency needed |
| `lib/guesty.js` `guestyFetch` | Project lib | Auth + retry wrapper for BEAPI calls | Phase 1 established pattern; handles 401 refresh and 429 backoff |
| `lib/notify.js` `sendUpsellNotification` | Project lib | Fire-and-forget email to Sebastian | Phase 3 implemented and tested; ready to call |
| `lib/upsells-config.js` `UPSELLS` | Project lib | Validate upsell IDs + look up prices | Phase 3 established; named export confirmed |
| `node:test` (built-in) | Node 24.13.1 | Test framework | Established in Phase 1; no external test runner |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:assert/strict` | Built-in | Test assertions | All test cases follow established pattern |
| `resend` | ^6.10.0 | Email (used by notify.js) | Already installed; Phase 4 never imports it directly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `guestyFetch` | Raw `fetch` | Raw fetch skips auth, 401 refresh, 429 retry — never do this |
| fire-and-forget notification | await notification | Awaiting blocks booking response; notification failure would fail the booking |

**Installation:**
No new packages needed. All dependencies already present.

---

## Architecture Patterns

### Recommended File Layout
```
api/
  book.js           -- New: POST /api/book handler
tests/
  book.test.js      -- New: tests for BOOK-01, BOOK-02, BOOK-03
```

No changes to `lib/` — all libraries are already implemented and tested.

### Pattern 1: POST handler with body validation (from api/quote.js)
**What:** setCors → OPTIONS guard → method guard → validate required fields → call guestyFetch → handle error → return success JSON
**When to use:** All POST endpoints in this project
**Example:**
```javascript
// Source: api/quote.js (established project pattern)
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed', fallbackUrl: FALLBACK_URL});
  }
  // ... validate body ...
  try {
    const resp = await guestyFetch(INSTANT_URL(quoteId), {
      method: 'POST',
      body: JSON.stringify({ ratePlanId, ccToken, guest }),
    });
    // ... handle response ...
  } catch (err) {
    console.error('Book error:', err);
    return res.status(500).json({error: 'Booking failed', code: 'BOOKING_FAILED', fallbackUrl: FALLBACK_URL});
  }
}
```

### Pattern 2: Fire-and-forget notification after confirmed booking
**What:** Call `sendUpsellNotification()` without `await` after Guesty confirms. Never block the response on email success.
**When to use:** Any post-booking side-effect that should not fail the primary operation
**Example:**
```javascript
// Source: lib/notify.js (never throws — already safe to call without await)
if (upsells.length > 0) {
  // Fire and forget — sendUpsellNotification never throws
  sendUpsellNotification({guest, checkIn, checkOut, confirmationCode, upsells: enrichedUpsells});
}
return res.status(200).json({success: true, reservationId, confirmationCode, status: 'confirmed', upsells: upsellIds, upsellTotal});
```

### Pattern 3: Guesty instant-book request body (VERIFIED from official docs)
**What:** The exact JSON shape for `POST https://booking.guesty.com/api/reservations/quotes/{quoteId}/instant`
**Source:** booking-api-docs.guesty.com/reference/createinquiryreservationfromquote (inquiry endpoint mirrors instant — same body shape)
```javascript
// Source: https://booking-api-docs.guesty.com/reference/createinquiryreservationfromquote
{
  ratePlanId: "5bf544a600a9b000389f81d8",   // required — must be from quote response
  ccToken:    "pm_1KTRn22eZvKYlo2CkHIARaGo", // required — Stripe pm_xxx token
  guest: {
    firstName: "John",    // required
    lastName:  "Doe",     // required
    email:     "john@example.com", // required
    phone:     "3035551234",        // optional
    address: { /* optional */ }
  },
  policy: {   // entirely optional
    privacy:            {version: 1, dateOfAcceptance: "...", isAccepted: true},
    termsAndConditions: {dateOfAcceptance: "...", isAccepted: true},
    marketing:          {isAccepted: false}
  }
}
```

### Pattern 4: Guesty instant-book response (VERIFIED from official docs)
**What:** The exact JSON shape returned on success
**Source:** booking-api-docs.guesty.com/reference/createinstantreservationfromquote
```javascript
// Source: https://booking-api-docs.guesty.com/reference/createinstantreservationfromquote
{
  _id:              "string",      // reservation ID — map to our reservationId
  status:           "confirmed",   // always "confirmed" for instant book
  platform:         "direct",
  confirmationCode: "string",      // booking reference — return to frontend
  createdAt:        "string",      // ISO datetime
  guestId:          "string"
}
```

### Pattern 5: Test mock for multi-step Guesty flow (from quote.test.js)
**What:** Intercept both token fetch and booking API call with a single `mock.method(globalThis, 'fetch', ...)`. Discriminate by URL.
**When to use:** All tests that call guestyFetch — token fetch URL comes first
```javascript
// Source: tests/quote.test.js (established project pattern)
const mockFetch = mock.fn(async (url) => {
  if (url === BEAPI_TOKEN_URL) return tokenResp();
  // url will be the instant-book URL for booking tests
  return mockResponse(200, mockBookingResponse);
});
mock.method(globalThis, 'fetch', mockFetch);
// ... call handler ...
mock.restoreAll();
```

### Anti-Patterns to Avoid
- **Awaiting the notification:** `await sendUpsellNotification(...)` — blocks the response; notification errors would fail the booking. The function already never throws, so fire-and-forget is safe.
- **Sending upsells to Guesty:** BEAPI does not support custom fees on the instant-book endpoint. Upsells are display/notification only.
- **Using raw `fetch` instead of `guestyFetch`:** Bypasses 401 refresh and 429 retry logic that `lib/guesty.js` handles.
- **ccToken format check as `pm_` prefix:** The `pm_` prefix is the Stripe PaymentMethod format. This is a basic sanity guard; Guesty ultimately validates the token.
- **Notifying before confirmation:** If Guesty returns non-ok, notification must not fire.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth + token refresh | Custom token logic in book.js | `guestyFetch` from lib/guesty.js | Already handles 401 refresh with single retry and 429 backoff |
| Email delivery | Custom Resend call in book.js | `sendUpsellNotification` from lib/notify.js | Already implemented, tested, and handles RESEND_API_KEY missing case |
| Upsell price lookup | Re-declare prices in book.js | `UPSELLS` from lib/upsells-config.js | Single source of truth; Phase 3 established this export for exactly this use case |
| CORS handling | Inline header logic | `setCors()` function (same pattern as quote.js) | Consistent across all endpoints |

---

## Guesty BEAPI Instant-Book: Field Name Verification

This section answers the key research question directly.

**Confirmed field name:** `ccToken` (camelCase, not `cc_token` or `paymentToken`)
**Confirmed format:** Stripe `pm_xxx` PaymentMethod token
**Source:** Official BEAPI reference docs, `createInquiryReservationFromQuote` (inquiry endpoint mirrors instant endpoint — same request body shape per official docs)
**Confidence:** HIGH

### Required fields in BEAPI request body:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `ratePlanId` | string | YES | Must be a rate plan ID from the quote response |
| `ccToken` | string | YES | Stripe `pm_xxx` PaymentMethod token |
| `guest.firstName` | string | YES | |
| `guest.lastName` | string | YES | |
| `guest.email` | string | YES | |
| `guest.phone` | string | NO | Optional in BEAPI — our validation requires it in the inbound request |
| `guest.address` | object | NO | Not needed for this use case |
| `policy` | object | NO | Privacy/terms acceptance — not required by BEAPI for instant book |

### Guesty response fields (success):
| Field | Notes |
|-------|-------|
| `_id` | Reservation ID (map to `reservationId` in our response) |
| `confirmationCode` | Booking reference string — return to frontend |
| `status` | Always `"confirmed"` for instant book success |
| `platform` | Always `"direct"` for API-created reservations |
| `guestId` | Not needed by our frontend |
| `createdAt` | Not needed by our frontend |

---

## Error Code Mapping

Guesty BEAPI does not publish a comprehensive error code reference. Based on official docs (rate limit documentation) and general HTTP conventions for booking APIs, the recommended mapping is:

| Guesty HTTP Status | Our Error Code | Reasoning |
|--------------------|----------------|-----------|
| 410 Gone | `QUOTE_EXPIRED` | Standard HTTP semantics for expired/consumed resources; BEAPI uses 410 for expired quotes per booking flow docs |
| 402 / 422 (payment) | `PAYMENT_DECLINED` | 422 Unprocessable Entity is the REST standard for payment validation failures; 402 is Payment Required |
| 400 (general) | `BOOKING_FAILED` | Generic client error for malformed request |
| 404 Not Found | `BOOKING_FAILED` | Quote ID not found |
| 500 / other | `BOOKING_FAILED` | Catch-all for unexpected Guesty failures |

**Confidence: MEDIUM** — Guesty does not publish exact status codes for quote-expired or payment-declined scenarios. The mapping above is defensive. The catch-all `BOOKING_FAILED` is always safe. In practice, Sebastian must verify one real booking attempt to confirm actual error codes returned.

**Implementation strategy:** Check `resp.ok` first; if false, read `resp.status`. Map 410 → `QUOTE_EXPIRED`, 402/422 → `PAYMENT_DECLINED`, all other non-ok → `BOOKING_FAILED`. This is safe to refine after observing real Guesty errors in Vercel logs.

---

## Common Pitfalls

### Pitfall 1: Awaiting the notification
**What goes wrong:** Adding `await` before `sendUpsellNotification(...)` causes any Resend failure to propagate and return a 500 to the frontend — even though the booking succeeded.
**Why it happens:** Natural instinct to await all async calls.
**How to avoid:** Call without await. `lib/notify.js` is already written to never throw — it catches internally and logs. Fire-and-forget is documented and safe.
**Warning signs:** Test for booking success verifies `res._status === 200` regardless of whether a mock fetch for Resend is set up.

### Pitfall 2: Sending upsells to the BEAPI request body
**What goes wrong:** Passing `upsells` array in the Guesty request body. BEAPI ignores or rejects unknown fields.
**Why it happens:** Assuming the API accepts arbitrary metadata.
**How to avoid:** BEAPI request body contains only `ratePlanId`, `ccToken`, and `guest`. Upsells are processed entirely server-side after confirmation.

### Pitfall 3: Missing `ratePlanId` makes the BEAPI call fail
**What goes wrong:** Omitting `ratePlanId` from the BEAPI body silently errors (Guesty may return 400 or use wrong pricing).
**Why it happens:** `ratePlanId` is optional in our inbound request shape — the frontend may not always send it.
**How to avoid:** Only include `ratePlanId` in the Guesty body if it is truthy. Guesty will use its default rate plan if omitted, which may still succeed. Document the conditional inclusion explicitly.

### Pitfall 4: Token pollution between test cases
**What goes wrong:** `lib/guesty.js` caches the token in a module-level variable. If test A sets the token mock and doesn't restore it, test B's mock sees a pre-cached token and never calls the token endpoint.
**Why it happens:** ES module caching keeps `cachedToken` alive across test cases in the same process.
**How to avoid:** Always call `mock.restoreAll()` after each test case. The established pattern in `tests/quote.test.js` does this correctly — follow the same pattern.

### Pitfall 5: vercel.json CORS does not cover POST /api/book
**What goes wrong:** `vercel.json` global CORS headers only set `GET, OPTIONS` methods. The `book` handler must set its own CORS headers to allow `POST`.
**Why it happens:** `vercel.json` has `"Access-Control-Allow-Methods": "GET, OPTIONS"` globally — this does not override the per-response `setCors()` call.
**How to avoid:** Use the same `setCors()` + OPTIONS handler pattern as `api/quote.js`. The per-response headers override `vercel.json` at response time (established in Phase 1).

---

## Code Examples

### Complete Guesty BEAPI instant-book request
```javascript
// Source: https://booking-api-docs.guesty.com/reference/createinquiryreservationfromquote
// (inquiry and instant endpoints use identical request body shape)
const INSTANT_URL = (quoteId) =>
  `https://booking.guesty.com/api/reservations/quotes/${quoteId}/instant`;

const body = {ccToken, guest: {firstName, lastName, email, phone}};
if (ratePlanId) body.ratePlanId = ratePlanId;

const resp = await guestyFetch(INSTANT_URL(quoteId), {
  method: 'POST',
  body: JSON.stringify(body),
});
```

### Upsell enrichment pattern (validate + look up prices)
```javascript
// Source: lib/upsells-config.js pattern established in Phase 3
import {UPSELLS} from '../lib/upsells-config.js';

const upsellIds = Array.isArray(upsells) ? upsells : [];
const validIds = new Set(UPSELLS.map(u => u.id));
const unknown = upsellIds.filter(id => !validIds.has(id));
if (unknown.length > 0) {
  return res.status(400).json({error: `Unknown upsell IDs: ${unknown.join(', ')}`, fallbackUrl: FALLBACK_URL});
}
const enrichedUpsells = upsellIds.map(id => UPSELLS.find(u => u.id === id));
const upsellTotal = enrichedUpsells.reduce((sum, u) => sum + u.price, 0);
```

### Fire-and-forget notification (upsells present only)
```javascript
// Source: lib/notify.js — sendUpsellNotification never throws
if (enrichedUpsells.length > 0) {
  sendUpsellNotification({guest, checkIn, checkOut, confirmationCode, upsells: enrichedUpsells});
}
```

### Error mapping pattern
```javascript
if (!resp.ok) {
  if (resp.status === 410) {
    return res.status(410).json({error: 'Quote has expired', code: 'QUOTE_EXPIRED', fallbackUrl: FALLBACK_URL});
  }
  if (resp.status === 402 || resp.status === 422) {
    return res.status(402).json({error: 'Payment declined', code: 'PAYMENT_DECLINED', fallbackUrl: FALLBACK_URL});
  }
  console.error('Guesty instant-book error:', resp.status);
  return res.status(500).json({error: 'Booking failed', code: 'BOOKING_FAILED', fallbackUrl: FALLBACK_URL});
}
```

### Test mock for instant-book (two-call fetch mock)
```javascript
// Source: tests/quote.test.js (established project pattern)
import {describe, it, mock} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/book.js';

const BEAPI_TOKEN_URL = 'https://booking.guesty.com/oauth2/token';
const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';

function mockResponse(status, body = {}) {
  return {status, ok: status >= 200 && status < 300, headers: {get: () => null}, json: async () => body};
}
function tokenResp() {
  return mockResponse(200, {access_token: 'test-token', expires_in: 86400});
}

const mockBookResponse = {
  _id: 'res-abc123',
  status: 'confirmed',
  confirmationCode: 'SCR-99999',
  platform: 'direct',
};

const mockFetch = mock.fn(async (url) => {
  if (url === BEAPI_TOKEN_URL) return tokenResp();
  return mockResponse(200, mockBookResponse);
});
mock.method(globalThis, 'fetch', mockFetch);
// ... await handler(req, res) ...
mock.restoreAll();
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 24.13.1) |
| Config file | none — run directly |
| Quick run command | `node --test tests/book.test.js` |
| Full suite command | `node --test tests/*.test.js` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOK-01 | Valid POST body calls Guesty instant-book and returns 200 with reservationId + confirmationCode | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-01 | Missing quoteId returns 400 | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-01 | Missing ccToken returns 400 | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-01 | ccToken without `pm_` prefix returns 400 | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-01 | Missing guest sub-field returns 400 | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-01 | Guesty returns 410 → response has code QUOTE_EXPIRED | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-01 | Guesty returns 422 → response has code PAYMENT_DECLINED | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-01 | Guesty returns 500 → response has code BOOKING_FAILED | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-02 | Success response includes reservationId, confirmationCode, status: "confirmed" | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-03 | Unknown upsell ID returns 400 | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-03 | Valid upsells compute upsellTotal from catalog prices | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-03 | Upsells present: sendUpsellNotification is called post-confirmation | unit | `node --test tests/book.test.js` | Wave 0 |
| BOOK-03 | No upsells: sendUpsellNotification is not called | unit | `node --test tests/book.test.js` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/book.test.js`
- **Per wave merge:** `node --test tests/*.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/book.test.js` — covers BOOK-01, BOOK-02, BOOK-03 (does not exist yet)
- [ ] `api/book.js` — the handler itself (does not exist yet)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v24.13.1 | — |
| Vercel env: GUESTY_CLIENT_ID | guestyFetch auth | Assumed set | — | Tests mock fetch; runtime requires it |
| Vercel env: GUESTY_CLIENT_SECRET | guestyFetch auth | Assumed set | — | Tests mock fetch; runtime requires it |
| Vercel env: GUESTY_LISTING_ID | Not needed by book.js | n/a | — | — |
| Vercel env: RESEND_API_KEY | sendUpsellNotification | Assumed set | — | notify.js handles missing key gracefully (logs, does not throw) |
| Guesty BEAPI instant-book endpoint | BOOK-01 | External service | — | No fallback — Sebastian must confirm property is set to instant-book mode |
| node:test | Test runner | Yes | Built-in Node 24.13.1 | — |

**Missing dependencies with no fallback:**
- Guesty BEAPI instant-book availability requires Sebastian to confirm the property listing is configured for instant booking. This is documented in STATE.md as a Phase 4 pre-flight blocker.

**Missing dependencies with fallback:**
- RESEND_API_KEY: `lib/notify.js` already handles the missing key by logging and returning without error. Upsell notification emails will silently not send until the key is present.

---

## Open Questions

1. **Exact Guesty error status for expired quote**
   - What we know: HTTP 410 Gone is the standard REST convention for expired resources; Guesty BEAPI FAQ does not document specific error codes
   - What's unclear: Guesty may return 400 or 422 instead of 410 for expired quotes
   - Recommendation: Map 410 → QUOTE_EXPIRED as primary, but also check response body for an "expired" string if `resp.ok` is false. Refine after observing first real failure in Vercel logs.

2. **Whether `ratePlanId` is strictly required by Guesty**
   - What we know: Official docs say "required — ensure you supply one of the rate plan IDs returned in the quote payload"
   - What's unclear: Whether omitting it causes a 400 or Guesty silently uses a default plan
   - Recommendation: Always include `ratePlanId` if present in the inbound request; document that frontend must pass it (it comes from the quote response).

3. **checkIn / checkOut for the notification**
   - What we know: `sendUpsellNotification` requires `checkIn` and `checkOut` strings
   - What's unclear: The `/api/book` request body in CONTEXT.md does not explicitly include checkIn/checkOut
   - Recommendation: Either include checkIn/checkOut in the inbound request body (simplest — frontend already has them), or retrieve them from the quoteId via a Guesty quote lookup. Adding them to the inbound request body is strongly preferred to avoid an extra Guesty API call.

---

## Sources

### Primary (HIGH confidence)
- `https://booking-api-docs.guesty.com/reference/createinstantreservationfromquote` — Response body schema (reservationId, confirmationCode, status fields)
- `https://booking-api-docs.guesty.com/reference/createinquiryreservationfromquote` — Request body schema (ccToken field name, ratePlanId, guest object shape with example JSON)
- `https://booking-api-docs.guesty.com/docs/stripe-tokenization-flow` — Confirmed ccToken is the field name for Stripe pm_xxx tokens
- `https://booking-api-docs.guesty.com/docs/booking-flow` — Required fields: quoteId, ratePlanId, ccToken, guest, policy
- `api/quote.js`, `lib/guesty.js`, `lib/notify.js`, `lib/upsells-config.js`, `tests/quote.test.js` — Project pattern source of truth

### Secondary (MEDIUM confidence)
- `https://booking-api-docs.guesty.com/docs/api-intro` — Rate limit (429) and retry-after header behavior; no error body schema documented
- `https://booking-api-docs.guesty.com/docs/new-reservation-creation-flow` — Confirmed two-step flow (create quote → instant book)
- `SUNSHINE-BOOKING-SPEC.md` — Project build spec with API route shapes and confirmed instant-book URL

### Tertiary (LOW confidence)
- Error status code mapping (410/402/422) — inferred from HTTP conventions; Guesty does not publish explicit error codes per status

---

## Project Constraints (from CLAUDE.md)

| Constraint | Impact on Phase 4 |
|------------|-------------------|
| Node.js serverless functions on Vercel — match existing `/api/calendar` pattern | `api/book.js` exports `default async function handler(req, res)` |
| Vanilla JS only — no TypeScript, no build tools | Plain `.js` file, no type annotations |
| Credentials as Vercel env vars only — never in frontend | `ccToken` is a Stripe token, never raw card data; GUESTY credentials stay in env |
| CORS: allow requests from GitHub Pages domain | `setCors()` function in handler — same as quote.js |
| Booking type: instant book only | Use `/quotes/{quoteId}/instant` endpoint exclusively |
| `node:test` built-in — no external test framework | `import {describe, it, mock} from 'node:test'` |
| `mock.method(globalThis, 'fetch', ...)` for test isolation | Two-call mock: token URL → book URL |
| Always include `fallbackUrl` in error responses | All error returns include `fallbackUrl: FALLBACK_URL` |
| camelCase for all variables and function names | `ccToken`, `ratePlanId`, `upsellTotal`, `reservationId` |
| `guestyFetch` from `lib/guesty.js` — never raw fetch for BEAPI calls | Import and use `guestyFetch` |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project code, no new dependencies
- Architecture: HIGH — verified BEAPI request/response shape from official docs; established patterns from Phases 1-3
- Guesty ccToken field name: HIGH — confirmed from official BEAPI reference docs with example JSON
- Error code mapping: MEDIUM — inferred from HTTP conventions; Guesty does not publish per-error status codes
- Pitfalls: HIGH — derived from existing code, Phase 1-3 patterns, and test suite review

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (Guesty BEAPI is stable; token/auth pattern well-established)
