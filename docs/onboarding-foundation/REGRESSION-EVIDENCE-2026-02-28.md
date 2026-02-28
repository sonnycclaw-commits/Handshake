# Onboarding Regression Evidence

Date: 2026-02-28
Scope: Backend-only onboarding foundation and contract integration

## Commands Run

1. `npm test -- tests/unit/onboarding tests/integration/onboarding`
2. `npm test`

## Results

- Onboarding targeted suites: **5 test files, 17 tests, all pass**
- Full project suite: **71 test files, 400 tests, all pass**

## Key Coverage Confirmed

- WF-00 onboarding acceptance contract behavior
- Fail-closed timeout semantics with terminal HITL state enforcement
- Non-bypass privileged path checks
- Revoke-under-pressure behavior
- Machine-readable policy envelope
- Decision-grade audit event/export contract
- TTFTP metric retrieval path
- Curvy hardening checks:
  - semantic bypass denial for malformed action shape
  - deterministic outcomes across metadata/channel variants
  - explicit reason-code quality floor (no placeholder reasons)

## Notes

- No frontend artifacts introduced.
- No new Clerk dependency introduced in onboarding core path.
- Existing phase suites remain green (no regressions observed).
