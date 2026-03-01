export type ResponseClass = 'ok' | 'retryable' | 'blocked' | 'unknown'

export type HandshakeErrorShape = {
  status?: string
  error?: string
  reasonCode?: string
  responseClass?: ResponseClass
  message?: string
}

export class HandshakeApiError extends Error {
  public reasonCode: string
  public responseClass: ResponseClass
  public retryable: boolean
  public statusCode: number

  constructor(message: string, opts: {
    reasonCode: string
    responseClass: ResponseClass
    retryable: boolean
    statusCode: number
  }) {
    super(message)
    this.name = 'HandshakeApiError'
    this.reasonCode = opts.reasonCode
    this.responseClass = opts.responseClass
    this.retryable = opts.retryable
    this.statusCode = opts.statusCode
  }
}

export function inferRetryable(reasonCode: string, statusCode: number, responseClass: ResponseClass): boolean {
  if (responseClass === 'retryable') return true
  if (responseClass === 'ok' || responseClass === 'blocked') return false
  if (statusCode >= 500) return true
  if (reasonCode.startsWith('adapter_')) return true
  return false
}

export function toHandshakeApiError(statusCode: number, body: HandshakeErrorShape): HandshakeApiError {
  const reasonCode = body.reasonCode ?? body.error ?? 'unknown_error'
  const responseClass: ResponseClass = body.responseClass ?? 'unknown'
  const message = body.message ?? body.error ?? 'Handshake API request failed'

  return new HandshakeApiError(message, {
    reasonCode,
    responseClass,
    retryable: inferRetryable(reasonCode, statusCode, responseClass),
    statusCode,
  })
}
