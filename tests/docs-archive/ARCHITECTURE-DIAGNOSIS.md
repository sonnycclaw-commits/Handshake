## Diagnosis

The test/implementation misalignment reveals a deeper architectural concern: validation responsibilities are split incorrectly across layers, creating both security and testing challenges.

Root cause analysis:
1. **Constructor Validation vs Service Validation**: The Manifest entity performs aggressive validation in its constructor, while tests expect validation at the service layer (signManifest). This creates a temporal coupling issue where validation exceptions can occur at different points than expected.

2. **Defensive vs Offensive Posture**: The current implementation takes a defensive posture (validate early in constructor) while the test suite assumes an offensive posture (validate at service boundaries). This misalignment is actually good for security but needs proper architectural expression.

3. **Layer Boundary Confusion**: The Manifest entity is enforcing business rules (MAX_CREDENTIALS) that arguably belong in the domain service layer, while the service is re-implementing some of the same validations.

## Architectural Recommendation

1. **Keep Constructor Validation, Add Service Pre-conditions**
   - Manifest constructor should continue validating structural integrity (proper types, formats, non-null)
   - signManifest service should validate business rules (size limits, policy checks) before construction
   - Tests should expect both layers of validation

2. **Clarify Layer Responsibilities**
   - Entity Layer: Structural integrity, invariant preservation
   - Service Layer: Business rules, policy enforcement
   - Separate MAX_CREDENTIALS into a domain policy object

3. **Implement Defense in Depth Pattern**
   ```typescript
   // Domain Policy (new)
   export class ManifestPolicy {
     static readonly MAX_CREDENTIALS = 100
     
     static validateForSigning(manifest: Manifest): void {
       if (manifest.credentials.length > this.MAX_CREDENTIALS) {
         throw new ManifestPolicyError('Exceeds maximum credential limit')
       }
       // Other business rules
     }
   }

   // Service Layer
   export const signManifest = async (manifest: Manifest, key: KeyLike): Promise<SignedManifest> => {
     // 1. Policy validation first
     ManifestPolicy.validateForSigning(manifest)
     
     // 2. Proceed with signing
     // ... rest of implementation
   }
   ```

## Security Implications

The current implementation is actually MORE secure than the tests expect, not less. This is good, but needs proper architectural expression.

Security benefits to preserve:
1. **Early Validation**: Constructor validation prevents invalid objects from existing
2. **Defense in Depth**: Multiple validation layers catch different types of issues
3. **Immutability**: Current approach enforces immutable manifests post-construction

Risks of changing:
1. **Temporal Attack Window**: Moving ALL validation to service layer would create a window between construction and validation
2. **Object Invariant Violations**: Relaxing constructor validation could allow invalid states
3. **Replay/Mutation Attacks**: Need to ensure immutability guarantees remain

## Concrete Actions

1. **Refactor Tests** (Immediate)
   ```typescript
   describe('Manifest Validation', () => {
     it('rejects invalid manifests at construction', () => {
       expect(() => new Manifest(...invalid)).toThrow()
     })

     it('rejects oversized manifests at signing', async () => {
       const manifest = new Manifest(...valid)
       await expect(signManifest(manifest, key))
         .rejects.toThrow(ManifestPolicyError)
     })
   })
   ```

2. **Extract Domain Policy** (This Week)
   - Create ManifestPolicy class
   - Move business rules from entity to policy
   - Update service layer to use policy checks

3. **Update Documentation** (This Week)
   - Document validation layers in ARCHITECTURE.md
   - Add security rationale for defense-in-depth
   - Update SDK docs to clarify validation expectations

4. **Security Review** (Next Sprint)
   - Audit all validation points
   - Verify no temporal attack windows
   - Test immutability guarantees
   - Document security properties in code

The goal is not to relax security but to express it more clearly in the architecture while maintaining the current strong guarantees.