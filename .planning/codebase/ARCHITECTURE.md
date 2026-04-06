# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Serverless API Gateway with External Integration Proxy

**Key Characteristics:**
- Vercel serverless functions (AWS Lambda-based) as the API layer
- Token-based authentication proxy to Guesty Booking Engine API
- In-memory token caching with expiry management
- CORS-enabled for cross-origin requests from GitHub Pages frontend
- Event-driven architecture where availability and pricing queries trigger external API calls
- No database layer — stateless functions with optional Redis caching for token persistence

## Layers

**API Layer (Serverless Functions):**
- Purpose: Routes incoming HTTP requests from the frontend, manages authentication, orchestrates calls to Guesty BEAPI, and transforms responses
- Location: `api/` directory
- Contains: Vercel serverless function handlers (Node.js)
- Depends on: Guesty BEAPI, environment variables, Stripe (for payment info), email service (for upsells notification)
- Used by: Frontend (GitHub Pages) via HTTPS requests

**Authentication Layer:**
- Purpose: Obtains and caches OAuth2 tokens from Guesty to authenticate subsequent API calls
- Location: Module-level implementation in `api/calendar.js` (current pattern) and future `lib/guesty.js` (refactored)
- Contains: Token request logic, expiry calculation, caching mechanism
- Depends on: Guesty OAuth2 endpoint, environment credentials (GUESTY_CLIENT_ID, GUESTY_CLIENT_SECRET)
- Used by: All API routes that need to call Guesty endpoints

**Integration Layer:**
- Purpose: Abstracts Guesty BEAPI HTTP calls and response transformation
- Location: `lib/guesty.js` (future) or inline in each route
- Contains: fetch() calls to Guesty endpoints, error handling, response parsing
- Depends on: Guesty BEAPI base URL, token from authentication layer
- Used by: All API routes

**Data Transformation Layer:**
- Purpose: Converts Guesty API responses into frontend-friendly JSON structures
- Location: Each route handler (e.g., `api/calendar.js` lines 40-52)
- Contains: Mapping logic, aggregation, filtering
- Depends on: Raw response from Guesty
- Used by: Frontend consumption

## Data Flow

**Calendar & Availability Query:**

1. Frontend calls `GET /api/calendar?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
2. Vercel receives request at `api/calendar.js`
3. `getToken()` checks for valid cached token (module-level variable)
   - If valid (> 5 min remaining): return cached token
   - If expired/missing: POST to `https://open-api.guesty.com/oauth2/token` with client credentials
4. Call `https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings/{listingId}?startDate=...&endDate=...` with token
5. Parse response: extract day-level data (date, price, status, minNights)
6. Transform to frontend schema: `{ date, price, status, minNights, available }`
7. Compute summary: total days, available days, booked days, price range, average price
8. Return `{ listing: { id, name }, summary: {...}, calendar: [...] }`
9. Frontend renders calendar view and price comparison

**Reservation Quote Flow:**

1. Frontend collects check-in, check-out, guest count, guest details
2. Frontend calls `POST /api/quote` with request body
3. Vercel receives request at `api/quote.js`
4. Get valid token (same caching strategy)
5. POST to `https://booking.guesty.com/api/reservations/quotes` with guest details
6. Parse quote response for rate plans, pricing breakdown, taxes, fees
7. Return structured quote: `{ quoteId, expiresAt, ratePlans: [...] }`
8. Frontend displays quote with total and breakdown

**Reservation Confirmation Flow:**

1. Frontend displays quote, guest selects rate plan, adds upsells
2. Frontend initializes Stripe Elements, tokenizes card (client-side only, no server contact)
3. Frontend calls `POST /api/book` with quoteId, ratePlanId, ccToken (Stripe PaymentMethod), guest details, upsells array
4. Vercel receives request at `api/book.js`
5. Validate request body (dates, guest info, token format)
6. Get valid token
7. POST to `https://booking.guesty.com/api/reservations/quotes/{quoteId}/instant` with ccToken
8. If upsells selected: send email notification to Sebastian with guest details + upsell list
9. Return confirmation: `{ success, reservationId, confirmationCode, upsells, upsellTotal }`
10. Frontend shows confirmation screen

**State Management:**
- Frontend state: User selections (dates, guest info, upsells), Stripe PaymentMethod token
- API state: Cached OAuth token (module-level variable, ephemeral — resets on cold start)
- Guesty state: Quote lifetime (typically 30 minutes), reservation confirmation (permanent)
- No persistent database — each request is independent and stateless

## Key Abstractions

**Token Manager:**
- Purpose: Provides a `getToken()` function that returns a valid OAuth2 token, handling refresh transparently
- Examples: `api/calendar.js` lines 4-20
- Pattern: Module-level caching with expiry sentinel (60-second buffer before expiry)
- Used by: All routes that call Guesty API

**Response Mapper:**
- Purpose: Transforms Guesty BEAPI JSON into frontend-friendly schemas
- Examples: `api/calendar.js` lines 40-52 (calendar transformation)
- Pattern: Extract relevant fields, compute derived values (available boolean, summary totals), return clean object
- Used by: Each route independently

**Error Handler:**
- Purpose: Catches and standardizes errors across routes
- Examples: `api/calendar.js` lines 58-61
- Pattern: try-catch wrapping, console.error logging, res.status(500).json({ error: "..." })
- Used by: All routes

**CORS Middleware:**
- Purpose: Adds Access-Control headers to all responses
- Examples: `api/calendar.js` lines 23-25, plus `vercel.json` configuration
- Pattern: Manual header setting in each route + Vercel config for broader rules
- Used by: All routes

## Entry Points

**GET /api/calendar:**
- Location: `api/calendar.js`
- Triggers: Frontend calendar widget on page load or date range change
- Responsibilities: Fetch availability + pricing from Guesty, aggregate summary stats, return calendar data

**POST /api/availability (planned):**
- Location: `api/availability.js`
- Triggers: Frontend when user selects dates to check if still available
- Responsibilities: Check real-time availability for selected dates, return pricing

**POST /api/quote (planned):**
- Location: `api/quote.js`
- Triggers: Frontend when user clicks "Continue to Book" on the quote screen
- Responsibilities: Create a reservation quote in Guesty, return detailed breakdown with rate plans

**POST /api/book (planned):**
- Location: `api/book.js`
- Triggers: Frontend when user confirms and pays
- Responsibilities: Confirm reservation in Guesty, notify Sebastian of upsells, return confirmation code

**GET /api/payment-info (planned):**
- Location: `api/payment-info.js`
- Triggers: Frontend on checkout page load
- Responsibilities: Retrieve Stripe account ID connected to listing, return for client-side Stripe initialization

**GET /api/upsells (planned):**
- Location: `api/upsells.js`
- Triggers: Frontend during guest details step
- Responsibilities: Return list of available add-ons with pricing

## Error Handling

**Strategy:** Graceful degradation with fallback links. All routes wrap Guesty calls in try-catch and return 500 with error message. Frontend catches 5xx responses and shows fallback link to Guesty booking page.

**Patterns:**
- Token refresh on expiry: Automatic retry when OAuth token expires mid-request
- Rate limit handling: Exponential backoff (future enhancement, not yet implemented)
- Guesty API errors: Catch response errors, log to console, return descriptive error JSON
- Network errors: Catch fetch() errors, return 500 with generic message
- Validation errors: Return 400 before calling Guesty (validate dates, required fields)
- Fallback: All routes include link to `https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96` in error responses

## Cross-Cutting Concerns

**Logging:** console.error() on failures, console.log() optional for debug. No structured logging framework yet. Example: `api/calendar.js` line 59.

**Validation:** Minimal — dates are assumed valid from frontend. Server-side validation to be added per SUNSHINE-BOOKING-SPEC.md section 9 (input validation before Guesty calls).

**Authentication:** OAuth2 with Guesty. Client credentials stored in Vercel environment variables. Never logged or exposed. STRIPE_PK is frontend-safe (public key) but stored as constant in future `checkout.js`.

**CORS:** Manually set in each route (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, OPTIONS`) and in `vercel.json` for blanket rules.

---

*Architecture analysis: 2026-04-06*
