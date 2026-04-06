# Domain Pitfalls

**Domain:** Vacation rental direct booking — Guesty BEAPI + Stripe connected account
**Project:** Sunshine Canyon Direct Booking
**Researched:** 2026-04-06

---

## Critical Pitfalls

Mistakes that cause broken bookings, failed payments, or require significant rework.

---

### Pitfall 1: Stripe Publishable Key Is Not Available via API

**What goes wrong:** The Guesty payment provider endpoint (`/listings/{id}/payment-provider`) returns
`providerAccountId`, `paymentProviderId`, and status — but does NOT return the Stripe publishable key.
Developers assume they can dynamically fetch the key and initialize Stripe.js at runtime. This assumption
is wrong.

**Why it happens:** The publishable key lives in Stripe's dashboard. Guesty's API exposes the connected
account ID (`acct_XXX`) but not the key itself. Many integration guides gloss over this gap.

**Consequences:** The `/api/payment-info` endpoint cannot return a publishable key unless it is
pre-configured as an environment variable. If the frontend expects to receive the key dynamically and
it is absent, the entire payment form fails to initialize.

**Prevention:**
- Treat the Stripe publishable key as a Vercel env var (`STRIPE_PUBLISHABLE_KEY`), not a runtime API fetch.
- The `/api/payment-info` endpoint should return the key from `process.env`, not from the Guesty API.
- The fallback-to-Guesty-page behavior must trigger when this env var is absent or empty.
- Sebastian must retrieve this from his Stripe dashboard (Dashboard > Developers > API keys) and provide it.

**Warning signs:** If you find yourself building logic to extract a publishable key from the Guesty
payment provider response, stop — it is not there.

**Phase mapping:** Address in the Payment Info endpoint implementation. The fallback mechanism
(redirect to Guesty page when key is absent) must be built before the Stripe Elements step.

---

### Pitfall 2: Tokenizing Against the Wrong Stripe Account

**What goes wrong:** The card token is created against the platform Stripe account (or any account
other than the one assigned to this listing). When Guesty tries to charge using that token, the charge
fails with an account mismatch error.

**Why it happens:** Stripe.js must be initialized with the publishable key belonging specifically to
the connected Stripe account assigned to the listing in Guesty. Using a generic or platform-level
key tokenizes the card on the wrong account.

**Consequences:** The reservation is created in Guesty but payment fails. The guest sees a successful
booking but the charge never processes, creating a ghost reservation with no payment attached.

**Prevention:**
- Always call `GET /listings/{id}/payment-provider` first to confirm the `providerAccountId`.
- Initialize Stripe.js with the publishable key that belongs to that specific connected account.
- For a single-property site like Sunshine Canyon, the key is static — store it as an env var and
  document which Stripe account it corresponds to.
- Never use a platform-level or test-mode key in production.

**Warning signs:** Token creation succeeds but subsequent Guesty payment method creation returns
a "payment method not found" or "token belongs to a different account" error.

**Phase mapping:** Address during Stripe Elements implementation and in the env var configuration docs.

---

### Pitfall 3: Creating a Stripe Customer Before Passing the Token to Guesty

**What goes wrong:** Developer calls `stripe.customers.create()` and attaches the payment method to
a Stripe customer before passing the `ccToken` to Guesty. Guesty then fails to process it.

**Why it happens:** Standard Stripe payment flows involve creating a Customer and attaching a
PaymentMethod. The Guesty BEAPI flow is different: Guesty creates the Stripe customer itself when
it validates the token.

**Consequences:** The error returned is: "This PaymentMethod was previously used without being
attached to a Customer or was detached from a Customer and may not be used again." The payment
method is now unusable and a new token must be generated.

**Prevention:**
- The client-side Stripe.js call creates a PaymentMethod (`pm_XXX`). Stop there.
- Pass the `pm_XXX` token directly as `ccToken` in the instant reservation endpoint.
- Do not create a Stripe Customer, do not attach the PaymentMethod in Stripe — let Guesty handle it.
- This also means no Stripe Customer ID is ever stored server-side, which is consistent with the
  project's "out of scope" decision.

**Warning signs:** Payment method attached error immediately after reservation creation.

**Phase mapping:** Address in the payment flow implementation phase. Include a code comment in
`stripe-setup.js` explaining why customer creation is intentionally omitted.

---

### Pitfall 4: BEAPI Activation Not Completed Before Testing Booking Flow

**What goes wrong:** The Guesty Booking Engine API source is "inactive" until two manual steps are
completed in the Guesty dashboard. API calls succeed technically (auth works, quotes return) but
reservation creation silently fails or the "BE API" source never appears in Guesty's automation rules.

**Why it happens:** Guesty requires:
1. A manual direct booking created from the dashboard (activates the "manual" source).
2. The first reservation actually submitted via the BEAPI (activates the "BE API" source and
   enables it as an option for payment automations, additional fees, and automated messages).

Until step 2 is completed, BEAPI-created reservations may not trigger Guesty's automation workflows.

**Consequences:** Payment automation rules (such as the $50 deposit + 14-day remainder charge)
do not apply to BEAPI reservations. Sebastian won't see expected behaviors in his Guesty dashboard.

**Prevention:**
- Before any frontend testing, verify with Sebastian that a manual direct booking has been created
  from the Guesty dashboard.
- After the first successful BEAPI test booking, confirm in Guesty that "BE API" appears as a
  reservation source option.
- Use a test booking (real dates, real flow, then cancel) to complete this activation step.

**Warning signs:** Payment automations don't appear to apply; reservation source shown as unknown
in Guesty dashboard.

**Phase mapping:** Address as a pre-flight checklist item in the booking flow implementation phase,
before connecting real payment processing.

---

### Pitfall 5: BEAPI Instance Booking Type Mismatch

**What goes wrong:** The BEAPI instance is configured for "Request to Book" but the code calls the
instant reservation endpoint. Or the reverse. Bookings are silently rejected or the wrong status
is returned.

**Why it happens:** The BEAPI instance has a dashboard-level setting for booking type (instant only,
request only, or both). The endpoint called must match this setting.

**Consequences:** If the instance is set to "request to book" and the instant endpoint is called,
the booking does not confirm. No obvious error is surfaced to the guest.

**Prevention:**
- Confirm with Sebastian that the BEAPI instance is set to "Only instant booking."
- The code should call `POST /api/reservations/quotes/:quoteId/instant` and expect `status: confirmed`.
- Add an assertion that the returned status is `confirmed` — if it is not, surface a clear error
  rather than proceeding to a success screen.

**Warning signs:** Reservation created with `status: reserved` instead of `status: confirmed`.

**Phase mapping:** Address in BEAPI instance setup and booking flow implementation.

---

## Moderate Pitfalls

---

### Pitfall 6: Token Renewal Exhaustion on Vercel Serverless

**What goes wrong:** Guesty OAuth2 tokens expire after 24 hours and can only be renewed 3 times per
24-hour period per application. Vercel serverless functions spin up fresh instances that may not
share in-memory state. If every cold-start re-fetches a token, the renewal limit is hit quickly
during any traffic spike or deployment.

**Why it happens:** In-memory caches in Vercel serverless functions are instance-local. Multiple
concurrent instances each fetch their own token without knowing about the others.

**Consequences:** After 3 token renewals in 24 hours, the auth endpoint returns an error. All API
calls fail until the window resets. With only one property, traffic is low enough that this is
unlikely — but any deploy cycle, cold-start flurry, or load spike can trigger it.

**Prevention:**
- Store the current token and its expiration time in a Vercel environment variable or external
  KV store (e.g., Vercel KV / Upstash Redis) so it is shared across instances.
- Do not fetch a new token on every function invocation. Check expiration and reuse if valid.
- The safest approach for a single-property low-traffic site: cache token in a module-level variable
  for warm instances, accept that cold starts may refetch, and monitor for 429 errors on the auth
  endpoint. With low traffic this is acceptable; document the 3-renewal limit clearly.
- Pre-warm: fetch a fresh token at deploy time and write it to external storage.

**Warning signs:** Auth endpoint returning 429 or token-not-found errors during normal operation.

**Phase mapping:** Address in the OAuth2 token management implementation.

---

### Pitfall 7: Quote Expiry Causing Stale Booking Attempts

**What goes wrong:** A guest gets a quote, walks away for a day, then tries to book. The quote
has expired. The instant reservation endpoint returns an error that is surfaced as a generic failure.

**Why it happens:** Guesty quotes are valid for 24 hours. After that, `status: expired` and the
`quoteId` cannot be used to create a reservation.

**Consequences:** Guest is confused. If no fallback exists, the checkout is broken for that guest.

**Prevention:**
- Store `expiresAt` from the quote response alongside the `quoteId` in frontend session state.
- Before submitting a booking, check if `Date.now() >= expiresAt`. If expired, re-fetch a fresh
  quote silently and update the displayed price before proceeding.
- Display a "prices confirmed for 24 hours" message in the UI to set expectations.
- Treat the specific "quote expired" error response distinctly — offer to refresh the quote rather
  than showing a generic error.

**Warning signs:** Occasional booking failures with no clear payment error; bookings that fail
on Monday for quotes created Sunday.

**Phase mapping:** Address in frontend checkout flow implementation.

---

### Pitfall 8: Race Condition Between Availability Check and Booking Confirmation

**What goes wrong:** Guest checks availability, sees dates open, proceeds through the checkout
form, but by the time the instant reservation endpoint is called, another booking (from an OTA
synced via Guesty) has already claimed those dates. The reservation fails.

**Why it happens:** Availability is checked at quote-creation time. iCal sync and OTA channel
sync introduce a lag. There is no locking mechanism in BEAPI — the quote does not hold the dates.

**Consequences:** Payment tokenization completes client-side but the reservation creation fails.
The guest has authorized a payment that cannot be applied.

**Prevention:**
- Keep checkout flow fast — minimize time between quote creation and reservation confirmation.
- Handle the availability conflict error code explicitly: surface "those dates are no longer
  available" rather than a generic error, and redirect back to the date picker.
- Do not pre-charge the card before the reservation is confirmed — with the BEAPI instant flow,
  the `ccToken` is passed simultaneously with reservation creation, so no separate pre-charge exists.

**Warning signs:** Sporadic booking failures with date-conflict error codes, especially for
high-demand weekends.

**Phase mapping:** Address error handling in booking flow implementation.

---

### Pitfall 9: The 60-Second Wait Rule After BEAPI Reservation Operations

**What goes wrong:** After creating a reservation via BEAPI, the code immediately queries the
reservation or attempts to modify it via the Open API. The data is stale or the modification fails.

**Why it happens:** Guesty explicitly states: "allow up to 60 seconds between requests to allow
each [reservation operation] to complete and achieve the expected outcome." BEAPI reservations
take time to propagate across Guesty's internal systems.

**Consequences:** If the confirmation screen immediately fetches the reservation details to display
them, it may get stale or incomplete data. Future modifications by Sebastian via Open API
immediately after booking may also fail.

**Prevention:**
- Do not query the reservation immediately after creation for display purposes. The instant book
  response itself returns enough data (reservation ID, confirmation number, guest info, dates,
  total) to render a confirmation screen without a follow-up GET.
- Document the 60-second propagation delay in API comments so future developers don't add a
  real-time reservation fetch to the confirmation step.

**Warning signs:** Confirmation screen showing null/missing reservation fields; Open API
modifications made right after BEAPI booking returning 404 or stale data.

**Phase mapping:** Address in confirmation screen implementation.

---

### Pitfall 10: CORS Not Configured for GitHub Pages Domain

**What goes wrong:** The Vercel API rejects requests from the GitHub Pages frontend with a CORS
error. The browser blocks the request before it reaches the API.

**Why it happens:** Vercel serverless functions do not automatically allow cross-origin requests.
The GitHub Pages domain (`*.github.io` or a custom domain) must be explicitly allowed.

**Consequences:** Every API call from the frontend fails in the browser. The checkout is completely
broken, even though the API functions correctly when called directly.

**Prevention:**
- Add `Access-Control-Allow-Origin` headers to every API function, matching the production GitHub
  Pages domain exactly.
- Handle `OPTIONS` preflight requests in each function (or use a shared CORS middleware module).
- Include both the `*.github.io` subdomain and any custom domain (e.g., `sunshinecanyonretreat.com`)
  in the allowed origins.
- Test CORS behavior from the actual GitHub Pages origin before declaring any API endpoint complete.

**Warning signs:** Browser console shows "has been blocked by CORS policy" with no network
response body; API works fine in Postman but fails in the browser.

**Phase mapping:** Address in each API endpoint as it is implemented. The existing `/api/calendar`
endpoint may already have a pattern to follow.

---

## Minor Pitfalls

---

### Pitfall 11: Stripe.js Must Be Loaded From the Official CDN

**What goes wrong:** Stripe.js is bundled locally or loaded from a non-Stripe CDN.

**Why it happens:** Developers try to manage dependencies uniformly.

**Consequences:** PCI compliance is violated. Stripe's fraud detection (Radar) requires the
official CDN-loaded script to function. Stripe may flag the integration.

**Prevention:** Always load from `https://js.stripe.com/v3/`. Never self-host. This is a constraint
already captured in PROJECT.md.

**Phase mapping:** Enforce at Stripe Elements implementation.

---

### Pitfall 12: Mobile Safari Checkout Scroll-Off Issue with Stripe Card Element

**What goes wrong:** On iOS, the Stripe Card Element (iframe-based input) scrolls off screen when
the iOS keyboard opens, making it unusable for guests booking on iPhone.

**Why it happens:** iOS number keypad behavior overrides JavaScript scroll attempts. Sebastian
explicitly tests on iPhone.

**Consequences:** Guests on iPhone — likely the primary mobile user — cannot complete checkout.

**Prevention:**
- Use the Stripe Payment Element (not the older Card Element) which has better mobile handling.
- Add `overflow: hidden` on the body when the payment step is active to prevent background scroll.
- Test checkout flow specifically on iOS Safari before marking the payment step complete.
- Ensure the payment form container has enough bottom padding to account for the iOS keyboard.

**Warning signs:** Works on desktop, broken on iPhone Safari.

**Phase mapping:** Address during payment form UI implementation; test on real iOS device before
declaring payment step complete.

---

### Pitfall 13: Quote API Not Called for Price Changes — Displaying Stale Prices

**What goes wrong:** The price shown in the comparison widget (existing feature) is used as
the booking price. The quote endpoint returns a different total (additional fees, taxes, seasonal
pricing). Guest sees a discrepancy.

**Why it happens:** The existing price comparison widget pulls from a separate pricing endpoint.
The BEAPI quote includes all fees and taxes at the moment of quote creation, which may differ.

**Consequences:** Trust erosion if the "book now" price is higher than the displayed comparison
price. Potential for abandoned bookings.

**Prevention:**
- Always use the quote response as the authoritative price shown at checkout.
- Show a clear breakdown (nightly rate + cleaning fee + taxes = total) from the quote response.
- The comparison widget is for marketing — the quote is for booking. Keep these concerns separate.

**Phase mapping:** Address in the quote display step of the checkout flow.

---

### Pitfall 14: Resend Free Tier Is Sufficient But Requires a Verified Domain

**What goes wrong:** Resend upsell notification emails fail to send because the sending domain
(`seb@sv.partners` or similar) is not verified in Resend.

**Why it happens:** Resend requires DNS TXT records to verify sending domains. Free tier works
fine for low volume (100/day) but the domain setup is a prerequisite.

**Consequences:** Sebastian receives no upsell notifications. The upsell feature appears broken
even though the booking itself succeeds.

**Prevention:**
- Treat Resend domain verification as a setup prerequisite, not an implementation detail.
- Confirm with Sebastian which sender address to use and which domain Sebastian controls for DNS.
- Test a real email send in the Vercel preview environment before declaring the upsell feature done.

**Warning signs:** API returns 200 but email never arrives; Resend dashboard shows authentication
or domain errors.

**Phase mapping:** Address as an environment setup step before upsell notification implementation.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| OAuth2 token management | Token renewal exhaustion on multiple cold starts | External KV cache or module-level cache with expiry check |
| BEAPI instance setup | Booking type mismatch (request vs instant) | Confirm dashboard setting before writing booking endpoint |
| BEAPI first activation | Automations not triggered | Complete dashboard manual booking + first API booking in order |
| Payment info endpoint | Publishable key not in API response | Store as env var; fallback if absent |
| Stripe Elements | Wrong account tokenization | Use key matching the listing's connected account |
| Stripe Elements | Mobile Safari scroll-off | Use Payment Element not Card Element; test on iPhone |
| Stripe Elements | Customer creation error | Never create Stripe Customer; let Guesty handle it |
| Booking confirmation | Stale reservation data | Use instant book response directly; don't re-fetch |
| Quote display | Price mismatch vs comparison widget | Quote price is authoritative; explain the breakdown |
| CORS | All API calls blocked in browser | Add explicit CORS headers and OPTIONS handling to every endpoint |
| Upsell notifications | Resend domain not verified | Verify sending domain before testing email delivery |

---

## Sources

- Guesty BEAPI FAQ: https://booking-api-docs.guesty.com/docs/frequently-asked-questions
- Guesty Quick Start: https://booking-api-docs.guesty.com/docs/quick-start
- Guesty Reservation Quote Flow: https://booking-api-docs.guesty.com/docs/new-reservation-creation-flow
- Guesty Stripe Tokenization Flow: https://booking-api-docs.guesty.com/docs/stripe-tokenization-flow
- Guesty Open API Stripe Tokenization: https://open-api-docs.guesty.com/docs/stripe-tokenization-flow-copy
- Guesty Payment Provider Retrieval: https://open-api-docs.guesty.com/docs/retrieving-the-payment-provider-id
- Guesty Authentication: https://booking-api-docs.guesty.com/docs/authentication-1
- Stripe API Keys: https://docs.stripe.com/keys
- Stripe Error Codes: https://docs.stripe.com/error-codes
- Stripe Payment Element: https://docs.stripe.com/payments/payment-element
- Vercel Runtime Cache: https://vercel.com/docs/caching/runtime-cache
- Resend Quotas: https://resend.com/docs/knowledge-base/account-quotas-and-limits
- Guesty Help: Connecting Stripe: https://help.guesty.com/hc/en-gb/articles/9369937520285-Connecting-a-Stripe-account-to-Guesty
- Guesty Help: Booking Policy (Instant vs Request): https://help.guesty.com/hc/en-gb/articles/17298869126429-Setting-a-listing-booking-policy-Instant-book-or-Request-to-book
