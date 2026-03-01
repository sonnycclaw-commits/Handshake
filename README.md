# Handshake

Authorization layer for agent actions: bounded autonomy, deterministic policy decisions, auditability, and HITL at boundaries.

## 10-Minute Quickstart (TypeScript)

1. Install deps in this repo:

```bash
npm ci
```

2. Run local tests/gates:

```bash
npm run test:ap6-gate
```

3. Use SDK wrapper (`sdk/typescript/src/handshake-client.ts`) with identity envelope:

```ts
import { HandshakeClient } from './sdk/typescript/src/handshake-client'

const client = new HandshakeClient({ baseUrl: 'http://localhost:8787' })

const identityEnvelope = {
  principalId: 'p1',
  subjectType: 'human',
  roles: ['operator'],
  scopes: ['workflow:resolve'],
}

const req = await client.workflow.submitRequest({
  requestId: 'req-1',
  principalId: 'p1',
  agentId: 'a1',
  actionType: 'payment',
  payloadRef: 'amount:50',
  timestamp: Date.now(),
})

const room = await client.workflow.getDecisionRoom(req.requestId, identityEnvelope)
```

## Protected Headers Model

- `x-identity-envelope`: required for protected workflow read/action routes
- `x-internal-trust-context`: required for privileged internal policy apply transitions
- `x-idempotency-key`: optional replay protection for decision actions

## Canonical Contract + SDK

- OpenAPI source of truth: `openapi/handshake.v1.yaml`
- API reference pointer: `docs/reference/API.md`
- TS SDK wrapper: `sdk/typescript/src/handshake-client.ts`

## Stable vs Moving Surface

Handshake evolves, but v1 integration surface should remain stable:
- reasonCode + responseClass semantics
- identity envelope contract for protected routes
- OpenAPI-governed request/response schemas

For compatibility and change policy, see `COMPATIBILITY.md`.


## Program Status (30-Day Scale Program)

Status: **Complete (W1-W4)**

- W1: Transitional risk surface elimination
- W2: Least-privilege scope model (`self|tenant|any`)
- W3: Production observability + deterministic alert/runbook rails
- W4: Release discipline + environment safety + invariants + 24h watch hooks

Post-program smell assessment:
- `docs/workflow/POST-30DAY-SMELL-TEST-2026-03-01.md`


## Layman Docs

Plain-English references:
- `docs/layman/01-what-is-handshake.md`
- `docs/layman/02-agent-identity.md`
- `docs/layman/03-permissions-and-limits.md`
- `docs/layman/04-approvals-and-risk.md`
- `docs/layman/05-errors-and-safety.md`
- `docs/layman/06-what-backend-can-do.md`
