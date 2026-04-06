---
phase: 1
slug: api-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node.js built-in) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `node --test tests/` |
| **Full suite command** | `node --test tests/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/`
- **After every plan wave:** Run `node --test tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-01 | unit | `node --test tests/guesty.test.js` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-02 | unit | `node --test tests/guesty.test.js` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | AUTH-03 | unit | `node --test tests/guesty.test.js` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | AUTH-04 | unit | `node --test tests/guesty.test.js` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | LIST-01 | integration | `node scripts/discover-listing.js` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | LIST-02 | manual | verify env var in Vercel | N/A | ⬜ pending |
| 1-03-01 | 03 | 2 | AVAIL-01 | integration | `curl localhost:3000/api/availability?checkIn=...&checkOut=...&guests=2` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | AVAIL-02 | integration | `curl localhost:3000/api/availability?checkIn=...&checkOut=...&guests=2` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 1 | INFRA-01 | integration | `curl -I -X OPTIONS localhost:3000/api/availability` | N/A | ⬜ pending |
| 1-04-02 | 04 | 1 | INFRA-02 | unit | `grep -r "GUESTY_CLIENT" api/ lib/ && echo "LEAK" || echo "OK"` | N/A | ⬜ pending |
| 1-04-03 | 04 | 1 | INFRA-03 | unit | `node --test tests/availability.test.js` | ❌ W0 | ⬜ pending |
| 1-04-04 | 04 | 1 | INFRA-04 | unit | `node --test tests/guesty.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/guesty.test.js` — stubs for AUTH-01 through AUTH-04, INFRA-04
- [ ] `tests/availability.test.js` — stubs for AVAIL-01, AVAIL-02, INFRA-03

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Listing ID stored in Vercel env | LIST-02 | Requires Vercel dashboard access | Check GUESTY_LISTING_ID is set in Vercel project settings |
| CORS from GitHub Pages domain | INFRA-01 | Requires deployed endpoint | Deploy to Vercel, fetch from mattgshepard-prog.github.io |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
