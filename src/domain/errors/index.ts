import { ErrorCode } from '../value-objects/error-code'

export interface ErrorMetadata {
  field?: string
  expectedFormat?: string
  path?: string[]
  requiresAdmin?: boolean
  severity?: string
  [key: string]: any
}

class BaseDomainError extends Error {
  public readonly code: ErrorCode
  public readonly field?: string
  public readonly expectedFormat?: string
  public readonly path?: string[]
  public readonly requiresAdmin?: boolean
  public readonly severity?: string
  public readonly correlationId?: string
  public security?: boolean

  constructor(name: string, message: string, code: ErrorCode, metadata: ErrorMetadata = {}) {
    super(message)
    this.name = name
    this.code = code
    Object.assign(this, metadata)
  }
}

export class ValidationError extends BaseDomainError {
  constructor(message: string, code: ErrorCode, metadata: ErrorMetadata = {}) {
    super('ValidationError', message, code, metadata)
  }
}

export class SignatureError extends BaseDomainError {
  constructor(message: string, code: ErrorCode, metadata: ErrorMetadata = {}) {
    super('SignatureError', message, code, metadata)
    this.security = true
  }
}

export class SecurityError extends BaseDomainError {
  constructor(message: string, code: ErrorCode, metadata: ErrorMetadata = {}) {
    super('SecurityError', message, code, metadata)
    this.security = true
  }
}

export class ManifestError extends BaseDomainError {
  constructor(message: string, code: ErrorCode, metadata: ErrorMetadata = {}) {
    super('ManifestError', message, code, metadata)
  }
}

export { ErrorCode }
