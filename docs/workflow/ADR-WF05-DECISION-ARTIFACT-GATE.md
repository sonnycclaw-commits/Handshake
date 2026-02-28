# ADR-WF05 — Decision Artifact Gate for Privileged Execution

Status: Proposed
Date: 2026-02-28

## Context
WF-05 defines a single request decision rail. Without a hard gate, privileged side paths can bypass policy/HITL/audit controls.

## Decision
All privileged execution endpoints must validate a Handshake decision artifact before side effects.

## Decision Artifact (minimum)
- `requestId`
- `decision`
- `reasonCode`
- `tier`
- `timestamp`
- `decisionContextHash`
- optional `hitlRequestId` / `txnId`

## Validation Rules
1. Artifact must exist and be parse-valid.
2. Artifact decision must be `allow` for direct execution.
3. Artifact must not be terminal deny/reject/expired.
4. Context hash must match execution request context.
5. If HITL-linked, request must be in approved terminal state.

## Consequences
- Prevents prompt/runtime bypass of privileged rails.
- Forces consistent auditability and post-hoc forensics.
- Adds integration burden up front but reduces systemic risk.

## Alternatives Rejected
- Advisory-only artifact checks (too weak)
- Runtime-specific bypass flags (creates parallel rails)
