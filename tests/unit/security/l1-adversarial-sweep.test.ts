import { describe, it, expect } from 'vitest'
import { sanitizeResponse } from '../../../../src/domain/services/response-sanitization'
import { DetectionResult } from '../../../../src/domain/value-objects/detection-result'
import { SensitiveDataPattern } from '../../../../src/domain/value-objects/sensitive-data-pattern'

const toSubscriptDigits = (input: string): string =>
  input.replace(/\d/g, d => String.fromCharCode(0x2080 + Number(d)))

const toFullWidthDigits = (input: string): string =>
  input.replace(/\d/g, d => String.fromCharCode(0xFF10 + Number(d)))

describe('L1 Adversarial Sweep', () => {
  it('redacts card leaked across stack trace and metadata fields', () => {
    const card = '4111111111111111'
    const payload = {
      error: {
        message: `failed for card ${card}`,
        stack: `at /home/ubuntu/app/service.ts\nquery ${card}`,
        metadata: {
          raw: card,
          nested: { also: `cc=${card}` }
        }
      }
    }

    const sanitized = sanitizeResponse(payload)
    const out = JSON.stringify(sanitized)
    expect(out).not.toContain(card)
    expect(DetectionResult.analyze(sanitized).hasPattern(SensitiveDataPattern.CARD_NUMBER)).toBe(false)
  })

  it('redacts split-card fragments even with misleading field names', () => {
    const card = '5105105105105100'
    const payload = {
      alpha: card.slice(0, 4),
      beta: card.slice(4, 8),
      gamma: card.slice(8, 12),
      delta: card.slice(12)
    }

    const sanitized = sanitizeResponse(payload)
    const out = JSON.stringify(sanitized)
    expect(out).not.toContain(card.slice(0, 4))
    expect(out).not.toContain(card.slice(12))
  })

  it('redacts encoded values in arrays and nested objects', () => {
    const card = '4242424242424242'
    const payload = {
      values: [
        Buffer.from(card).toString('base64'),
        Buffer.from(card).toString('hex'),
        encodeURIComponent(card)
      ],
      nested: {
        encoded: {
          b64: Buffer.from(`card=${card}`).toString('base64')
        }
      }
    }

    const sanitized = sanitizeResponse(payload)
    const result = DetectionResult.analyze(sanitized)
    expect(result.hasEncodedPattern(SensitiveDataPattern.CARD_NUMBER)).toBe(false)
  })

  it('redacts unicode-obfuscated digit strings', () => {
    const card = '5555555555554444'
    const payload = {
      sub: toSubscriptDigits(card),
      full: toFullWidthDigits(card)
    }

    const sanitized = sanitizeResponse(payload)
    const result = DetectionResult.analyze(sanitized)
    expect(result.hasObfuscatedPattern(SensitiveDataPattern.CARD_NUMBER)).toBe(false)
    expect(result.hasPattern(SensitiveDataPattern.CARD_NUMBER)).toBe(false)
  })

  it('scrubs path traversal and script payloads from errors', () => {
    const payload = {
      error: {
        message: '<script>alert(1)</script> ../../etc/passwd',
        stack: 'at /home/ubuntu/secret/path\n"; DROP TABLE users; --'
      }
    }

    const sanitized = sanitizeResponse(payload)
    const out = JSON.stringify(sanitized)

    expect(out).not.toContain('<script>alert(1)</script>')
    expect(out).not.toContain('../../etc/passwd')
    expect(out).not.toContain('DROP TABLE users')
    expect(out).not.toContain('/home/ubuntu/secret/path')
  })
})
