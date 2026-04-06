---
phase: 01-api-foundation
verified: 2026-04-06T00:00:00Z
status: human_needed
score: 5/5 success-criteria verified (9 automated, 2 human-only)
re_verification: false
human_verification:
  - test: "Run scripts/discover-listing.js with real Guesty BEAPI credentials and confirm listing ID is returned"
    expected: "Output prints: Listings found: 1 / id=693366e4e2c2460012d9ed96 title=Sunshine Canyon Retreat"
    why_human: "LIST-01 requires a live call to the BEAPI search endpoint — cannot be mocked without real Guesty credentials in the local environment. The script exists and is correctly wired, but the round-trip has not been confirmed in this session."
  - test: "Confirm GUESTY_LISTING_ID is set as a Vercel environment variable in the project dashboard"
    expected: "vercel env ls shows GUESTY_LISTING_ID=693366e4e2c2460012d9ed96 (or the ID returned by discover-listing.js)"
    why_human: "LIST-02 is a manual Vercel dashboard action — there is no code artifact to check and no way to inspect the Vercel project env from the local filesystem."
---

# Phase 1: API Foundation Verification Report

**Phase Goal:** The Guesty BEAPI token lifecycle is working, the listing ID is confirmed, and a real availability request round-trips through the serverless function — proving CORS, credentials, and BEAPI scope separation are correct before any write operations
**Verified:** 2026-04-06
**Status:** human_needed (all automated checks pass; LIST-01 and LIST-02 require human confirmation)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A call to `/api/availability` with valid check-in/check-out dates returns availability status and nightly rate from Guesty | VERIFIED | `tests/availability.test.js` AVAIL-02 passes GREEN; `api/availability.js` calls `booking-api.guesty.com/v1/search` and returns `{ available: boolean, listing: { id, title, nightlyRate } }` |
| 2 | Expired token auto-retries with fresh token on 401 and succeeds | VERIFIED | `tests/guesty.test.js` AUTH-04 passes GREEN; `lib/guesty.js` clears `cachedToken=null, tokenExpiry=0` on 401 and calls `guestyFetch(path, options, true)` once |
| 3 | BEAPI token is reused across warm Vercel invocations (module-level cache) | VERIFIED | `tests/guesty.test.js` AUTH-02 passes GREEN; `lib/guesty.js` uses module-level `cachedToken`/`tokenExpiry` with 300000ms (5-min) buffer |
| 4 | GitHub Pages frontend domain receives valid CORS response from all API routes | VERIFIED | `vercel.json` sets `Access-Control-Allow-Origin: https://mattgshepard-prog.github.io` at CDN layer; `api/availability.js` `setCors()` overrides per-request with allowlist including the GitHub Pages domain |
| 5 | Guesty credentials exist only in Vercel env vars and never appear in any API response | VERIFIED | `api/availability.js` contains no `GUESTY_CLIENT_ID` or `GUESTY_CLIENT_SECRET` references in code (only in `lib/guesty.js` via `process.env`); `scripts/discover-listing.js` mention is comment-only (line 6 usage example) |

**Score:** 5/5 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | ES module config (`"type": "module"`) | VERIFIED | Contains `"type": "module"`, no extraneous keys added |
| `lib/guesty.js` | BEAPI token cache + `guestyFetch` wrapper | VERIFIED | Exports `guestyFetch`; contains `booking.guesty.com/oauth2/token`, `booking_engine:api` scope, 300000ms buffer; does NOT reference `open-api.guesty.com` |
| `api/availability.js` | GET `/api/availability` endpoint | VERIFIED | Exports default handler; imports from `lib/guesty.js`; calls `booking-api.guesty.com/v1/search`; full input validation; returns correct response shapes |
| `vercel.json` | CORS headers with GitHub Pages origin | VERIFIED | Sets `Access-Control-Allow-Origin: https://mattgshepard-prog.github.io`; retains `Cache-Control: public, s-maxage=3600, stale-while-revalidate=7200` |
| `scripts/discover-listing.js` | One-time listing ID discovery CLI | VERIFIED (static) | Imports `guestyFetch` from `lib/guesty.js`; targets `booking-api.guesty.com/v1/search`; uses `l.id` (not `l._id`); prints next-step instruction; live round-trip requires human |
| `tests/guesty.test.js` | Test suite for `lib/guesty.js` (5 tests) | VERIFIED | 5 tests, all GREEN; covers AUTH-01, AUTH-02, AUTH-03, AUTH-04, INFRA-04 |
| `tests/availability.test.js` | Test suite for `api/availability.js` (4 tests) | VERIFIED | 4 tests, all GREEN; covers INFRA-03 (3 cases), AVAIL-02 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/guesty.js` | `https://booking.guesty.com/oauth2/token` | `fetch POST` with `scope=booking_engine:api` | WIRED | Line 10 and 21 — constant `BEAPI_TOKEN_URL` used in `fetch()` call inside `getBeapiToken()` |
| `api/availability.js` | `lib/guesty.js` | `import {guestyFetch} from '../lib/guesty.js'` | WIRED | Line 6 — active import, used on line 49 in the try block |
| `api/availability.js` | `https://booking-api.guesty.com/v1/search` | `guestyFetch(url)` with checkIn/checkOut/adults | WIRED | Lines 9, 48-49 — `SEARCH_BASE` constant used to build URL, passed to `guestyFetch` |
| `tests/guesty.test.js` | `lib/guesty.js` | `import` with cache-bust query string | WIRED | Line 34 — dynamic `import('../lib/guesty.js?t=${Date.now()}')` in `beforeEach`; active import used in all 5 tests |
| `tests/availability.test.js` | `api/availability.js` | `import handler from '../api/availability.js'` | WIRED | Line 8 — active import, `handler` called in all 4 tests |
| `scripts/discover-listing.js` | `lib/guesty.js` | `import { guestyFetch } from '../lib/guesty.js'` | WIRED | Line 14 — active import, `guestyFetch` called on line 28 |
| `vercel.json` | `api/availability.js` | CORS headers on `/api/(.*)` source pattern | WIRED | `mattgshepard-prog.github.io` set as CDN-level fallback; `setCors()` in handler overrides per-request |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `api/availability.js` | `data.results` | `guestyFetch(url)` → `booking-api.guesty.com/v1/search` | Yes — live BEAPI search response | FLOWING (confirmed by AVAIL-02 test with mocked realistic shape; live confirmed via human check) |
| `lib/guesty.js` | `cachedToken` | `fetch(BEAPI_TOKEN_URL)` → `booking.guesty.com/oauth2/token` | Yes — real OAuth2 token | FLOWING (confirmed by AUTH-01 test; live confirmed via human check) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 5 guesty.test.js tests GREEN | `node --test tests/guesty.test.js` | 5 pass, 0 fail | PASS |
| All 4 availability.test.js tests GREEN | `node --test tests/availability.test.js` | 4 pass, 0 fail | PASS |
| Full suite 9/9 GREEN | `node --test tests/guesty.test.js tests/availability.test.js` | 9 pass, 0 fail | PASS |
| package.json has `"type": "module"` | File read | Present, no extra keys | PASS |
| vercel.json sets correct CORS origin | File read | `https://mattgshepard-prog.github.io` | PASS |
| `lib/guesty.js` does NOT reference `open-api.guesty.com` | grep | No matches | PASS |
| `api/availability.js` does NOT contain credentials | grep | No matches in code (comment-only in scripts/) | PASS |
| Live BEAPI round-trip via discover-listing.js | `node scripts/discover-listing.js` | Requires real credentials | SKIP — human needed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 01-01, 01-02 | Server-side OAuth2 token acquisition from `booking.guesty.com/oauth2/token` | SATISFIED | `lib/guesty.js` line 10 + 21; `tests/guesty.test.js` AUTH-01 GREEN |
| AUTH-02 | 01-01, 01-02 | Token caching with module-level variable, reuse until 5 min before expiry | SATISFIED | `lib/guesty.js` `cachedToken`/`tokenExpiry` + `TOKEN_BUFFER_MS=300000`; AUTH-02 test GREEN |
| AUTH-03 | 01-01, 01-02 | Separate BEAPI scope (`booking_engine:api`) vs Open API scope | SATISFIED | `lib/guesty.js` uses `scope: 'booking_engine:api'`; no `open-api.guesty.com` in file; AUTH-03 test GREEN |
| AUTH-04 | 01-01, 01-02 | Automatic token refresh on 401 with single retry | SATISFIED | `lib/guesty.js` lines 44-48: clears cache, retries with `retried=true`; AUTH-04 test GREEN |
| LIST-01 | 01-03 | One-time listing ID discovery via Guesty `/v1/search` API | NEEDS HUMAN | `scripts/discover-listing.js` exists and is correctly wired; live API call required to confirm |
| LIST-02 | 01-03 | Listing ID stored as `GUESTY_LISTING_ID` Vercel env var | NEEDS HUMAN | Manual Vercel dashboard step — not verifiable from filesystem |
| AVAIL-01 | 01-01, 01-04 | Real-time availability check for check-in/check-out dates and guest count | SATISFIED | `api/availability.js` calls BEAPI search with `checkIn`, `checkOut`, `adults` params; validated and tested |
| AVAIL-02 | 01-01, 01-04 | Returns availability status and nightly rate from Guesty search endpoint | SATISFIED | Response shape `{ available: boolean, listing: { id, title, nightlyRate } }` or `{ available: false, listing: null }`; AVAIL-02 test GREEN |
| INFRA-01 | 01-04 | CORS headers allowing requests from GitHub Pages domain | SATISFIED | `vercel.json` CDN layer + `setCors()` per-request allowlist including `https://mattgshepard-prog.github.io` |
| INFRA-02 | 01-02, 01-04 | Guesty credentials stored as Vercel env vars only, never in frontend | SATISFIED | `GUESTY_CLIENT_ID`/`GUESTY_CLIENT_SECRET` accessed only via `process.env` in `lib/guesty.js`; absent from `api/availability.js` response paths |
| INFRA-03 | 01-01, 01-04 | Input validation on all API routes before passing to Guesty | SATISFIED | `api/availability.js` validates `checkIn`, `checkOut`, date parsing, `checkOut > checkIn`, `guests >= 1`; returns 400 + `fallbackUrl` on any failure; 3 validation tests GREEN |
| INFRA-04 | 01-01, 01-02 | Rate limit awareness (5 req/s, 275 req/min) with 429 retry logic | SATISFIED | `lib/guesty.js` line 49: `if (resp.status === 429 && !retried)` — reads `Retry-After` header, waits, retries once; INFRA-04 test GREEN |

**Orphaned requirements check:** REQUIREMENTS.md Traceability table maps LIST-01 and LIST-02 to Phase 1. Both appear in plan 01-03's `requirements` field. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/discover-listing.js` | 6 | `GUESTY_CLIENT_ID=xxx` in usage comment | Info | Comment only — no code path exposes credentials; INFRA-02 not violated |

No blockers or warnings found. The single Info item is a comment in a one-time CLI script showing usage syntax, not a credential leak.

### Human Verification Required

#### 1. Live BEAPI Round-Trip (LIST-01)

**Test:** Run `GUESTY_CLIENT_ID=<real_id> GUESTY_CLIENT_SECRET=<real_secret> node scripts/discover-listing.js` from the repo root
**Expected:** Output contains `Listings found: 1` and `id=693366e4e2c2460012d9ed96 title=Sunshine Canyon Retreat` (or whichever listing ID is associated with Sunshine Canyon in Guesty BEAPI)
**Why human:** The script is correctly wired to `lib/guesty.js` and `booking-api.guesty.com/v1/search` but a live credential round-trip cannot be executed without real Guesty BEAPI credentials in the local environment

#### 2. Vercel Environment Variable Confirmed (LIST-02)

**Test:** Run `vercel env ls` (or check the Vercel dashboard > Project Settings > Environment Variables) and confirm `GUESTY_LISTING_ID` is set
**Expected:** `GUESTY_LISTING_ID` is present with the value discovered in test 1 above
**Why human:** Setting a Vercel environment variable is a manual dashboard action; there is no code artifact to inspect and the Vercel project config is not stored in the repository

### Gaps Summary

No gaps blocking goal achievement. All automated checks pass. The two human-needed items (LIST-01 and LIST-02) are integration/infrastructure steps that are correctly implemented in code but require a live environment to confirm. The phase goal — BEAPI token lifecycle working, listing ID confirmed, availability round-trip proven — is fully achievable with the artifacts in place.

---

_Verified: 2026-04-06_
_Verifier: Claude (gsd-verifier)_
