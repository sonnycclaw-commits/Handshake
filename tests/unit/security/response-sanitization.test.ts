import { describe, it, expect, beforeEach } from 'vitest'
import { sanitizeResponse } from '@/domain/services/response-sanitization'
import { 
  generateTestCard,
  generateTestSSN,
  generateTestPassport,
  createNestedStructure,
  TestResponseBuilder
} from '../../fixtures/sensitive-data'
import { SensitiveDataPattern } from '@/domain/value-objects/sensitive-data-pattern'
import { DetectionResult } from '@/domain/value-objects/detection-result'

/**
 * Response Sanitization Test Suite
 * 
 * This suite defines the gold standard for testing sensitive data sanitization
 * in manifest-based authorization systems. It verifies our implementation of
 * D006: Response Sanitization Mandatory.
 * 
 * Core Security Properties:
 * 1. Zero Credential Leakage - No credential fragments in any form
 * 2. Pattern Resilience - Cannot bypass via encoding, splitting, or obfuscation
 * 3. Deep Detection - Finds sensitive data at any depth
 * 4. Format Independence - Works across all data representations
 * 
 * Testing Philosophy:
 * Each test proves a specific security property. Tests are structured to be
 * self-documenting - reading the tests should explain the security model.
 */

describe('Response Sanitization System', () => {
  let testResponse: TestResponseBuilder

  beforeEach(() => {
    testResponse = new TestResponseBuilder()
  })

  describe('Core Security Properties', () => {
    describe('1. Zero Credential Leakage', () => {
      it('prevents leakage of complete credentials', () => {
        // Arrange: Create response with clear credential
        const card = generateTestCard()
        const response = testResponse
          .withCard(card)
          .build()

        // Act: Sanitize
        const sanitized = sanitizeResponse(response)
        const result = DetectionResult.analyze(sanitized)

        // Assert: No card numbers anywhere in output
        expect(result.hasPattern(SensitiveDataPattern.CARD_NUMBER)).toBe(false)
        expect(JSON.stringify(sanitized)).not.toContain(card.number)
      })

      it('prevents leakage of credential fragments', () => {
        // Arrange: Create response with last 4 digits
        const card = generateTestCard()
        const response = testResponse
          .withField('last_four', card.number.slice(-4))
          .withField('first_six', card.number.slice(0, 6))
          .build()

        // Act: Sanitize
        const sanitized = sanitizeResponse(response)

        // Assert: No fragments that could be combined
        expect(JSON.stringify(sanitized)).not.toContain(card.number.slice(-4))
        expect(JSON.stringify(sanitized)).not.toContain(card.number.slice(0, 6))
      })

      it('prevents all forms of PII leakage', () => {
        // Arrange: Multiple PII types
        const response = testResponse
          .withSSN(generateTestSSN())
          .withPassport(generateTestPassport())
          .withField('dob', '1990-01-01')
          .withField('address', '123 Main St')
          .build()

        // Act: Sanitize
        const sanitized = sanitizeResponse(response)
        const result = DetectionResult.analyze(sanitized)

        // Assert: Zero PII in output
        expect(result.hasPattern(SensitiveDataPattern.SSN)).toBe(false)
        expect(result.hasPattern(SensitiveDataPattern.PASSPORT)).toBe(false)
        expect(result.hasPattern(SensitiveDataPattern.DATE_OF_BIRTH)).toBe(false)
        expect(result.hasPattern(SensitiveDataPattern.ADDRESS)).toBe(false)
      })
    })

    describe('2. Pattern Resilience', () => {
      it('detects and removes encoded credentials', () => {
        // Arrange: Create response with various encodings
        const card = generateTestCard()
        const response = testResponse
          .withField('base64', Buffer.from(card.number).toString('base64'))
          .withField('hex', Buffer.from(card.number).toString('hex'))
          .withField('url', encodeURIComponent(card.number))
          .build()

        // Act: Sanitize
        const sanitized = sanitizeResponse(response)
        const result = DetectionResult.analyze(sanitized)

        // Assert: No encoded values leak
        expect(result.hasEncodedPattern(SensitiveDataPattern.CARD_NUMBER)).toBe(false)
      })

      it('prevents pattern splitting and reassembly', () => {
        // Arrange: Split card number across fields
        const card = generateTestCard()
        const parts = [
          card.number.slice(0, 4),
          card.number.slice(4, 8),
          card.number.slice(8, 12),
          card.number.slice(12)
        ]

        const response = testResponse
          .withField('part1', parts[0])
          .withField('part2', parts[1])
          .withField('part3', parts[2])
          .withField('part4', parts[3])
          .build()

        // Act: Sanitize
        const sanitized = sanitizeResponse(response)

        // Assert: Cannot reconstruct from parts
        const sanitizedStr = JSON.stringify(sanitized)
        parts.forEach(part => {
          expect(sanitizedStr).not.toContain(part)
        })
      })

      it('handles obfuscation attempts', () => {
        // Arrange: Various obfuscation techniques
        const card = generateTestCard()
        const response = testResponse
          .withField('spaced', card.number.split('').join(' '))
          .withField('reversed', card.number.split('').reverse().join(''))
          .withField('unicode', card.number.replace(/\d/g, n => String.fromCharCode(0x2080 + parseInt(n))))
          .build()

        // Act: Sanitize
        const sanitized = sanitizeResponse(response)
        const result = DetectionResult.analyze(sanitized)

        // Assert: No obfuscated patterns leak
        expect(result.hasObfuscatedPattern(SensitiveDataPattern.CARD_NUMBER)).toBe(false)
      })
    })

    describe('3. Deep Detection', () => {
      it('sanitizes deeply nested structures', () => {
        // Arrange: Create deep nesting with credentials
        const card = generateTestCard()
        const deep = createNestedStructure(10, card.number)
        const response = testResponse
          .withField('nested', deep)
          .build()

        // Act: Sanitize
        const sanitized = sanitizeResponse(response)

        // Assert: No leaks at any depth
        function checkNested(obj: any): void {
          for (const key in obj) {
            const value = obj[key]
            if (typeof value === 'object') {
              checkNested(value)
            } else {
              expect(value).not.toContain(card.number)
            }
          }
        }
        checkNested(sanitized)
      })

      it('handles circular references safely', () => {
        // Arrange: Create circular structure with embedded credential
        const card = generateTestCard()
        const circular: any = { number: card.number }
        circular.self = circular
        
        const response = testResponse
          .withField('circular', circular)
          .build()

        // Act & Assert: Should handle without stack overflow
        const sanitized = sanitizeResponse(response)
        expect(JSON.stringify(sanitized)).not.toContain(card.number)
      })
    })

    describe('4. Format Independence', () => {
      it('sanitizes all JSON types', () => {
        // Arrange: Embed sensitive data in all JSON types
        const card = generateTestCard()
        const response = testResponse
          .withField('string', `Card: ${card.number}`)
          .withField('number', parseInt(card.number))
          .withField('boolean', card.number === card.number)
          .withField('null', null)
          .withField('array', [card.number, `Card: ${card.number}`])
          .withField('object', { card: card.number })
          .build()

        // Act: Sanitize
        const sanitized = sanitizeResponse(response)
        const result = DetectionResult.analyze(sanitized)

        // Assert: Clean across all types
        expect(result.hasPattern(SensitiveDataPattern.CARD_NUMBER)).toBe(false)
      })

      it('handles mixed content types', () => {
        // Arrange: Mix of text, numbers, dates with embedded credentials
        const card = generateTestCard()
        const ssn = generateTestSSN()
        const response = testResponse
          .withField('text', `Card ${card.number} and SSN ${ssn}`)
          .withField('date', new Date().toISOString())
          .withField('amount', 123.45)
          .build()

        // Act: Sanitize
        const sanitized = sanitizeResponse(response)

        // Assert: All sensitive data removed while preserving types
        expect(typeof sanitized.date).toBe('string')
        expect(typeof sanitized.amount).toBe('number')
        expect(sanitized.text).not.toContain(card.number)
        expect(sanitized.text).not.toContain(ssn)
      })
    })
  })

  describe('Error Handling & Edge Cases', () => {
    it('handles malformed JSON safely', () => {
      // Arrange: Invalid JSON with credential
      const card = generateTestCard()
      const response = `{"broken": "${card.number}", malformed`

      // Act & Assert: Should not throw
      expect(() => sanitizeResponse(response)).not.toThrow()
    })

    it('preserves error status codes and types', () => {
      // Arrange: Error response with sensitive data
      const card = generateTestCard()
      const error = {
        status: 404,
        type: 'NotFoundError',
        message: `Could not find card ${card.number}`,
        stack: `Error: Could not find card ${card.number}\n    at Object...`
      }

      // Act: Sanitize
      const sanitized = sanitizeResponse(error)

      // Assert: Maintains error properties while sanitizing
      expect(sanitized.status).toBe(404)
      expect(sanitized.type).toBe('NotFoundError')
      expect(sanitized.message).not.toContain(card.number)
      expect(sanitized.stack).not.toContain(card.number)
    })

    it('handles maximum sanitization depth', () => {
      // Arrange: Create extremely deep structure
      const card = generateTestCard()
      const deep = createNestedStructure(1000, card.number)

      // Act & Assert: Should handle without stack overflow
      expect(() => sanitizeResponse(deep)).not.toThrow()
    })
  })

  describe('Performance & Resource Usage', () => {
    it('completes sanitization within time budget', () => {
      // Arrange: Large response with many credentials
      const response = testResponse
        .withMultipleCards(100)
        .withMultipleSSNs(100)
        .withMultiplePassports(100)
        .build()

      // Act: Measure sanitization time
      const start = process.hrtime.bigint()
      sanitizeResponse(response)
      const end = process.hrtime.bigint()
      const ms = Number(end - start) / 1_000_000

      // Assert: Should complete within budget (50ms)
      expect(ms).toBeLessThan(50)
    })

    it('maintains reasonable memory usage', () => {
      // Note: This is a best-effort test in JavaScript
      if (typeof process !== 'undefined' && process.memoryUsage) {
        // Arrange: Large response
        const response = testResponse
          .withMultipleCards(1000)
          .build()

        // Act: Measure memory
        const before = process.memoryUsage().heapUsed
        sanitizeResponse(response)
        const after = process.memoryUsage().heapUsed

        // Assert: Heap growth should be reasonable
        const growth = after - before
        expect(growth).toBeLessThan(5 * 1024 * 1024) // 5MB
      }
    })
  })
})