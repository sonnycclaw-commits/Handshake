export type GovernanceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'GOVERNANCE_TRANSACTION_FAILED'

const codePrefix: Record<GovernanceErrorCode, string> = {
  INVALID_INPUT: 'invalid_input',
  NOT_FOUND: 'not_found',
  FORBIDDEN: 'forbidden',
  GOVERNANCE_TRANSACTION_FAILED: 'governance_transaction_failed'
}

export class GovernanceError extends Error {
  readonly code: GovernanceErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: GovernanceErrorCode, message: string, details?: Record<string, unknown>) {
    super(`${codePrefix[code]}: ${message}`)
    this.name = 'GovernanceError'
    this.code = code
    this.details = details
  }
}

export function isGovernanceError(err: unknown): err is GovernanceError {
  return err instanceof GovernanceError
}

export function invalidInput(message: string, details?: Record<string, unknown>): GovernanceError {
  return new GovernanceError('INVALID_INPUT', message, details)
}

export function notFound(message: string, details?: Record<string, unknown>): GovernanceError {
  return new GovernanceError('NOT_FOUND', message, details)
}

export function forbidden(message: string, details?: Record<string, unknown>): GovernanceError {
  return new GovernanceError('FORBIDDEN', message, details)
}

export function governanceTransactionFailed(
  message: string,
  details?: Record<string, unknown>
): GovernanceError {
  return new GovernanceError('GOVERNANCE_TRANSACTION_FAILED', message, details)
}
