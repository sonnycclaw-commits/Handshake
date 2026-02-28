# Onboarding Foundation

Status: Active working set
Owner: Sonny
Last updated: 2026-02-28

## Purpose
This folder isolates onboarding foundation artifacts before they are merged into canonical Handshake docs.

Use this folder to:
- shape onboarding standards,
- validate assumptions with testable criteria,
- prepare ADR/PRD updates without polluting root docs.

---

## Intended Structure

```text
docs/onboarding-foundation/
├── README.md
├── ONBOARDING-DESIGN-STANDARD.md
├── ONBOARDING-TDD-SCENARIOS.md
└── ADR-ONBOARDING-0001-FIRST-TRUST-PROOF.md
```

---

## Document Roles

### 1) ONBOARDING-DESIGN-STANDARD.md
Defines high-level onboarding principles and contracts.
- North star metric (TTFTP)
- State machine
- Acceptance contract (WF-00)
- Observability minimums

### 2) ONBOARDING-TDD-SCENARIOS.md
Defines test scenarios derived from onboarding standard.
- happy path
- boundary escalation
- timeout/fail-closed
- revoke validation
- non-bypassability checks

### 3) ADR-ONBOARDING-0001-FIRST-TRUST-PROOF.md
Decision proposal for onboarding success criteria.
- remains `Proposed` until approved
- promote to canonical ADR flow after approval

---

## How to Use

1. Discuss and iterate inside this folder.
2. Approve decision and acceptance language.
3. Promote approved content into canonical docs:
   - `docs/PRD.md` (WF-00 + acceptance matrix)
   - `docs/PRD-TRACEABILITY.md` (test ID mappings)
   - ADR index/location per project convention
4. Archive superseded drafts in dated archive path.

---

## Governance Rules

- Do not edit canonical PRD flow contracts until onboarding foundation is approved.
- Keep ADR files here as `Proposed` until explicit promotion.
- Every onboarding rule must map to at least one TDD scenario.
- Avoid duplicate truth statements across root docs and this folder.
