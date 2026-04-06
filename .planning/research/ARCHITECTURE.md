# Architecture Patterns

**Domain:** Vacation rental direct booking — Guesty BEAPI + Stripe + Vercel + GitHub Pages
**Researched:** 2026-04-06
**Overall confidence:** HIGH (spec document is authoritative; Guesty docs and Stripe docs verified)

---

## Recommended Architecture

### System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (GitHub Pages — Static)                               │
│  mattgshepard-prog.github.io/sunshine-canyon-retreat            │
│                                                                 │
│  index.html          checkout.js         stripe-setup.js        │
│  (existing + modal)  (4-step flow)       (Stripe Elements init) │
│                                                                 │
│  Step 1: Quote       Step 2: Details     Step 3: Payment        │
│  /api/quote   ──→    upsell checkboxes   Stripe.js (CDN only)  │
│                                          createPaymentMethod     │
│                                          → pm_xxx token         │
│  Step 4: Confirmation                                           │
│  /api/book  ←── pm_xxx + quoteId + ratePlanId + upsells        │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTPS (CORS headers required)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  API LAYER (Vercel Serverless Functions — Node.js ESM)          │
│  sunshine-canyon-api.vercel.app/api/                            │
│                                                                 │
│  lib/guesty.js          ← shared Guesty client + token cache   │
│  lib/upsells-config.js  ← upsell definitions (name/price/desc) │
│  lib/notify.js          ← Resend email helper                  │
│                                                                 │
│  GET  /api/availability ← GET /v1/search (Guesty BEAPI)        │
│  POST /api/quote        ← POST /api/reservations/quotes        │
│  GET  /api/payment-info ← GET /api/listings/:id/payment-prov.  │
│  POST /api/book         ← POST /api/reservations/quotes/:id/instant │
│  GET  /api/upsells      ← lib/upsells-config.js (no Guesty)   │
│  GET  /api/calendar     ← (existing) Guesty Open API           │
└────────────────────────┬────────────────────────────────────────┘
                         │  Bearer token (OAuth2 client_credentials)
          ┌──────────────┴──────────────────────┐
          ▼                                     ▼
┌─────────────────────┐             ┌──────────────────────────┐
│  Guesty BEAPI        │             │  Resend (email)          │
│  booking.guesty.com  │             │  Upsell notification     │
│  booking-api.guesty. │             │  → seb@sv.partners       │
│  com/v1             │             └──────────────────────────┘
│                     │
│  OAuth token:       │
│  booking.guesty.com │
│  /oauth2/token      │
└─────────────────────┘
          │
          ▼ (Stripe account ID flows back to frontend)
┌─────────────────────────────────────────────────────────────────┐
│  Stripe (Payment Tokenization)                                  │
│  Stripe.js from https://js.stripe.com/v3/ (CDN — PCI required) │
│  Initialized with: platform pubkey + stripeAccount: acct_xxx   │
│  Creates: pm_xxx PaymentMethod token (one-time use)            │
│  Card data NEVER touches our servers                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Owns | Communicates With |
|-----------|---------------|------|-------------------|
| `lib/guesty.js` | OAuth2 token lifecycle + HTTP client | In-memory token cache (module-level var) | Guesty BEAPI auth + data endpoints |
| `lib/upsells-config.js` | Static upsell definitions | Upsell catalog (name, price, description) | No external calls |
| `lib/notify.js` | Email notification dispatch | None (stateless) | Resend API |
| `/api/availability` | Translate date+guests query → availability+pricing | None | lib/guesty.js → Guesty /v1/search |
| `/api/quote` | Create Guesty quote, return price breakdown | None | lib/guesty.js → booking.guesty.com/api/reservations/quotes |
| `/api/payment-info` | Resolve Stripe account ID for listing | None | lib/guesty.js → booking.guesty.com/api/listings/:id/payment-provider |
| `/api/book` | Confirm instant reservation, trigger upsell email | None | lib/guesty.js → quotes/:id/instant + lib/notify.js → Resend |
| `/api/upsells` | Serve upsell catalog to frontend | None | lib/upsells-config.js (no network call) |
| `/api/calendar` | Existing iCal proxy (availability dates) | None | Guesty Open API (separate from BEAPI) |
| `checkout.js` | Orchestrate 4-step booking UI state | quoteId, ratePlanId, guestData, selectedUpsells | /api/quote, /api/book, stripe-setup.js |
| `stripe-setup.js` | Stripe.js init + PaymentMethod creation | Stripe Elements DOM | /api/payment-info (for stripeAccount ID), Stripe.js CDN |

---

## Data Flow: Full Booking Sequence

### Pre-Booking (existing, no change)
```
Date picker → GET /api/calendar → blocked dates rendered on calendar
```

### Step 1: Quote
```
Guest selects dates + guest count
  → Frontend: POST /api/quote { checkIn, checkOut, guests, guest{...} }
  → API: lib/guesty.js.getToken() [cache hit or OAuth2 refresh]
  → API: POST booking.guesty.com/api/reservations/quotes
  → Guesty: returns quoteId + ratePlans[] + pricing breakdown
  → API: return { quoteId, ratePlans, totals } to frontend
  → Frontend: render price breakdown, store quoteId + ratePlanId in state
```

### Step 2: Guest Details + Upsells
```
Guest fills form (firstName, lastName, email, phone)
Guest checks upsell boxes
  → Frontend: GET /api/upsells [on page load, before step 2]
  → Frontend: store { guestData, selectedUpsells[] } in state
  → No API calls during this step (validation only)
```

### Step 3: Payment
```
Frontend: GET /api/payment-info
  → API: GET booking.guesty.com/api/listings/{GUESTY_LISTING_ID}/payment-provider
  → Guesty: returns { providerAccountId: "acct_xxx" }
  → API: return { stripeAccountId: "acct_xxx" } to frontend

Frontend stripe-setup.js:
  if (!STRIPE_PK) → showFallback() → link to svpartners.guestybookings.com
  else:
    stripe = Stripe(STRIPE_PK, { stripeAccount: stripeAccountId })
    card = stripe.elements().create('card')
    card.mount('#card-element')

Guest enters card → clicks "Complete Booking":
  { paymentMethod, error } = await stripe.createPaymentMethod({ type:'card', card, billing_details })
  → pm_xxx token created CLIENT-SIDE by Stripe.js
  → card data NEVER sent to our API
```

### Step 4: Booking Confirmation
```
Frontend: POST /api/book {
  quoteId,
  ratePlanId,
  ccToken: "pm_xxx",
  guest: { firstName, lastName, email, phone },
  upsells: ["early_checkin", "stocked_fridge"]
}
  → API: lib/guesty.js.getToken()
  → API: POST booking.guesty.com/api/reservations/quotes/{quoteId}/instant
         body: { ratePlanId, ccToken, guest, policy }
  → Guesty: creates confirmed reservation, charges $50 deposit
  → Guesty: returns { reservationId, confirmationCode, status: "confirmed" }

  if upsells.length > 0:
    → API: lib/notify.js → Resend: email to seb@sv.partners
           [guest name, email, phone, dates, confirmationCode, upsells + prices]

  → API: return { success, reservationId, confirmationCode, status } to frontend
  → Frontend: render confirmation screen, display .ics download link
```

---

## Token Management Architecture

The critical constraint: max 3 token renewals per 24h per application.

```
lib/guesty.js module-level variables:
  let cachedToken = null
  let tokenExpiry = 0    // epoch ms

getToken() algorithm:
  if cachedToken && Date.now() < tokenExpiry - 300_000:  // 5min buffer
    return cachedToken  // ← warm Vercel instance reuse (HIGH value)
  else:
    POST booking.guesty.com/oauth2/token
    cachedToken = response.access_token
    tokenExpiry = Date.now() + (response.expires_in * 1000)  // 24h
    return cachedToken
```

**Warm instance behavior (confirmed):** Vercel preserves module-level variables between invocations on the same warm instance. With Fluid Compute (Vercel's current default), multiple concurrent requests share the same instance. This makes in-memory caching effective — cold starts are the only scenario requiring a new token fetch.

**Cold start behavior:** Each cold start fetches a fresh token. At ~5 req/s rate limit and low booking volume, this is within the 3-renewal-per-24h constraint. No Vercel KV needed for this traffic pattern.

**Scope difference (important):** The existing `/api/calendar` uses Guesty Open API (`open-api.guesty.com`) with scope `open-api`. The new BEAPI routes use `booking.guesty.com` with scope `booking_engine:api`. These are separate OAuth endpoints with separate credentials — the `lib/guesty.js` BEAPI client must NOT reuse the calendar route's token logic.

---

## API Base URL Clarification

Guesty BEAPI uses two distinct base hostnames (confirmed via official docs):

| Use | Hostname | Example |
|-----|----------|---------|
| OAuth token | `booking.guesty.com` | `POST /oauth2/token` |
| Search/availability | `booking-api.guesty.com/v1` | `GET /v1/search` |
| Quote + booking operations | `booking.guesty.com` | `POST /api/reservations/quotes` |
| Payment provider lookup | `booking.guesty.com` | `GET /api/listings/:id/payment-provider` |

The `/v1/search` endpoint lives on `booking-api.guesty.com`, while all quote and reservation operations live on `booking.guesty.com`. This split is intentional and must be handled in `lib/guesty.js`.

---

## Stripe Connected Account Integration

Guesty's payment model uses Stripe Connect. The property manager (Sebastian) has a Stripe account connected to Guesty. Card tokens must be created on that connected account, not on a platform account.

```
Frontend flow:
1. GET /api/payment-info → returns { stripeAccountId: "acct_xxx" }
2. Stripe(STRIPE_PK, { stripeAccount: "acct_xxx" })
   NOTE: STRIPE_PK is the PLATFORM publishable key (Sebastian provides)
         stripeAccount routes the token to his connected account
3. stripe.createPaymentMethod({ type: 'card', card, billing_details })
   → pm_xxx token is scoped to acct_xxx automatically
4. pm_xxx passed to /api/book as ccToken
```

**Key constraint:** A PaymentMethod token (pm_xxx) is single-use. Do not attempt to retry booking with the same token. If `/api/book` fails after Stripe tokenization, the user must re-enter card details.

**Fallback path (no Stripe key):**
```
if (!STRIPE_PK) → show "Book via partner portal" → link to Guesty booking page
```
This path is required because Sebastian's Stripe publishable key is not yet available.

---

## Upsell Architecture

Upsells are intentionally outside Guesty's data model. Guesty BEAPI does not support custom fees on quotes.

```
/api/upsells:
  reads lib/upsells-config.js (static JSON)
  no Guesty API call
  returns catalog to frontend

Frontend:
  renders checkboxes in Step 2
  accumulates selectedUpsells[] in JS state
  displays running total (upsell prices added to quote total display)

/api/book:
  receives selectedUpsells[] from frontend
  does NOT pass to Guesty (Guesty ignores unknown fields)
  IF upsells.length > 0:
    sends email to Sebastian via Resend
    email contains: booking confirmation + upsell list + individual prices
  returns confirmation + upsellTotal to frontend
```

Upsell pricing is server-side only (in `lib/upsells-config.js`). Frontend receives prices from `/api/upsells` — never trusts frontend-submitted prices.

---

## CORS Configuration

GitHub Pages domain must be in `Access-Control-Allow-Origin`. The existing `vercel.json` sets `*` (wildcard) globally for all `/api/` routes. This is acceptable for this project (no auth headers from frontend, no sensitive data sent TO frontend beyond confirmation codes).

Preflight OPTIONS requests must return 200 — the existing `calendar.js` pattern (check `req.method === "OPTIONS"`) should be replicated in all new handlers. Alternatively, the `vercel.json` headers config handles this at the CDN layer.

---

## Error Handling Architecture

| Error Condition | Where Detected | Response |
|----------------|---------------|----------|
| Token expired (401 from Guesty) | `lib/guesty.js` | Auto-refresh + retry once |
| Rate limited (429 from Guesty) | Each API handler | Exponential backoff, max 2 retries |
| Quote expired | `/api/book` (Guesty returns error) | 409 to frontend → "Quote expired, start over" |
| Availability changed | `/api/book` | 409 to frontend → "Dates unavailable, recheck" |
| Stripe tokenization failure | `stripe-setup.js` (client-side) | Show Stripe error message, retry allowed |
| pm_xxx passed but Guesty rejects | `/api/book` | 402 to frontend → "Payment failed, retry" |
| Any unrecoverable API failure | Each handler | 502 + fallback URL to Guesty booking page |

---

## File Layout

```
sunshine-canyon-api/           (this repo — Vercel)
├── api/
│   ├── calendar.js            (existing — Open API, keep as-is)
│   ├── availability.js        (new — GET /api/availability)
│   ├── quote.js               (new — POST /api/quote)
│   ├── payment-info.js        (new — GET /api/payment-info)
│   ├── book.js                (new — POST /api/book)
│   └── upsells.js             (new — GET /api/upsells)
└── lib/
    ├── guesty.js              (new — BEAPI client + token cache)
    ├── upsells-config.js      (new — upsell catalog, static)
    └── notify.js              (new — Resend email helper)

sunshine-canyon-retreat/       (separate repo — GitHub Pages)
├── index.html                 (updated — adds checkout modal/drawer)
├── js/
│   ├── checkout.js            (new — 4-step flow orchestration)
│   └── stripe-setup.js        (new — Stripe.js init + token creation)
└── css/
    └── checkout.css           (new — checkout-specific styles)
```

---

## Suggested Build Order

Dependencies dictate this sequence:

### 1. `lib/guesty.js` — Token + HTTP client
Everything else depends on it. Build and test token acquisition in isolation before any other API work.

**Test:** Direct curl to Guesty BEAPI with token obtained from this lib.

### 2. `/api/availability` — Search endpoint
Simplest Guesty call (GET, read-only). Validates token management works end-to-end and confirms listing ID discovery.

**Test:** `curl "/api/availability?checkIn=2026-06-01&checkOut=2026-06-03&guests=2"`

**Dependency:** Resolves `GUESTY_LISTING_ID` (hardcode as env var after discovery).

### 3. `/api/quote` — Quote creation
First write operation. Returns `quoteId` needed by `/api/book`. Test thoroughly — this is the most complex response shape.

**Test:** `curl -X POST /api/quote` with date/guest body.

### 4. `/api/payment-info` — Stripe account lookup
Short GET call. Returns `stripeAccountId` needed for frontend Stripe init. Can be built in parallel with `/api/quote` since both only depend on `lib/guesty.js`.

**Test:** `curl "/api/payment-info"` — expect `acct_xxx` format.

### 5. `lib/upsells-config.js` + `/api/upsells` — Static catalog
No Guesty dependency. Can be built any time. Unblocks frontend Step 2.

### 6. `lib/notify.js` + Resend integration
Test email delivery to Sebastian's address before wiring into `/api/book`.

### 7. `/api/book` — Reservation confirmation + upsell notification
Last API route. Depends on lib/guesty.js (token), lib/notify.js (email), and a valid quoteId from /api/quote.

**Test:** End-to-end with a real quote ID. Verify reservation appears in Guesty dashboard.

### 8. Frontend: `checkout.js` + `checkout.css` — UI shell + Steps 1 and 2
Build modal/drawer HTML, wire "Book Direct" buttons, implement Step 1 (quote display) and Step 2 (guest form + upsells). Fully testable without Stripe key.

### 9. Frontend: `stripe-setup.js` — Step 3 payment
Build last because it requires Stripe publishable key from Sebastian. Build the fallback path first (show Guesty link when no key). Wire real Stripe Elements once key is available.

### 10. End-to-end test
Full flow: date selection → quote → guest details → Stripe tokenization → book → confirm in Guesty dashboard.

---

## Scalability Considerations

| Concern | At current volume (low) | If traffic grows |
|---------|------------------------|-----------------|
| Token renewals | In-memory cache sufficient, cold starts add fetches but stay under 3/24h limit | Add Vercel KV (Redis) for persistent cross-instance cache |
| Rate limits (5 req/s) | Single property, low concurrency, non-issue | Rate limiter middleware in lib/guesty.js |
| Quote expiry | Quotes expire; user flow is ~5 min end-to-end, non-issue | Show timer / re-quote silently if step takes >10 min |
| Vercel cold starts | Free tier: cold starts frequent; cached token lost on cold start | Upgrade to Vercel Pro for pre-warmed instances |

---

## Sources

- Guesty BEAPI Quick Start: https://booking-api-docs.guesty.com/docs/quick-start (HIGH confidence — official docs)
- Guesty BEAPI Authentication: https://booking-api-docs.guesty.com/docs/authentication-1 (HIGH confidence — official docs)
- Guesty Booking Flow: https://booking-api-docs.guesty.com/docs/booking-flow (HIGH confidence — official docs)
- Guesty Stripe Tokenization Flow: https://booking-api-docs.guesty.com/docs/stripe-tokenization-flow (HIGH confidence — official docs)
- Guesty Create Reservation Quote: https://booking-api-docs.guesty.com/reference/createreservationquote (HIGH confidence — official API reference)
- Stripe.js initialization with stripeAccount: https://docs.stripe.com/js/initializing (HIGH confidence — official docs)
- Stripe Connect authentication: https://docs.stripe.com/connect/authentication (HIGH confidence — official docs)
- Vercel serverless function warm instance behavior: https://vercel.com/docs/functions/concepts (HIGH confidence — official docs)
- Resend + Vercel Functions: https://resend.com/docs/send-with-vercel-functions (HIGH confidence — official docs)
- Existing codebase: `/api/calendar.js` — ESM export default pattern, in-memory token cache, CORS headers (direct observation — HIGH confidence)
