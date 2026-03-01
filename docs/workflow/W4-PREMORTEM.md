# W4 Premortem — Release Discipline & Environment Safety

Date: 2026-03-01
Owner: Sonny
Program: 30-Day $1Bn Scale Program / Week 4

## Objective
Eliminate unsafe release paths by enforcing migration preflight, environment policy safety, and invariants in CI/deploy flow.

## Failure Modes We Are Preventing

1. **Unsafe deploy despite passing tests**
- Cause: schema drift/migration not applied or not validated.
- Control: migration confirmation gate + schema preflight as hard release blocker.

2. **Environment misconfiguration leaks into production**
- Cause: dev bypass flags enabled in prod-like deployment.
- Control: environment matrix enforcement and deploy-time policy checks.

3. **Semantic drift not caught by example tests**
- Cause: missing invariant/property checks for scope lattice and tenant isolation.
- Control: property/invariant suites in CI with deterministic assertions.

4. **Manual release checklist bypass**
- Cause: “trust me” releases with no machine-verifiable evidence.
- Control: automated release checklist proof artifacts + gate wiring.

## Hard Execution Constraints

1. One mergeable slice at a time.
2. No gate bypasses.
3. Blast radius note on each slice.
4. Docs/runtime/tests in same change set.
5. Release safety changes must fail closed.

## W4 Slice Plan

### Slice 1 — Migration Confirmation Gate (W4-D1)
- Add deterministic migration preflight check in release path.
- Block release if migration state is unsafe.

### Slice 2 — Environment Matrix Enforcement (W4-D2)
- Encode no-prod-with-dev-bypass rules.
- Add explicit failing checks for invalid env combinations.

### Slice 3 — Invariant/Property Rails (W4-D3)
- Add invariant tests for:
  - scope lattice monotonicity
  - tenant isolation
  - deterministic reason/status for equivalent failures

### Slice 4 — Release Checklist Automation + 24h watch hooks (W4-D4/D5)
- Convert checklist to verifiable artifact output.
- Add post-release verification thresholds and watch notes.

## Go/No-Go per W4 Slice

Must hold on every slice:
- Targeted RED->GREEN test evidence.
- `npm run test:prod-gate` green.
- `npm run check:openapi` green if contract touched.
- No unrelated files changed.
- TASKS updated with explicit evidence.
