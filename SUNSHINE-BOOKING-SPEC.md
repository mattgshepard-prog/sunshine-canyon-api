# Sunshine Canyon Retreat — Direct Booking Integration

## Build Spec & Architecture Document

**Project:** Replace external Guesty booking page with native booking flow on sunshine-canyon-retreat site
**Owner:** Matt Shepard (Onsight Construction LLC / AMS Holdings)
**Property Manager:** Sebastian Hood (Soundview Partners — seb@sv.partners)
**Date:** April 6, 2026

---

## 1. Problem Statement

The Sunshine Canyon Retreat website (mattgshepard-prog.github.io/sunshine-canyon-retreat) currently sends guests to an external Guesty-hosted booking page (`svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96`) to complete their reservation. This creates a jarring UX break — the guest leaves a polished, branded site and lands on a generic Guesty template page.

**Goal:** Build a native checkout flow on the site so guests never leave. Use the Guesty Booking Engine API (BEAPI) to handle availability, pricing, quoting, and reservation creation. Payments are tokenized via Stripe.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Frontend (GitHub Pages — Static HTML/JS)            │
│  mattgshepard-prog.github.io/sunshine-canyon-retreat │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Date Picker  │→ │ Price Quote  │→ │ Checkout   │ │
│  │ (existing)   │  │ Display      │  │ Form       │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │               │          │
│         │     Stripe.js (client-side)     │          │
│         │     Card tokenization ──────────┤          │
└─────────┼─────────────────┼───────────────┼──────────┘
          │                 │               │
          ▼                 ▼               ▼
┌─────────────────────────────────────────────────────┐
│  API Layer (Vercel Serverless Functions)              │
│  sunshine-canyon-api.vercel.app/api/                  │
│                                                      │
│  /api/auth/token     — OAuth2 token management       │
│  /api/availability   — Calendar + pricing lookup     │
│  /api/quote          — Create reservation quote      │
│  /api/book           — Confirm reservation           │
│  /api/payment-info   — Get Stripe account for listing│
│  /api/calendar       — (existing) iCal proxy         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Guesty Booking Engine API                           │
│  Base URL: https://booking-api.guesty.com/v1         │
│  Auth URL: https://booking.guesty.com/oauth2/token   │
│                                                      │
│  Endpoints used:                                     │
│  GET  /v1/search           — availability + pricing  │
│  POST /api/reservations/quotes — create quote        │
│  GET  /api/reservations/quotes/:id — retrieve quote  │
│  POST /api/reservations/quotes/:id/instant — book    │
│  POST /api/reservations/quotes/:id/inquiry — inquire │
│  GET  /api/listings/:id/payment-provider — Stripe ID │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Stripe (Payment Tokenization Only)                  │
│  Connected account linked to Guesty                  │
│  Stripe.js → PaymentMethod (pm_xxx) → passed to     │
│  Guesty as ccToken on reservation creation           │
│  DO NOT create Stripe Customer — Guesty handles that │
└─────────────────────────────────────────────────────┘
```

---

## 3. Guesty BEAPI Credentials

**IMPORTANT: Store these as Vercel environment variables. Never expose in client-side code.**

```
GUESTY_CLIENT_ID=${GUESTY_CLIENT_ID}
GUESTY_CLIENT_SECRET=${GUESTY_CLIENT_SECRET}
```

- **Token URL:** `https://booking.guesty.com/oauth2/token`
- **Grant type:** `client_credentials`
- **Scope:** `booking_engine:api`
- **Token lifetime:** 24 hours (86400 seconds)
- **Token renewal limit:** 3 times per 24 hours per application
- **Strategy:** Cache token server-side, reuse until 5 minutes before expiry, then renew

---

## 4. Guesty Property Details

- **Listing ID:** Must be discovered via `/v1/search` API call. The property is "6186 Sunshine Canyon Drive, Boulder, CO 80302". Use the search endpoint to find the Guesty listing ID, then hardcode it as `GUESTY_LISTING_ID` env var.
- **Guesty booking page (for fallback):** `https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96`

---

## 5. API Routes (Vercel Serverless Functions)

All routes live in the existing `sunshine-canyon-api` Vercel project. Add them alongside the existing `/api/calendar` route.

### 5.1 `POST /api/auth/token` (internal only — not called by frontend directly)

**Purpose:** Shared utility for other API routes to get a valid Guesty access token.

**Logic:**
1. Check if cached token exists and is valid (> 5 min remaining)
2. If valid, return cached token
3. If expired/missing, request new token from `https://booking.guesty.com/oauth2/token`
4. Cache new token with expiry timestamp
5. Return token

**Caching strategy:** Use Vercel KV (Redis) or a simple in-memory module-level variable. Since serverless functions are stateless, prefer Vercel KV if available. Fallback: request a new token on each cold start (acceptable given the 24h lifetime and 5 req/sec rate limit).

**Token request:**
```
POST https://booking.guesty.com/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
scope=booking_engine:api
client_id={GUESTY_CLIENT_ID}
client_secret={GUESTY_CLIENT_SECRET}
```

**Response:**
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

### 5.2 `GET /api/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=N`

**Purpose:** Check real-time availability and get pricing for the property.

**Logic:**
1. Get valid Guesty token
2. Call `GET https://booking-api.guesty.com/v1/search?checkIn={checkIn}&checkOut={checkOut}&adults={guests}`
3. Filter results to find our listing
4. Return availability status + pricing breakdown

**Response to frontend:**
```json
{
  "available": true,
  "listing": {
    "id": "...",
    "title": "Sunshine Canyon Retreat",
    "nightlyRate": 350,
    "currency": "USD"
  }
}
```

### 5.3 `POST /api/quote`

**Purpose:** Create a reservation quote with full price breakdown.

**Request body:**
```json
{
  "checkIn": "2026-05-15",
  "checkOut": "2026-05-18",
  "guests": 4,
  "guest": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+13035551234"
  }
}
```

**Logic:**
1. Get valid Guesty token
2. Call `POST https://booking.guesty.com/api/reservations/quotes` with:
   ```json
   {
     "checkInDateLocalized": "2026-05-15",
     "checkOutDateLocalized": "2026-05-18",
     "listingId": "{GUESTY_LISTING_ID}",
     "guestsCount": 4,
     "guest": {
       "firstName": "John",
       "lastName": "Doe",
       "email": "john@example.com",
       "phone": "+13035551234"
     }
   }
   ```
3. Parse response for rate plans, pricing, fees, taxes
4. Return structured quote to frontend

**Response to frontend:**
```json
{
  "quoteId": "675893fc754a15b1234cf325",
  "expiresAt": "2026-05-16T...",
  "ratePlans": [
    {
      "id": "...",
      "name": "Standard Rate",
      "days": [
        { "date": "2026-05-15", "price": 350, "currency": "USD" },
        { "date": "2026-05-16", "price": 350, "currency": "USD" },
        { "date": "2026-05-17", "price": 375, "currency": "USD" }
      ],
      "totals": {
        "accommodation": 1075,
        "cleaning": 135,
        "fees": 0,
        "taxes": 86,
        "total": 1296
      }
    }
  ]
}
```

### 5.4 `GET /api/payment-info`

**Purpose:** Get the Stripe account ID connected to the listing's payment processor.

**Logic:**
1. Get valid Guesty token
2. Call `GET https://booking.guesty.com/api/listings/{GUESTY_LISTING_ID}/payment-provider`
3. Return the `providerAccountId` (Stripe connected account ID, format `acct_xxx`)

**Response:**
```json
{
  "providerType": "stripe",
  "stripeAccountId": "acct_xxxxxxxxxxxxx"
}
```

**IMPORTANT:** The frontend needs this Stripe account ID to create the PaymentMethod token on the correct connected Stripe account.

### 5.5 `POST /api/book`

**Purpose:** Confirm the reservation (instant book only) and notify Sebastian of upsell selections.

**Request body:**
```json
{
  "quoteId": "675893fc754a15b1234cf325",
  "ratePlanId": "...",
  "ccToken": "pm_1234567890abcdef",
  "guest": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+13035551234"
  },
  "upsells": ["early_checkin", "stocked_fridge"]
}
```

**Logic:**
1. Get valid Guesty token
2. Call `POST https://booking.guesty.com/api/reservations/quotes/{quoteId}/instant` with `ccToken`
3. If upsells are selected, send notification email to Sebastian (seb@sv.partners) with:
   - Guest name, email, phone
   - Check-in / check-out dates
   - Confirmation code
   - List of selected upsells with prices
   - Total upsell amount
   (Use a simple email service — Resend, SendGrid, or even a webhook to Sebastian's email)
4. Return confirmation to frontend

**Response to frontend:**
```json
{
  "success": true,
  "reservationId": "...",
  "confirmationCode": "SCR-12345",
  "status": "confirmed",
  "upsells": ["early_checkin", "stocked_fridge"],
  "upsellTotal": 275,
  "depositCharged": 50,
  "remainingBalance": 1521
}
```

### 5.6 `GET /api/upsells`

**Purpose:** Return available upsell add-ons with current pricing. Keeps upsell config server-side so pricing can be updated without redeploying the frontend.

**Response:**
```json
{
  "upsells": [
    { "id": "early_checkin", "name": "Early Check-In (2:00 PM)", "price": 75, "description": "Check in at 2:00 PM instead of 4:00 PM" },
    { "id": "late_checkout", "name": "Late Checkout (12:00 PM)", "price": 75, "description": "Check out at 12:00 PM instead of 10:00 AM" },
    { "id": "airport_shuttle_to", "name": "Airport Shuttle (DEN → Property)", "price": 150, "description": "Private shuttle from Denver International Airport" },
    { "id": "airport_shuttle_from", "name": "Airport Shuttle (Property → DEN)", "price": 150, "description": "Private shuttle to Denver International Airport" },
    { "id": "stocked_fridge", "name": "Stocked Fridge", "price": 200, "description": "Groceries and beverages pre-stocked before your arrival" }
  ]
}
```

---

## 6. Frontend Checkout Flow

### 6.1 User Journey

The existing site already has:
- Custom calendar date picker with availability (just deployed)
- Price comparison widget (Airbnb vs VRBO vs Direct)
- "Book Direct & Save" CTA buttons

**New flow replacing the external Guesty link:**

```
1. Guest selects dates in custom calendar picker
2. Guest clicks "Book Direct & Save" (or "Compare Prices" → "Book Direct")
3. → STEP 1: Quote Screen
   - Call /api/quote with dates + guest count
   - Display full price breakdown (nightly rates, cleaning, taxes, total)
   - Show deposit info: "$50 deposit today. Remaining $X charged 14 days before check-in."
   - Show cancellation policy text
   - Show "Continue to Book" button
4. → STEP 2: Guest Details + Upsells
   - Form: First Name, Last Name, Email, Phone
   - Form validation (required fields, email format, phone format)
   - Upsell add-ons section with checkboxes:
     □ Early Check-In (2:00 PM) — +$75
     □ Late Checkout (12:00 PM) — +$75
     □ Airport Shuttle (DEN → Property) — +$150
     □ Airport Shuttle (Property → DEN) — +$150
     □ Stocked Fridge — +$200
   - Running total updates as upsells are toggled
5. → STEP 3: Payment
   - Stripe Elements card input (Card Number, Expiry, CVC)
   - If STRIPE_PK is empty/missing: show "Direct booking payments coming soon. 
     Book now through our partner portal." with link to Guesty page as fallback
   - If STRIPE_PK is set: initialize Stripe with connected account
   - Creates PaymentMethod token (pm_xxx) client-side
   - Display: "You will be charged $50 today. Remaining balance of $X 
     will be charged 14 days before check-in."
   - Checkbox: "I agree to the cancellation policy" (required)
6. → STEP 4: Confirmation
   - Call /api/book with quoteId + ccToken + upsell selections
   - Display confirmation code + booking summary
   - List selected upsells with confirmation
   - "Add to Calendar" link (generate .ics download)
   - "A confirmation email has been sent to [email]"
   - Sebastian receives email notification with guest details + upsell requests
```

### 6.2 Implementation Approach

**Option A (recommended for GitHub Pages):** Build as a multi-step inline section/modal on the existing `index.html`. Uses vanilla JS (no React). The checkout slides in as an overlay/drawer when the user clicks "Book Direct."

**Option B:** Build as a separate `checkout.html` page in the same repo. Simpler to develop but less seamless UX.

**Recommendation:** Option A — keeps the single-page luxury feel. Build it as a slide-up modal/drawer.

### 6.3 Stripe Integration

**Stripe.js must be loaded from Stripe's CDN (required for PCI compliance):**
```html
<script src="https://js.stripe.com/v3/"></script>
```

**Initialization (using connected account):**
```javascript
// stripeAccountId comes from /api/payment-info
const stripe = Stripe('pk_live_xxxxx', {
  stripeAccount: stripeAccountId
});
const elements = stripe.elements();
const card = elements.create('card', { style: { /* match site theme */ } });
card.mount('#card-element');
```

**Token creation:**
```javascript
const { paymentMethod, error } = await stripe.createPaymentMethod({
  type: 'card',
  card: card,
  billing_details: {
    name: `${firstName} ${lastName}`,
    email: email,
    phone: phone
  }
});
// paymentMethod.id = "pm_xxx" → send to /api/book as ccToken
```

**CRITICAL RULES:**
- Only create the PaymentMethod token — do NOT create a Stripe Customer
- Each token can only be used once (new token per booking)
- Use the connected Stripe account ID from `/api/payment-info`, not the platform account

### 6.4 Stripe Publishable Key

**Status: PENDING from Sebastian.** Build with a placeholder variable. The checkout flow must handle the missing key gracefully:

```javascript
const STRIPE_PK = ''; // INSERT WHEN AVAILABLE FROM SEBASTIAN

function initStripe() {
  if (!STRIPE_PK) {
    // Show fallback: link to Guesty booking page
    showPaymentFallback();
    return null;
  }
  const stripe = Stripe(STRIPE_PK, { stripeAccount: stripeAccountId });
  return stripe;
}
```

**Fallback UI when Stripe key is missing:**
- Hide the card input form
- Show: "Direct booking payments are being set up. In the meantime, complete your booking through our partner portal."
- Button: "Complete Booking →" linking to Guesty booking page
- This ensures the site is functional and bookable even before we get the Stripe key

---

## 7. Existing Infrastructure

### 7.1 Current Repos & Deployment
- **Site repo:** `github.com/mattgshepard-prog/sunshine-canyon-retreat` (GitHub Pages, branch: `master`)
- **Local path:** `C:\Users\mattg\repos\sunshine-canyon-retreat`
- **API repo:** `sunshine-canyon-api` on Vercel (already has `/api/calendar` route)
- **Vercel account:** Team ID `team_44As4rnAPhzOiDrIZf0Ddrok`

### 7.2 Existing Calendar API
The site already calls `https://sunshine-canyon-api.vercel.app/api/calendar` for availability data used in the date picker and price comparison widget. The new BEAPI integration will provide more accurate real-time data, but the existing calendar endpoint should remain as a fallback.

---

## 8. Environment Variables (Vercel)

Add these to the `sunshine-canyon-api` Vercel project:

```
GUESTY_CLIENT_ID=${GUESTY_CLIENT_ID}
GUESTY_CLIENT_SECRET=${GUESTY_CLIENT_SECRET}
GUESTY_LISTING_ID=<discover via search API, then hardcode>
```

**Frontend constant (in index.html or checkout.js):**
```javascript
// INSERT STRIPE PUBLISHABLE KEY WHEN AVAILABLE FROM SEBASTIAN
// Safe to include in frontend code — this is a public key
const STRIPE_PK = ''; // e.g. 'pk_live_xxxxx' or 'pk_test_xxxxx'
```

**Upsell config (in API layer or frontend):**
```json
{
  "upsells": [
    { "id": "early_checkin", "name": "Early Check-In (2:00 PM)", "price": 75, "description": "Check in at 2:00 PM instead of 4:00 PM" },
    { "id": "late_checkout", "name": "Late Checkout (12:00 PM)", "price": 75, "description": "Check out at 12:00 PM instead of 10:00 AM" },
    { "id": "airport_shuttle_to", "name": "Airport Shuttle (DEN → Property)", "price": 150, "description": "Private shuttle from Denver International Airport" },
    { "id": "airport_shuttle_from", "name": "Airport Shuttle (Property → DEN)", "price": 150, "description": "Private shuttle to Denver International Airport" },
    { "id": "stocked_fridge", "name": "Stocked Fridge", "price": 200, "description": "Groceries and beverages pre-stocked before your arrival" }
  ]
}
```

---

## 9. Rate Limits & Error Handling

### Guesty BEAPI Rate Limits
- 5 requests/second
- 275 requests/minute
- 16,500 requests/hour

### Error Handling Strategy
- **Token expired (401):** Auto-refresh token, retry once
- **Rate limited (429):** Exponential backoff with retry
- **Quote expired:** Show message "Your quote has expired. Please try again." and re-quote
- **Availability changed:** Show message "These dates are no longer available" and return to date selection
- **Payment failed:** Show Stripe error message, let user retry with different card
- **Network error:** Show generic error with "Try again" button
- **Fallback:** If any API call fails after retries, show a link to the Guesty booking page as fallback: `https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96`

---

## 10. Security Considerations

1. **Guesty credentials:** Server-side only (Vercel env vars). Never in frontend code.
2. **Stripe publishable key:** Safe for frontend (it's designed to be public).
3. **Card data:** Never touches our server. Stripe.js tokenizes client-side, we only pass the `pm_xxx` token.
4. **CORS:** API routes must set `Access-Control-Allow-Origin` to the GitHub Pages domain.
5. **Input validation:** Validate all user inputs server-side before passing to Guesty.
6. **HTTPS:** Both GitHub Pages and Vercel enforce HTTPS. Stripe requires it.

---

## 11. Build Phases

### Phase 1: API Layer (Vercel)
1. Discover listing ID via search API
2. Build token management utility
3. Build `/api/availability` endpoint
4. Build `/api/quote` endpoint
5. Build `/api/payment-info` endpoint
6. Build `/api/book` endpoint
7. Test all endpoints via curl
8. Deploy to Vercel

### Phase 2: Frontend Checkout
1. Build checkout modal/drawer HTML + CSS (match existing site design language)
2. Wire "Book Direct" buttons to open checkout flow
3. Build Step 1: Quote display
4. Build Step 2: Guest details form
5. Build Step 3: Stripe Elements payment form
6. Build Step 4: Confirmation display
7. Error handling + loading states
8. Mobile responsive (critical — Sebastian tests on iPhone)
9. Deploy to GitHub Pages

### Phase 3: Polish & Integration
1. Get Stripe publishable key from Sebastian
2. Replace all external Guesty links with native checkout triggers
3. Update fallback behavior
4. End-to-end testing (test booking → check Guesty dashboard)
5. Cross-reference with Sebastian's Soundview HolidayFuture portfolio site

---

## 12. Decisions (Locked In)

1. **Booking type: INSTANT BOOK.** Guest pays, reservation is confirmed immediately. No approval step. Use `POST /api/reservations/quotes/{quoteId}/instant` endpoint exclusively.
2. **Stripe publishable key: INSERT LATER.** Build the frontend with a placeholder `STRIPE_PK` variable. The Stripe Elements initialization should check for the key and show a graceful "Payment setup in progress" message if missing. Sebastian will provide the `pk_live_xxx` key. Store it as a frontend constant (safe — it's a public key).
3. **Manual source: ASSUMED ACTIVE.** Sebastian has done manual bookings in Guesty before.
4. **Payment schedule: $50 DEPOSIT + REMAINDER AT 14 DAYS BEFORE CHECK-IN.** Display this clearly during checkout: "$50 deposit charged today. Remaining balance of $X charged 14 days before check-in." NOTE: The actual payment automation (split charge timing) is configured in Guesty's dashboard, not via API. Our site just displays the policy text and collects the card. Guesty handles the scheduled charges.
5. **Cancellation policy (display text):** "Free cancellation up to 14 days before check-in. 50% refund up to 7 days before check-in. Non-refundable after that." This text is displayed during checkout for the guest to acknowledge before confirming. Can be edited later.
6. **Upsells: YES — all of the following.** Display as optional add-ons during the Guest Details step (Step 2) with checkboxes:
   - Early check-in (2:00 PM instead of 4:00 PM) — $75
   - Late checkout (12:00 PM instead of 10:00 AM) — $75
   - Airport shuttle (DEN ↔ property) — $150 each way
   - Stocked fridge (groceries + beverages pre-arrival) — $200
   
   **Implementation:** Upsells are displayed in the frontend and included in the quote/confirmation display. They are NOT processed through the Guesty API (Guesty's BEAPI doesn't support adding custom fees to quotes). Instead, upsell selections are:
   - Added to the confirmation email sent to Sebastian (so he can fulfill them)
   - Added to the total displayed to the guest as line items
   - Stored as a note on the reservation if the Open API supports it, or emailed to Sebastian separately
   
   **Pricing for upsells is subject to change** — store upsell config (name, price, description) in a simple JSON object in the API layer so it can be updated without redeploying the frontend.

---

## 13. Reference Sites

Sebastian shared these as examples of what he wants, both built on Guesty Open API:
- https://www.capitalia.co/
- https://www.misfithomes.com/

He also mentioned the DirectBookingTools price comparison widget as inspiration:
- https://directbookingtools.com/solutions/#pricecomparison
(We've already built our own version of this.)

---

## 14. File Manifest (Expected Deliverables)

### API Layer (sunshine-canyon-api repo)
```
api/
  auth/
    token.js          — Token management utility
  availability.js     — GET /api/availability
  quote.js            — POST /api/quote
  book.js             — POST /api/book (includes upsell notification to Sebastian)
  payment-info.js     — GET /api/payment-info
  upsells.js          — GET /api/upsells
  calendar.js         — (existing) iCal proxy
lib/
  guesty.js           — Shared Guesty API client with token caching
  upsells-config.js   — Upsell definitions (name, price, description)
  notify.js           — Email notification to Sebastian for upsell fulfillment
```

### Frontend (sunshine-canyon-retreat repo)
```
index.html            — Updated with checkout modal/drawer + upsell UI
js/
  checkout.js         — Checkout flow logic (4 steps)
  stripe-setup.js     — Stripe Elements initialization (graceful fallback if no key)
css/
  checkout.css        — Checkout-specific styles (or inline in index.html)
```

**Note:** The current site is a single `index.html` file with all CSS and JS inline. The checkout code can either be added inline (keeping the single-file pattern) or split into separate files. If splitting, update the HTML to reference them. **Recommendation: split into separate files for this feature** — the checkout logic is substantial enough that inline would make the HTML unwieldy.
