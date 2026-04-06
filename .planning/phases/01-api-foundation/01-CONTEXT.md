# Phase 1: API Foundation - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Guesty BEAPI token lifecycle, discover the listing ID, and create the `/api/availability` endpoint — proving CORS, credentials, and BEAPI scope separation are correct before any write operations. This phase delivers `lib/guesty.js` (shared auth/fetch layer) and `api/availability.js`, plus a one-time listing discovery script.

</domain>

<decisions>
## Implementation Decisions

### Token Architecture
- Separate `lib/guesty.js` for BEAPI token management — leave existing `calendar.js` self-contained with its own Open API token
- Use module-level variable for token caching (not Vercel KV) — Vercel fluid compute preserves module state, and low traffic won't exhaust 3 renewals/24h
- Calculate absolute expiry timestamp on fetch, check `Date.now()` before each call with 5-minute buffer before expiry
- `lib/guesty.js` exposes a general-purpose `guestyFetch(path, options)` wrapper that auto-attaches Bearer token and handles 401 retry transparently

### API Response Contract
- `/api/availability` returns `{ available: false, listing: null }` when dates are unavailable (clean boolean, no error thrown)
- All error responses include `fallbackUrl` pointing to Guesty booking page (`https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96`)
- Validate inputs before calling Guesty: dates exist, valid ISO format, checkOut > checkIn, guests is positive integer — reject bad input before burning rate limit
- Handle Guesty 429 with exponential backoff and 1 retry

### CORS & Listing Discovery
- Allow origins: `mattgshepard-prog.github.io` + `localhost` for dev
- Configure CORS both in vercel.json headers AND per-route OPTIONS handler (matching existing calendar.js pattern)
- One-time listing discovery script (`scripts/discover-listing.js`) — run once, output listing ID, hardcode as `GUESTY_LISTING_ID` env var
- Discovery script also validates BEAPI credentials work (test token acquisition + search in one script)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/calendar.js` — existing pattern for Vercel serverless handler with token caching, CORS, and Guesty API calls
- `vercel.json` — existing deployment config with CORS headers

### Established Patterns
- Module-level `cachedToken`/`tokenExpiry` variables for OAuth caching
- `getToken()` async function for token acquisition
- `handler(req, res)` export default pattern
- CORS via manual header setting + OPTIONS early return
- `.map()` / `.filter()` for response transformation
- `try/catch` with `console.error()` and 500 JSON response

### Integration Points
- New `lib/guesty.js` will be imported by `api/availability.js` and all future API routes
- CORS configuration must be consistent with existing `api/calendar.js`
- Environment variables: `GUESTY_CLIENT_ID`, `GUESTY_CLIENT_SECRET` already set; `GUESTY_LISTING_ID` to be added after discovery

</code_context>

<specifics>
## Specific Ideas

- BEAPI base URLs differ from Open API: `booking-api.guesty.com/v1` for search, `booking.guesty.com` for quotes/reservations — `lib/guesty.js` must handle both
- Token endpoint is `https://booking.guesty.com/oauth2/token` with scope `booking_engine:api`
- The search endpoint is `GET https://booking-api.guesty.com/v1/search?checkIn=X&checkOut=X&adults=N`
- Research confirmed: never create Stripe Customer, pm_xxx tokens are single-use, BEAPI and Open API tokens cannot be shared

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
