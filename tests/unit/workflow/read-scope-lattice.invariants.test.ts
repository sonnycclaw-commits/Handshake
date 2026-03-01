import { describe, it, expect } from 'vitest'
import { authorizeWorkflowReadAccess } from '@/use-cases/workflow/authorize-workflow-read-access'

describe('W4-D3 invariant: read-scope lattice monotonicity', () => {
  const record = { principalId: 'owner-1', tenantId: 'tenant-a' }

  function allowed(identity: { principalId: string; tenantId?: string; roles?: string[]; scopes?: string[] }) {
    return authorizeWorkflowReadAccess({ identity, record }).allowed
  }

  it('self baseline: no-scope self access remains allowed', () => {
    expect(allowed({ principalId: 'owner-1', tenantId: 'tenant-a' })).toBe(true)
  })

  it('scope lattice monotonicity for non-admin cross-principal same-tenant', () => {
    const principal = 'ops-1'
    const base = allowed({ principalId: principal, tenantId: 'tenant-a', roles: ['operator'], scopes: [] })
    const self = allowed({ principalId: principal, tenantId: 'tenant-a', roles: ['operator'], scopes: ['workflow:read:self'] })
    const tenant = allowed({ principalId: principal, tenantId: 'tenant-a', roles: ['operator'], scopes: ['workflow:read:tenant'] })
    const anyNonAdmin = allowed({ principalId: principal, tenantId: 'tenant-a', roles: ['operator'], scopes: ['workflow:read:any'] })

    // base and self should be denied; tenant + any(non-admin compatibility) allowed in same tenant
    expect(base).toBe(false)
    expect(self).toBe(false)
    expect(tenant).toBe(true)
    expect(anyNonAdmin).toBe(true)

    // monotonicity: self cannot exceed tenant/any
    expect(Number(self)).toBeLessThanOrEqual(Number(tenant))
    expect(Number(tenant)).toBeLessThanOrEqual(Number(anyNonAdmin))
  })

  it('admin any is maximal and allows cross-tenant', () => {
    const adminAny = allowed({ principalId: 'admin-1', tenantId: 'tenant-b', roles: ['admin'], scopes: ['workflow:read:any'] })
    const tenantScope = allowed({ principalId: 'admin-1', tenantId: 'tenant-b', roles: ['admin'], scopes: ['workflow:read:tenant'] })
    expect(adminAny).toBe(true)
    expect(tenantScope).toBe(false)
  })
})
