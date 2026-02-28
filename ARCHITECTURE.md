# Handshake Architecture

> **Hexagonal (Ports & Adapters) — Clean separation, testable core, swappable integrations.**

---

## The Pattern

We use **Hexagonal Architecture** because:

| Need | Why Hexagonal |
|------|---------------|
| Multiple vault integrations | Each vault is an adapter, core doesn't care which |
| Testable business logic | Swap real adapters for mocks |
| Clean SDK for third parties | VaultAdapter IS the SDK contract |
| No framework lock-in | Core has zero dependencies on Cloudflare, 1Password, etc. |

---

## The Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    HANDSHAKE CORE                            │
│                   (Domain + Use Cases)                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 PORTS (Interfaces)                    │    │
│  │                                                       │    │
│  │  VaultAdapter          NotificationChannel           │    │
│  │  AuditLog              ManifestStore                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Domain has NO dependencies on external services.            │
│  Domain imports ONLY ports (interfaces).                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ implements
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    ADAPTERS (Implementations)                │
│                                                              │
│  VaultAdapter:              NotificationChannel:            │
│  ├── OnePasswordAdapter     ├── TelegramChannel            │
│  ├── AWSSecretsAdapter      ├── EmailChannel               │
│  ├── HashiCorpVaultAdapter  └── MockChannel (testing)      │
│  └── MockVault (testing)                                   │
│                                                             │
│  AuditLog:                  ManifestStore:                  │
│  ├── CloudflareKVLog        ├── CloudflareKVStore          │
│  └── InMemoryLog (testing)  └── InMemoryStore (testing)    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Dependency Rule

```
DEPENDENCIES POINT INWARD ONLY.

Domain → Ports → (nothing)
Use Cases → Domain, Ports → (nothing)
Adapters → Ports → (never Domain directly)
```

**Never:**
- Domain imports from adapters
- Domain imports Cloudflare, 1Password, Telegram, etc.
- Use cases import adapters directly

---

## The Ports (Interfaces)

### VaultAdapter — The SDK

The primary integration point. Third-party vaults implement this.

```typescript
// src/ports/vault-adapter.ts

export interface VaultAdapter {
  // Identity
  readonly name: string                    // "1password", "aws-secrets-manager"
  readonly version: string                 // Adapter version

  // Connection
  connect(config: VaultConfig): Promise<void>
  disconnect(): Promise<void>
  health(): Promise<HealthStatus>

  // Credential Discovery (what's available, not values)
  listCredentials(principalId: string): Promise<CredentialMetadata[]>

  // Transaction Execution (retrieve + execute in one call)
  execute(
    credentialId: string,
    action: TransactionAction,
    context: ExecutionContext
  ): Promise<TransactionResult>

  // Optional: Signing Key Support
  getSigningKey?(principalId: string): Promise<SigningKey>
}
```

### NotificationChannel

```typescript
// src/ports/notification-channel.ts

export interface NotificationChannel {
  readonly name: string                    // "telegram", "email"

  send(request: HITLRequest): Promise<void>
  handleCallback(callback: Callback): Promise<CallbackResult>
}
```

### AuditLog

```typescript
// src/ports/audit-log.ts

export interface AuditLog {
  append(entry: AuditEntry): Promise<void>
  query(filter: QueryFilter): Promise<AuditEntry[]>
}
```

### ManifestStore

```typescript
// src/ports/manifest-store.ts

export interface ManifestStore {
  save(manifest: SignedManifest): Promise<void>
  get(agentId: string): Promise<SignedManifest | null>
  list(principalId: string): Promise<SignedManifest[]>
}
```

---

## The Domain (Core Business Logic)

### Entities

```typescript
// src/domain/entities/manifest.ts

export class Manifest {
  constructor(
    public readonly agentId: string,
    public readonly principalId: string,
    public readonly credentials: CredentialRef[],
    public readonly createdAt: number,
    public readonly expiresAt: number
  ) {}

  isExpired(): boolean {
    return Date.now() > this.expiresAt
  }

  hasCredential(credentialType: CredentialType): boolean {
    return this.credentials.some(c => c.type === credentialType)
  }
}
```

### Value Objects

```typescript
// src/domain/value-objects/tier.ts

export class Tier {
  static readonly TIER_0 = new Tier(0, 'Auto-approved')
  static readonly TIER_1 = new Tier(1, 'Silent')
  static readonly TIER_2 = new Tier(2, 'One-tap')
  static readonly TIER_3 = new Tier(3, 'Confirm')
  static readonly TIER_4 = new Tier(4, 'Quorum')

  private constructor(
    public readonly level: number,
    public readonly name: string
  ) {}

  requiresHITL(): boolean {
    return this.level >= 2
  }
}
```

### Domain Services

```typescript
// src/domain/services/tier-classifier.ts

export class TierClassifier {
  classify(action: TransactionAction, credential: CredentialMetadata): Tier {
    // Business logic for tier classification
    if (action.type === 'payment' && action.params.amount > 50) {
      return Tier.TIER_3
    }
    if (credential.type === 'identity_document') {
      return Tier.TIER_3
    }
    // ... more rules
  }
}
```

---

## Use Cases

Use cases orchestrate domain logic and ports.

```typescript
// src/use-cases/execute-transaction.ts

export class ExecuteTransactionUseCase {
  constructor(
    private readonly vault: VaultAdapter,
    private readonly manifestStore: ManifestStore,
    private readonly auditLog: AuditLog,
    private readonly notificationChannel: NotificationChannel,
    private readonly tierClassifier: TierClassifier
  ) {}

  async execute(request: TransactionRequest): Promise<TransactionResult> {
    // 1. Load manifest
    const manifest = await this.manifestStore.get(request.agentId)
    if (!manifest || manifest.isExpired()) {
      throw new Error('Invalid or expired manifest')
    }

    // 2. Verify signature
    if (!manifest.verify()) {
      throw new Error('Manifest signature invalid')
    }

    // 3. Check credential is authorized
    if (!manifest.hasCredential(request.credentialType)) {
      throw new Error('Credential not in manifest')
    }

    // 4. Classify tier
    const tier = this.tierClassifier.classify(request.action, request.credential)

    // 5. HITL if needed
    if (tier.requiresHITL()) {
      return this.handleHITL(request, tier)
    }

    // 6. Execute via vault
    const result = await this.vault.execute(
      request.credentialId,
      request.action,
      { agentId: request.agentId, principalId: manifest.principalId }
    )

    // 7. Log
    await this.auditLog.append({
      agentId: request.agentId,
      action: request.action,
      tier: tier.level,
      result: result.success ? 'success' : 'failed'
    })

    return result
  }
}
```

---

## The Adapters (Implementations)

### MockVault (Testing)

```typescript
// src/adapters/vault/mock-vault.ts

export class MockVault implements VaultAdapter {
  readonly name = 'mock-vault'
  readonly version = '1.0.0'

  private credentials: Map<string, CredentialMetadata> = new Map()

  async listCredentials(principalId: string): Promise<CredentialMetadata[]> {
    return Array.from(this.credentials.values())
  }

  async execute(
    credentialId: string,
    action: TransactionAction,
    context: ExecutionContext
  ): Promise<TransactionResult> {
    // Return mock result
    return {
      success: true,
      transactionId: `mock_${Date.now()}`,
      details: { action: action.type }
    }
  }
}
```

### OnePasswordAdapter (Real)

```typescript
// src/adapters/vault/one-password.ts

export class OnePasswordAdapter implements VaultAdapter {
  readonly name = '1password'
  readonly version = '1.0.0'

  private client: OnePasswordClient

  async connect(config: OnePasswordConfig): Promise<void> {
    this.client = new OnePasswordClient({
      token: config.token,
      baseUrl: config.connectHost
    })
  }

  async listCredentials(principalId: string): Promise<CredentialMetadata[]> {
    const vaults = await this.client.listVaults()
    const items = await Promise.all(
      vaults.map(v => this.client.listItems(v.id))
    )

    return items.flat().map(item => ({
      id: item.id,
      type: this.inferCredentialType(item),
      name: item.title,
      tier: this.defaultTier(item)
    }))
  }

  async execute(
    credentialId: string,
    action: TransactionAction,
    context: ExecutionContext
  ): Promise<TransactionResult> {
    // 1. Get item from 1Password
    const item = await this.client.getItem(credentialId)

    // 2. Execute action (e.g., call Stripe API)
    // 3. Sanitize response
    // 4. Return result
  }
}
```

---

## Testing Strategy

### Unit Tests (Domain + Use Cases)

```typescript
// tests/unit/use-cases/execute-transaction.test.ts

describe('ExecuteTransactionUseCase', () => {
  it('rejects expired manifest', async () => {
    const mockVault = new MockVault()
    const mockStore = new InMemoryManifestStore()
    const useCase = new ExecuteTransactionUseCase(mockVault, mockStore, ...)

    // Create expired manifest
    const manifest = createTestManifest({ expiresAt: Date.now() - 1000 })
    await mockStore.save(manifest)

    await expect(useCase.execute(testRequest))
      .rejects.toThrow('Invalid or expired manifest')
  })
})
```

### Integration Tests (Adapters)

```typescript
// tests/integration/one-password-adapter.test.ts

describe('OnePasswordAdapter', () => {
  it('lists credentials from vault', async () => {
    const adapter = new OnePasswordAdapter()
    await adapter.connect(testConfig)

    const credentials = await adapter.listCredentials('principal_001')

    expect(credentials.length).toBeGreaterThan(0)
    expect(credentials[0]).toHaveProperty('type')
    expect(credentials[0]).not.toHaveProperty('value')  // Never values
  })
})
```

---

## The SDK for Third Parties

See `SDK.md` for integration guide.

**Summary:**
1. Implement `VaultAdapter` interface
2. Return credential metadata (never values)
3. Execute transactions and return sanitized results
4. Register with Handshake

---

## Key Principles

1. **Domain is pure** — No framework, no infrastructure, no adapters
2. **Ports are contracts** — Interfaces only, no implementation
3. **Adapters are swappable** — Mock for testing, real for production
4. **Dependencies inward** — Outer layers depend on inner, never reverse
5. **Tests mock adapters** — Domain and use cases tested in isolation

---

**ARCHITECTURE — Hexagonal, Ports & Adapters, Clean Core, Swappable Integrations**

---

## Hexagonal Standard v1 (2026-02-28)

### Purpose
This standard defines the non-negotiable architecture rules for Handshake so production evolution does not regress into monolithic or duplicated logic.

### Layer Boundaries

#### 1) Domain (`src/domain/**`)
- Owns: entities, value objects, domain rules, deterministic decisions, state transitions, domain events.
- Must NOT: import adapters, runtime bindings, or infrastructure SDKs.
- Must NOT: perform direct persistence, transport, or provider calls.

#### 2) Ports (`src/ports/**`)
- Owns: contracts/interfaces and domain-facing types.
- Must NOT: contain implementation logic.

#### 3) Adapters (`src/adapters/**`)
- Owns: concrete implementations of ports (D1/KV/Vault/etc), serialization, provider-specific concerns.
- Must NOT: encode core business policy or workflow branching.

#### 4) Use Cases (`src/use-cases/**`)
- Owns: orchestration of domain + ports for executable application flows.
- Must NOT: duplicate domain business rules.

#### 5) Entry/Wiring (`src/index.ts`)
- Owns: transport mapping, request parsing, dependency assembly, response formatting.
- Must NOT: contain business decisions.

### Dependency Rule (Hard)
Allowed direction only:
`entry/use-cases -> domain + ports <- adapters`

Forbidden:
- domain -> adapters
- domain -> index/runtime env bindings
- ports -> adapters

### Single-Purpose File Rule
Each file must have one reason to change.
If a file mixes decision logic, state mutation, persistence orchestration, and observability projection, it must be split.

### Canonical Semantic Contracts (Shared)
- Decision outcomes: `allow | deny | escalate`
- Terminal immutability semantics
- Versioned reason-code registry
- Artifact-gate semantics for privileged execution

No workflow-specific semantic forks are allowed unless explicitly versioned and approved.

### Event + Projection Pattern
Domain and use-cases should emit canonical events.
Audit/lineage/metrics are projections through adapters/services, not ad hoc inline branching logic.

### Production Invariants
1. No privileged side effect without artifact-gate authorization.
2. Timeout and uncertainty fail closed.
3. Unknown reason codes and unknown terminal states fail closed.
4. Terminal states are immutable.
5. External boundaries are idempotent.

### Transitional Code Policy
- Compatibility fallback paths must have explicit removal tasks and target milestone.
- No indefinite dual rails.

### Enforcement Gates (CI/Review)
1. Import boundary checks for layer violations.
2. Reason-code registry lock checks.
3. Privileged-path gate tests mandatory.
4. File complexity/size guard for orchestration hotspots.
5. Architecture review required for any new port introduction.

### Refactor Pass Model
- Pass 1: Full map (Pass / Drift / Violation)
- Pass 2: Critical priority triage (must fix)
- Pass 3: High priority triage
- Pass 4: Medium priority triage
- Pass 5: Low priority / cleanup

