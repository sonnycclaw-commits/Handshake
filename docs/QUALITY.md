# Quality (Canonical)

## Release Gates

- `test:ap6-gate`
- `test:prod-gate`
- `check:openapi`
- `check:security-parity`
- `check:sdk-drift`
- `check:reason-code-map`
- `check:no-workflow-shim-imports`
- `check:schema-preflight`
- `check:release-readiness`
- `check:env-matrix`
- `test:sdk-smoke`
- `check:ap6-report`

## PR Change Checklist

- OpenAPI updated for externally visible changes
- SDK drift green
- Protected route security parity green
- Reason-code/responseClass contract preserved
- Docs updated when behavior changes

## SLO Baseline (initial)

- Workflow eval p95 < 200ms (excluding external vault latency)
- Decision action p95 < 250ms
- Policy apply p95 < 300ms
- Replay guard availability >= 99.9%

## Edge Case Matrix (Living)

### P0
1. Missing identity envelope on protected reads -> 401 `security_missing_identity_envelope`
2. Expired trust token on policy apply -> 401 `security_internal_trust_context_expired`
3. Decision replay -> 409 `security_replay_detected`
4. Replay guard unavailable -> 503 `security_replay_guard_unavailable` (fail closed)
5. OpenAPI security parity CI gate must fail on drift

### P1
- HITL timeout boundary determinism
- Cross-agent evidence scope enforcement
- Reason-code parity for equivalent failures

### P2
- Delegation multi-hop subset invariants
- Unknown response class fallback behavior in SDK


Environment matrix (W4-D2):
- CI must fail if production config enables dev exposure flags.
- CI must fail if production env vars do not explicitly identify production posture.
