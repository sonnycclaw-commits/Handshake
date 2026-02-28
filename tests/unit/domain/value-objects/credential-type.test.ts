import { describe, it, expect } from 'vitest'
import { CredentialType } from '../../../../src/domain/value-objects/credential-type'

// TODO: Update allowed types list if spec changes
const allowedTypes = [
  'payment_method',
  'identity_document',
  'api_key',
  'email',
  'calendar'
]

describe('CredentialType', () => {
  it('creates valid credential type from string', () => {
    const type = CredentialType.from('payment_method')
    expect(type.value).toBe('payment_method')
  })

  it('creates valid credential type for each allowed type', () => {
    for (const t of allowedTypes) {
      const type = CredentialType.from(t)
      expect(type.value).toBe(t)
    }
  })

  it('rejects invalid credential type', () => {
    expect(() => CredentialType.from('invalid_type')).toThrowError('Invalid credential type')
  })

  it('rejects empty string', () => {
    expect(() => CredentialType.from('')).toThrowError('Invalid credential type')
  })

  it('rejects non-string inputs', () => {
    const inputs: any[] = [null, undefined, 123, {}, []]
    for (const input of inputs) {
      expect(() => CredentialType.from(input as any)).toThrowError('Invalid credential type')
    }
  })

  it('enforces normalization (trims whitespace)', () => {
    const type = CredentialType.from(' payment_method ')
    expect(type.value).toBe('payment_method')
  })

  it('equality compares by value', () => {
    const a = CredentialType.from('payment_method')
    const b = CredentialType.from('payment_method')
    expect(a.equals(b)).toBe(true)
  })

  it('equality returns false for different values', () => {
    const a = CredentialType.from('payment_method')
    const b = CredentialType.from('identity_document')
    expect(a.equals(b)).toBe(false)
  })
})
