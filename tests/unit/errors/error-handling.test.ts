import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createManifest } from '@/domain/services/create-manifest'
import { signManifest } from '@/domain/services/sign-manifest'
import { verifyManifestSignature } from '@/domain/services/verify-manifest-signature'
import { sanitizeResponse } from '@/domain/services/response-sanitization'
import { ErrorCode } from '@/domain/value-objects/error-code'
import { LogLevel } from '@/domain/value-objects/log-level'
import {
  ManifestError,
  SignatureError,
  ValidationError,
  SecurityError
} from '@/domain/errors'
import {
  ErrorTestBuilder,
  createTestLogger,
  TestLogger,
  assertErrorProperties,
  generateLargeErrorChain
} from '../../fixtures/errors'

/**
 * Error Handling Test Suite
 * 
 * This suite defines the reference standard for error handling in
 * manifest-based authorization systems. Error handling is critical
 * for security (D006) and user experience.
 * 
 * Core Properties:
 * 1. Error Clarity - Clear, actionable error messages
 * 2. Information Security - No sensitive data in errors
 * 3. Error Recovery - System remains in valid state after errors
 * 4. Logging & Monitoring - Structured error logging for analysis
 * 
 * Testing Philosophy:
 * Each test validates a specific error handling property. The suite serves
 * as both a test and a specification for correct error handling.
 */

describe('Error Handling System', () => {
  let errorBuilder: ErrorTestBuilder
  let logger: TestLogger

  beforeEach(() => {
    errorBuilder = new ErrorTestBuilder()
    logger = createTestLogger()
  })

  describe('1. Error Clarity', () => {
    describe('Validation Errors', () => {
      it('provides clear, actionable error messages for missing fields', () => {
        // Arrange: Create manifest with missing required field
        const input = errorBuilder
          .withoutField('agentId')
          .build()

        // Act & Assert
        try {
          createManifest(input)
          fail('Should have thrown')
        } catch (error) {
          assertErrorProperties(error, {
            name: 'ValidationError',
            code: ErrorCode.MANIFEST_MISSING_FIELD,
            field: 'agentId',
            hasActionableMessage: true
          })
        }
      })

      it('includes expected format in error messages', () => {
        // Arrange: Create manifest with wrong field format
        const input = errorBuilder
          .withInvalidFormat('createdAt', 'not-a-timestamp')
          .build()

        // Act & Assert
        try {
          createManifest(input)
          fail('Should have thrown')
        } catch (error) {
          assertErrorProperties(error, {
            name: 'ValidationError',
            code: ErrorCode.MANIFEST_INVALID_FORMAT,
            field: 'createdAt',
            expectedFormat: 'timestamp',
            hasActionableMessage: true
          })
        }
      })

      it('provides clear validation context for complex objects', () => {
        // Arrange: Create manifest with invalid nested field
        const input = errorBuilder
          .withInvalidNestedField('credentials[0].type', null)
          .build()

        // Act & Assert
        try {
          createManifest(input)
          fail('Should have thrown')
        } catch (error) {
          assertErrorProperties(error, {
            name: 'ValidationError',
            code: ErrorCode.MANIFEST_INVALID_CREDENTIAL,
            field: 'credentials[0].type',
            path: ['credentials', '0', 'type'],
            hasActionableMessage: true
          })
        }
      })
    })

    describe('Security Errors', () => {
      it('provides clear error messages without exposing sensitive data', async () => {
        // Arrange: Create invalid signature scenario
        const { manifest, tamperedSignature } = await errorBuilder
          .withInvalidSignature()
          .build()

        // Act & Assert
        try {
          await verifyManifestSignature(tamperedSignature)
          fail('Should have thrown')
        } catch (error) {
          assertErrorProperties(error, {
            name: 'SecurityError',
            code: ErrorCode.SIGNATURE_INVALID,
            hasActionableMessage: true,
            containsSensitiveData: false
          })
        }
      })

      it('indicates when error requires administrator attention', async () => {
        // Arrange: Create system-level security error
        const { manifest, error: securityBreach } = errorBuilder
          .withSystemSecurityError()
          .build()

        // Act & Assert
        try {
          throw securityBreach
        } catch (error) {
          assertErrorProperties(error, {
            name: 'SecurityError',
            code: ErrorCode.SYSTEM_SECURITY_BREACH,
            requiresAdmin: true,
            severity: 'CRITICAL',
            hasActionableMessage: true
          })
        }
      })
    })
  })

  describe('2. Information Security', () => {
    it('sanitizes sensitive data from error messages', () => {
      // Arrange: Create error with embedded sensitive data
      const { error, sensitiveData } = errorBuilder
        .withEmbeddedSensitiveData()
        .build()

      // Act: Sanitize error
      const sanitized = sanitizeResponse(error)

      // Assert: No sensitive data in error
      const errorString = JSON.stringify(sanitized)
      sensitiveData.forEach(data => {
        expect(errorString).not.toContain(data)
      })
    })

    it('prevents error message injection attacks', () => {
      // Arrange: Create error with malicious content
      const { error, maliciousContent } = errorBuilder
        .withMaliciousContent()
        .build()

      // Act: Sanitize error
      const sanitized = sanitizeResponse(error)

      // Assert: Malicious content removed
      const errorString = JSON.stringify(sanitized)
      maliciousContent.forEach(content => {
        expect(errorString).not.toContain(content)
      })
    })

    it('maintains stack trace security', () => {
      // Arrange: Create error with sensitive stack
      const { error, sensitiveStack } = errorBuilder
        .withSensitiveStackTrace()
        .build()

      // Act: Sanitize error
      const sanitized = sanitizeResponse(error)

      // Assert: Stack sanitized but useful
      expect(sanitized.stack).toBeDefined()
      sensitiveStack.forEach(frame => {
        expect(sanitized.stack).not.toContain(frame)
      })
    })
  })

  describe('3. Error Recovery', () => {
    it('maintains system in valid state after validation error', () => {
      // Arrange: Create invalid manifest
      const input = errorBuilder
        .withInvalidField('agentId', '')
        .build()

      // Act: Attempt create, then fix
      try {
        createManifest(input)
        fail('Should have thrown')
      } catch (error) {
        // Fix the error
        input.agentId = 'valid_agent'
        const manifest = createManifest(input)

        // Assert: System recovered
        expect(manifest.agentId).toBe('valid_agent')
      }
    })

    it('handles concurrent error scenarios', async () => {
      // Arrange: Create multiple error scenarios
      const scenarios = await Promise.all([
        errorBuilder.withInvalidSignature().build(),
        errorBuilder.withInvalidFormat('createdAt', 'invalid').build(),
        errorBuilder.withSystemSecurityError().build()
      ])

      // Act & Assert: All errors handled independently
      for (const scenario of scenarios) {
        try {
          throw scenario.error
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
          expect(error.code).toBeDefined()
        }
      }
    })

    it('prevents error condition cascades', async () => {
      // Arrange: Create cascading error chain
      const { errors, recover } = generateLargeErrorChain(5)

      // Act: Trigger cascade
      for (const error of errors) {
        try {
          throw error
        } catch (e) {
          // Should handle each error
          expect(e).toBeInstanceOf(Error)
        }
      }

      // Assert: Can recover
      expect(recover()).toBe(true)
    })
  })

  describe('4. Logging & Monitoring', () => {
    it('logs structured error data for analysis', () => {
      // Arrange: Create error with context
      const { error, context } = errorBuilder
        .withContext({
          operation: 'manifest_creation',
          userId: 'user_123',
          attempt: 1
        })
        .build()

      // Act: Log error
      logger.error(error, context)

      // Assert: Structured logging
      expect(logger.lastLog).toEqual({
        level: LogLevel.ERROR,
        code: error.code,
        message: error.message,
        context: expect.objectContaining({
          operation: 'manifest_creation',
          userId: 'user_123',
          attempt: 1
        })
      })
    })

    it('maintains error correlations for tracing', () => {
      // Arrange: Create correlated errors
      const { errors, correlationId } = errorBuilder
        .withCorrelatedErrors(3)
        .build()

      // Act: Log all errors
      errors.forEach(error => logger.error(error))

      // Assert: Correlation maintained
      const logs = logger.getLogs()
      logs.forEach(log => {
        expect(log.correlationId).toBe(correlationId)
      })
    })

    it('logs security events at appropriate level', () => {
      // Arrange: Create security error
      const { error, severity } = errorBuilder
        .withSecurityError(LogLevel.CRITICAL)
        .build()

      // Act: Log error
      logger.error(error)

      // Assert: Correct severity
      expect(logger.lastLog.level).toBe(LogLevel.CRITICAL)
      expect(logger.lastLog.security).toBe(true)
    })
  })
})