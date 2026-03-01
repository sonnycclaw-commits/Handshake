# W3 Premortem — Production Observability & Alerts

Date: 2026-03-01
Owner: Sonny
Program: 30-Day $1Bn Scale Program / Week 3

## Objective
Ship production observability that detects and routes governance/security failure modes early, with deterministic operator actions.

## Failure Modes We Are Preventing

1. **Silent security degradation**
   - Replay guard unavailable but no alert path.
   - Tenant mismatch spikes hidden in aggregate metrics.

2. **Noisy telemetry without decision value**
   - Lots of metrics, no mapped runbook actions.
   - Operators can see graphs but not what to do next.

3. **Contract drift between runtime/docs/tests**
   - Alert conditions in code differ from operations docs.
   - Reason-code metrics not reflected in workflow runbooks.

4. **Blended changes increasing blast radius**
   - Telemetry + policy + unrelated refactors in one slice.

## Hard Execution Constraints (non-negotiable)

1. One mergeable slice at a time.
2. No gate bypasses.
3. Explicit blast-radius note per slice.
4. Docs/runtime/tests in same change set.
5. Fail-closed behavior unchanged by observability additions.

## Slice Plan (W3)

### Slice 1 — Structured Telemetry Rail (W3-C1)
- Add explicit structured events for key denial/replay failures.
- Scope: metrics projection path + tests only.
- Blast radius: read-only telemetry writes; no policy decision path mutation.

### Slice 2 — Baseline Dashboard Data Surfaces (W3-C2)
- Ensure reason-family, endpoint failure, replay trend surfaces are queryable and stable.
- Scope: metrics summary/series/reasons contracts + tests.
- Blast radius: API response contract on metrics routes.

### Slice 3 — Alert Thresholds + Routing (W3-C3)
- Define deterministic alert thresholds for:
  - replay guard unavailable
  - denial spikes
  - tenant mismatch spikes
- Scope: alert evaluator + integration tests.
- Blast radius: operator alert signal generation only.

### Slice 4 — Runbook Linkage (W3-C4)
- Map each alert to exact operations action in `docs/OPERATIONS.md`.
- Scope: docs + contract checks.
- Blast radius: documentation and operational clarity.

## Go/No-Go for W3 merge slices

Must hold for every slice:
- Targeted RED->GREEN tests pass.
- `npm run test:prod-gate` remains green.
- `npm run check:openapi` remains green where API contracts touched.
- No unrelated files changed.
- TASKS updated with progress and evidence pointers.

## Notes
W3 is a visibility and response-speed week. It must reduce time-to-detection and time-to-action without altering core authorization semantics.
