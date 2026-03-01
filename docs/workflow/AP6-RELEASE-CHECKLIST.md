# AP6 Release Checklist (Go/No-Go)

Status: Active (execution evidence checklist)
Date: 2026-03-01
Owner: Joel + Sonny

## Purpose
Prevent AP6 drift by enforcing one deterministic release gate across identity, contract, SDK, and CI controls.

## Gate Commands
- `npm run test:prod-gate`
- `npm run check:openapi`
- `npm run check:sdk-drift`
- `npm run test:ap6-gate`
- `npm run test:sdk-smoke`
- `npx tsc --noEmit`

## Go / No-Go Criteria

### W1/W2 Baseline Integrity
- [x] AP6 W1 identity-envelope RED suite passing
- [x] AP6 W2 trust-boundary RED suite passing
- [x] Workflow invariant transport gate passing (`test:prod-gate`)

### W3 Contract Governance
- [x] `openapi/handshake.v1.yaml` exists and validates against AP6 parity checks
- [x] OpenAPI includes core rails: workflow, policy, metrics, agents, entities
- [x] Canonical error schema includes `error`, `reasonCode`, `responseClass`
- [x] Runtime parity fixture checks exist (`tests/integration/workflow/ap6-openapi-runtime-parity.test.ts`)

### W4 SDK Accessibility
- [x] `sdk/typescript/` package scaffold exists
- [x] Wrapper surface includes workflow/policy/agents/entities methods
- [x] SDK error model includes `reasonCode`, `responseClass`, `retryable`
- [x] Quickstart smoke test exists and is CI-runnable

### W5 CI Enforcement
- [x] `package.json` AP6 scripts are executable checks (no placeholders)
- [x] CI workflow executes AP6 gates (`test:ap6-gate`, `check:openapi`, `check:sdk-drift`, `test:sdk-smoke`)
- [x] AP6 gate failure blocks merge
- [x] AP6 gate emits machine-readable artifact (`artifacts/ap6-gate-report.json`)

### Type + Regression Safety
- [x] `npx tsc --noEmit` passing
- [x] Existing workflow/policy/operator transport tests unaffected

## Evidence Log

### 2026-03-01 (semantic hardening pass)
- [x] `npm test -- tests/red/ap6/*.test.ts`
- [x] `npm run test:prod-gate`
- [x] `npm run check:openapi`
- [x] `npm run check:sdk-drift`
- [x] `npm run test:ap6-gate`
- [x] `npm run test:sdk-smoke`
- [x] `npx tsc --noEmit`
- [x] `npm test` full regression

## Rollback Rule
If any AP6 gate fails after merge prep, pause release and rollback only the failing AP6 slice. Do not mix rollback scope with unrelated runtime changes.
