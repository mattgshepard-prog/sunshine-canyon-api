# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Property Management & Booking:**
- Guesty Booking Engine API (BEAPI) - Handles availability, pricing, quoting, and reservation creation
  - SDK/Client: Native Node.js `fetch()` (no SDK library)
  - Auth: OAuth2 client credentials
  - Environment variables: `GUESTY_CLIENT_ID`, `GUESTY_CLIENT_SECRET`
  - Token endpoint: `https://booking.guesty.com/oauth2/token`
  - API base: `https://booking-api.guesty.com/v1` and `https://booking.guesty.com/api`
  - Token lifetime: 24 hours (86400 seconds)
  - Token caching: Server-side cache with 5-minute renewal buffer (in-memory or Vercel KV)

**Payment Processing:**
- Stripe - Payment method tokenization only (no direct charge creation)
  - SDK/Client: Stripe.js (client-side only, not in this API codebase)
  - Auth: Stripe connected account ID retrieved via Guesty API
  - Use case: Generate payment method tokens (pm_xxx) passed to Guesty for charging
  - Connected account model: Stripe account linked to Guesty, Guesty handles charge creation
  - Important: Do NOT create Stripe Customer objects; Guesty manages customer relationship

**Email Notifications:**
- Email service (to be determined: Resend, SendGrid, or webhook)
  - Purpose: Send upsell confirmation notifications to property manager
  - Recipient: seb@sv.partners (Sebastian Hood)
  - Trigger: On reservation booking with upsell selections

## Data Storage

**Databases:**
- None - This API is stateless; all data flows through Guesty API

**File Storage:**
- None - No file storage integration

**Caching:**
- Server-side OAuth token caching:
  - Method 1: Vercel KV (Redis) - Recommended for distributed token reuse across function invocations
  - Method 2: In-memory module variable - Current implementation in `api/calendar.js`
  - Fallback: Request new token on each cold start (acceptable given 24h lifetime and low rate limit impact)

## Authentication & Identity

**Auth Provider:**
- Guesty OAuth2 (client credentials flow)
  - Implementation: Bearer token in Authorization header
  - Token request includes grant_type `client_credentials` and scope `booking_engine:api`
  - Tokens cached server-side and reused until 5 minutes before expiry

**Guest Identity:**
- Guesty guest object (passed during quote and booking)
  - Fields: firstName, lastName, email, phone

## Monitoring & Observability

**Error Tracking:**
- console.error() - Basic error logging (seen in `api/calendar.js`)
- No structured logging or external error tracking service integrated

**Logs:**
- Vercel function logs (accessible via Vercel dashboard)
- Error responses include descriptive JSON messages

## CI/CD & Deployment

**Hosting:**
- Vercel - Serverless function hosting
- Deployment via git push or Vercel CLI
- Edge caching enabled via `vercel.json` configuration

**CI Pipeline:**
- None detected - Direct deployment from version control

## Environment Configuration

**Required env vars:**
- `GUESTY_CLIENT_ID` - OAuth2 client ID (required for token generation)
- `GUESTY_CLIENT_SECRET` - OAuth2 client secret (required for token generation)
- `GUESTY_LISTING_ID` - Property listing ID (optional, defaults to `693366e4e2c2460012d9ed96`)

**Secrets location:**
- Vercel Environment Variables dashboard
- Never expose in client-side code or version control

## Webhooks & Callbacks

**Incoming:**
- None currently integrated

**Outgoing:**
- Guesty reservation webhook (optional) - For real-time reservation status updates
- Email webhook to property manager on booking with upsells
- No webhook infrastructure currently implemented

## API Routes Architecture

**Existing:**
- `GET /api/calendar` - Guesty availability calendar proxy (returns 90-day availability and pricing)
  - Implementation: `api/calendar.js`
  - Caches token in module-level variable

**Planned (per spec):**
- `POST /api/auth/token` - Internal OAuth token management utility
- `GET /api/availability` - Real-time availability check with pricing
- `POST /api/quote` - Create reservation quote with price breakdown
- `GET /api/payment-info` - Get Stripe account ID for payment tokenization
- `POST /api/book` - Confirm reservation and send upsell notifications
- `GET /api/upsells` - Return available add-on upsells with pricing

---

*Integration audit: 2026-04-06*
