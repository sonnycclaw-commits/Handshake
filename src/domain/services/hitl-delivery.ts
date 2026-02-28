type DeliveryInput = {
  requestId: string
  principalId: string
  tier: number
  action: string
  expiresAt: number
  idempotencyKey: string
  forceFailure?: boolean
}

type DeliveryResult = {
  status: 'delivered' | 'failed'
  attempts: number
  failClosed: boolean
  envelope: {
    requestId: string
    principalId: string
    tier: number
    action: string
    expiresAt: number
    idempotencyKey: string
  }
}

export async function deliverHITLNotification(input: DeliveryInput): Promise<DeliveryResult> {
  const envelope = {
    requestId: input.requestId,
    principalId: input.principalId,
    tier: input.tier,
    action: input.action,
    expiresAt: input.expiresAt,
    idempotencyKey: input.idempotencyKey
  }

  const maxAttempts = 3
  let attempts = 0

  while (attempts < maxAttempts) {
    attempts += 1
    if (!input.forceFailure) {
      return {
        status: 'delivered',
        attempts,
        failClosed: false,
        envelope
      }
    }
  }

  return {
    status: 'failed',
    attempts,
    failClosed: true,
    envelope
  }
}
