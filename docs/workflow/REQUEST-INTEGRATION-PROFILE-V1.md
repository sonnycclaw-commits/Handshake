# Request Integration Profile v1 (Narrow Wedge)

Status: Draft
Date: 2026-02-28

## Goal
Agent-facing integration profile for high-risk privileged actions with minimal ambiguity.

## Supported Action Classes (v1)
1. `payment`
2. `credential_use`
3. `data_access` (sensitive branch)

## Required Contract
- request schema with stable core fields
- decision enum: `allow|deny|escalate`
- reason-code taxonomy (versioned)
- state model with immutable terminal states
- decision artifact required for privileged execution

## Explicit Non-Goals (v1)
- broad universal action ontology
- per-runtime custom decision semantics
- adaptive ML scoring in decision critical path

## Adoption Principle
Prefer strict composability over broad feature surface.
If integrator cannot conform to profile v1, keep integration out of privileged path.
