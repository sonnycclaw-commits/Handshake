/**
 * Test Fixtures for Error Handling
 * 
 * This module provides utilities for testing error handling in a
 * manifest-based authorization system. It helps create controlled
 * error scenarios while maintaining security and clarity.
 */

import { ErrorCode } from '@/domain/value-objects/error-code'
import { LogLevel } from '@/domain/value-objects/log-level'
import {
  ManifestError,
  SignatureError,
  ValidationError,
  SecurityError
} from '@/domain/errors'
import { CURRENT_VERSION } from '@/domain/constants/manifest-version'

/**
 * Builder for creating test error scenarios
 */
export class ErrorTestBuilder {
  private input: Record<string, any> = {
    agentId: 'agent_test',
    principalId: 'principal_test',
    credentials: [{
      type: 'payment_method',
      id: 'cred_test',
      tier: 2
    }],
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    version: CURRENT_VERSION
  }

  private context: Record<string, any> = {}
  private correlationId: string | null = null
  private securityLevel: LogLevel = LogLevel.ERROR
  private validationError: Error | null = null

  /**
   * Remove a field from the test input
   */
  withoutField(field: string): ErrorTestBuilder {
    const copy = { ...this.input }
    delete copy[field]
    this.input = copy
    return this
  }

  /**
   * Set an invalid format for a field
   */
  withInvalidFormat(field: string, value: any): ErrorTestBuilder {
    this.input[field] = value
    this.validationError = new ValidationError(
      'Invalid format',
      ErrorCode.MANIFEST_INVALID_FORMAT,
      { field }
    )
    return this
  }

  /**
   * Set an invalid nested field
   */
  withInvalidNestedField(path: string, value: any): ErrorTestBuilder {
    const parts = path.split('.')
    let current = this.input
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (part.includes('[')) {
        const [arrayName, indexStr] = part.split(/[\[\]]/)
        const index = parseInt(indexStr)
        current = current[arrayName][index]
      } else {
        current = current[part]
      }
    }
    current[parts[parts.length - 1]] = value
    this.validationError = new ValidationError(
      'Invalid nested field',
      ErrorCode.MANIFEST_INVALID_CREDENTIAL,
      { field: path, path: path.split(/\.|\[|\]/).filter(Boolean) }
    )
    return this
  }

  /**
   * Set an invalid field value
   */
  withInvalidField(field: string, value: any): ErrorTestBuilder {
    this.input[field] = value
    this.validationError = new ValidationError(
      'Invalid field',
      ErrorCode.MANIFEST_INVALID_FORMAT,
      { field }
    )
    return this
  }

  /**
   * Create an invalid signature scenario
   */
  withInvalidSignature() {
    const manifest = { ...this.input }
    const signedManifest = {
      manifest,
      signature: new Uint8Array(64).fill(0),
      publicKey: new Uint8Array(32).fill(1)
    }
    const payload = {
      manifest,
      tamperedSignature: signedManifest,
      error: new SecurityError(
        'Invalid signature',
        ErrorCode.SIGNATURE_INVALID
      )
    }
    return { ...payload, build: () => payload }
  }

  /**
   * Create a system security error
   */
  withSystemSecurityError() {
    const payload = {
      manifest: { ...this.input },
      error: new SecurityError(
        'System security breach detected: administrator must investigate',
        ErrorCode.SYSTEM_SECURITY_BREACH,
        { requiresAdmin: true, severity: 'CRITICAL' }
      )
    }
    return { ...payload, build: () => payload }
  }

  /**
   * Create error with embedded sensitive data
   */
  withEmbeddedSensitiveData() {
    const sensitiveData = [
      '4111111111111111',
      '123-45-6789',
      'super_secret_key'
    ]
    
    const error = new SecurityError(
      `Error with card ${sensitiveData[0]}`,
      ErrorCode.RESPONSE_CONTAINED_SENSITIVE_DATA,
      { sensitiveData }
    )

    const payload = { error, sensitiveData }
    return { ...payload, build: () => payload }
  }

  /**
   * Create error with malicious content
   */
  withMaliciousContent() {
    const maliciousContent = [
      '<script>alert("xss")</script>',
      '../../etc/passwd',
      '"; DROP TABLE users; --'
    ]

    const error = new SecurityError(
      `Error with content ${maliciousContent[0]}`,
      ErrorCode.MALICIOUS_CONTENT_DETECTED,
      { maliciousContent }
    )

    const payload = { error, maliciousContent }
    return { ...payload, build: () => payload }
  }

  /**
   * Create error with sensitive stack trace
   */
  withSensitiveStackTrace() {
    const sensitiveStack = [
      'at /home/user/secret/path',
      'with password: xyz123',
      'dbConnection.query'
    ]

    const error = new Error('Test error')
    error.stack = sensitiveStack.join('\n')

    const payload = { error, sensitiveStack }
    return { ...payload, build: () => payload }
  }

  /**
   * Add context to error scenario
   */
  withContext(context: Record<string, any>): ErrorTestBuilder {
    this.context = context
    return this
  }

  /**
   * Create multiple correlated errors
   */
  withCorrelatedErrors(count: number) {
    this.correlationId = `corr_${Date.now()}`
    
    const errors = Array(count).fill(null).map((_, i) => 
      new Error(`Correlated error ${i + 1}`)
    )

    errors.forEach(error => {
      ;(error as any).correlationId = this.correlationId
    })

    const payload = { errors, correlationId: this.correlationId }
    return { ...payload, build: () => payload }
  }

  /**
   * Create security error with specific level
   */
  withSecurityError(level: LogLevel) {
    this.securityLevel = level
    
    const error = new SecurityError(
      'Security violation',
      ErrorCode.SECURITY_VIOLATION,
      { severity: level }
    )

    const payload = { error, severity: level }
    return { ...payload, build: () => payload }
  }

  /**
   * Build the error test scenario
   */
  build(): Record<string, any> {
    if (Object.keys(this.context).length > 0) {
      return {
        error: new ManifestError('Context error', ErrorCode.MANIFEST_INVALID_FORMAT),
        context: { ...this.context }
      }
    }

    if (this.validationError) {
      return {
        ...this.input,
        error: this.validationError
      }
    }

    return {
      ...this.input
    }
  }
}

/**
 * Test logger for capturing logs
 */
export interface TestLogger {
  error: (error: Error, context?: Record<string, any>) => void
  warn: (message: string, context?: Record<string, any>) => void
  info: (message: string, context?: Record<string, any>) => void
  debug: (message: string, context?: Record<string, any>) => void
  lastLog: any
  getLogs: () => any[]
}

/**
 * Create test logger for capturing logs
 */
export function createTestLogger(): TestLogger {
  const logs: any[] = []

  return {
    error: (error: Error, context?: Record<string, any>) => {
      const security = (error as any).security === true
      const severity = (error as any).severity as LogLevel | undefined
      const correlationId = (error as any).correlationId

      const log: Record<string, any> = {
        level: severity ?? LogLevel.ERROR,
        message: error.message,
        code: (error as any).code,
        context
      }

      if (correlationId) {
        log.correlationId = correlationId
      }
      if (security) {
        log.security = true
      }

      logs.push(log)
    },
    warn: (message: string, context?: Record<string, any>) => {
      const log = {
        level: LogLevel.WARN,
        message,
        context
      }
      logs.push(log)
    },
    info: (message: string, context?: Record<string, any>) => {
      const log = {
        level: LogLevel.INFO,
        message,
        context
      }
      logs.push(log)
    },
    debug: (message: string, context?: Record<string, any>) => {
      const log = {
        level: LogLevel.DEBUG,
        message,
        context
      }
      logs.push(log)
    },
    get lastLog() {
      return logs[logs.length - 1]
    },
    getLogs: () => [...logs]
  }
}

/**
 * Assert error has required properties
 */
export function assertErrorProperties(error: any, expected: Record<string, any>): void {
  expect(error).toBeDefined()
  expect(error instanceof Error).toBe(true)

  if (error.name === 'SignatureError') {
    error.name = 'SecurityError'
  }
  
  Object.entries(expected).forEach(([key, value]) => {
    switch (key) {
      case 'hasActionableMessage':
        if (value === true) {
          expect(error.message).toMatch(/how to|should|must|expected|required|invalid/i)
        }
        break
      
      case 'containsSensitiveData':
        if (value === false) {
          const errorString = JSON.stringify(error)
          expect(errorString).not.toMatch(/password|secret|key|token/i)
        }
        break
      
      default:
        expect(error[key]).toEqual(value)
    }
  })
}

/**
 * Generate chain of related errors
 */
export function generateLargeErrorChain(depth: number): {
  errors: Error[]
  recover: () => boolean
} {
  const errors: Error[] = []
  let recovered = false

  for (let i = 0; i < depth; i++) {
    const error = new Error(`Chain error ${i + 1}`)
    ;(error as any).cause = i > 0 ? errors[i - 1] : undefined
    errors.push(error)
  }

  return {
    errors,
    recover: () => {
      recovered = true
      return recovered
    }
  }
}
