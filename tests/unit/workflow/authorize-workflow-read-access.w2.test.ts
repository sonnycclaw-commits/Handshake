import { describe, it, expect } from 'vitest'
import { authorizeWorkflowReadAccess } from '@/use-cases/workflow/authorize-workflow-read-access'

describe('W2 scope hierarchy — authorizeWorkflowReadAccess', () => {
  const record = { principalId: 'owner-1', tenantId: 'tenant-a' }

  it('allows self reads without scope', () => {
    const res = authorizeWorkflowReadAccess({
      identity: { principalId: 'owner-1', tenantId: 'tenant-a' },
      record,
    })
    expect(res).toEqual({ allowed: true })
  })

  it('denies cross-principal when only self scope present', () => {
    const res = authorizeWorkflowReadAccess({
      identity: { principalId: 'other-1', tenantId: 'tenant-a', scopes: ['workflow:read:self'] },
      record,
    })
    expect(res).toEqual({ allowed: false, reasonCode: 'security_read_scope_denied' })
  })

  it('allows tenant scope read for same tenant', () => {
    const res = authorizeWorkflowReadAccess({
      identity: { principalId: 'ops-1', tenantId: 'tenant-a', scopes: ['workflow:read:tenant'] },
      record,
    })
    expect(res).toEqual({ allowed: true })
  })

  it('denies tenant scope read for tenant mismatch', () => {
    const res = authorizeWorkflowReadAccess({
      identity: { principalId: 'ops-1', tenantId: 'tenant-b', scopes: ['workflow:read:tenant'] },
      record,
    })
    expect(res).toEqual({ allowed: false, reasonCode: 'security_read_tenant_mismatch' })
  })

  it('allows any scope for admin cross-tenant', () => {
    const res = authorizeWorkflowReadAccess({
      identity: { principalId: 'admin-1', tenantId: 'tenant-b', roles: ['admin'], scopes: ['workflow:read:any'] },
      record,
    })
    expect(res).toEqual({ allowed: true })
  })

  it('treats non-admin any scope as tenant-scoped (backward-compat tightening)', () => {
    const sameTenant = authorizeWorkflowReadAccess({
      identity: { principalId: 'ops-1', tenantId: 'tenant-a', roles: ['operator'], scopes: ['workflow:read:any'] },
      record,
    })
    expect(sameTenant).toEqual({ allowed: true })

    const crossTenant = authorizeWorkflowReadAccess({
      identity: { principalId: 'ops-1', tenantId: 'tenant-b', roles: ['operator'], scopes: ['workflow:read:any'] },
      record,
    })
    expect(crossTenant).toEqual({ allowed: false, reasonCode: 'security_read_tenant_mismatch' })
  })
})
