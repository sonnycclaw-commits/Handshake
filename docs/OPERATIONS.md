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
```
