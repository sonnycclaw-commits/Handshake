# Architecture Map — Pass 1 (Hexagonal Standard v1)

Status legend: PASS | DRIFT | VIOLATION

| File | Layer | Detected Concerns | Status | Notes |
|---|---|---|---|---|
| `adapters/crypto/jwt-credential-service.ts` | adapters | - | **PASS** | - |
| `adapters/persistence/d1-hitl-store.ts` | adapters | decision/policy,infra/io,state-machine | **PASS** | - |
| `adapters/persistence/d1-identity-store.ts` | adapters | infra/io | **PASS** | - |
| `adapters/persistence/d1-request-workflow-store.ts` | adapters | infra/io,state-machine | **PASS** | - |
| `adapters/persistence/in-memory-hitl-store.ts` | adapters | - | **PASS** | - |
| `adapters/persistence/in-memory-request-workflow-store.ts` | adapters | - | **PASS** | - |
| `adapters/persistence/kv-state-store.ts` | adapters | infra/io,state-machine | **PASS** | - |
| `adapters/vault/env-vault.ts` | adapters | decision/policy | **PASS** | - |
| `adapters/vault/in-memory-vault.ts` | adapters | decision/policy,state-machine | **PASS** | - |
| `adapters/vault/index.ts` | adapters | - | **PASS** | - |
| `domain/constants/manifest-version.ts` | domain | - | **PASS** | - |
| `domain/constants/reason-codes.ts` | domain | - | **PASS** | - |
| `domain/entities/audit-entry.ts` | domain | - | **PASS** | - |
| `domain/entities/manifest.ts` | domain | decision/policy | **PASS** | - |
| `domain/entities/signed-manifest.ts` | domain | - | **PASS** | - |
| `domain/errors/error-codes.ts` | domain | - | **PASS** | - |
| `domain/errors/governance-errors.ts` | domain | - | **PASS** | - |
| `domain/errors/index.ts` | domain | - | **PASS** | - |
| `domain/serialization/canonicalize.ts` | domain | - | **PASS** | - |
| `domain/serialization/manifest-canonicalization.ts` | domain | - | **PASS** | - |
| `domain/services/audit-log.ts` | domain | - | **PASS** | - |
| `domain/services/create-audit-entry.ts` | domain | - | **PASS** | - |
| `domain/services/create-manifest.ts` | domain | decision/policy | **PASS** | - |
| `domain/services/delegated-authority.ts` | domain | - | **PASS** | - |
| `domain/services/emergency-controls.ts` | domain | - | **PASS** | - |
| `domain/services/generate-key-pair.ts` | domain | - | **PASS** | - |
| `domain/services/governance-audit-lineage.ts` | domain | - | **PASS** | - |
| `domain/services/governance-transaction.ts` | domain | decision/policy,observability | **DRIFT** | domain has observability concern |
| `domain/services/hitl-callback-verification.ts` | domain | decision/policy,state-machine | **PASS** | - |
| `domain/services/hitl-delivery.ts` | domain | decision/policy,state-machine | **PASS** | - |
| `domain/services/hitl-queue.ts` | domain | decision/policy,state-machine | **PASS** | - |
| `domain/services/hitl-workflow.ts` | domain | decision/policy,state-machine | **PASS** | verified 2026-02-28: no adapter imports |
| `domain/services/incident-report.ts` | domain | - | **PASS** | - |
| `domain/services/manifest-canonicalization.ts` | domain | decision/policy | **PASS** | - |
| `domain/services/onboarding-workflow.ts` | domain | decision/policy,state-machine | **PASS** | - |
| `domain/services/operator-read-model.ts` | domain | state-machine | **PASS** | - |
| `domain/services/policy-evaluator.ts` | domain | decision/policy | **PASS** | - |
| `domain/services/policy-inheritance.ts` | domain | - | **PASS** | - |
| `domain/services/policy-management.ts` | domain | decision/policy,state-machine | **PASS** | - |
| `domain/services/quorum-hitl.ts` | domain | decision/policy,state-machine | **PASS** | - |
| `domain/services/request-retry-policy.ts` | domain | decision/policy,state-machine | **PASS** | - |
| `domain/services/request-workflow.ts` | domain | decision/policy,state-machine | **PASS** | verified 2026-02-28: no adapter imports |
| `domain/services/response-sanitization.ts` | domain | - | **PASS** | - |
| `domain/services/risk-signal-aggregation.ts` | domain | - | **PASS** | - |
| `domain/services/sign-manifest.ts` | domain | - | **PASS** | - |
| `domain/services/trust-score.ts` | domain | state-machine | **PASS** | - |
| `domain/services/verify-manifest-signature.ts` | domain | - | **PASS** | - |
| `domain/services/wf5-ops-metrics.ts` | domain | observability | **DRIFT** | domain has observability concern |
| `domain/value-objects/credential-id.ts` | domain | - | **PASS** | - |
| `domain/value-objects/credential-ref.ts` | domain | decision/policy | **PASS** | - |
| `domain/value-objects/credential-type.ts` | domain | - | **PASS** | - |
| `domain/value-objects/detection-result.ts` | domain | - | **PASS** | - |
| `domain/value-objects/error-code.ts` | domain | - | **PASS** | - |
| `domain/value-objects/index.ts` | domain | decision/policy | **PASS** | - |
| `domain/value-objects/log-level.ts` | domain | - | **PASS** | - |
| `domain/value-objects/sensitive-data-pattern.ts` | domain | - | **PASS** | - |
| `domain/value-objects/tier.ts` | domain | decision/policy | **PASS** | - |
| `index.ts` | entry | imports-adapters,infra/io,state-machine | **DRIFT** | entry may contain business semantics |
| `ports/credential-service.ts` | ports | - | **PASS** | - |
| `ports/hitl-store.ts` | ports | decision/policy,state-machine | **PASS** | - |
| `ports/identity-store.ts` | ports | - | **PASS** | - |
| `ports/request-workflow-store.ts` | ports | decision/policy,state-machine | **PASS** | - |
| `ports/state-store.ts` | ports | state-machine | **PASS** | - |
| `ports/types.ts` | ports | decision/policy | **PASS** | - |
| `use-cases/execute-privileged-action.ts` | use-cases | decision/policy | **PASS** | - |
| `use-cases/l0-verification.ts` | use-cases | infra/io,state-machine | **PASS** | - |
