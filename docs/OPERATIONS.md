# Operations (Canonical)

## Runtime Dependencies

- D1 database (workflow + replay guards)
- KV namespace (other runtime concerns)
- `INTERNAL_TRUST_SHARED_SECRET`

## Deploy Hygiene

Before deploy:
- migrations applied
- secrets present
- gates green

## Required Gates

```bash
npm run check:openapi
npm run check:security-parity
npm run check:sdk-drift
npm run test:ap6-gate
npm run test:prod-gate
npm run check:ap6-report
```

## Incident Decision Tree

- `security_missing_identity_envelope` -> inject envelope, retry.
- `security_missing_internal_trust_context` -> add signed trust token.
- `security_replay_detected` -> do not replay with same key blindly.
- `security_replay_guard_unavailable` -> fail closed, incident, restore D1 path.
- `hitl_timeout_fail_closed` / `hitl_terminal_state_immutable` -> new request path.

## Replay Guard Retention

Policy:
```sql
DELETE FROM replay_guards WHERE expires_at < <now_ms>;
```

Helper script:
- `scripts/replay-guards-retention.mjs` (dry-run by default)

## Secret Rotation (Trust Secret)

1. prepare + announce
2. rotate secret in env store
3. redeploy trust-signing/verifying components
4. verify `/policy/apply` path
5. revoke old secret
6. re-run gates

Never disable trust checks to recover availability.


## Schema Preflight

Run before deploy:
```bash
npm run check:schema-preflight
npm run check:release-readiness
npm run check:env-matrix
```


## W3 Alert Runbook Mapping (C4)

### Alert: `alert_replay_guard_unavailable`
Signal:
- Replay guard store path is unavailable or degraded.
- Usually correlated with `security_replay_guard_unavailable` responses.

Operator action:
1. Pause privileged mutation retries (`/workflow/decision-room/action`, `/policy/apply`).
2. Validate D1 health and replay table availability (`replay_guards`).
3. Run schema preflight and verify migrations:
   - `npm run check:schema-preflight
npm run check:release-readiness
npm run check:env-matrix`
4. Validate trust/replay rails with gates:
   - `npm run test:prod-gate`
5. Resume traffic only after deterministic replay behavior is restored.

---

### Alert: `alert_denial_spike`
Signal:
- Security denial rate exceeds configured threshold (`maxDenialRate`).

Operator action:
1. Query reason-family distribution (`GET /metrics/reasons`) and isolate dominant reasons.
2. Check endpoint trend via metrics series (`GET /metrics/series`).
3. Confirm no contract drift:
   - `npm run check:reason-code-map`
   - `npm run check:security-parity`
4. If driven by malformed client payloads, issue integration guidance + throttle noisy callers.
5. If driven by internal changes, execute rollback/mitigation and re-run release gates.

---

### Alert: `alert_tenant_mismatch_spike`
Signal:
- Tenant-boundary denial rate exceeds configured threshold (`maxTenantMismatchRate`).
- Usually correlated with `security_read_tenant_mismatch` denials.

Operator action:
1. Verify identity envelope issuer and tenant claim mapping in middleware path.
2. Validate read-scope behavior (`self|tenant|any`) against deployed config.
3. Audit recent deploys affecting identity/read rails.
4. Run protected-route parity and transport gates:
   - `npm run check:security-parity`
   - `npm run test:prod-gate`
5. If cross-tenant leakage risk is suspected, keep fail-closed posture and escalate incident.


## W4 Release Safety Gates (D1)

Release path must fail closed unless migration + runtime safety checks pass.

Primary gate:
```bash
npm run check:release-readiness
npm run check:env-matrix
```

This currently enforces:
1. `check:schema-preflight` (required migration + replay/tenant wiring)
2. `test:prod-gate` (critical transport/invariant suite)

If this gate fails, do not deploy.


## W4 Environment Matrix Safety (D2)

Production deploy policy forbids dev-mode exposure flags and invalid production env labeling.

Gate:
```bash
npm run check:env-matrix
```

Current enforced rules:
1. `workers_dev = false`
2. `preview_urls = false`
3. `[env.production]` block must exist
4. `[env.production.vars].ENVIRONMENT` must equal `"production"`

If this gate fails, do not deploy.
