# Handshake Onboarding TDD Scenarios (v1)

Status: Draft
Date: 2026-02-28
Owner: Sonny

Reference: WF-00 (Onboarding Acceptance Contract)

## Scenario Set

### T-ONB-001 Happy Path: First Trust Proof
Given a new principal and linked agent
When user selects baseline policy and runs guided workflow
Then one action is evaluated and result includes reason code
And trust proof is rendered within TTFTP budget

### T-ONB-002 Boundary Escalation Visible
Given policy tier that requires escalation for medium/high risk action
When guided workflow triggers boundary action
Then HITL request is created and surfaced
And outcome is explicit (approved/rejected/expired)

### T-ONB-003 Timeout Fails Closed
Given pending HITL request
When timeout window expires
Then action resolves to deny
And audit event includes `hitl_expired`

### T-ONB-004 Revoke Control Validation
Given onboarding reaches trust-proof step
When user activates revoke/pause test
Then subsequent privileged action attempts are denied
And reason code indicates revoked state

### T-ONB-005 Non-Bypassable Privileged Action
Given privileged action path
When request bypasses handshake envelope requirements
Then execution is blocked deterministically
And no downstream action occurs

### T-ONB-006 Machine-Readable Policy Envelope
Given policy selection completed
When onboarding emits agent constraints
Then envelope contains enforceable fields (scope, tier, limits, expiry)
And agent runtime can parse schema successfully

### T-ONB-007 Deterministic Reason Codes
Given any allow/deny/escalate outcome during onboarding
When result is returned
Then standardized reason code is present and non-empty

### T-ONB-008 Audit Completeness
Given onboarding workflow execution
When events occur
Then required onboarding events are logged with required dimensions

### T-ONB-009 Low Cognitive Load Path
Given first-time user
When following guided sequence
Then no step requires protocol/domain knowledge to proceed
And progress indicator reflects current stage

### T-ONB-010 TTFTP Budget
Given normal system conditions
When onboarding is run end-to-end
Then p95 TTFTP meets target budget (<= 5m)

## Test Notes
- Keep onboarding tests deterministic (mock external latency where needed).
- Explicitly test failure branches as first-class flows.
- Treat reason-code stability as contract (breaking change requires version bump).

### T-ONB-011 No Privileged Bypass (Operator Adversarial)
Given direct privileged API/tool path attempt outside handshake
When request is executed
Then execution is blocked and security event is logged

### T-ONB-012 Revoke Under Pressure (Individual Principal)
Given active guided workflow and successful prior action
When principal revokes during next action window
Then next privileged action is denied with explicit revoked reason code

### T-ONB-013 Governance-Grade Audit Record (Entity Principal)
Given onboarding workflow completes with allow/deny/escalate events
When records are exported
Then each record contains required governance fields and consistent lineage identifiers

### T-ONB-014 Deterministic Runtime Contract (Agent Runtime)
Given identical request context and policy envelope
When evaluated across supported interaction paths
Then outcome class and reason schema are consistent (`allow|deny|escalate`)


## Coverage Notes
- T-ONB-001..010 cover baseline WF-00 contract.
- T-ONB-011..014 cover actor-premortem hardening (operator/principal/entity/runtime).
- All onboarding principles in design standard must map to at least one TDD scenario ID.
