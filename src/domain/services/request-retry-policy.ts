export type RetryDecision = 'retry_immediate' | 'retry_with_backoff' | 'retry_after_remediation' | 'do_not_retry'

export interface RetryPolicy {
  decision: RetryDecision
  maxRetries: number
  requiresHumanAction: boolean
  notes: string
}

function startsWithAny(reasonCode: string, prefixes: string[]): boolean {
  return prefixes.some((p) => reasonCode.startsWith(p))
}

/**
 * Deterministic retry policy for agent runtimes.
 * - This policy is intentionally conservative on security and terminal states.
 * - Unknown reason codes fail closed to do_not_retry.
 */
export function getRetryPolicyForReason(reasonCode: string): RetryPolicy {
  const code = String(reasonCode || '').trim().toLowerCase()

  if (!code) {
    return {
      decision: 'do_not_retry',
      maxRetries: 0,
      requiresHumanAction: true,
      notes: 'Empty reason code is treated as unsafe/unknown.'
    }
  }

  if (startsWithAny(code, ['security_', 'hitl_terminal_state_', 'revoked_'])) {
    return {
      decision: 'do_not_retry',
      maxRetries: 0,
      requiresHumanAction: true,
      notes: 'Security or terminal control condition. Automatic retry is forbidden.'
    }
  }

  if (startsWithAny(code, ['trust_context_', 'policy_not_selected', 'missing_principal_binding'])) {
    return {
      decision: 'retry_after_remediation',
      maxRetries: 1,
      requiresHumanAction: true,
      notes: 'Retry only after setup/binding remediation completes.'
    }
  }

  if (startsWithAny(code, ['policy_', 'out_of_policy', 'disallowed_'])) {
    return {
      decision: 'retry_after_remediation',
      maxRetries: 1,
      requiresHumanAction: true,
      notes: 'Policy-bound denial. Retry unchanged request is disallowed.'
    }
  }

  if (startsWithAny(code, ['hitl_timeout_', 'hitl_rejected', 'hitl_'])) {
    return {
      decision: 'retry_after_remediation',
      maxRetries: 1,
      requiresHumanAction: true,
      notes: 'HITL-mediated decision requires renewed approval context.'
    }
  }

  if (startsWithAny(code, ['adapter_', 'provider_', 'network_'])) {
    return {
      decision: 'retry_with_backoff',
      maxRetries: 3,
      requiresHumanAction: false,
      notes: 'Transient infrastructure/provider condition. Use bounded backoff.'
    }
  }

  if (startsWithAny(code, ['rate_limit_', 'throttle_'])) {
    return {
      decision: 'retry_with_backoff',
      maxRetries: 2,
      requiresHumanAction: false,
      notes: 'Backoff required to avoid saturation.'
    }
  }

  return {
    decision: 'do_not_retry',
    maxRetries: 0,
    requiresHumanAction: true,
    notes: 'Unknown reason code class. Fail closed.'
  }
}
