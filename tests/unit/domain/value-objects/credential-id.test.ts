import { describe, it, expect } from 'vitest'
import { CredentialId } from '../../../../src/domain/value-objects/credential-id'

describe('CredentialId', () => {
  it('creates valid credential id from string', () => {
    const id = CredentialId.from('cred_123')
    expect(id.value).toBe('cred_123')
  })

  it('rejects empty credential id', () => {
    expect(() => CredentialId.from('')).toThrowError('Invalid credential id')
  })

  it('rejects whitespace-only credential id', () => {
    expect(() => CredentialId.from('   ')).toThrowError('Invalid credential id')
  })

  it('rejects non-string inputs', () => {
    const inputs: any[] = [null, undefined, 123, {}, []]
    for (const input of inputs) {
      expect(() => CredentialId.from(input as any)).toThrowError('Invalid credential id')
    }
  })

  it('trims whitespace', () => {
    const id = CredentialId.from('  cred_123  ')
    expect(id.value).toBe('cred_123')
  })

  it('equality compares by value', () => {
    const a = CredentialId.from('cred_123')
    const b = CredentialId.from('cred_123')
    expect(a.equals(b)).toBe(true)
  })

  it('equality returns false for different values', () => {
    const a = CredentialId.from('cred_123')
    const b = CredentialId.from('cred_456')
    expect(a.equals(b)).toBe(false)
  })
})
