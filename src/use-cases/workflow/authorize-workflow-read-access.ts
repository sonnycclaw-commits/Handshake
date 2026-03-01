export type WorkflowReadIdentity = {
  principalId: string
  scopes?: string[]
  tenantId?: string
}

export type WorkflowReadRecord = {
  principalId: string
  tenantId?: string
}

export function authorizeWorkflowReadAccess(input: {
  identity: WorkflowReadIdentity
  record: WorkflowReadRecord
}): { allowed: true } | { allowed: false; reasonCode: 'security_read_scope_denied' | 'security_read_tenant_mismatch' } {
  const scopes = Array.isArray(input.identity.scopes) ? input.identity.scopes : []

  if (input.identity.tenantId && input.record.tenantId && input.identity.tenantId !== input.record.tenantId) {
    return { allowed: false, reasonCode: 'security_read_tenant_mismatch' }
  }

  if (input.identity.principalId === input.record.principalId) {
    return { allowed: true }
  }

  if (scopes.includes('workflow:read:any')) {
    return { allowed: true }
  }

  return { allowed: false, reasonCode: 'security_read_scope_denied' }
}
