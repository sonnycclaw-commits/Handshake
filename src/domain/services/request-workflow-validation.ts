import type { RequestInput } from './request-workflow-types'
import { MAX_CLOCK_SKEW_MS } from './request-workflow-types'

export function validateInput(input: RequestInput, nowMs: () => number): string | null {
  if (!input || typeof input !== 'object') return 'trust_context_invalid_request_shape'
  if (!input.requestId || !input.agentId || !input.principalId) return 'trust_context_missing_binding'
  if (!input.actionType || !input.payloadRef) return 'trust_context_invalid_request_shape'
  if (!Number.isFinite(input.timestamp)) return 'trust_context_invalid_timestamp'

  const delta = Math.abs(nowMs() - input.timestamp)
  if (delta > MAX_CLOCK_SKEW_MS) return 'trust_context_timestamp_skew_fail_closed'

  if (!input.privilegedPath) return 'security_handshake_required_bypass_denied'
  if (input.context && (input.context['sideChannelAttempt'] === true || input.context['directAdapterCall'] === true)) return 'security_side_channel_denied'
  return null
}
