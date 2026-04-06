---
created: 2026-04-06
total_phases: 6
sonnet_phases: 3
opus_phases: 3
estimated_savings: 40%
---

# Economical Model Routing

## Phase Assignments

| Phase | Name | Tier | Model | Effort | Rationale |
|-------|------|------|-------|--------|-----------|
| 1 | API Foundation | 3 | Opus | high | OAuth token lifecycle + BEAPI scope separation + CORS wiring — wrong here breaks everything downstream |
| 2 | Quote + Payment Info | 2 | Sonnet | medium | Standard REST proxy endpoints following the pattern established in Phase 1 |
| 3 | Upsells + Notifications | 2 | Sonnet | medium | Static JSON catalog + simple Resend email — well-known patterns, single concern each |
| 4 | Booking Endpoint | 3 | Opus | high | Multi-system coordination (Guesty instant-book + Stripe token + Resend email) with error recovery paths |
| 5 | Checkout Modal — Steps 1 & 2 | 2 | Sonnet | medium | Standard vanilla JS modal with forms, validation, and API calls — well-known UI patterns |
| 6 | Stripe Elements + End-to-End | 3 | Opus | high | Connected account tokenization + end-to-end booking flow across Stripe/Guesty/frontend — PCI compliance matters |

## Model Switching Commands

Before each phase, run:
- **Phase 1:** `/model opus` then `/effort high`
- **Phase 2:** `/model sonnet` then `/effort medium`
- **Phase 3:** `/model sonnet` then `/effort medium`
- **Phase 4:** `/model opus` then `/effort high`
- **Phase 5:** `/model sonnet` then `/effort medium`
- **Phase 6:** `/model opus` then `/effort high`

## Savings Estimate

- All-Opus baseline: ~$18.00 estimated (6 phases x ~$3.00)
- Economical routing: ~$10.95 estimated (3 x $1.35 Sonnet + 3 x $3.00 Opus)
- Savings: ~40%
