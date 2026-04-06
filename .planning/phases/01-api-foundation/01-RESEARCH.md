# Phase 1: API Foundation - Research

**Researched:** 2026-04-06
**Domain:** Guesty Booking Engine API (BEAPI), Vercel Serverless Functions, CORS
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Separate `lib/guesty.js` for BEAPI token management — leave existing `api/calendar.js` self-contained with its own Open API token
- Use module-level variable for token caching (not Vercel KV) — Vercel fluid compute preserves module state, and low traffic won't exhaust 3 renewals/24h
- Calculate absolute expiry timestamp on fetch, check `Date.now()` before each call with 5-minute buffer before expiry
- `lib/guesty.js` exposes a general-purpose `guestyFetch(path, options)` wrapper that auto-attaches Bearer token and handles 401 retry transparently
- `/api/availability` returns `{ available: false, listing: null }` when dates are unavailable (clean boolean, no error thrown)
- All error responses include `fallbackUrl` pointing to Guesty booking page (`https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96`)
- Validate inputs before calling Guesty: dates exist, valid ISO format, checkOut > checkIn, guests is positive integer — reject bad input before burning rate limit
- Handle Guesty 429 with exponential backoff and 1 retry
- Allow origins: `mattgshepard-prog.github.io` + `localhost` for dev
- Configure CORS both in vercel.json headers AND per-route OPTIONS handler (matching existing calendar.js pattern)
- One-time listing discovery script (`scripts/discover-listing.js`) — run once, output listing ID, hardcode as `GUESTY_LISTING_ID` env var
- Discovery script also validates BEAPI credentials work (test token acquisition + search in one script)
- BEAPI base URLs: `booking-api.guesty.com/v1` for search, `booking.guesty.com` for quotes/reservations
- Token endpoint: `https://booking.guesty.com/oauth2/token` with scope `booking_engine:api`
- Search endpoint: `GET https://booking-api.guesty.com/v1/search?checkIn=X&checkOut=X&adults=N`
- Never create Stripe Customer, pm_xxx tokens are single-use, BEAPI and Open API tokens cannot be shared

### Claude's Discretion

None stated.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Server-side OAuth2 token acquisition from Guesty BEAPI (`booking.guesty.com/oauth2/token`) | Token endpoint, grant_type, scope, and request shape verified against official BEAPI docs |
| AUTH-02 | Token caching with module-level variable (reuse until 5 min before expiry) | Vercel fluid compute confirmed to preserve module-level state across warm invocations; race condition risk documented |
| AUTH-03 | Separate token management for BEAPI scope (`booking_engine:api`) vs existing Open API scope | Confirmed scopes are entirely separate — BEAPI token cannot be used for Open API and vice versa |
| AUTH-04 | Automatic token refresh on 401 response with single retry | Pattern established in existing calendar.js; 401 retry loop documented with flag to prevent infinite recursion |
| LIST-01 | One-time listing ID discovery via Guesty `/v1/search` API | Search endpoint and response shape (`id` field, `title`, `nightlyRates`) verified |
| LIST-02 | Listing ID stored as `GUESTY_LISTING_ID` Vercel environment variable | Environment variable pattern already in use in calendar.js; just needs new key |
| AVAIL-01 | Real-time availability check for given check-in/check-out dates and guest count | Search endpoint parameters (`checkIn`, `checkOut`, `adults`) confirmed; response shape documented |
| AVAIL-02 | Returns availability status and nightly rate from Guesty search endpoint | `nightlyRates` date-keyed object in response; nightly rate extraction pattern documented |
| INFRA-01 | CORS headers allowing requests from GitHub Pages domain | vercel.json limitation with multiple origins documented; per-route dynamic origin validation pattern identified |
| INFRA-02 | Guesty credentials stored as Vercel environment variables (never in frontend) | Established pattern in calendar.js; enforced by CLAUDE.md constraint |
| INFRA-03 | Input validation on all API routes before passing to Guesty | Validation requirements documented; date format, range, and guest count checks specified |
| INFRA-04 | Rate limit awareness (5 req/s, 275 req/min) with 429 retry logic | 429 + Retry-After header pattern verified from Guesty docs; exponential backoff with 1 retry specified |
</phase_requirements>

---

## Summary

Phase 1 builds the BEAPI authentication layer (`lib/guesty.js`), the availability endpoint (`api/availability.js`), and a one-time listing discovery script. The core challenge is keeping BEAPI credentials and token management completely isolated from the existing Open API flow in `api/calendar.js` — these two auth systems share client ID/secret but use different token endpoints, scopes, and base URLs.

The Guesty BEAPI token lifecycle is well-documented and confirmed: `POST https://booking.guesty.com/oauth2/token` with `scope=booking_engine:api`, 24-hour lifetime (86400s), max 3 renewals per 24 hours. The module-level caching strategy is safe for Vercel fluid compute — module state is preserved across warm invocations — but a small race condition window exists under concurrent requests (documented in pitfalls). The 5-minute expiry buffer (consistent with the 60-second buffer already used in `calendar.js`, but extended to 5 minutes to protect the 3-renewal limit) is the right call.

CORS requires careful handling: `vercel.json` supports only a single static `Access-Control-Allow-Origin` value, but this phase needs to allow both `mattgshepard-prog.github.io` (production) and `localhost` (dev). The solution is per-route dynamic origin validation matching the existing `calendar.js` pattern but with a specific allowed-list check rather than the wildcard `*` currently used.

**Primary recommendation:** Build `lib/guesty.js` first (token cache + `guestyFetch` wrapper), verify it independently with the discovery script, then wire `api/availability.js` on top of it.

---

## Project Constraints (from CLAUDE.md)

These directives are mandatory. All plans must comply.

| Constraint | Source | Impact on Phase 1 |
|---|---|---|
| API stack: Node.js serverless on Vercel — match existing `/api/calendar` pattern | CLAUDE.md | All new routes follow `export default async function handler(req, res)` pattern |
| Frontend: Vanilla HTML/JS/CSS — no React, no build tools | CLAUDE.md | Not applicable to Phase 1 (API only) |
| Stripe: Client-side tokenization only, never touch card data server-side | CLAUDE.md | Not applicable to Phase 1 |
| Credentials: Guesty client ID/secret as Vercel env vars only, never in frontend | CLAUDE.md | `lib/guesty.js` reads only from `process.env` |
| CORS: API must allow requests from GitHub Pages domain | CLAUDE.md | Drives CORS implementation decision |
| Booking type: Instant book only — no inquiry/approval flow | CLAUDE.md | Not applicable to Phase 1 |
| GSD Workflow: All file edits via `/gsd:execute-phase` — no direct repo edits outside workflow | CLAUDE.md | Execution discipline constraint |
| Code style: Compact JS, camelCase, single default export per route, no TypeScript | Conventions | lib/guesty.js and api/availability.js must match |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fetch()` | Node 24.13.1 (runtime) | HTTP client for BEAPI calls | Already used in calendar.js; no external dep needed |
| Node.js built-in `URLSearchParams` | Node 24.13.1 (runtime) | OAuth2 form-encoded body construction | Already used in calendar.js; Vercel confirmed runtime |
| Vercel Serverless Functions | 50.32.3 CLI | Serverless function hosting | Existing project infra |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No additional libraries required | — | — | Phase 1 has no npm dependencies beyond Node builtins |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Module-level token cache | Vercel KV (Redis) | KV adds billing complexity and cold-start latency; module cache works for low-traffic single-property site with 3-renewal/24h token limit |
| Per-route CORS dynamic check | vercel.json static origin | Static config only supports one origin value; localhost dev support requires dynamic check |
| Built-in `fetch()` | `node-fetch`, `axios` | No benefit — Node 24 native fetch is fully capable |

**Installation:** No npm packages to install for Phase 1. Runtime is Node.js 24 with native fetch.

**Version verification:** Node.js v24.13.1 confirmed live on this machine. No npm packages involved.

---

## Architecture Patterns

### Recommended Project Structure

```
api/
  availability.js      # GET /api/availability — BEAPI search wrapper
  calendar.js          # (existing, untouched) Open API calendar proxy
lib/
  guesty.js            # BEAPI token cache + guestyFetch() wrapper
scripts/
  discover-listing.js  # One-time CLI script: acquire token, call search, print listing ID
```

### Pattern 1: BEAPI Token Cache (module-level variable)

**What:** Module-level `cachedToken` and `tokenExpiry` variables in `lib/guesty.js`, initialized to null/0, populated on first call and reused while valid.
**When to use:** Every BEAPI request — callers never touch token logic directly.
**Key difference from calendar.js:** 5-minute buffer (300000ms) instead of 60-second buffer, to protect the 3-renewal/24h limit.

```javascript
// lib/guesty.js
let cachedToken = null;
let tokenExpiry = 0;

async function getBeapiToken() {
  if (cachedToken && Date.now() < tokenExpiry - 300000) return cachedToken;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'booking_engine:api',
    client_id: process.env.GUESTY_CLIENT_ID,
    client_secret: process.env.GUESTY_CLIENT_SECRET,
  });
  const resp = await fetch('https://booking.guesty.com/oauth2/token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) throw new Error(`BEAPI token error: ${resp.status}`);
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}
```

Source: Verified against [Guesty BEAPI Authentication docs](https://booking-api-docs.guesty.com/docs/authentication-1)

### Pattern 2: guestyFetch() with 401 Auto-Retry

**What:** General-purpose wrapper that attaches Bearer token and retries once on 401 with a fresh token.
**When to use:** All BEAPI calls from any route — never call Guesty directly from route handlers.

```javascript
// lib/guesty.js (continued)
export async function guestyFetch(path, options = {}, retried = false) {
  const token = await getBeapiToken();
  const resp = await fetch(path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (resp.status === 401 && !retried) {
    cachedToken = null; // force re-acquire
    tokenExpiry = 0;
    return guestyFetch(path, options, true);
  }
  return resp;
}
```

**Note:** The `retried` flag is critical — without it a persistent 401 causes infinite recursion.

### Pattern 3: CORS with Dynamic Origin Allowlist

**What:** Per-route function that checks `req.headers.origin` against an allowed list and sets the header to the matched origin (or omits it for disallowed origins). `vercel.json` keeps a static wildcard for GET caching compatibility but the function overrides for POST/OPTIONS.
**When to use:** Every handler — must be first in handler body before any async work.

```javascript
// lib/guesty.js or inline in each route
const ALLOWED_ORIGINS = [
  'https://mattgshepard-prog.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

**Alternative:** Keep `*` in vercel.json for the GET availability route (no credentials header needed, no PCI concern), matching how `calendar.js` works. The locked decision allows `mattgshepard-prog.github.io` + `localhost` — both can be served with a dynamic check or a well-crafted vercel.json with a specific production origin and `*` for dev.

Source: Verified against [Vercel CORS KB](https://vercel.com/kb/guide/how-to-enable-cors)

### Pattern 4: Input Validation Before Guesty Calls

**What:** Validate query parameters synchronously before any `await`. Return 400 with descriptive error rather than letting Guesty return a confusing error.
**When to use:** First async operation in every route handler.

```javascript
// api/availability.js
const { checkIn, checkOut, guests } = req.query;
if (!checkIn || !checkOut) {
  return res.status(400).json({ error: 'checkIn and checkOut are required', fallbackUrl: FALLBACK_URL });
}
const inDate = new Date(checkIn);
const outDate = new Date(checkOut);
if (isNaN(inDate) || isNaN(outDate)) {
  return res.status(400).json({ error: 'Dates must be valid ISO format (YYYY-MM-DD)', fallbackUrl: FALLBACK_URL });
}
if (outDate <= inDate) {
  return res.status(400).json({ error: 'checkOut must be after checkIn', fallbackUrl: FALLBACK_URL });
}
const guestCount = parseInt(guests, 10);
if (!guests || isNaN(guestCount) || guestCount < 1) {
  return res.status(400).json({ error: 'guests must be a positive integer', fallbackUrl: FALLBACK_URL });
}
```

### Pattern 5: 429 Retry with Retry-After

**What:** When Guesty returns 429, wait for the `Retry-After` header duration (or a default backoff) then retry once.
**When to use:** Wrap every `guestyFetch()` call in availability handler.

```javascript
async function guestyFetchWithRetry(path, options = {}) {
  const resp = await guestyFetch(path, options);
  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get('retry-after') || '2', 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return guestyFetch(path, options); // single retry only
  }
  return resp;
}
```

Source: [Guesty rate limits documentation](https://open-api-docs.guesty.com/docs/rate-limits) — confirmed `Retry-After` header is present.

### Pattern 6: Listing Discovery Script

**What:** A Node.js script (not a Vercel route) run locally once to discover the listing `id` from the BEAPI search response.
**When to use:** One-time execution. Output is hardcoded as `GUESTY_LISTING_ID` Vercel env var.

```javascript
// scripts/discover-listing.js
// Run with: node scripts/discover-listing.js
import { guestyFetch } from '../lib/guesty.js';

// Test date window — next 30 days
const checkIn = new Date();
checkIn.setDate(checkIn.getDate() + 7);
const checkOut = new Date(checkIn);
checkOut.setDate(checkOut.getDate() + 2);

const fmt = d => d.toISOString().split('T')[0];
const url = `https://booking-api.guesty.com/v1/search?checkIn=${fmt(checkIn)}&checkOut=${fmt(checkOut)}&adults=2`;

const resp = await guestyFetch(url);
const data = await resp.json();
console.log('Listings found:', data.results?.length || 0);
data.results?.forEach(l => console.log(`  id=${l.id}  title=${l.title}`));
```

**Note:** Response field is `id` (not `_id`). Confirmed from BEAPI definitions docs.

### Anti-Patterns to Avoid

- **Sharing BEAPI token with Open API calls:** The `scope=booking_engine:api` token CANNOT authenticate Open API (`scope=open-api`) endpoints and vice versa. `lib/guesty.js` must NEVER be imported into `api/calendar.js`.
- **Calling `getBeapiToken()` without the 5-minute buffer:** With only 3 renewals/24h, burning tokens on premature refresh is costly. Buffer must be 300000ms, not the 60000ms used in `calendar.js`.
- **Putting the retry flag as a default parameter:** The `retried = false` must remain a parameter default (not a module-level flag) so it resets per invocation.
- **Wildcard CORS with sensitive headers:** The current `calendar.js` uses `*` which is fine for public data. The spec says to restrict to the GitHub Pages domain — use the dynamic origin check or accept `*` is acceptable since there are no credentials headers.
- **Node.js 24 concurrent mutation under fluid compute:** Under fluid compute, multiple requests can share one instance. The token cache write (`cachedToken = data.access_token`) is not atomic. For low-traffic single-property site this is acceptable (worst case: two simultaneous cold starts both acquire tokens, both valid, one overwrites the other — no data loss, just one extra token acquisition counted against the 3/day limit).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client | Custom fetch wrapper beyond `guestyFetch` | Node.js built-in `fetch()` | Already available in Node 24; zero deps |
| Token storage | File system, Vercel KV, external cache | Module-level variable | Adequate for low-traffic single-property; KV adds cost and cold-start latency |
| Date validation | Custom date parsing logic | `new Date(str)` + `isNaN()` check | ISO 8601 parsing is built in; no library needed |
| CORS middleware | Express cors package | Manual header setting (existing pattern) | No Express in project; adding deps for 3 lines is wrong |
| Retry scheduler | Queue or retry library | `setTimeout` + single counter | One retry is all that's needed; library is overkill |

**Key insight:** This project has zero npm dependencies by design — Node.js builtins cover every need in Phase 1. Keep it that way.

---

## Common Pitfalls

### Pitfall 1: BEAPI Token Scope Confusion
**What goes wrong:** Using the BEAPI token (scope `booking_engine:api`) to call an Open API endpoint like `open-api.guesty.com/v1/...` returns 401. Developer assumes credentials are wrong and wastes time debugging.
**Why it happens:** Both APIs use the same `GUESTY_CLIENT_ID` and `GUESTY_CLIENT_SECRET`, so the credentials look correct. The difference is the token endpoint and scope.
**How to avoid:** BEAPI token endpoint is `https://booking.guesty.com/oauth2/token`, Open API is `https://open-api.guesty.com/oauth2/token`. Never mix. Keep `lib/guesty.js` entirely separate from `api/calendar.js`.
**Warning signs:** 401 on valid-looking requests; token logs look correct but API rejects.

### Pitfall 2: Exhausting the 3-Renewal-Per-Day Token Limit
**What goes wrong:** With the 60-second buffer from `calendar.js` (or no buffer at all), a token acquired at 23:59:00 that expires at 00:00:00 triggers re-acquisition every minute for an hour on a cold-start machine — burning all 3 renewals.
**Why it happens:** Low buffer + cold starts = many redundant token requests.
**How to avoid:** Use a 5-minute (300000ms) buffer. Verify with `console.log` that token is reused across warm requests.
**Warning signs:** Guesty returns HTTP 429 or specific "token renewal limit exceeded" error on auth endpoint.

### Pitfall 3: vercel.json CORS Origin Mismatch
**What goes wrong:** Setting `"Access-Control-Allow-Origin": "https://mattgshepard-prog.github.io"` in `vercel.json` breaks `localhost` testing. Setting `*` in `vercel.json` works but is less precise.
**Why it happens:** `vercel.json` headers are static — no expression or list is supported.
**How to avoid:** For Phase 1 (no credentials header, no Stripe), keeping `*` in `vercel.json` is acceptable and matches the existing pattern. If a specific origin is required, implement the dynamic origin check in each route handler (the in-function headers override the vercel.json headers). Note: vercel.json headers are applied at the CDN layer; in-function `res.setHeader()` overrides them.
**Warning signs:** Preflight OPTIONS requests return CORS error in browser dev tools.

### Pitfall 4: Listing ID Field Name (`id` vs `_id`)
**What goes wrong:** Using `result._id` instead of `result.id` from the BEAPI search response returns `undefined`, causing `GUESTY_LISTING_ID` to be set to "undefined".
**Why it happens:** Guesty's Open API uses MongoDB `_id` convention; BEAPI uses clean `id`.
**How to avoid:** The BEAPI search response field is `id` (confirmed from BEAPI definitions). Discovery script must log `l.id`, not `l._id`.
**Warning signs:** Listing ID is "undefined" in env var; all subsequent BEAPI calls return 404 or empty results.

### Pitfall 5: `discover-listing.js` Script Requires `type: module` or `.mjs`
**What goes wrong:** Running `node scripts/discover-listing.js` with `import` syntax fails with `SyntaxError: Cannot use import statement in a module` because `package.json` has no `"type": "module"`.
**Why it happens:** Current `package.json` is `{"name":"sunshine-canyon-api","version":"1.0.0","private":true}` — no `"type": "module"` key. The Vercel routes work because Vercel's runtime handles ES modules independently. But `node` CLI defaults to CommonJS.
**How to avoid:** Either add `"type": "module"` to `package.json` (affects all .js files) OR name the discovery script `discover-listing.mjs`. Since Vercel routes already use `export default`, adding `"type": "module"` is the cleaner fix — verify this doesn't break `api/calendar.js` (it won't, since it also uses `export default`).
**Warning signs:** `SyntaxError: Cannot use import statement in a module` when running the script.

### Pitfall 6: Race Condition in Token Cache Under Fluid Compute
**What goes wrong:** Two concurrent requests both see `cachedToken === null` and both acquire a new token simultaneously, counting as 2 of the 3 daily renewals.
**Why it happens:** Fluid compute allows multiple concurrent requests in the same instance. Module-level write is not atomic.
**How to avoid:** For low-traffic single-property site, this is acceptable. If concerned, implement a simple in-flight promise cache (assign a pending promise to `cachedToken` while acquiring, let concurrent callers await it). The locked decision accepts this risk.
**Warning signs:** Token acquisition logs show two fetches within milliseconds.

---

## Code Examples

### Full lib/guesty.js Structure

```javascript
// lib/guesty.js
// Source: patterns from api/calendar.js + BEAPI docs https://booking-api-docs.guesty.com/docs/authentication-1

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';

let cachedToken = null;
let tokenExpiry = 0;

async function getBeapiToken() {
  if (cachedToken && Date.now() < tokenExpiry - 300000) return cachedToken;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'booking_engine:api',
    client_id: process.env.GUESTY_CLIENT_ID,
    client_secret: process.env.GUESTY_CLIENT_SECRET,
  });
  const resp = await fetch('https://booking.guesty.com/oauth2/token', {
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'},
    body: params.toString(),
  });
  if (!resp.ok) throw new Error(`BEAPI token fetch failed: ${resp.status}`);
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}

export async function guestyFetch(path, options = {}, retried = false) {
  const token = await getBeapiToken();
  const resp = await fetch(path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (resp.status === 401 && !retried) {
    cachedToken = null;
    tokenExpiry = 0;
    return guestyFetch(path, options, true);
  }
  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get('retry-after') || '2', 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    if (!retried) return guestyFetch(path, options, true);
  }
  return resp;
}

export { FALLBACK_URL };
```

### Full api/availability.js Structure

```javascript
// api/availability.js
// Source: existing calendar.js pattern + BEAPI search endpoint docs
import { guestyFetch, FALLBACK_URL } from '../lib/guesty.js';

const LISTING_ID = process.env.GUESTY_LISTING_ID;
const SEARCH_BASE = 'https://booking-api.guesty.com/v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const {checkIn, checkOut, guests} = req.query;

  // Input validation (INFRA-03)
  if (!checkIn || !checkOut) {
    return res.status(400).json({error: 'checkIn and checkOut are required', fallbackUrl: FALLBACK_URL});
  }
  const inDate = new Date(checkIn), outDate = new Date(checkOut);
  if (isNaN(inDate) || isNaN(outDate)) {
    return res.status(400).json({error: 'Dates must be YYYY-MM-DD format', fallbackUrl: FALLBACK_URL});
  }
  if (outDate <= inDate) {
    return res.status(400).json({error: 'checkOut must be after checkIn', fallbackUrl: FALLBACK_URL});
  }
  const guestCount = parseInt(guests || '1', 10);
  if (isNaN(guestCount) || guestCount < 1) {
    return res.status(400).json({error: 'guests must be a positive integer', fallbackUrl: FALLBACK_URL});
  }

  try {
    const url = `${SEARCH_BASE}/search?checkIn=${checkIn}&checkOut=${checkOut}&adults=${guestCount}`;
    const searchResp = await guestyFetch(url);
    if (!searchResp.ok) throw new Error(`BEAPI search error: ${searchResp.status}`);
    const data = await searchResp.json();

    const listing = data.results?.find(l => l.id === LISTING_ID);
    if (!listing) {
      return res.status(200).json({available: false, listing: null, fallbackUrl: FALLBACK_URL});
    }

    // Extract nightly rate from nightlyRates date-keyed object
    const rates = Object.values(listing.nightlyRates || {});
    const nightlyRate = rates.length ? rates[0] : null;

    return res.status(200).json({
      available: true,
      listing: {
        id: listing.id,
        title: listing.title,
        nightlyRate,
        currency: listing.prices?.currency || 'USD',
      },
    });
  } catch(err) {
    console.error('Availability error:', err);
    return res.status(500).json({error: 'Failed to check availability', fallbackUrl: FALLBACK_URL});
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel classic serverless (one request per instance) | Fluid Compute (concurrent requests per instance, module state shared) | April 2025 (default for new projects) | Module-level cache benefits are now more reliable; concurrent write race condition risk exists but is minor |
| Node.js 18 (previous Vercel default) | Node.js 24 LTS now available on Vercel | 2025 | Native fetch() faster (Undici v7), URLPattern available, bytecode caching improves cold starts |
| `_id` field in older Guesty APIs | `id` field in BEAPI | BEAPI v1 design | Use `id` not `_id` in BEAPI responses |

**Deprecated/outdated:**
- Vercel KV for token caching in this project: Decided against — module-level cache is correct choice for low-traffic single-property site.

---

## Open Questions

1. **Is `GUESTY_LISTING_ID` already set in the Vercel project?**
   - What we know: `GUESTY_CLIENT_ID` and `GUESTY_CLIENT_SECRET` are confirmed set (calendar.js uses them). `GUESTY_LISTING_ID` is used as a fallback in `calendar.js` line 29 with the hardcoded value `693366e4e2c2460012d9ed96`.
   - What's unclear: Whether this hardcoded ID is already correct for BEAPI (it comes from the Guesty booking URL `svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96`) or whether the BEAPI listing `id` is different.
   - Recommendation: Run the discovery script and confirm. The fallback ID in `calendar.js` may already be correct, but the BEAPI `id` field must be validated. Do not skip the discovery script.

2. **Does `mattgshepard-prog.github.io` need to be matched as a prefix or exact origin?**
   - What we know: The GitHub Pages site is at `mattgshepard-prog.github.io/sunshine-canyon-retreat` — the origin would be `https://mattgshepard-prog.github.io` (no path in origin header).
   - What's unclear: Whether wildcard `*` CORS (current calendar.js pattern) is acceptable for availability or if the specific origin is required.
   - Recommendation: Keep `*` to match existing pattern. The availability endpoint exposes no credentials and returns only public pricing data. The locked decision lists specific origins but the existing `calendar.js` already uses `*` without issue.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All serverless functions, discovery script | Yes | v24.13.1 | — |
| npm | Package management | Yes | 11.8.0 | — |
| Vercel CLI | Deployment, local dev (`vercel dev`) | Yes | 50.32.3 | — |
| `GUESTY_CLIENT_ID` env var | Token acquisition | Yes (confirmed — calendar.js uses it) | — | — |
| `GUESTY_CLIENT_SECRET` env var | Token acquisition | Yes (confirmed — calendar.js uses it) | — | — |
| `GUESTY_LISTING_ID` env var | availability.js filtering | Not yet set in Vercel | — | Discovery script output must be set before deployment |
| `"type": "module"` in package.json | `scripts/discover-listing.js` ESM import | Not yet set | — | Name script `.mjs` instead |
| Guesty BEAPI account access | Token endpoint | Assumed yes (credentials in spec) | — | Cannot proceed without valid BEAPI credentials |

**Missing dependencies with no fallback:**
- `GUESTY_LISTING_ID` Vercel environment variable — must be set after running discovery script before `api/availability.js` works in production.

**Missing dependencies with fallback:**
- `"type": "module"` in package.json — name `discover-listing.mjs` if not added.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — Wave 0 must add |
| Config file | None — Wave 0 creates |
| Quick run command | `node --test api/availability.test.js` (Node.js built-in test runner, no install needed) |
| Full suite command | `node --test` (runs all `*.test.js` files) |

**Rationale:** Node.js 24 has a built-in test runner (`node:test`) requiring zero npm dependencies. This matches the project's zero-dependency philosophy. No Jest, Vitest, or Mocha needed.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Token acquired from correct BEAPI endpoint | unit (mock fetch) | `node --test lib/guesty.test.js` | No — Wave 0 |
| AUTH-02 | Cached token reused on second call; no duplicate fetch | unit (mock fetch) | `node --test lib/guesty.test.js` | No — Wave 0 |
| AUTH-03 | BEAPI token not shared with Open API — separate module state | unit (assert no import cross-contamination) | `node --test lib/guesty.test.js` | No — Wave 0 |
| AUTH-04 | 401 triggers token clear + single retry | unit (mock 401 then 200) | `node --test lib/guesty.test.js` | No — Wave 0 |
| LIST-01 | Discovery script outputs an `id` field | manual / script smoke test | `node scripts/discover-listing.mjs` | No — Wave 0 |
| LIST-02 | `GUESTY_LISTING_ID` env var used by availability handler | unit (assert env lookup) | `node --test api/availability.test.js` | No — Wave 0 |
| AVAIL-01 | `/api/availability` with valid dates returns 200 + available field | unit (mock guestyFetch) | `node --test api/availability.test.js` | No — Wave 0 |
| AVAIL-02 | Response includes `nightlyRate` when listing found | unit (mock search response) | `node --test api/availability.test.js` | No — Wave 0 |
| INFRA-01 | OPTIONS preflight returns CORS headers | unit (mock req method=OPTIONS) | `node --test api/availability.test.js` | No — Wave 0 |
| INFRA-02 | Credentials not present in any API response body | unit (assert no env leak) | `node --test api/availability.test.js` | No — Wave 0 |
| INFRA-03 | Bad inputs return 400 before Guesty is called | unit (assert fetch not called) | `node --test api/availability.test.js` | No — Wave 0 |
| INFRA-04 | 429 response triggers Retry-After wait + single retry | unit (mock 429 then 200) | `node --test lib/guesty.test.js` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test lib/guesty.test.js` (auth and retry logic)
- **Per wave merge:** `node --test` (all test files)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/guesty.test.js` — covers AUTH-01, AUTH-02, AUTH-03, AUTH-04, INFRA-04
- [ ] `api/availability.test.js` — covers AVAIL-01, AVAIL-02, LIST-02, INFRA-01, INFRA-02, INFRA-03
- [ ] `package.json` update: add `"type": "module"` to enable ESM imports in test files and discovery script

---

## Sources

### Primary (HIGH confidence)

- [Guesty BEAPI Authentication docs](https://booking-api-docs.guesty.com/docs/authentication-1) — token endpoint, scope, expires_in, renewal limit verified
- [Guesty BEAPI Quick Start / Search](https://booking-api-docs.guesty.com/docs/quick-start) — search endpoint URL `https://booking-api.guesty.com/v1/search` and parameters verified
- [Guesty BEAPI Search Capabilities](https://booking-api-docs.guesty.com/docs/search-capabilities) — response shape including `id`, `title`, `nightlyRates` object verified
- [Guesty BEAPI Definitions](https://booking-api-docs.guesty.com/reference/definitions) — `id` (not `_id`) confirmed as listing identifier field in BEAPI
- [Vercel CORS KB](https://vercel.com/kb/guide/how-to-enable-cors) — static vs dynamic origin, OPTIONS handling verified
- [Vercel Fluid Compute docs](https://vercel.com/docs/fluid-compute) — module-level state preservation confirmed
- `api/calendar.js` (existing project file) — established patterns for token cache, CORS, handler export, error handling
- `SUNSHINE-BOOKING-SPEC.md` (project spec) — endpoint URLs, fallback URL, upsell structure, credential env var names

### Secondary (MEDIUM confidence)

- [Guesty BEAPI Booking Flow](https://booking-api-docs.guesty.com/docs/booking-flow) — 3-phase flow and "activate booking engine first" requirement
- [Guesty rate limits docs](https://open-api-docs.guesty.com/docs/rate-limits) — 5 req/s, 275 req/min, 16500 req/hr; `Retry-After` header on 429
- [Vercel Fluid Compute blog](https://vercel.com/blog/introducing-fluid-compute) — concurrent request sharing + module state race condition risk

### Tertiary (LOW confidence)

- None — all critical claims verified with official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero npm dependencies; all tools verified live on machine
- Architecture: HIGH — patterns from official BEAPI docs + existing codebase; response shapes confirmed
- Pitfalls: HIGH — token scope confusion, renewal limit, and field name (`id` vs `_id`) verified from official docs
- CORS behavior: MEDIUM — verified static vs dynamic limitation from Vercel KB; specific behavior under Fluid Compute not tested

**Research date:** 2026-04-06
**Valid until:** 2026-07-06 (90 days — Guesty BEAPI and Vercel APIs are stable; fluid compute behavior is current)
