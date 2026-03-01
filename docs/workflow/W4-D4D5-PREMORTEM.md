# W4-D4/D5 Premortem — Release Checklist Automation + 24h Watch Hooks

Date: 2026-03-01
Owner: Sonny
Scope: W4-D4 (release checklist automation), W4-D5 (24h post-release watch hooks)

## Objective
Convert release confidence from manual trust to machine-verifiable evidence, then ensure first-24h production risk signals are monitored with deterministic response actions.

## What can fail if we do this poorly

1. **Checklist theater (artifact exists but proves nothing)**
- Failure mode: JSON generated with placeholder/pass-through values.
- Impact: false confidence; unsafe releases still pass.
- Prevention: artifact verifier must validate concrete gate outputs and timestamps, not mere field presence.

2. **CI coupling drift**
- Failure mode: release checklist requires fields that CI never populates (or vice versa).
- Impact: persistent false failures or silent bypass.
- Prevention: single contract source + verifier test fixtures (valid/invalid artifact cases).

3. **Post-release watch noise flood**
- Failure mode: thresholds too sensitive, operators ignore alerts.
- Impact: alert fatigue; real incidents missed.
- Prevention: explicit threshold defaults + environment profile + runbook action mapping.

4. **Post-release watch blind spots**
- Failure mode: watch checks only one metric class.
- Impact: replay/tenant drift goes unseen in first 24h.
- Prevention: mandatory triad checks (replay-guard unavailable, denial spike, tenant mismatch spike).

5. **Non-deterministic operator response**
- Failure mode: alert fires but runbook says “investigate” with no concrete steps.
- Impact: longer MTTR; inconsistent handling.
- Prevention: action matrix with first response, escalation trigger, and closure condition.

## Hard constraints (must hold)

1. One mergeable slice at a time.
2. No gate bypasses.
3. Docs/runtime/tests updated together for each slice.
4. Release checks fail closed.
5. No new broad API surface unless required for D4/D5 objective.

## Execution plan

### Slice D4 — Release checklist automation
- Add release checklist artifact schema + generator script.
- Add verifier script to enforce:
  - required gate statuses
  - freshness window
  - commit/branch identity fields
- Wire verifier into CI.
- Add unit test for verifier with valid + tampered fixtures.

Blast radius: CI/release process only (no runtime decision semantics).

### Slice D5 — 24h watch hooks
- Define `docs/workflow/W4-24H-WATCH.md` with mandatory signals + thresholds + action matrix.
- Add watch-config validator script (`check:w4-watch-config`).
- Add gate in CI to enforce watch contract presence/shape.
- Link alerts directly back to OPERATIONS runbook actions.

Blast radius: operations process and monitoring contract; no workflow policy behavior changes.

## Go / No-Go

Ship D4/D5 only if all are true:
- `npm run test:w4-invariants` green
- `npm run test:prod-gate` green
- `npm run check:openapi` green (if touched)
- new checklist/watch verifier tests green
- CI passes on PR with new gates active
- TASKS evidence block includes command outputs

## Success criteria

- A release cannot pass without machine-verifiable checklist proof.
- First 24h post-release has explicit signals, thresholds, and deterministic actions.
- Operator can answer, from artifacts alone: "what shipped, which checks passed, what are we watching right now?"
