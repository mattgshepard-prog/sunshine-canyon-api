# Feature Landscape

**Domain:** Vacation rental direct booking checkout flow
**Project:** Sunshine Canyon Retreat — native checkout replacing Guesty external page
**Researched:** 2026-04-06
**Overall confidence:** HIGH (well-established patterns in vacation rental industry)

---

## Table Stakes

Features guests expect from any booking flow. Missing any of these and guests abandon or lose trust.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time availability check | Guests must know dates are open before investing time in checkout | Low | Already proxied via `/api/availability`; feeds date picker |
| Full price breakdown before payment | Airbnb/VRBO trained guests to expect line-item costs (nightly rate, cleaning fee, taxes, total) | Low-Med | Guesty quote API returns this breakdown; display all components |
| Cancellation policy display | Industry standard — guests won't pay without knowing refund terms | Low | Static display: free 14d+, 50% 7-14d, non-refundable after; show at quote step and before confirm |
| Guest details form | Name, email, phone — minimum required to create a reservation | Low | First/last name, email, phone; no account creation required (one-time bookers) |
| Secure payment input | PCI-compliant card entry — guests will not enter card numbers on non-standard forms | Med | Stripe Elements from CDN; never touch raw card data server-side |
| Booking confirmation screen | Guests need immediate reassurance their booking was accepted | Low | Show confirmation number, dates, property, total paid, what happens next |
| Confirmation email | Industry expectation — guests want paper trail in email | Med | Guesty handles transactional confirmation email; may not need custom send |
| Deposit model transparency | Guests must understand they pay $50 now and the rest later | Low | Show payment schedule: $50 today, balance due 14 days before check-in |
| Mobile-responsive layout | 65-70% of travel research and booking happens on phones | Med | Sebastian tests on iPhone; vanilla CSS flexbox/grid; large tap targets |
| Loading/processing states | Guests panic if payment submission goes silent for 2-3 seconds | Low | Disable submit button, show spinner during API calls |
| Error messages (payment declined) | Card decline must be surfaced clearly, not lost in a generic error | Med | Parse Stripe error codes; show actionable message ("card declined — try another card") |
| Graceful fallback when unavailable | If Stripe key missing or API is down, guests need somewhere to book | Low-Med | Redirect to Guesty booking page (`svpartners.guestybookings.com`); already scoped in project |

## Differentiators

Features that set a direct booking apart from OTA platforms. Not expected, but valued — and some directly reduce OTA commission dependency.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Branded experience (no redirect) | Guests stay in the Sunshine Canyon visual context throughout; trust increases | Med | The entire purpose of this project — checkout modal/drawer in site's design language |
| Upsell add-ons at checkout | Early check-in, late checkout, welcome basket etc. increase revenue 12-15% per Enso Connect data | Med | Per project scope: display-only + email notification to Sebastian via Resend (BEAPI can't add custom fees to quotes) |
| Price comparison context | Site already has Airbnb vs VRBO vs Direct widget — guests arrive knowing they're saving OTA fees | Low | Already built; checkout should reinforce the savings ("You're saving $X by booking direct") |
| Single-page modal/drawer flow | Avoids full-page redirects that break mobile momentum; 4 steps in one overlay | High | 4-step flow: Quote Review → Guest Details + Upsells → Payment → Confirmation |
| Transparent deposit schedule | Most OTA flows bury payment schedule; showing it upfront is trust-building | Low | "$50 due today. $[remainder] due [date] — 14 days before check-in." |
| Instant book confirmation | No waiting for host approval — reservation confirmed immediately after payment | Low | Scoped to instant book only via Guesty BEAPI `/instant` endpoint |

## Anti-Features

Features to deliberately NOT build. Building these would add cost, complexity, or risk with no return for this property and use case.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Guest account creation / login | Guests are one-time bookers; forced registration kills conversion | Collect name/email/phone only; no password, no session |
| Inquiry / approval flow | Adds host latency and guest anxiety; instant book is the competitive advantage of direct booking | Instant book only via BEAPI; inquiry endpoint not used |
| Custom payment scheduling | Guesty already handles $50 deposit + 14-day remainder split in its dashboard | Display the policy; let Guesty execute it |
| Upsell payment processing | BEAPI doesn't support custom fees on quotes; processing upsells separately adds PCI surface area | Email Sebastian via Resend; upsells are informational only |
| Stripe Customer object creation | Guesty manages guest records; creating duplicate Stripe Customers causes reconciliation problems | Pass `pm_xxx` token to Guesty as `ccToken`; Guesty creates the customer |
| Admin dashboard or reporting | Sebastian uses Guesty dashboard directly; building a shadow dashboard duplicates work | Out of scope entirely |
| Real-time chat or guest messaging | Not part of booking conversion; adds complexity with no checkout impact | Post-booking communication happens in Guesty |
| Apple Pay / Google Pay wallet buttons | Desirable but requires verified domain with Stripe and adds integration complexity | Ship with Stripe Elements card form; wallet buttons are a future enhancement if conversion data justifies it |
| Multi-property search | This is a single-property site; search is just date selection | Date picker + availability check is sufficient |
| Review collection at checkout | Checkout is not the moment for reviews; post-stay is the right time | Out of scope; Guesty handles this |

---

## Feature Dependencies

```
Date selection (existing)
  └── Availability check (/api/availability)
        └── Price quote (/api/quote)
              ├── Quote display (Step 1: Quote Review)
              │     └── Guest details form (Step 2: Details + Upsells)
              │           ├── Upsell selections → Resend email to Sebastian
              │           └── Payment input (Step 3: Payment)
              │                 ├── Stripe.js payment method tokenization
              │                 │     └── /api/payment-info (get Stripe publishable key)
              │                 └── /api/book (confirm reservation)
              │                       └── Confirmation screen (Step 4: Confirmation)
              │
              └── Fallback trigger
                    └── Redirect to svpartners.guestybookings.com
                          (triggers when: Stripe key unavailable OR API error)
```

**Key dependency facts:**
- A valid quote ID from Guesty is required before payment can be submitted. Quote must be held/referenced through the entire checkout flow.
- Stripe publishable key comes from `/api/payment-info` (which calls Guesty `/listings/:id/payment-provider`). If this call fails or returns no key, fallback must activate.
- Upsell email notification is fire-and-forget — it must not block booking confirmation.
- Cancellation policy display has no API dependency — it's static content from known policy terms.

---

## MVP Recommendation

**Build in this order:**

1. Quote display (Step 1) — price breakdown with all line items, cancellation policy, deposit schedule
2. Guest details form (Step 2) — name, email, phone; upsell display with Resend notification
3. Payment (Step 3) — Stripe Elements card form, submit to `/api/book`
4. Confirmation (Step 4) — confirmation number, booking summary, what happens next
5. Fallback handling — activate when Stripe key missing or API returns unrecoverable error

**Defer:**
- Apple Pay / Google Pay — add after launch once Stripe domain verification is confirmed and conversion data justifies the integration work
- Animated step transitions — basic show/hide is sufficient for MVP; polish later
- "Saving vs Airbnb" callout in checkout — nice-to-have reinforcement; the price widget already does this job before checkout starts

---

## Confidence Notes

| Area | Confidence | Source Basis |
|------|------------|--------------|
| Table stakes list | HIGH | Airbnb/VRBO patterns well-documented; Page Flows VRBO analysis; industry sources |
| Upsell patterns | HIGH | Guesty blog, Enso Connect data, Hostaway, SuiteOp — consistent across sources |
| Anti-features rationale | HIGH | Grounded in project constraints (Guesty managing customers, BEAPI limitations, single property) |
| Mobile priority | HIGH | Multiple 2025-2026 sources cite 65-70% mobile booking share |
| Wallet pay conversion uplift | MEDIUM | 3x conversion claim from rework.com; single source, plausible but not independently verified here |

---

## Sources

- [VRBO Booking: Tips and Best Practices — Page Flows](https://pageflows.com/resources/vrbo-booking/)
- [Vacation Rental Website Design That Gets Bookings — hostAI Blog](https://gethostai.com/blog/vacation-rental-website-design)
- [Direct Bookings for Vacation Rentals: The Complete 2026 Guide — NowiStay](https://www.nowistay.com/ressources/direct-bookings-vacation-rental-complete-guide)
- [Short-term rental upselling — Guesty Blog](https://www.guesty.com/blog/short-term-rental-upselling-the-untapped-potential-of-your-properties/)
- [Vacation Rental Upsells Data and Trends 2025 — Enso Connect](https://ensoconnect.com/resources/vacation-rental-upsells-data-and-trends-2025)
- [How to Increase Vacation Rental Revenue 12-15% with Automated Upsells — SuiteOp](https://suiteop.com/blog/increase-vacation-rental-revenue-automated-upsells)
- [Mobile Booking Optimization — Rework](https://resources.rework.com/libraries/travel-tour-growth/mobile-booking-optimization)
- [4 UX Tweaks to Boost Hotel Direct Booking Conversion — Nokumo](https://www.nokumo.net/en/blog/blog-4-ux-tweaks-to-reduce-friction-in-your-direct-booking-process)
- [Top 15 UX Tips to Improve Conversion Rates in Travel Booking — Ulan Software](https://ulansoftware.com/blog/ux-tips-improve-travel-booking-conversion)
- [Airbnb Scheduled Payments Help](https://www.airbnb.com/help/article/2143)
- [VRBO Payment Terms Help](https://help.vrbo.com/articles/How-do-I-set-up-a-payment-schedule-for-reservations)
