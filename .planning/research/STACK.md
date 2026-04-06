# Technology Stack

**Project:** Sunshine Canyon Direct Booking — Guesty BEAPI + Stripe Checkout
**Researched:** 2026-04-06
**Overall confidence:** MEDIUM-HIGH (core APIs verified via official docs; some Stripe connected-account nuance needs validation against Sebastian's actual Stripe account structure)

---

## Recommended Stack

### API Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 22.x (pin in package.json) | Vercel serverless runtime | 22.x is current LTS on Vercel; 24.x is the new default but LTS status makes 22.x more stable for production. Native `fetch` is stable in both. |
| Vercel Functions | Current | Serverless API host | Already used by `/api/calendar`. No server to manage, scales to zero. Hobby tier gives 300s max execution, 2 GB memory — more than enough for API proxy calls. |

**Source:** [Vercel Node.js Versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) — HIGH confidence

**Pin the version in `package.json`:**
```json
{
  "engines": { "node": "22.x" }
}
```

---

### HTTP Transport (Server-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `fetch` | Built-in (Node.js 22) | All outbound API calls (Guesty, Stripe) | Zero dependencies. Node.js 22 has stable fetch. Already used in `calendar.js`. No `node-fetch` or `axios` needed. |

**Do NOT use:** `node-fetch`, `axios`, `got`. Native fetch is stable in Node.js 18+ and is already the pattern in this codebase.

**Source:** [Vercel Node.js Runtime Docs](https://vercel.com/docs/functions/runtimes/node-js) — HIGH confidence

---

### Guesty Booking Engine API

| Aspect | Detail | Notes |
|--------|--------|-------|
| Base URL | `https://booking-api.guesty.com/v1` | BEAPI (not Open API) |
| Auth endpoint | `https://booking.guesty.com/oauth2/token` | Different from Open API auth used in `calendar.js` |
| Quote endpoint | `POST https://booking.guesty.com/api/reservations/quotes` | Creates priced reservation hold |
| Instant book | `POST https://booking.guesty.com/api/reservations/quotes/{quoteId}/instant` | Confirms reservation with ccToken |
| Payment provider | `GET /listings/{listingId}/payment-provider` | Returns `providerAccountId` (Stripe acct_...) |
| Token lifetime | 86,400s (24h), max 3 renewals per 24h | Must cache — identical pattern to `calendar.js` |
| Rate limits | 5 req/s, 275 req/min, 16,500 req/hr | Non-burst; implement per-endpoint retry with 429 backoff |

**CRITICAL:** The BEAPI uses a different OAuth2 scope (`booking_engine:api`) and a different token endpoint than the Open API used by `calendar.js` (`open-api.guesty.com/oauth2/token`). Two separate token caches are needed if both APIs remain in use.

**Token caching pattern** (extend existing `calendar.js` pattern, but scoped to BEAPI):
```js
// Module-level — survives across fluid compute invocations
let beapiToken = null;
let beapiTokenExpiry = 0;

async function getBeapiToken() {
  if (beapiToken && Date.now() < beapiTokenExpiry - 60_000) return beapiToken;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'booking_engine:api',
    client_id: process.env.GUESTY_CLIENT_ID,
    client_secret: process.env.GUESTY_CLIENT_SECRET,
  });
  const resp = await fetch('https://booking.guesty.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: params.toString(),
  });
  const data = await resp.json();
  beapiToken = data.access_token;
  beapiTokenExpiry = Date.now() + data.expires_in * 1000;
  return beapiToken;
}
```

**Source:** [BEAPI Authentication](https://booking-api-docs.guesty.com/docs/authentication-1), [Quick Start](https://booking-api-docs.guesty.com/docs/quick-start) — HIGH confidence

---

### Stripe (Client-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Stripe.js v3 | Latest (CDN, pinned by Stripe) | Card Element, PaymentMethod creation | PCI compliance requires card data never touch the server. CDN-only for vanilla JS — no npm install. |

**CDN tag (goes in checkout HTML):**
```html
<script src="https://js.stripe.com/v3/"></script>
```

**CRITICAL — Token format:** Guesty BEAPI instant booking requires a **Stripe SCA PaymentMethod token** (`pm_...`). Pre-SCA card tokens (`tok_...`) are explicitly NOT supported by the instant booking endpoint. Use `stripe.createPaymentMethod()`, not the legacy `stripe.createToken()`.

**Initialization for connected account:**
```js
// publishableKey comes from /api/payment-info (server fetches from Guesty, returns to frontend)
// stripeAccountId is the acct_... value from GET /listings/{id}/payment-provider
const stripe = Stripe(publishableKey, { stripeAccount: stripeAccountId });
const elements = stripe.elements();
const cardElement = elements.create('card');
```

**PaymentMethod creation:**
```js
const { paymentMethod, error } = await stripe.createPaymentMethod({
  type: 'card',
  card: cardElement,
  billing_details: {
    name: `${firstName} ${lastName}`,
    email: guestEmail,
  },
});
// paymentMethod.id is the pm_... token — pass this as ccToken to /api/book
```

**Source:** [Stripe.js Reference](https://docs.stripe.com/js/initializing), [Stripe createPaymentMethod](https://docs.stripe.com/js/payment_methods/create_payment_method), [Guesty instant booking endpoint research](https://booking-api-docs.guesty.com/reference/createinstantreservationfromquote) — MEDIUM-HIGH confidence (Stripe side HIGH; Guesty pm_ requirement verified via endpoint docs)

---

### Stripe (Server-Side)

The server does NOT use the Stripe Node.js SDK. The server's only Stripe-related job is:

1. Fetching the Stripe `providerAccountId` and publishable key from Guesty's payment provider endpoint and returning it to the frontend
2. Passing the `pm_...` token (already created client-side) to Guesty's booking endpoint as `ccToken`

No direct Stripe charges are made server-side. Guesty handles charge execution. Therefore **do not install `stripe` npm package** — it adds unnecessary weight and complexity.

---

### Email Notifications (Upsells)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Resend SDK | `resend@^4.0.0` (verify: npm shows 6.10.0 as of April 2026) | Transactional email to Sebastian for upsell notifications | Simple REST API, generous free tier (3,000 emails/month), first-class Vercel integration, no SMTP config. |

**Install:**
```bash
npm install resend
```

**Usage pattern in serverless function:**
```js
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'bookings@yourdomain.com',
  to: 'seb@sv.partners',
  subject: `Upsell request: ${confirmationCode}`,
  html: `<p>Guest selected: ${upsellList}</p>`,
});
```

**Source:** [Resend Node.js Docs](https://resend.com/docs/send-with-nodejs), [npm package](https://www.npmjs.com/package/resend) — HIGH confidence

**Confidence note:** Version 6.10.0 reported by npm search (April 2026). Verify with `npm show resend version` before installing — the SDK is actively maintained and version number may have jumped further.

---

### Token Caching Strategy

Vercel's fluid compute (enabled by default for new projects as of April 2025) allows module-level variables to persist across concurrent invocations in the same instance. This means the in-memory token cache pattern used in `calendar.js` works correctly without external storage.

**Do NOT use:** Vercel KV (Redis) for token caching. It adds latency, cost, and operational complexity for a single token that refreshes once per day. Module-level caching is sufficient given the 3-renewal-per-24h limit and low request volume for a single vacation rental.

**Source:** [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute) — MEDIUM confidence (fluid compute behavior with module-level state is documented but depends on Vercel's instance reuse behavior, which is best-effort not guaranteed)

---

### CORS

No new library needed. The existing pattern from `calendar.js` — setting `Access-Control-Allow-Origin` headers manually in each handler — is sufficient. All handlers must include:

```js
res.setHeader('Access-Control-Allow-Origin', 'https://sunshinecanyonretreat.com'); // tighten from *
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
if (req.method === 'OPTIONS') return res.status(200).end();
```

Tightening `*` to the specific GitHub Pages domain is recommended for the booking endpoints that receive guest data.

---

### Environment Variables (new additions)

| Variable | Used By | Notes |
|----------|---------|-------|
| `GUESTY_CLIENT_ID` | All API handlers | Already exists (used by `calendar.js`) |
| `GUESTY_CLIENT_SECRET` | All API handlers | Already exists |
| `GUESTY_LISTING_ID` | All API handlers | Already exists |
| `STRIPE_PUBLISHABLE_KEY` | `/api/payment-info` response | Sebastian's connected Stripe account publishable key — pending |
| `STRIPE_ACCOUNT_ID` | `/api/payment-info` response | Stripe `acct_...` ID for the connected account — may be derivable from Guesty payment provider endpoint instead |
| `RESEND_API_KEY` | `/api/book` (upsell notification) | From Resend dashboard |

**Note on Stripe keys:** The Guesty `GET /listings/{id}/payment-provider` endpoint returns the `providerAccountId` (Stripe `acct_...`). However, it does NOT return the Stripe publishable key — that must come from Sebastian's Stripe dashboard and be stored as a Vercel env var. The `/api/payment-info` endpoint should return both to the frontend.

---

## What NOT to Use

| Package | Why Not |
|---------|---------|
| `stripe` (npm) | Server never charges Stripe directly; Guesty handles charges. Dead weight. |
| `node-fetch` | Node.js 22 has stable native `fetch`. Zero benefit. |
| `axios` | Same. Native `fetch` is sufficient and already in use. |
| `express` | Vercel's built-in request/response helpers are sufficient for these simple proxy endpoints. |
| `@vercel/kv` (Redis) | Token caching via module-level variables is adequate. Redis adds latency and cost. |
| React / any framework | Project constraint: vanilla JS only on GitHub Pages frontend. |
| Stripe Payment Element | Guesty BEAPI requires `pm_...` tokens but manages its own payment confirmation flow. Payment Element is designed for `confirmPayment()` which is Stripe-managed — incompatible with Guesty's token-pass model. Use Card Element + `createPaymentMethod()` instead. |

---

## Full Booking API Call Sequence

```
1. GET  /api/payment-info
       → server: GET /listings/{id}/payment-provider (Guesty)
       → returns: { publishableKey, stripeAccountId }
       → frontend: initializes Stripe(publishableKey, { stripeAccount: stripeAccountId })

2. GET  /api/availability?checkIn=&checkOut=&guests=
       → server: POST /v1/search (Guesty BEAPI)
       → returns: available dates + nightly rates

3. POST /api/quote { checkIn, checkOut, guests }
       → server: POST /api/reservations/quotes (Guesty BEAPI)
       → returns: { quoteId, ratePlanId, totalPrice, breakdown }

4. [Frontend] stripe.createPaymentMethod({ type: 'card', card: cardElement })
       → returns: pm_... token

5. POST /api/book { quoteId, ratePlanId, ccToken: pm_..., guest: {...} }
       → server: POST /api/reservations/quotes/{quoteId}/instant (Guesty BEAPI)
       → server: send upsell email via Resend (if upsells selected)
       → returns: { reservationId, confirmationCode, status: 'confirmed' }
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Email | Resend | SendGrid, Mailgun, AWS SES | Resend has the simplest API and best Vercel DX; SendGrid is heavyweight for one notification email |
| Token storage | Module-level variable | Vercel KV / Redis | Single token, refreshed once/day — external KV is over-engineering |
| Stripe token type | `pm_...` via `createPaymentMethod()` | `tok_...` via `createToken()` | Guesty BEAPI instant booking endpoint explicitly rejects `tok_...` tokens |
| Stripe Element | Card Element | Payment Element | Payment Element assumes Stripe manages confirmation (`confirmPayment()`); incompatible with Guesty's token handoff model |
| HTTP client | Native `fetch` | `axios`, `node-fetch` | Zero-dependency is better; native `fetch` is already used in this codebase |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Vercel runtime / Node.js version | HIGH | Official Vercel docs, verified April 2026 |
| BEAPI OAuth2 / token endpoint | HIGH | Official BEAPI docs at booking-api-docs.guesty.com |
| BEAPI booking flow (quote → instant) | HIGH | Verified endpoint reference docs |
| Stripe `pm_...` requirement | HIGH | Explicit in Guesty instant booking endpoint docs |
| Stripe connected account initialization | MEDIUM | `stripeAccount` option documented in Stripe.js; exact publishable key retrieval path needs validation with Sebastian's account |
| Resend version | MEDIUM | npm shows 6.10.0 as of April 2026; verify before installing |
| Module-level token caching with fluid compute | MEDIUM | Pattern works but Vercel's instance reuse is best-effort, not guaranteed |

---

## Sources

- [Guesty BEAPI Authentication](https://booking-api-docs.guesty.com/docs/authentication-1)
- [Guesty BEAPI Quick Start](https://booking-api-docs.guesty.com/docs/quick-start)
- [Guesty Booking Website Flow](https://booking-api-docs.guesty.com/docs/booking-flow)
- [Guesty Stripe Tokenization Flow](https://booking-api-docs.guesty.com/docs/stripe-tokenization-flow)
- [Guesty Create Instant Reservation From Quote](https://booking-api-docs.guesty.com/reference/createinstantreservationfromquote)
- [Guesty Create Guest and Payment Method](https://open-api-docs.guesty.com/docs/create-guest-and-payment-method)
- [Stripe.js Initializing](https://docs.stripe.com/js/initializing)
- [Stripe createPaymentMethod](https://docs.stripe.com/js/payment_methods/create_payment_method)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Vercel Node.js Versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)
- [Resend Node.js SDK](https://resend.com/docs/send-with-nodejs)
- [Resend npm package](https://www.npmjs.com/package/resend)
