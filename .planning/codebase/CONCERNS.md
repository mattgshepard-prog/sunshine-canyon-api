# Codebase Concerns

**Analysis Date:** 2026-04-06

## Tech Debt

**Module-level token caching in serverless functions:**
- Issue: `/api/calendar.js` caches Guesty OAuth token in module-level variables (`cachedToken`, `tokenExpiry`). In Vercel's serverless environment, this creates unpredictable behavior: token cache may persist across invocations on warm containers, or disappear entirely on cold starts. This leads to wasted token requests and potential race conditions.
- Files: `api/calendar.js` (lines 1-2, 4-20)
- Impact: Inefficient token reuse, increased API calls to Guesty, potential for hitting rate limits (5 req/sec, 275 req/min). Token refresh on every cold start increases latency. No distributed cache means different function instances can't share tokens.
- Fix approach: Replace module-level variables with Vercel KV (Redis). Implement atomic token store with expiry check in a shared utility (`lib/guesty.js`). Fallback to requesting fresh token on cache miss (acceptable given 24h token lifetime). Reference: `https://vercel.com/docs/storage/vercel-kv`.

**Hardcoded listing ID with email references:**
- Issue: `GUESTY_LISTING_ID` environment variable defaults to `"693366e4e2c2460012d9ed96"` (hardcoded fallback in line 29). The spec requires discovering this via the search API first, but the current code bypasses that step entirely. This assumes the listing ID never changes and creates tight coupling to Guesty's ID scheme.
- Files: `api/calendar.js` (line 29)
- Impact: If the property moves to a different Guesty account or the listing ID changes, the endpoint breaks silently. No validation that the ID is actually valid or owns the correct property.
- Fix approach: Before any endpoint goes to production, run a one-time discovery via `/v1/search?q=6186%20Sunshine%20Canyon%20Drive` and validate the ID. Store as `GUESTY_LISTING_ID` env var with no fallback. Add startup check in the API layer to validate the ID on first request.

**Hardcoded cleaning fee and currency:**
- Issue: Cleaning fee (`$135`) and currency (`"USD"`) are hardcoded in `/api/calendar.js` (line 51). These values should come from Guesty API response, not hardcoded assumptions.
- Files: `api/calendar.js` (line 51)
- Impact: If Sebastian adjusts the cleaning fee in Guesty's dashboard, the API will continue returning `$135` forever. No single source of truth. Frontend developers will have no way to know the hardcoded values are stale.
- Fix approach: Include cleaning fee and currency in the actual Guesty API response parse. If Guesty doesn't return these, move them to a config file (`lib/property-config.js`) with clear comments that these need manual updates if changed in Guesty.

**No error recovery for failed Guesty API calls:**
- Issue: Both `/api/calendar.js` (line 16) and future endpoints call `calResp.json()` and `resp.json()` without checking HTTP status codes. If Guesty returns 401 (expired token), 429 (rate limited), or 500 (server error), the code will try to parse potentially non-JSON error responses, leading to cryptic errors.
- Files: `api/calendar.js` (lines 16, 38)
- Impact: Guests see generic "Failed to fetch calendar data" error without knowing if it's a temporary rate limit, auth issue, or Guesty outage. No automatic retry on 401 (expired token). No exponential backoff on 429.
- Fix approach: Check `resp.status` before calling `.json()`. Implement retry logic for 401 (refresh token, retry once) and 429 (exponential backoff). Return structured error responses with `retryable` flag so frontend can implement smart retry UI.

**CORS headers hardcoded and wildcard-open:**
- Issue: `/api/calendar.js` (lines 23-24) and `vercel.json` set `Access-Control-Allow-Origin: *`. This allows any origin (malicious site, mobile app, attacker script) to call the API.
- Files: `api/calendar.js` (lines 23-24), `vercel.json`
- Impact: API endpoints are vulnerable to CSRF attacks from any domain. An attacker could embed `<img src="https://sunshine-canyon-api.vercel.app/api/calendar">` on their site and trigger API calls in the victim's browser. No protection against token leakage via CORS.
- Fix approach: Change `Access-Control-Allow-Origin` to only the GitHub Pages domain: `https://mattgshepard-prog.github.io`. Store as env var `ALLOWED_ORIGIN`. Add request origin check before responding.

**No input validation on environment variables:**
- Issue: The code assumes `GUESTY_CLIENT_ID`, `GUESTY_CLIENT_SECRET`, and `GUESTY_LISTING_ID` are set. If any are missing or malformed, the code fails at runtime with unhelpful errors.
- Files: `api/calendar.js` (lines 8-9, 29)
- Impact: Deployment to new Vercel environment or accidental deletion of env vars causes outages. No startup validation means the failure is discovered only after a guest tries to book.
- Fix approach: Add a startup check (e.g., in a shared `lib/env.js`) that validates all required env vars at function initialization time. Throw clear error if missing.

## Known Bugs

**Calendar date range is always future 90 days:**
- Symptoms: The calendar always shows today + 90 days, regardless of Guesty's actual availability window. If Guesty allows bookings 6 months out, the API hides anything beyond day 90.
- Files: `api/calendar.js` (lines 30-33)
- Trigger: Call `/api/calendar` any day; response will show only 90 days.
- Impact: Guests can't see or book dates beyond 90 days in the future, even if available. The frontend date picker will show gaps.
- Workaround: Query Guesty's search endpoint with `startDate=today`, `endDate=today+180d` (or configurable) to get full available window. Store window as env var or config.

**No handling for missing Guesty data in calendar response:**
- Symptoms: If Guesty's API response is missing the `data.days` array (malformed response or Guesty API change), the code silently returns `calendar: []` (line 39 defaults to empty array with `||`).
- Files: `api/calendar.js` (line 39)
- Trigger: Guesty API change or network corruption that removes the `data` key.
- Impact: Frontend shows completely empty calendar (no days at all), confusing guests. No error indication that something went wrong. May appear as if property is fully booked.
- Workaround: Log response shape on any malformed response and return a 502 Bad Gateway with details to help debugging.

## Security Considerations

**Guesty OAuth credentials exposed in spec document:**
- Risk: The spec file (`SUNSHINE-BOOKING-SPEC.md`) contains literal `GUESTY_CLIENT_ID` and `GUESTY_CLIENT_SECRET` values (lines 81-82). If this file is committed to public GitHub, credentials are leaked.
- Files: `SUNSHINE-BOOKING-SPEC.md` (lines 81-82)
- Current mitigation: File is currently untracked (in git status as `??`). Not yet committed.
- Recommendations: 
  1. Add `SUNSHINE-BOOKING-SPEC.md` to `.gitignore` before any commit.
  2. Store spec in a private wiki or email (not in version control).
  3. If spec must be in the repo, replace all credential values with placeholders like `[REDACTED]` or `YOUR_CLIENT_ID_HERE`.
  4. Rotate the Guesty credentials immediately if this file was ever public.

**Stripe publishable key placeholder in spec:**
- Risk: The spec documents the expected location of `STRIPE_PK` frontend constant (line 456). If the key is accidentally committed or logged, it should be rotated. Stripe public keys are safe to expose, but logging/exposing them in source control is bad practice.
- Files: `SUNSHINE-BOOKING-SPEC.md` (line 456)
- Current mitigation: Key is not yet obtained; placeholder is empty string.
- Recommendations: Store final `STRIPE_PK` only in frontend code as a const, never in `.env` or source control. Use Stripe's key rotation feature if it's ever compromised.

**No HTTPS enforcement documentation:**
- Risk: The spec mentions HTTPS is enforced (line 499), but there's no code verification. If a developer accidentally calls Guesty over HTTP, credentials are leaked.
- Files: `api/calendar.js` (lines 11, 35)
- Current mitigation: URLs are hardcoded as `https://`. Stripe SDK also requires HTTPS.
- Recommendations: Add explicit `const GUESTY_BASE_URL = 'https://...'` const to fail loudly if anyone tries to change it to http. Use Node.js security headers middleware in future endpoints.

**Token refresh logic doesn't prevent replay attacks:**
- Risk: If a token is leaked, an attacker can use it to make API calls on behalf of the application until expiry (24 hours).
- Files: `api/calendar.js` (lines 4-20)
- Current mitigation: Tokens are short-lived (24h). Rate limiting on Guesty side (5 req/sec).
- Recommendations: 
  1. Monitor token usage patterns (alert if more than 5 token refreshes in 24h, which suggests token leakage).
  2. Implement IP whitelisting at Vercel level if Guesty supports it.
  3. Use shorter token lifetime if Guesty API supports it.

## Performance Bottlenecks

**No caching of calendar data on the API side:**
- Problem: Every request to `/api/calendar` makes a fresh Guesty API call. If 100 guests load the site in 1 minute, that's 100 API calls in 60 seconds, approaching the 275 req/min rate limit.
- Files: `api/calendar.js` (lines 34-38)
- Cause: `vercel.json` sets caching headers to `s-maxage=3600` (1 hour), but that's browser/CDN caching. The API itself doesn't cache Guesty responses.
- Improvement path: Implement server-side response caching (Vercel KV or simple in-memory with TTL) for the calendar endpoint. Cache the full Guesty response for 5-10 minutes, reuse for all requests in that window. This reduces load on Guesty API by ~95%.

**No pagination or limits on calendar day array:**
- Problem: The calendar returns all 90 days as individual objects in the response. For a 365-day booking window, this would be 365 day objects + price data per day = significant JSON payload (20+ KB).
- Files: `api/calendar.js` (lines 40-43)
- Cause: No filtering or aggregation of calendar data. Response bloats linearly with day count.
- Improvement path: Implement smart response: return only `availableDays` and `bookedDays` counts, plus `priceRange` and `avgPrice` summary. Include full day-by-day breakdown only if requested via query param (e.g., `?full=true`).

**Token refresh on every cold start:**
- Problem: Vercel's serverless containers can spin down after inactivity. On the next request, a new container starts (cold start) and the module-level cache is empty, forcing a fresh token request. This adds ~500ms latency per cold start.
- Files: `api/calendar.js` (lines 1-20)
- Cause: No persistent cache (Vercel KV not implemented). In-memory cache only lasts for the container lifetime.
- Improvement path: Implement Vercel KV cache for token (addressed above). Store token with 23-hour TTL. This eliminates cold-start token request latency for 99% of requests.

## Fragile Areas

**Token expiry calculation is off by exactly 60 seconds:**
- Files: `api/calendar.js` (line 5)
- Why fragile: The check `Date.now()<tokenExpiry-60000` means the code refreshes 60 seconds early. If Guesty's `expires_in` is exactly 86400 seconds, the token will be refreshed at 86340s (23:59:00), not at actual expiry. This is intentionally conservative (good), but if the 60000ms value is ever reduced to 10000ms without comment, tokens could expire mid-request.
- Safe modification: Add a named constant `const TOKEN_REFRESH_BUFFER_MS = 60000; // Refresh 60s before expiry` and document why this exists.
- Test coverage: No tests exist. Need unit test: "refreshes token when buffer time remaining < 60s" and "reuses token when buffer time remaining > 60s".

**Guesty API response parsing assumes structure:**
- Files: `api/calendar.js` (lines 39-43)
- Why fragile: The code assumes `calResp.json()` returns `{ data: { days: [...] } }`. If Guesty API response structure changes (e.g., wraps in `result.data.days` instead of `data.days`), the entire endpoint breaks silently with an empty calendar.
- Safe modification: Add explicit null checks and schema validation. Use a library like `zod` or `joi` to validate response shape. Return 502 Bad Gateway if shape is invalid.
- Test coverage: No tests. Need integration test mocking Guesty API with various response shapes.

**CORS headers set in two places (code + vercel.json):**
- Files: `api/calendar.js` (lines 23-24) + `vercel.json`
- Why fragile: If headers are set in both places and they conflict, it's unclear which wins. A future developer might update headers in one place thinking it applies everywhere.
- Safe modification: Remove CORS headers from individual route handlers. Set all headers globally in `vercel.json`. Add comments: "All CORS headers managed in vercel.json — do not duplicate in routes."
- Test coverage: No tests for header presence. Need integration test checking response headers.

## Scaling Limits

**Token caching on single instance with no shared state:**
- Current capacity: Can serve ~10-20 requests/sec on a warm container. Token refresh adds 500ms latency (shared across requests in cache window).
- Limit: When traffic spikes (multiple concurrent requests after cold start), all requests hit the token refresh bottleneck. First request refreshes token, others wait. After 23:59 of warm runtime, cache expires and all requests hit refresh again.
- Scaling path: Implement Vercel KV for distributed token cache. This allows all instances to share a single token, eliminating refresh bottleneck.

**Rate limit on Guesty API (5 req/sec, 275 req/min):**
- Current capacity: At peak (100 guests loading site), each refresh triggers 1 calendar API call + future booking attempts trigger quote/availability calls. Could easily hit 5 req/sec limit.
- Limit: Guesty will return 429 Too Many Requests. Code doesn't handle this, returns 500 to guest.
- Scaling path: Implement request queuing with exponential backoff. Cache responses aggressively (see Performance section). Consider upgrading Guesty API plan if available.

**Vercel function timeout (10 seconds default):**
- Current capacity: Network calls to Guesty typically take 200-500ms. Function overhead ~50ms. Token refresh adds 500ms. Total ~1s per request (acceptable).
- Limit: If Guesty is slow or returns large responses, could approach timeout. No handling for timeouts.
- Scaling path: Set explicit timeout in function (e.g., 5 second fetch timeout) and return 503 Service Unavailable if exceeded. Implement timeout handling in all future endpoints.

## Dependencies at Risk

**Dependency: Guesty Booking Engine API (External):**
- Risk: Guesty could change API endpoint URLs, require different auth, or deprecate the Booking Engine API. No version pinning on the API URL itself.
- Impact: All booking/availability features break. No fallback booking method (spec mentions Guesty booking page as fallback, but that's manual).
- Migration plan: 
  1. Monitor Guesty changelog/API status page. Set alerts for deprecation notices.
  2. Implement adapter pattern in `lib/guesty.js` so API client can be swapped for alternative provider (e.g., Airbnb Airbnb Open API if needed).
  3. Keep fallback link to Guesty booking page always accessible.

**Dependency: Vercel (Hosting/Deployment):**
- Risk: Vercel could go down, change pricing, discontinue serverless functions, or change environment variable handling.
- Impact: API endpoints become unreachable. Frontend fallback to Guesty page still works.
- Migration plan: Export function handlers to AWS Lambda or Google Cloud Functions compatible format. Keep monolithic approach so switching providers is straightforward.

**Dependency: Stripe (Future, when implemented):**
- Risk: Stripe changes fee structure, requires new authentication, or has prolonged outages.
- Impact: Payment collection fails. Spec mentions fallback to Guesty booking page; implement that gracefully (hide Stripe form, show fallback link).
- Migration plan: Use Stripe Node.js SDK with version pinning. Implement provider abstraction (`lib/payment.js`) so alternative payment processor can be swapped.

## Missing Critical Features

**No authentication/authorization on API endpoints:**
- Problem: All endpoints (future `/api/book`, `/api/quote`, etc.) will be publicly callable. Anyone can trigger bookings, see payment info, or spam the API.
- Blocks: Can't protect against bot attacks, fraudulent bookings, or API abuse.
- Recommendations:
  1. Implement rate limiting per IP (Vercel middleware or third-party service like Cloudflare).
  2. Add CSRF token validation for POST endpoints.
  3. Require reCAPTCHA on quote/booking endpoints to prevent bot abuse.
  4. Monitor for unusual booking patterns (e.g., 100 bookings in 1 minute to same email).

**No logging or observability:**
- Problem: Current code logs errors to console only (`console.error` on line 59). No structured logging, no tracing, no metrics.
- Blocks: Can't debug production issues, monitor API health, or detect anomalies.
- Recommendations:
  1. Implement structured logging with timestamps and correlation IDs (e.g., use Vercel's built-in logging, or send to external service like LogRocket).
  2. Track metrics: request count, latency, error rate, token refresh frequency.
  3. Set up alerts for error spikes or repeated failures.

**No testing framework or tests:**
- Problem: No unit tests, integration tests, or end-to-end tests. Code changes risk breaking existing functionality silently.
- Blocks: Can't confidently refactor, can't catch regressions, can't validate Guesty API changes.
- Recommendations:
  1. Add `vitest` or `jest` to `package.json`.
  2. Write unit tests for token management (mock Guesty OAuth endpoint).
  3. Write integration tests for calendar endpoint (mock Guesty API, verify response structure).
  4. Add pre-deployment test suite to GitHub Actions.

**No request validation or sanitization:**
- Problem: Future endpoints (`/api/quote`, `/api/book`, etc.) will accept `guest` object from frontend without validation. Could pass malformed data to Guesty.
- Blocks: Guesty API errors will confuse guests. No protection against injection attacks or malformed requests.
- Recommendations:
  1. Use `zod` or `joi` to validate all request bodies before processing.
  2. Add OpenAPI spec to document request/response schemas.
  3. Return 400 Bad Request with validation errors (not 500).

## Test Coverage Gaps

**Untested area: Token refresh logic**
- What's not tested: The `getToken()` function never has tests verifying:
  - Token is cached and reused (not fetched twice)
  - Token is refreshed when expiry < 60s away
  - Token refresh handles Guesty OAuth failures (400, 401, 500)
  - Concurrent requests don't trigger duplicate token refreshes
- Files: `api/calendar.js` (lines 4-20)
- Risk: A bug in token caching could silently waste API quota or expose stale tokens. A future refactor (e.g., moving to Vercel KV) could break this logic without anyone knowing.
- Priority: **High** — token management is critical path for all endpoints.

**Untested area: Guesty API integration**
- What's not tested: The calendar endpoint response parsing:
  - Guesty returns valid `{ data: { days: [...] } }` structure
  - Guesty returns empty days array (no bookings)
  - Guesty returns malformed response (missing keys)
  - Guesty returns error (401, 429, 500)
  - Guesty returns large response (100+ days) and response is correctly paginated/summarized
- Files: `api/calendar.js` (lines 34-50)
- Risk: API silently fails or returns incorrect data if Guesty API changes. Guests see empty calendar or misleading prices.
- Priority: **High** — calendar data directly affects guest booking decisions.

**Untested area: HTTP headers and CORS**
- What's not tested: Vercel `vercel.json` headers configuration:
  - CORS headers are correctly set for all routes
  - `Access-Control-Allow-Origin` matches expected domain
  - `Cache-Control` headers are correctly applied
  - No conflicting headers between route and global config
- Files: `vercel.json`, `api/calendar.js` (lines 23-25)
- Risk: CORS misconfiguration could expose API to unintended origins or break frontend requests.
- Priority: **Medium** — affects security and frontend integration.

**Untested area: Date calculations**
- What's not tested:
  - Date range calculation (today to today+90) is correct
  - `toISOString().split("T")[0]` correctly formats dates as `YYYY-MM-DD`
  - Dates are correctly passed to Guesty (no timezone issues)
  - Edge cases: leap years, month boundaries, DST transitions
- Files: `api/calendar.js` (lines 30-33)
- Risk: Off-by-one errors in date ranges could exclude available dates or show stale dates. Timezone issues could cause guests to book wrong dates.
- Priority: **High** — date correctness is critical for property operations.

---

*Concerns audit: 2026-04-06*
