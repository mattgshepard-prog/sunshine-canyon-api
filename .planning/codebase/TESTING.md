# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Runner:**
- Not detected - no testing framework configured

**Assertion Library:**
- None in use

**Run Commands:**
- No test scripts defined in `package.json`
- No test command available: `npm test` would fail

## Test File Organization

**Location:**
- No test files present in codebase
- No `*.test.js`, `*.spec.js`, or `__tests__/` directories found
- Single source file: `api/calendar.js` with no corresponding test file

**Naming:**
- Not applicable - testing infrastructure not in place

**Structure:**
- Not applicable - no test files

## Test Coverage

**Requirements:**
- Not enforced - no coverage tooling configured
- Coverage reporting not available

## Test Types

**Unit Tests:**
- Not implemented
- Key testable functions: `getToken()` (token caching and refresh logic), `handler()` (API orchestration)

**Integration Tests:**
- Not implemented
- Would test Guesty API token exchange and calendar endpoint

**E2E Tests:**
- Not implemented
- Would verify full request/response cycle through deployed serverless function

## Testing Gaps

**Critical areas without tests:**
- `getToken()` in `api/calendar.js`: Token caching logic with 60-second buffer before expiry
  - Risk: Stale token errors in production, token refresh timing bugs
  - Current mitigation: None
  
- Token expiry calculation in `api/calendar.js`: `Date.now() + (data.expires_in * 1000)`
  - Risk: Millisecond math errors if expires_in is undefined/null
  - Current mitigation: None

- Date range calculation in `api/calendar.js`: Hard-coded 90-day window
  - Risk: Off-by-one errors, timezone issues with `toISOString()`
  - Current mitigation: None

- Response data transformation in `api/calendar.js`: `.map()` to reshape calendar data
  - Risk: Missing or unexpected fields from Guesty API causing undefined properties
  - Current mitigation: Optional chaining on one field only (`calData?.data?.days`)

- Error handling in `api/calendar.js`: Generic 500 errors for all failure types
  - Risk: Cannot distinguish between auth failures, API timeouts, malformed data
  - Current mitigation: console.error logging (visible only in Vercel logs)

- CORS preflight handling in `api/calendar.js`: OPTIONS method check
  - Risk: Incorrect header combinations could fail browser preflight checks
  - Current mitigation: Hardcoded headers in `vercel.json`, validated against CORS spec

- Environment variable usage in `api/calendar.js`:
  - `GUESTY_CLIENT_ID` and `GUESTY_CLIENT_SECRET` - No validation that vars are set
  - `GUESTY_LISTING_ID` - Falls back to hardcoded ID if unset
  - Risk: Silent failures with undefined env vars, no startup validation
  - Current mitigation: None

## Recommended Testing Strategy

**Priority 1 - Unit tests for token management:**
```javascript
// Would test getToken() function:
// - First call fetches from Guesty API
// - Second call (within expiry) returns cached token
// - Call after expiry refreshes token
// - Handles network errors from token endpoint
```

**Priority 2 - Integration tests for API response:**
```javascript
// Would test handler() function:
// - Mocks Guesty token API and calendar API
// - Verifies response structure with summary statistics
// - Tests date range calculation
// - Tests transformation of calendar days
```

**Priority 3 - Error scenarios:**
```javascript
// Would test error handling:
// - Token API returns 401 Unauthorized
// - Calendar API returns 404 or 500
// - Network timeout during fetch
// - Missing environment variables
// - Malformed responses from Guesty
```

## Current Testing Infrastructure

**Configuration files:**
- No `jest.config.js`, `vitest.config.ts`, or test runner configuration
- No `package.json` test scripts
- No test dependencies in `package.json`

**Execution barriers:**
- Would need to add testing framework (Jest or Vitest recommended for Node.js)
- Would need to mock external API calls (Guesty endpoints)
- Would need mocking library for `fetch()` API
- Serverless function handler requires request/response mocking

---

*Testing analysis: 2026-04-06*
