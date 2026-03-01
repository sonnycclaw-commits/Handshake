# Contract Model (Official)

## Canonical API Contract

The canonical API contract is:
- `openapi/handshake.v1.yaml`

All request/response schema truth lives there.

## Stable Error Envelope

All deterministic errors should expose:
- `error`
- `reasonCode`
- `responseClass`
- `message` (human-readable)

SDK and operators should use `reasonCode` + `responseClass` as machine contract.

## Protected Header Contracts

### Identity Envelope
Required on protected workflow rails:
- `GET /workflow/requests/{requestId}`
- `GET /workflow/decision-room/{requestId}`
- `GET /workflow/evidence/{requestId}`
- `POST /workflow/decision-room/action`

Header:
- `x-identity-envelope` (JSON)

### Internal Trust Context
Required on policy apply:
- `POST /policy/apply`

Header:
- `x-internal-trust-context` (signed internal token)

### Idempotency
Optional but recommended:
- `POST /workflow/decision-room/action`

Header:
- `x-idempotency-key`

## Contract Change Rule

If behavior changes for external integrators, update OpenAPI and regenerate SDK before merge.


## Read Scope Enforcement

For protected workflow read routes, envelope presence is insufficient. Access requires self principal match or `workflow:read:any` scope; unauthorized reads return `security_read_scope_denied` (403).
