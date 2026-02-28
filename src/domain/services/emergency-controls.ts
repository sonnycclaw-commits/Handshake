type EmergencyMode = 'global_deny' | 'scoped_quarantine'

type ActivateEmergencyControlInput = {
  mode: EmergencyMode
  reason: string
  scope?: {
    principalId?: string
    agentId?: string
  }
}

export type EmergencyControlState = {
  active: boolean
  mode: EmergencyMode
  reason: string
  scope?: {
    principalId?: string
    agentId?: string
  }
  activatedAt: number
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function activateEmergencyControl(input: ActivateEmergencyControlInput): EmergencyControlState {
  if (!input || typeof input !== 'object') {
    throw new Error('invalid_input: object required')
  }

  if (input.mode !== 'global_deny' && input.mode !== 'scoped_quarantine') {
    throw new Error('invalid_input: mode must be global_deny|scoped_quarantine')
  }

  if (!isNonEmptyString(input.reason)) {
    throw new Error('invalid_input: reason is required')
  }

  if (input.mode === 'scoped_quarantine') {
    const scope = input.scope
    const hasPrincipal = isNonEmptyString(scope?.principalId)
    const hasAgent = isNonEmptyString(scope?.agentId)
    if (!hasPrincipal && !hasAgent) {
      throw new Error('invalid_input: scoped_quarantine requires principalId or agentId')
    }
  }

  return {
    active: true,
    mode: input.mode,
    reason: input.reason.trim(),
    ...(input.scope ? { scope: input.scope } : {}),
    activatedAt: Date.now()
  }
}
