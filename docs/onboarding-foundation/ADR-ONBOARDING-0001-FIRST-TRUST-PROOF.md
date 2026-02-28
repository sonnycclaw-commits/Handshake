# ADR-ONBOARDING-0001: Onboarding Success = First Trust Proof in <= 5 Minutes

Date: 2026-02-28
Status: Accepted
Owner: Sonny

## Context
Handshake needs a hardened and intuitive onboarding flow that creates immediate user confidence without requiring deep protocol knowledge. Previous discussion identified risk of over-abstracted onboarding and trust claims without proof.

## Decision
Adopt **First Trust Proof** as the onboarding success contract.

Onboarding is only successful when user can see, in <= 5 minutes:
1) what an agent did,
2) why it was allowed/blocked/escalated,
3) how to revoke control immediately.

## Consequences
### Positive
- Anchors onboarding to observable value.
- Aligns design, implementation, and testing around measurable outcome.
- Reduces trust-theater risk.

### Negative / Tradeoffs
- Additional engineering effort on telemetry and reason-code clarity.
- Requires robust guided flow and deterministic state handling.

## Alternatives Considered
1. **Feature-tour onboarding** (rejected): high completion risk, low confidence gain.
2. **Docs-first onboarding** (rejected): slow time-to-value.
3. **Full configuration upfront** (rejected): high cognitive load.

## Acceptance Checks
- WF-00 criteria pass
- Onboarding TDD scenario set green for happy + failure branches
- TTFTP metric instrumented and observable

## Open Risks
- TTFTP may vary by channel/device/network.
- Reason-code quality can degrade if not treated as contract.
- HITL UX could still induce fatigue if thresholds are poor.

## Next Step
Integrate WF-00 into PRD and map to test IDs in PRD traceability.


## Approval

Accepted as canonical onboarding decision for backend-first implementation scope (WF-00).
