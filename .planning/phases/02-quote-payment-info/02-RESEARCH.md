# Phase 2: Quote + Payment Info - Research

**Researched:** 2026-04-06
**Domain:** Guesty BEAPI quotes endpoint, Guesty payment-provider endpoint, Stripe publishable key, Vercel serverless patterns
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- POST method for quote endpoint (creates a quote resource in Guesty)
- Pass through Guesty's rate plan structure: `quoteId`, `expiresAt`, `ratePlans[]` (each with `days[]` and `totals`), matching spec section 5.3
- Return all rate plans from Guesty — let frontend display or auto-select
- Request body: `{ checkIn, checkOut, guests, guest: { firstName, lastName, email, phone } }`
- Calls `POST https://booking.guesty.com/api/reservations/quotes`
- Include `fallbackUrl` in all error responses (consistent with Phase 1 pattern)
- Input validation: require all fields, validate date formats, validate guest object shape
- GET method for payment-info, no parameters needed (uses hardcoded `GUESTY_LISTING_ID`)
- Returns `{ providerType, stripeAccountId, stripePublishableKey, fallbackUrl }` in one response
- `stripePublishableKey` comes from `STRIPE_PUBLISHABLE_KEY` env var (safe — it's a public key)
- When `STRIPE_PUBLISHABLE_KEY` is missing: return `stripeAccountId: null, stripePublishableKey: null` with `fallbackUrl` — NOT an error
- Calls `GET https://booking.guesty.com/api/listings/{GUESTY_LISTING_ID}/payment-provider`
- No caching — lightweight single call

### Claude's Discretion

- Error message wording for validation failures
- Exact JSON field naming beyond what spec defines
- Test structure and mocking approach (follow Phase 1 patterns)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUOTE-01 | Create reservation quote with full price breakdown (nightly rates, cleaning, fees, taxes, total) | Guesty BEAPI `POST /api/reservations/quotes` confirmed in spec; request body and response shape documented in spec section 5.3 |
| QUOTE-02 | Quote includes rate plan details and per-night pricing | `ratePlans[].days[]` per-night breakdown in spec response shape; `totals` object with accommodation/cleaning/fees/taxes/total confirmed |
| QUOTE-03 | Quote response includes expiry timestamp | `expiresAt` field in Guesty quote response; pass through directly |
| PAY-01 | Retrieve Stripe connected account ID (`acct_xxx`) from Guesty payment provider endpoint | `GET /api/listings/{id}/payment-provider` confirmed in spec section 5.4; returns `providerAccountId` |
| PAY-02 | Return provider type and account ID to frontend for Stripe.js initialization | Response shape `{ providerType, stripeAccountId }` defined in spec 5.4; extended by CONTEXT.md to include `stripePublishableKey` and `fallbackUrl` |
</phase_requirements>

---

## Summary

Phase 2 adds two serverless endpoints — `api/quote.js` and `api/payment-info.js` — both built on `lib/guesty.js` from Phase 1. The code patterns are identical to `api/availability.js`: import `guestyFetch`, set CORS, validate input, call Guesty, transform response, return JSON with `fallbackUrl` on errors.

The quote endpoint is the heavier of the two: it accepts a POST body, validates all fields (including the nested `guest` object), calls `POST https://booking.guesty.com/api/reservations/quotes`, and passes through the full `ratePlans` array. The key design decision is minimal transformation — return Guesty's structure nearly verbatim so the frontend (Phase 5) can choose which rate plan to display or auto-select.

The payment-info endpoint is deliberately simple: one `guestyFetch` call plus one `process.env` read. The only non-trivial logic is the graceful degradation when `STRIPE_PUBLISHABLE_KEY` is absent — return `{ stripeAccountId: null, stripePublishableKey: null, fallbackUrl }` as a 200 success, not an error. This allows the frontend to detect the missing key and redirect to the Guesty booking page without treating it as a failure.

**Primary recommendation:** Build `api/quote.js` first (more logic to test), then `api/payment-info.js` (simpler), with test files stubbed in Wave 0 following the `node:test` + `mock.method(globalThis, 'fetch', ...)` pattern established in Phase 1.

---

## Project Constraints (from CLAUDE.md)

These directives are mandatory. All plans must comply.

| Constraint | Source | Impact on Phase 2 |
|---|---|---|
| API stack: Node.js serverless on Vercel — match existing `/api/calendar` pattern | CLAUDE.md | `api/quote.js` and `api/payment-info.js` use `export default async function handler(req, res)` |
| Frontend: Vanilla HTML/JS/CSS — no React, no build tools | CLAUDE.md | Not applicable to Phase 2 (API only) |
| Stripe: Client-side tokenization only, never touch card data server-side | CLAUDE.md | Payment-info returns publishable key (public) only — no secret key, no card data |
| Credentials: Guesty client ID/secret as Vercel env vars only, never in frontend | CLAUDE.md | `guestyFetch` in `lib/guesty.js` reads credentials; routes never expose them |
| No TypeScript — plain JavaScript only | CLAUDE.md conventions | `.js` files with no type annotations |
| camelCase everywhere — no UPPER_SNAKE_CASE for module-level state | CLAUDE.md conventions | Constants like `FALLBACK_URL` and `BEAPI_QUOTES_URL` are acceptable screaming-snake for true constants; module state uses camelCase |
| node:test built-in — no external test framework | STATE.md Phase 01 decision | Tests use `import { describe, it, mock } from 'node:test'` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fetch` | v24.13.1 runtime | HTTP client for Guesty API calls | Already used in Phase 1; no external dependency needed |
| `lib/guesty.js` | Phase 1 artifact | Auth + fetch wrapper | Auth handled transparently; routes just call `guestyFetch()` |
| `node:test` | Node.js built-in | Unit testing | Established in Phase 1; `mock.method(globalThis, 'fetch', ...)` pattern proven |
| `node:assert/strict` | Node.js built-in | Assertions in tests | Established in Phase 1 |

### No New Dependencies
This phase introduces zero new npm packages. All required functionality is already present:
- `lib/guesty.js` — BEAPI auth and fetch
- Node.js built-in `fetch` — HTTP
- `node:test` — testing
- Vercel serverless platform — hosting

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

```
api/
├── calendar.js          # (existing) iCal proxy — Open API scope
├── availability.js      # (Phase 1) BEAPI availability check
├── quote.js             # (Phase 2) BEAPI quote creation — POST
└── payment-info.js      # (Phase 2) Stripe account info — GET

lib/
└── guesty.js            # (Phase 1) shared auth + fetch wrapper

tests/
├── guesty.test.js       # (Phase 1) auth/retry tests
├── availability.test.js # (Phase 1) availability tests
├── quote.test.js        # (Phase 2) quote validation + response tests
└── payment-info.test.js # (Phase 2) payment-info fallback tests
```

### Pattern 1: Endpoint Skeleton (POST variant for quote.js)

All Phase 2 endpoints follow the exact pattern established in `api/availability.js`:

```javascript
// api/quote.js
// POST /api/quote
// Requirements: QUOTE-01, QUOTE-02, QUOTE-03

import {guestyFetch} from '../lib/guesty.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const QUOTES_URL = 'https://booking.guesty.com/api/reservations/quotes';
const ALLOWED_ORIGINS = [
  'https://mattgshepard-prog.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.find(o => origin.startsWith(o));
  res.setHeader('Access-Control-Allow-Origin', allowed || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed', fallbackUrl: FALLBACK_URL});
  }
  // ... validation, guestyFetch, response
}
```

### Pattern 2: Input Validation (POST body with nested object)

Quote validation must cover: top-level fields present, date format valid, checkOut > checkIn, guests positive integer, and guest sub-object has all required string fields.

```javascript
const {checkIn, checkOut, guests, guest} = req.body || {};

if (!checkIn || !checkOut || !guests || !guest) {
  return res.status(400).json({error: 'checkIn, checkOut, guests, and guest are required', fallbackUrl: FALLBACK_URL});
}
const inDate = new Date(checkIn);
const outDate = new Date(checkOut);
if (isNaN(inDate) || isNaN(outDate)) {
  return res.status(400).json({error: 'Dates must be valid ISO format (YYYY-MM-DD)', fallbackUrl: FALLBACK_URL});
}
if (outDate <= inDate) {
  return res.status(400).json({error: 'checkOut must be after checkIn', fallbackUrl: FALLBACK_URL});
}
const guestCount = parseInt(guests, 10);
if (isNaN(guestCount) || guestCount < 1) {
  return res.status(400).json({error: 'guests must be a positive integer', fallbackUrl: FALLBACK_URL});
}
const {firstName, lastName, email, phone} = guest;
if (!firstName || !lastName || !email || !phone) {
  return res.status(400).json({error: 'guest must include firstName, lastName, email, and phone', fallbackUrl: FALLBACK_URL});
}
```

### Pattern 3: Guesty Quote Request Body Mapping

The frontend sends camelCase date fields; Guesty BEAPI expects `checkInDateLocalized` / `checkOutDateLocalized`:

```javascript
const resp = await guestyFetch(QUOTES_URL, {
  method: 'POST',
  body: JSON.stringify({
    checkInDateLocalized: checkIn,
    checkOutDateLocalized: checkOut,
    listingId: process.env.GUESTY_LISTING_ID,
    guestsCount: guestCount,
    guest: {firstName, lastName, email, phone},
  }),
});
```

### Pattern 4: Quote Response Passthrough

Return Guesty's structure with minimal transformation — renaming `_id` to `quoteId` if needed:

```javascript
const data = await resp.json();
return res.status(200).json({
  quoteId: data._id || data.quoteId,
  expiresAt: data.expiresAt,
  ratePlans: data.ratePlans || [],
});
```

### Pattern 5: Payment-Info Graceful Degradation

The most important non-trivial logic in this phase — missing `STRIPE_PUBLISHABLE_KEY` is a 200 success with nulls plus `fallbackUrl`:

```javascript
// api/payment-info.js
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || null;

const resp = await guestyFetch(
  `https://booking.guesty.com/api/listings/${process.env.GUESTY_LISTING_ID}/payment-provider`
);
if (!resp.ok) {
  return res.status(500).json({error: 'Failed to retrieve payment info', fallbackUrl: FALLBACK_URL});
}
const data = await resp.json();

// When Stripe key is missing — 200 with nulls and fallbackUrl, not an error
if (!stripePublishableKey) {
  return res.status(200).json({
    providerType: data.providerType || null,
    stripeAccountId: null,
    stripePublishableKey: null,
    fallbackUrl: FALLBACK_URL,
  });
}

return res.status(200).json({
  providerType: data.providerType,
  stripeAccountId: data.providerAccountId,
  stripePublishableKey,
  fallbackUrl: FALLBACK_URL,
});
```

### Pattern 6: Test Structure (node:test, mock.method)

Follow Phase 1 test conventions exactly. For POST endpoints, construct `req` with `body` property:

```javascript
// tests/quote.test.js
import {describe, it, mock} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/quote.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const BEAPI_TOKEN_URL = 'https://booking.guesty.com/oauth2/token';

function mockReqRes(body = {}) {
  const headers = {};
  const res = {
    _status: 200, _body: null,
    status(code) { this._status = code; return this; },
    json(b) { this._body = b; return this; },
    setHeader(k, v) { headers[k] = v; },
    end() {},
  };
  return {req: {method: 'POST', headers: {}, body}, res};
}

function mockResponse(status, body = {}) {
  return {
    status, ok: status >= 200 && status < 300,
    headers: {get: () => null},
    json: async () => body,
  };
}
```

### Anti-Patterns to Avoid

- **Method mismatch on vercel.json CORS:** The existing `vercel.json` only declares `GET, OPTIONS` in `Access-Control-Allow-Methods`. The quote endpoint is POST — update the per-route `setCors()` to include `POST`, and note that the global `vercel.json` header block may need updating or the per-handler override takes precedence at response time (Phase 1 confirmed per-handler wins).
- **Assuming Guesty returns `quoteId` directly:** Guesty likely returns `_id` as the document identifier. Check `data._id || data.quoteId` to be safe. Do not assume field name without handling both.
- **Treating missing STRIPE_PUBLISHABLE_KEY as an error:** The frontend relies on detecting `stripeAccountId: null` to show the fallback URL redirect. An HTTP 500 would break this flow.
- **Forgetting `Content-Type: application/json` is already set by guestyFetch:** `lib/guesty.js` already merges `Content-Type: application/json` into every request. Do not double-set it in the route.
- **Reading `req.body` without awareness of Vercel's JSON parsing:** Vercel automatically parses JSON request bodies when `Content-Type: application/json`. The handler receives `req.body` as a parsed object — no `JSON.parse()` needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| BEAPI authentication | Custom token fetch in route | `guestyFetch` from `lib/guesty.js` | Auth, 401 retry, and 429 retry already handled |
| HTTP client | Custom fetch wrapper | Node.js built-in `fetch` via `guestyFetch` | Already abstracted; adding another layer is wasteful |
| JSON body parsing | Manual `req.read()` stream | `req.body` (Vercel auto-parses) | Vercel parses `application/json` bodies automatically |
| Test mocking framework | Custom spy/stub helpers | `mock.method(globalThis, 'fetch', ...)` | Established in Phase 1; works correctly in Node 24.13.1 |

**Key insight:** Phase 2 is intentionally thin — all the hard infrastructure (auth, retry, CORS, error patterns) was built in Phase 1. These two routes are wiring exercises, not architecture exercises.

---

## Common Pitfalls

### Pitfall 1: Guesty Quote Field Name — `_id` vs `quoteId`
**What goes wrong:** Code references `data.quoteId` but Guesty returns `data._id` (MongoDB ObjectId pattern). The response returns `quoteId: undefined`.
**Why it happens:** The spec example uses `quoteId` as the label, but REST APIs following MongoDB conventions often use `_id` as the actual field name.
**How to avoid:** Return `data._id || data.quoteId` defensively. Log the raw response shape during Wave 0 test authoring if uncertain.
**Warning signs:** `quoteId` is `undefined` in integration tests against real Guesty.

### Pitfall 2: POST Body Not Accessible on `req.body`
**What goes wrong:** Route reads `req.body` but it is `undefined` — handler was tested with a GET-style mock that didn't set `body`.
**Why it happens:** Test helper `mockReqRes` was copied from `availability.test.js` which uses `req.query`. POST tests need `body` on the request object.
**How to avoid:** Test helper for quote must use `{req: {method: 'POST', headers: {}, body}, res}` not `query`.
**Warning signs:** Validation fails with "checkIn required" even when body is populated — means `req.body` is undefined.

### Pitfall 3: vercel.json CORS Methods Mismatch
**What goes wrong:** Browser preflight for `POST /api/quote` gets `Access-Control-Allow-Methods: GET, OPTIONS` from vercel.json global headers and blocks the request.
**Why it happens:** The global `vercel.json` header block was set to `GET, OPTIONS` for Phase 1. The per-handler `setCors()` sets the right methods, but vercel.json headers merge/override behavior can vary.
**How to avoid:** The per-handler `res.setHeader()` call runs after vercel.json headers and wins at response time (confirmed in Phase 1 notes). Set `Access-Control-Allow-Methods: POST, OPTIONS` in `setCors()` for the quote handler. No vercel.json change needed unless integration testing reveals a conflict.
**Warning signs:** Browser shows CORS error for POST but not GET from same origin.

### Pitfall 4: `guestyFetch` Sending Wrong `Content-Type` for GET
**What goes wrong:** `payment-info.js` calls `guestyFetch(url)` with no options, but `lib/guesty.js` always injects `Content-Type: application/json`. Some APIs reject GET requests with that header.
**Why it happens:** `guestyFetch` was designed for POST-heavy BEAPI usage. The default header injection applies to all methods.
**How to avoid:** Guesty BEAPI generally ignores `Content-Type` on GET requests. This is documented as LOW risk — Guesty's own booking engine frontend likely sends similar headers. Monitor for unexpected 400s on the payment-provider endpoint.
**Warning signs:** `payment-info` returns 400 from Guesty even with correct URL and valid token.

### Pitfall 5: Module Cache State Between Tests
**What goes wrong:** `lib/guesty.js` caches the token in a module-level variable. If a previous test populates the token cache, subsequent tests may not call the token endpoint — causing assertions about token fetch count to fail.
**Why it happens:** Node.js ES module cache persists across test cases in the same file unless deliberately busted.
**How to avoid:** Phase 1 established the query-string cache-bust pattern: `await import('../lib/guesty.js?t=${Date.now()}')` in `beforeEach`. Use the same approach in `quote.test.js` if testing token behavior. For `payment-info.test.js`, mock `globalThis.fetch` at the test level and call `mock.restoreAll()` after each test.
**Warning signs:** Token endpoint called 0 times when test expects 1, or called multiple times when test expects reuse.

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 2 is a greenfield addition of two new API endpoints. No renames, refactors, or migrations involved.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v24.13.1 | — |
| `GUESTY_LISTING_ID` env var | Both endpoints | Assumed set (Phase 1 complete) | — | Phase 1 must be verified first |
| `GUESTY_CLIENT_ID` env var | `lib/guesty.js` auth | Assumed set (Phase 1 complete) | — | — |
| `GUESTY_CLIENT_SECRET` env var | `lib/guesty.js` auth | Assumed set (Phase 1 complete) | — | — |
| `STRIPE_PUBLISHABLE_KEY` env var | `api/payment-info.js` | Not yet received from Sebastian | — | Return `null` with `fallbackUrl` (design intent) |
| Vercel platform | Deployment | Yes (Phase 1 deployed) | — | — |

**Missing dependencies with no fallback:**
- None — the missing `STRIPE_PUBLISHABLE_KEY` is intentionally handled by the fallback degradation design.

**Missing dependencies with fallback:**
- `STRIPE_PUBLISHABLE_KEY` — absent until Sebastian provides it. `api/payment-info.js` returns `{ stripeAccountId: null, stripePublishableKey: null, fallbackUrl }` as a 200 response. Frontend redirects to Guesty page. This is the designed behavior, not a failure mode.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (v24.13.1) |
| Config file | None — run directly with `node --test` |
| Quick run command | `node --test tests/quote.test.js tests/payment-info.test.js` |
| Full suite command | `node --test tests/*.test.js` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUOTE-01 | Valid POST body returns 200 with nightly rates, cleaning, fees, taxes, total in `ratePlans[].totals` | unit | `node --test tests/quote.test.js` | No — Wave 0 |
| QUOTE-02 | `ratePlans[].days[]` contains per-night date + price entries | unit | `node --test tests/quote.test.js` | No — Wave 0 |
| QUOTE-03 | Response includes `expiresAt` timestamp | unit | `node --test tests/quote.test.js` | No — Wave 0 |
| QUOTE-01 | Missing `checkIn` returns 400 with error + fallbackUrl | unit | `node --test tests/quote.test.js` | No — Wave 0 |
| QUOTE-01 | Missing `guest.email` returns 400 with error + fallbackUrl | unit | `node --test tests/quote.test.js` | No — Wave 0 |
| QUOTE-01 | `checkOut <= checkIn` returns 400 with error | unit | `node --test tests/quote.test.js` | No — Wave 0 |
| PAY-01 | Guesty payment-provider response maps to `stripeAccountId` | unit | `node --test tests/payment-info.test.js` | No — Wave 0 |
| PAY-02 | Response includes `providerType` and `stripeAccountId` | unit | `node --test tests/payment-info.test.js` | No — Wave 0 |
| PAY-02 (success crit.) | Missing `STRIPE_PUBLISHABLE_KEY` returns 200 with `stripeAccountId: null` and `fallbackUrl` | unit | `node --test tests/payment-info.test.js` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/quote.test.js tests/payment-info.test.js`
- **Per wave merge:** `node --test tests/*.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/quote.test.js` — covers QUOTE-01, QUOTE-02, QUOTE-03 (stub with `assert.fail('not implemented')`)
- [ ] `tests/payment-info.test.js` — covers PAY-01, PAY-02, and missing-key fallback (stub with `assert.fail('not implemented')`)

*(Existing `tests/guesty.test.js` and `tests/availability.test.js` from Phase 1 must remain green throughout.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External framework (Jest, Mocha) | `node:test` built-in | Node.js 18+ | Zero dependencies, Phase 1 decision |
| Per-route token fetch logic | `lib/guesty.js` shared wrapper | Phase 1 | Routes are thin; auth is invisible |

**No deprecated patterns relevant to this phase.**

---

## Open Questions

1. **Exact Guesty quote response field names (especially quote ID)**
   - What we know: Spec example uses `quoteId`; MongoDB-style APIs often return `_id`
   - What's unclear: Whether Guesty BEAPI normalizes `_id` → `quoteId` in its response or returns raw `_id`
   - Recommendation: Return `data._id || data.quoteId` defensively. The Phase 4 (booking) endpoint will need the exact field name too — note this for cross-phase consistency.

2. **Guesty payment-provider response field for Stripe account ID**
   - What we know: Spec says `providerAccountId` is the field; CONTEXT.md maps it to `stripeAccountId` in our response
   - What's unclear: Whether the actual field is `providerAccountId`, `accountId`, or `stripeAccountId` on the Guesty side
   - Recommendation: Map `data.providerAccountId || data.accountId` defensively. Integration test against real Guesty before Phase 6 depends on this.

3. **vercel.json `Access-Control-Allow-Methods` for POST**
   - What we know: Phase 1 confirmed per-handler `res.setHeader()` wins over vercel.json headers at response time. vercel.json currently lists `GET, OPTIONS`.
   - What's unclear: Whether browser preflights see vercel.json headers before the handler runs (pre-handler header injection)
   - Recommendation: Per-handler CORS in `setCors()` is sufficient. If integration testing reveals preflight blocking, add a second `headers` block in vercel.json scoped to `/api/quote`.

---

## Sources

### Primary (HIGH confidence)
- `api/availability.js` (codebase) — canonical endpoint pattern: CORS, validation, guestyFetch, error shape, fallbackUrl
- `lib/guesty.js` (codebase) — confirmed `guestyFetch` signature, Content-Type injection behavior, 401/429 retry flags
- `tests/availability.test.js` (codebase) — confirmed `mockReqRes`, `mockResponse`, `mock.method(globalThis, 'fetch', ...)` test pattern for Phase 2 test files
- `SUNSHINE-BOOKING-SPEC.md` sections 5.3 and 5.4 — Guesty request/response shapes for quote and payment-provider endpoints
- `.planning/phases/02-quote-payment-info/02-CONTEXT.md` — locked decisions for both endpoints

### Secondary (MEDIUM confidence)
- `SUNSHINE-BOOKING-SPEC.md` section 5.1 — token endpoint and base URL confirmed consistent with Phase 1 implementation
- STATE.md Phase 01 decisions — `mock.method(globalThis, 'fetch')` confirmed working in Node 24.13.1; `mock.module()` not available

### Tertiary (LOW confidence)
- Guesty quote field name `_id` vs `quoteId` — inferred from MongoDB-style API convention; not directly verifiable without live API call. Defensive handling recommended.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all Phase 1 libraries re-used; no new dependencies
- Architecture: HIGH — endpoint skeleton is a direct copy of `api/availability.js` with POST variant and different validation
- Pitfalls: MEDIUM — CORS method mismatch and `_id` vs `quoteId` are inferred risks, not observed failures; graceful degradation pattern is HIGH confidence from CONTEXT.md decision
- Test architecture: HIGH — `node:test` pattern proven in Phase 1; Wave 0 stubs follow established convention

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable domain — Guesty BEAPI and Vercel serverless patterns are not fast-moving)
