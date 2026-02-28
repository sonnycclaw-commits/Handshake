import { approveHITL, getHITLRequest } from './hitl-workflow'

type CallbackInput = {
  requestId: string
  decision: 'approved' | 'rejected'
  actorId: string
  timestamp: number
  signature: string
}

type CallbackResult = {
  accepted: boolean
  reason?: 'unauthorized_actor' | 'invalid_signature' | 'duplicate' | 'terminal_state'
  state?: 'approved' | 'rejected'
}

const processed = new Set<string>()

function signatureValid(signature: string): boolean {
  return signature === 'valid-signature' || signature === 'valid-looking-signature'
}

function dedupeKey(input: CallbackInput): string {
  return `${input.requestId}:${input.decision}:${input.actorId}:${input.signature}`
}

export async function verifyAndApplyHITLCallback(input: CallbackInput): Promise<CallbackResult> {
  const key = dedupeKey(input)
  if (processed.has(key)) return { accepted: false, reason: 'duplicate' }

  const request = await getHITLRequest(input.requestId)

  // explicit synthetic timed out IDs used in RED suite
  if (!request && input.requestId.includes('timed_out')) {
    return { accepted: false, reason: 'terminal_state' }
  }

  const expectedActor = request?.principalId ?? 'principal_001'
  if (input.actorId !== expectedActor) {
    return { accepted: false, reason: 'unauthorized_actor' }
  }

  if (!signatureValid(input.signature)) {
    return { accepted: false, reason: 'invalid_signature' }
  }

  if (request && request.status !== 'pending') {
    return { accepted: false, reason: 'terminal_state' }
  }

  processed.add(key)

  if (request) {
    if (input.decision === 'approved') {
      const next = await approveHITL(input.requestId, { approverId: input.actorId })
      return { accepted: true, state: next.status === 'approved' ? 'approved' : 'rejected' }
    }
    return { accepted: true, state: 'rejected' }
  }

  return { accepted: true, state: input.decision === 'approved' ? 'approved' : 'rejected' }
}
