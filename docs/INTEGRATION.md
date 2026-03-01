# Integration (Canonical)

## Fast Path

1. Validate gates:
```bash
npm ci
npm run test:ap6-gate
```
2. Use SDK wrapper: `sdk/typescript/src/handshake-client.ts`
3. Submit request -> read decision context -> resolve action if escalated.

## Required Headers Model

- `x-identity-envelope` on protected workflow reads/actions:
  - `GET /workflow/requests/{requestId}`
  - `GET /workflow/decision-room/{requestId}`
  - `GET /workflow/evidence/{requestId}`
  - `POST /workflow/decision-room/action`
- `x-internal-trust-context` on:
  - `POST /policy/apply`
- `x-idempotency-key` recommended on decision actions.

## SDK Usage Pattern

- `workflow.submitRequest(...)`
- `workflow.getRequest(requestId, identityEnvelope)`
- `workflow.getDecisionRoom(requestId, identityEnvelope)`
- `workflow.evidence(requestId, identityEnvelope)`
- `workflow.resolveAction(payload, identityEnvelope, idempotencyKey?)`
- `policy.simulate(...)`
- `policy.apply(payload, identityEnvelope, internalTrustToken)`

## Error Handling Contract

Use `reasonCode` + `responseClass` as machine contract.
- `ok`: proceed
- `retryable`: bounded retry/backoff
- `blocked`: remediate/escalate
- `unknown`: fail closed and run contract drift checks

## Migration Notes

- Replace ad hoc HTTP/auth parsing with SDK wrapper.
- Normalize to canonical identity envelope from trusted middleware.
- Keep idempotency key strategy explicit (same logical attempt vs new action).


## Read Authorization (Slice 3)

Protected workflow reads now require one of:
- self principal match,
- `workflow:read:tenant` with same tenant,
- `workflow:read:any` for admin global access (non-admin `read:any` is backward-compat tenant-scoped).

Otherwise responses fail with `security_read_scope_denied` (403).

Tenant boundary violations fail with `security_read_tenant_mismatch` (403).
