# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- JavaScript (ES6+) - API route implementations
- Node.js environment - Serverless function execution

## Runtime

**Environment:**
- Node.js - Vercel serverless runtime

**Package Manager:**
- npm - Package management
- Lockfile: Not present

## Frameworks

**Core:**
- Vercel Serverless Functions - API route hosting and execution

**Build/Dev:**
- Vercel Platform - Deployment and hosting infrastructure

## Key Dependencies

**Critical:**
- Node.js built-in `fetch()` - HTTP client for external API calls (no external HTTP library required)
- Node.js built-in `URLSearchParams` - URL-encoded parameter handling for OAuth token requests

**Infrastructure:**
- Vercel - Serverless function platform and edge caching
- Vercel KV (optional) - Redis caching for token management (may be used for centralized token caching)

## Configuration

**Environment:**
- Environment variables stored as Vercel project settings
- Required variables:
  - `GUESTY_CLIENT_ID` - OAuth2 client ID for Guesty Booking Engine API
  - `GUESTY_CLIENT_SECRET` - OAuth2 client secret for Guesty Booking Engine API
  - `GUESTY_LISTING_ID` - Property listing ID (currently hardcoded default: `693366e4e2c2460012d9ed96`)

**Build:**
- `vercel.json` - Vercel platform configuration
  - Configures CORS headers for all `/api/(.*)` routes
  - Sets cache headers: `public, s-maxage=3600, stale-while-revalidate=7200` (1 hour max age, 2 hour stale)
  - Allows GET and OPTIONS methods only

## Platform Requirements

**Development:**
- Node.js runtime
- Git for version control
- Vercel account and CLI for deployment

**Production:**
- Vercel serverless deployment platform
- Node.js 18+ runtime environment
- Network access to external APIs (Guesty, Stripe)

---

*Stack analysis: 2026-04-06*
