# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- Lowercase with descriptive names (e.g., `calendar.js`)
- No file extensions in exports
- API route handlers match their function (e.g., `calendar.js` for `/api/calendar` endpoint)

**Functions:**
- camelCase for function names (e.g., `getToken`, `handler`)
- Async functions prefix with async keyword: `async function handler()`
- Event handlers follow Node.js convention: `handler(req, res)`

**Variables:**
- camelCase for all variables (e.g., `cachedToken`, `tokenExpiry`, `listingId`)
- Constant-like module-level state uses camelCase (not UPPER_SNAKE_CASE)
- Short, descriptive names for local variables (e.g., `d` for day objects in mapping, `resp` for response)
- Abbreviated names accepted in tight scopes (e.g., `a`, `b` in reduce functions)

**Types:**
- No TypeScript in use; plain JavaScript only
- Object shape defined implicitly through property access and assignment
- No JSDoc type annotations observed

## Code Style

**Formatting:**
- No explicit formatter configured (ESLint/Prettier not detected)
- Compact, minified-style spacing observed in source:
  - No spaces around object literals: `{grant_type:"client_credentials",scope:"open-api"}`
  - No spaces after keywords: `if(req.method==="OPTIONS")`
  - Tight variable declarations: `let cachedToken=null;`
  - Ternary operators inline: `new Date(today);const end=new Date(today);`
- Prefer single-line statements over multi-line where practical
- Line length appears flexible with no strict limit

**Linting:**
- No `.eslintrc*` or linting config detected
- No automated linting or code quality checks in place

## Import Organization

**Order:**
- ES6 module syntax used: `export default async function handler()`
- No import statements in current codebase (Vercel routes export single handler)
- Process environment accessed directly: `process.env.GUESTY_CLIENT_ID`

**Path Aliases:**
- Not applicable - single-file routes with no module resolution needed

## Error Handling

**Patterns:**
- Try-catch blocks for async operations catching all errors broadly
- Error caught and logged to console: `console.error("Guesty API error:", err)`
- Generic HTTP 500 response returned on any error: `res.status(500).json({error: "Failed to fetch calendar data"})`
- No error type checking or specific error handling per error type
- Network errors from fetch() not explicitly handled (caught by outer try-catch)
- Token fetch failures would bubble up as 500 errors

Example from `api/calendar.js`:
```javascript
try {
  // operation
} catch(err) {
  console.error("Guesty API error:", err);
  return res.status(500).json({error: "Failed to fetch calendar data"});
}
```

## Logging

**Framework:** console - Native Node.js console API

**Patterns:**
- Error logging on failures: `console.error("Guesty API error:", err)`
- Descriptive error messages with context prefix
- No info/debug/warn levels used
- No structured logging (e.g., JSON objects)
- Logging only on error paths, not for successful operations

## Comments

**When to Comment:**
- No comments present in `api/calendar.js`
- Code appears self-documenting through clear function and variable names
- Complex operations (like date calculations, token caching logic) left uncommented

**JSDoc/TSDoc:**
- Not used - no type annotations or formal documentation style

## Function Design

**Size:**
- Small, focused functions preferred
- `getToken()` is ~15 lines - handles single responsibility of token authentication
- Handler function is ~35 lines total - includes orchestration, API calls, transformation

**Parameters:**
- Minimal parameters: `handler(req, res)` - standard Node.js/Vercel pattern
- No destructuring of parameters observed
- Optional chaining used to handle undefined: `calData?.data?.days || []`

**Return Values:**
- Functions return promises (async functions)
- Handler returns response objects via `res.status().json()` or `res.status().end()`
- Implicit undefined returns acceptable in Node.js context
- Early returns for control flow: `if(req.method==="OPTIONS") return res.status(200).end()`

## Module Design

**Exports:**
- Single default export per route file: `export default async function handler(req, res)`
- Vercel convention: one handler function per API route file
- Helper functions defined within same file if co-located with handler

**Barrel Files:**
- Not applicable - no barrel/index files for re-exports observed
- Single-function files preferred

## Response Format

**API Responses:**
- Consistent JSON structure for success:
  ```javascript
  {
    listing: {id, name},
    summary: {totalDays, availableDays, bookedDays, priceRange, avgPrice, cleaningFee, currency},
    calendar: [array of day objects]
  }
  ```
- Error responses use standard format: `{error: "message"}`
- HTTP status codes used: 200 (success), 500 (error), 200 (CORS preflight)

## Data Transformation

**Array Methods:**
- `.map()` for transformations: `days.map(d => ({date, price, status, minNights, available}))`
- `.filter()` for filtering: `calendar.filter(d => d.available)`
- `.reduce()` for aggregation with arrow functions and abbreviated parameters: `(a,b) => a+b`
- Chained operations on filtered/mapped results

---

*Convention analysis: 2026-04-06*
