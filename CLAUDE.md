<!-- GSD:project-start source:PROJECT.md -->
## Project

**Sunshine Canyon Direct Booking**

A native booking flow for the Sunshine Canyon Retreat website that replaces the external Guesty booking page. Guests select dates, see pricing, enter details, choose upsell add-ons, pay via Stripe, and receive confirmation — all without leaving the branded site. The API layer (Vercel serverless functions) proxies to the Guesty Booking Engine API, while the frontend (GitHub Pages) handles the multi-step checkout experience.

**Core Value:** Guests can book the property directly on the Sunshine Canyon site with a seamless, branded checkout experience — no redirect to Guesty's generic booking page.

### Constraints

- **Tech stack (API):** Node.js serverless functions on Vercel — must match existing `/api/calendar` pattern
- **Tech stack (Frontend):** Vanilla HTML/JS/CSS on GitHub Pages — no React, no build tools
- **Payment:** Stripe.js from CDN only (PCI compliance), tokenize client-side, never touch card data server-side
- **Credentials:** Guesty client ID/secret as Vercel env vars only, never in frontend
- **CORS:** API must allow requests from GitHub Pages domain
- **Stripe key:** Pending from Sebastian — frontend must work without it (fallback to Guesty page)
- **Booking type:** Instant book only — no inquiry/approval flow
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (ES6+) - API route implementations
- Node.js environment - Serverless function execution
## Runtime
- Node.js - Vercel serverless runtime
- npm - Package management
- Lockfile: Not present
## Frameworks
- Vercel Serverless Functions - API route hosting and execution
- Vercel Platform - Deployment and hosting infrastructure
## Key Dependencies
- Node.js built-in `fetch()` - HTTP client for external API calls (no external HTTP library required)
- Node.js built-in `URLSearchParams` - URL-encoded parameter handling for OAuth token requests
- Vercel - Serverless function platform and edge caching
- Vercel KV (optional) - Redis caching for token management (may be used for centralized token caching)
## Configuration
- Environment variables stored as Vercel project settings
- Required variables:
- `vercel.json` - Vercel platform configuration
## Platform Requirements
- Node.js runtime
- Git for version control
- Vercel account and CLI for deployment
- Vercel serverless deployment platform
- Node.js 18+ runtime environment
- Network access to external APIs (Guesty, Stripe)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Lowercase with descriptive names (e.g., `calendar.js`)
- No file extensions in exports
- API route handlers match their function (e.g., `calendar.js` for `/api/calendar` endpoint)
- camelCase for function names (e.g., `getToken`, `handler`)
- Async functions prefix with async keyword: `async function handler()`
- Event handlers follow Node.js convention: `handler(req, res)`
- camelCase for all variables (e.g., `cachedToken`, `tokenExpiry`, `listingId`)
- Constant-like module-level state uses camelCase (not UPPER_SNAKE_CASE)
- Short, descriptive names for local variables (e.g., `d` for day objects in mapping, `resp` for response)
- Abbreviated names accepted in tight scopes (e.g., `a`, `b` in reduce functions)
- No TypeScript in use; plain JavaScript only
- Object shape defined implicitly through property access and assignment
- No JSDoc type annotations observed
## Code Style
- No explicit formatter configured (ESLint/Prettier not detected)
- Compact, minified-style spacing observed in source:
- Prefer single-line statements over multi-line where practical
- Line length appears flexible with no strict limit
- No `.eslintrc*` or linting config detected
- No automated linting or code quality checks in place
## Import Organization
- ES6 module syntax used: `export default async function handler()`
- No import statements in current codebase (Vercel routes export single handler)
- Process environment accessed directly: `process.env.GUESTY_CLIENT_ID`
- Not applicable - single-file routes with no module resolution needed
## Error Handling
- Try-catch blocks for async operations catching all errors broadly
- Error caught and logged to console: `console.error("Guesty API error:", err)`
- Generic HTTP 500 response returned on any error: `res.status(500).json({error: "Failed to fetch calendar data"})`
- No error type checking or specific error handling per error type
- Network errors from fetch() not explicitly handled (caught by outer try-catch)
- Token fetch failures would bubble up as 500 errors
## Logging
- Error logging on failures: `console.error("Guesty API error:", err)`
- Descriptive error messages with context prefix
- No info/debug/warn levels used
- No structured logging (e.g., JSON objects)
- Logging only on error paths, not for successful operations
## Comments
- No comments present in `api/calendar.js`
- Code appears self-documenting through clear function and variable names
- Complex operations (like date calculations, token caching logic) left uncommented
- Not used - no type annotations or formal documentation style
## Function Design
- Small, focused functions preferred
- `getToken()` is ~15 lines - handles single responsibility of token authentication
- Handler function is ~35 lines total - includes orchestration, API calls, transformation
- Minimal parameters: `handler(req, res)` - standard Node.js/Vercel pattern
- No destructuring of parameters observed
- Optional chaining used to handle undefined: `calData?.data?.days || []`
- Functions return promises (async functions)
- Handler returns response objects via `res.status().json()` or `res.status().end()`
- Implicit undefined returns acceptable in Node.js context
- Early returns for control flow: `if(req.method==="OPTIONS") return res.status(200).end()`
## Module Design
- Single default export per route file: `export default async function handler(req, res)`
- Vercel convention: one handler function per API route file
- Helper functions defined within same file if co-located with handler
- Not applicable - no barrel/index files for re-exports observed
- Single-function files preferred
## Response Format
- Consistent JSON structure for success:
- Error responses use standard format: `{error: "message"}`
- HTTP status codes used: 200 (success), 500 (error), 200 (CORS preflight)
## Data Transformation
- `.map()` for transformations: `days.map(d => ({date, price, status, minNights, available}))`
- `.filter()` for filtering: `calendar.filter(d => d.available)`
- `.reduce()` for aggregation with arrow functions and abbreviated parameters: `(a,b) => a+b`
- Chained operations on filtered/mapped results
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Vercel serverless functions (AWS Lambda-based) as the API layer
- Token-based authentication proxy to Guesty Booking Engine API
- In-memory token caching with expiry management
- CORS-enabled for cross-origin requests from GitHub Pages frontend
- Event-driven architecture where availability and pricing queries trigger external API calls
- No database layer — stateless functions with optional Redis caching for token persistence
## Layers
- Purpose: Routes incoming HTTP requests from the frontend, manages authentication, orchestrates calls to Guesty BEAPI, and transforms responses
- Location: `api/` directory
- Contains: Vercel serverless function handlers (Node.js)
- Depends on: Guesty BEAPI, environment variables, Stripe (for payment info), email service (for upsells notification)
- Used by: Frontend (GitHub Pages) via HTTPS requests
- Purpose: Obtains and caches OAuth2 tokens from Guesty to authenticate subsequent API calls
- Location: Module-level implementation in `api/calendar.js` (current pattern) and future `lib/guesty.js` (refactored)
- Contains: Token request logic, expiry calculation, caching mechanism
- Depends on: Guesty OAuth2 endpoint, environment credentials (GUESTY_CLIENT_ID, GUESTY_CLIENT_SECRET)
- Used by: All API routes that need to call Guesty endpoints
- Purpose: Abstracts Guesty BEAPI HTTP calls and response transformation
- Location: `lib/guesty.js` (future) or inline in each route
- Contains: fetch() calls to Guesty endpoints, error handling, response parsing
- Depends on: Guesty BEAPI base URL, token from authentication layer
- Used by: All API routes
- Purpose: Converts Guesty API responses into frontend-friendly JSON structures
- Location: Each route handler (e.g., `api/calendar.js` lines 40-52)
- Contains: Mapping logic, aggregation, filtering
- Depends on: Raw response from Guesty
- Used by: Frontend consumption
## Data Flow
- Frontend state: User selections (dates, guest info, upsells), Stripe PaymentMethod token
- API state: Cached OAuth token (module-level variable, ephemeral — resets on cold start)
- Guesty state: Quote lifetime (typically 30 minutes), reservation confirmation (permanent)
- No persistent database — each request is independent and stateless
## Key Abstractions
- Purpose: Provides a `getToken()` function that returns a valid OAuth2 token, handling refresh transparently
- Examples: `api/calendar.js` lines 4-20
- Pattern: Module-level caching with expiry sentinel (60-second buffer before expiry)
- Used by: All routes that call Guesty API
- Purpose: Transforms Guesty BEAPI JSON into frontend-friendly schemas
- Examples: `api/calendar.js` lines 40-52 (calendar transformation)
- Pattern: Extract relevant fields, compute derived values (available boolean, summary totals), return clean object
- Used by: Each route independently
- Purpose: Catches and standardizes errors across routes
- Examples: `api/calendar.js` lines 58-61
- Pattern: try-catch wrapping, console.error logging, res.status(500).json({ error: "..." })
- Used by: All routes
- Purpose: Adds Access-Control headers to all responses
- Examples: `api/calendar.js` lines 23-25, plus `vercel.json` configuration
- Pattern: Manual header setting in each route + Vercel config for broader rules
- Used by: All routes
## Entry Points
- Location: `api/calendar.js`
- Triggers: Frontend calendar widget on page load or date range change
- Responsibilities: Fetch availability + pricing from Guesty, aggregate summary stats, return calendar data
- Location: `api/availability.js`
- Triggers: Frontend when user selects dates to check if still available
- Responsibilities: Check real-time availability for selected dates, return pricing
- Location: `api/quote.js`
- Triggers: Frontend when user clicks "Continue to Book" on the quote screen
- Responsibilities: Create a reservation quote in Guesty, return detailed breakdown with rate plans
- Location: `api/book.js`
- Triggers: Frontend when user confirms and pays
- Responsibilities: Confirm reservation in Guesty, notify Sebastian of upsells, return confirmation code
- Location: `api/payment-info.js`
- Triggers: Frontend on checkout page load
- Responsibilities: Retrieve Stripe account ID connected to listing, return for client-side Stripe initialization
- Location: `api/upsells.js`
- Triggers: Frontend during guest details step
- Responsibilities: Return list of available add-ons with pricing
## Error Handling
- Token refresh on expiry: Automatic retry when OAuth token expires mid-request
- Rate limit handling: Exponential backoff (future enhancement, not yet implemented)
- Guesty API errors: Catch response errors, log to console, return descriptive error JSON
- Network errors: Catch fetch() errors, return 500 with generic message
- Validation errors: Return 400 before calling Guesty (validate dates, required fields)
- Fallback: All routes include link to `https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96` in error responses
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



## Economical Model Routing

This project uses GSD Economical to minimize AI model costs without sacrificing quality.

### Before Each Phase

Check `.planning/ECONOMICAL.md` for the assigned model and effort level, then run:
- `/model [assigned_model]` to switch models
- `/effort [assigned_level]` to set thinking depth

### Phase Assignments

| Phase | Name | Tier | Model | Effort |
|-------|------|------|-------|--------|
| 1 | API Foundation | 3 | Opus | high |
| 2 | Quote + Payment Info | 2 | Sonnet | medium |
| 3 | Upsells + Notifications | 2 | Sonnet | medium |
| 4 | Booking Endpoint | 3 | Opus | high |
| 5 | Checkout Modal — Steps 1 & 2 | 2 | Sonnet | medium |
| 6 | Stripe Elements + End-to-End | 3 | Opus | high |

### Escalation Rule

If a Sonnet executor fails the same task 3 times, escalate:
1. Stop execution
2. `/model opus`
3. `/effort high`
4. Re-run the failing task
5. After success, switch back to the assigned model for remaining tasks

### Post-Build Quality Check

After all phases complete, run Opus verification on Sonnet-built phases:
```
/model opus
/effort high
/gsd:verify-work [phase_number]
```

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
