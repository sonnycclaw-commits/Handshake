# PRD Traceability Report (Canonical)

Status: Updated for WF-00 onboarding + WF-05 unified request workflow
Date: 2026-02-28

## Workflow Traceability

| Workflow | Requirement Summary | Test Coverage | Status |
|---|---|---|---|
| WF-00 | Onboarding first trust proof <=5m, boundary visibility, revoke validation, non-bypassable privileged path, machine-readable policy envelope | `tests/unit/onboarding/onboarding-wf00.test.ts`<br>`tests/unit/onboarding/onboarding-contracts.test.ts`<br>`tests/integration/onboarding/onboarding-enforcement.integration.test.ts` | COVERED |
| WF-01 | Agent bounded execution | `tests/integration/transaction-flow.test.ts`<br>`tests/integration/policy-enforcement-decision-matrix.test.ts` | COVERED |
| WF-02 | Boundary escalation (HITL) | `tests/unit/hitl/hitl-workflow.phase3.test.ts`<br>`tests/integration/policy-hitl.phase3.test.ts` | COVERED |
| WF-03 | Fail-closed rejection path | `tests/unit/policy/policy-evaluator.phase3.test.ts`<br>`tests/integration/runtime-authorization-boundaries.test.ts` | COVERED |
| WF-04 | Entity governance / delegated approvals | `tests/unit/phase6/quorum-hitl.phase6.test.ts`<br>`tests/unit/phase6/delegated-authority.phase6.test.ts`<br>`tests/integration/governance-atomicity.phase6.integration.test.ts` | COVERED |
| WF-05 | Unified request workflow (`allow|deny|escalate`) with sensitivity branch, deterministic context, and integration-only composition | `tests/unit/workflow/request-workflow.red.test.ts`<br>`tests/unit/workflow/request-decision-context.red.test.ts`<br>`tests/unit/workflow/request-reason-codes.red.test.ts`<br>`tests/integration/workflow/request-workflow-enforcement.red.integration.test.ts`<br>`tests/integration/workflow/request-workflow-infra-compat.red.integration.test.ts`<br>`tests/integration/workflow/request-cross-surface-parity.red.integration.test.ts`<br>`tests/integration/workflow/request-sensitive-branch.red.integration.test.ts` | PLANNED (RED) |

---

## WF-00 Principle -> Test Mapping

| Onboarding Principle | Test IDs |
|---|---|
| Proof over promise | T-ONB-001, T-ONB-007, T-ONB-008 |
| Progressive trust | T-ONB-001, T-ONB-006 |
| Exception-first HITL | T-ONB-002, T-ONB-003 |
| Deterministic outcomes + reasons | T-ONB-007, T-ONB-014 |
| Non-bypassable privileged path | T-ONB-005, T-ONB-011 |
| Revoke visible/testable | T-ONB-004, T-ONB-012 |
| Machine-readable constraints | T-ONB-006, T-ONB-014 |
| Fail closed on uncertainty | T-ONB-003, T-ONB-005 |
| Audit by default (decision-grade) | T-ONB-008, T-ONB-013 |
| Low cognitive load / stepwise flow | T-ONB-009, T-ONB-010 |

---

## WF-00 Test Index

| Test ID | Description | File |
|---|---|---|
| T-ONB-001 | First trust proof under TTFTP budget | `tests/unit/onboarding/onboarding-wf00.test.ts` |
| T-ONB-002 | Boundary escalation terminal path | `tests/unit/onboarding/onboarding-wf00.test.ts` |
| T-ONB-003 | HITL timeout fail-closed | `tests/unit/onboarding/onboarding-wf00.test.ts` |
| T-ONB-004 | Revoke denies subsequent privileged action | `tests/unit/onboarding/onboarding-wf00.test.ts` |
| T-ONB-005 | Privileged non-bypassability | `tests/unit/onboarding/onboarding-wf00.test.ts` |
| T-ONB-006 | Machine-readable policy envelope contract | `tests/unit/onboarding/onboarding-contracts.test.ts` |
| T-ONB-007 | Standardized reason-code requirement | `tests/unit/onboarding/onboarding-wf00.test.ts` |
| T-ONB-008 | Audit event minimum dimensions | `tests/unit/onboarding/onboarding-wf00.test.ts` |
| T-ONB-009 | Stepwise progress / low cognitive load signal | `tests/unit/onboarding/onboarding-contracts.test.ts` |
| T-ONB-010 | TTFTP metric contract | `tests/unit/onboarding/onboarding-contracts.test.ts` |
| T-ONB-011 | Security event on bypass attempt | `tests/integration/onboarding/onboarding-enforcement.integration.test.ts` |
| T-ONB-012 | Revoke under pressure | `tests/unit/onboarding/onboarding-wf00.test.ts` |
| T-ONB-013 | Governance-grade audit export shape | `tests/unit/onboarding/onboarding-contracts.test.ts` |
| T-ONB-014 | Deterministic outcome class for identical input | `tests/integration/onboarding/onboarding-enforcement.integration.test.ts` |

---

## WF-05 Requirement -> Test Mapping (Planned)

| WF-05 Requirement | Test IDs | File |
|---|---|---|
| Single decision rail (`allow|deny|escalate`) | T-RW-001..003 | `tests/unit/workflow/request-workflow.red.test.ts` |
| Validation fail-closed | T-RW-004..007 | `tests/unit/workflow/request-workflow.red.test.ts` |
| Sensitive branch classification | T-RW-008..011 | `tests/integration/workflow/request-sensitive-branch.red.integration.test.ts` |
| HITL terminal semantics + late-approve denial | T-RW-012..016 | `tests/integration/workflow/request-workflow-enforcement.red.integration.test.ts` |
| Non-bypass privileged path | T-RW-017..018 | `tests/integration/workflow/request-workflow-enforcement.red.integration.test.ts` |
| Reason-code standardization + remediation mapping | T-RW-019..022 | `tests/unit/workflow/request-reason-codes.red.test.ts` |
| Deterministic context hash parity | T-RW-023..026 | `tests/unit/workflow/request-decision-context.red.test.ts` |
| Cross-surface decision parity (API/chat/workflow) | T-RW-027..029 | `tests/integration/workflow/request-cross-surface-parity.red.integration.test.ts` |
| Integration-only composition (no duplicate subsystem) | T-RW-030..032 | `tests/integration/workflow/request-workflow-infra-compat.red.integration.test.ts` |
| Audit+lineage consistency under partial failures | T-RW-033..035 | `tests/integration/workflow/request-workflow-infra-compat.red.integration.test.ts` |

---

## Notes

- WF-05 added to enforce integration-first request workflow as canonical path.
- Sensitivity remains a decision branch under WF-05; not a separate workflow.
- This report remains workflow-oriented and test-ID anchored for direct TDD use.
