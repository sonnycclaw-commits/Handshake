export type WorkflowReadIdentity = {
  principalId: string
  roles?: string[]
  scopes?: string[]
  tenantId?: string
}

export type WorkflowReadRecord = {
  principalId: string
  tenantId?: string
}

export type WorkflowReadDenyReason =
  | 'security_read_scope_denied'
  | 'security_read_tenant_mismatch'

export function authorizeWorkflowReadAccess(input: {
  identity: WorkflowReadIdentity
  record: WorkflowReadRecord
}): { allowed: true } | { allowed: false; reasonCode: WorkflowReadDenyReason } {
  const scopes = new Set(Array.isArray(input.identity.scopes) ? input.identity.scopes : [])
  const roles = new Set(Array.isArray(input.identity.roles) ? input.identity.roles : [])

  // Self path (no explicit scope required)
  if (input.identity.principalId === input.record.principalId) {
    return { allowed: true }
  }

  // Explicit self scope cannot elevate cross-principal reads
  if (scopes.has('workflow:read:self') && input.identity.principalId === input.record.principalId) {
    return { allowed: true }
  }

  // Global read: admin can read across tenants
  if (scopes.has('workflow:read:any') && roles.has('admin')) {
    return { allowed: true }
  }

  // Tenant-scoped rail (explicit tenant scope or non-admin backward-compat any)
  if (scopes.has('workflow:read:tenant') || scopes.has('workflow:read:any')) {
    if (input.identity.tenantId && input.record.tenantId && input.identity.tenantId === input.record.tenantId) {
      return { allowed: true }
    }
    return { allowed: false, reasonCode: 'security_read_tenant_mismatch' }
  }

  return { allowed: false, reasonCode: 'security_read_scope_denied' }
}
