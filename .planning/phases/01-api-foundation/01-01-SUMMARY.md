---
phase: 01-api-foundation
plan: 01
subsystem: test-infrastructure
tags: [testing, node:test, package.json, es-modules, wave-0]
dependency_graph:
  requires: []
  provides: [tests/guesty.test.js, tests/availability.test.js, package.json#type-module]
  affects: [01-02, 01-03, 01-04]
tech_stack:
  added: []
  patterns: [node:test built-in, ES module config, TDD RED stubs]
key_files:
  created:
    - tests/guesty.test.js
    - tests/availability.test.js
  modified:
    - package.json
decisions:
  - "Use node:test built-in with no external test framework — zero npm dependencies for Phase 1"
  - "Test stubs fail with assert.fail() (not broken syntax) — RED is the correct Wave 0 state"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-06"
  tasks_completed: 2
  files_changed: 3
---

# Phase 01 Plan 01: Test Scaffold and ES Module Config Summary

ES module config and failing test stubs (Wave 0) using node:test built-in — no external dependencies.

## What Was Built

Added `"type": "module"` to `package.json` and created two test stub files under `tests/` using Node.js built-in `node:test` and `node:assert/strict`.

### package.json
Added `"type": "module"` field to enable `import` syntax for both `scripts/discover-listing.js` (CLI) and `node --test tests/*.test.js` (test runner). No scripts, dependencies, or devDependencies were added.

### tests/guesty.test.js
Five failing stubs covering requirements: AUTH-01, AUTH-02, AUTH-03, AUTH-04, INFRA-04. Each stub has a `// TODO:` comment describing what assertion to make once `lib/guesty.js` is implemented in Plan 02. The import from `../lib/guesty.js` is commented out.

### tests/availability.test.js
Four failing stubs covering requirements: INFRA-03 (three input validation cases) and AVAIL-02 (valid response shape). Includes a `mockReqRes()` helper for testing the handler directly. The import from `../api/availability.js` is commented out.

## Verification Results

- `package.json` type field: `module` (verified with `node -e`)
- `node --test tests/guesty.test.js`: 5 tests, 0 pass, 5 fail (RED as expected)
- `node --test tests/availability.test.js`: 4 tests, 0 pass, 4 fail (RED as expected)
- Both files use `import { describe, it } from 'node:test'` and `import assert from 'node:assert/strict'`
- No active imports from `../lib/guesty.js` or `../api/availability.js`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | cd14f7c | chore(01-01): add type=module to package.json |
| Task 2 | 4326fe3 | test(01-01): add failing test stubs for guesty and availability |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

The test files themselves ARE the intentional stubs for this plan. Each `assert.fail()` call is a placeholder for the real assertion that will be filled in during Plans 02 and 04. This is the documented Wave 0 state — RED is correct.

## Self-Check: PASSED
