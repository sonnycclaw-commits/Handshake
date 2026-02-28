import { describe, it, expect } from 'vitest'
import { canonicalizeObject as canonicalize } from '@/domain/serialization/canonicalize'

describe('Canonicalization (Standard Library)', () => {
  it('produces deterministic output for same object', () => {
    const obj = { a: 1, b: 2, nested: { c: 3 } }
    expect(canonicalize(obj)).toBe(canonicalize(obj))
  })

  it('handles key ordering consistently', () => {
    const objA = { a: 1, b: 2 }
    const objB = { b: 2, a: 1 }
    expect(canonicalize(objA)).toBe(canonicalize(objB))
  })

  it('rejects non-JSON-safe values', () => {
    const withUndefined = { a: undefined as any }
    const withFunction = { a: () => {} }
    const circular: any = { a: 1 }
    circular.self = circular

    expect(() => canonicalize(withUndefined as any)).toThrow()
    expect(() => canonicalize(withFunction as any)).toThrow()
    expect(() => canonicalize(circular as any)).toThrow()
  })

  it('produces valid JSON string', () => {
    const obj = { a: 1, b: 'two', c: [1, 2, 3] }
    const output = canonicalize(obj) as string
    expect(() => JSON.parse(output)).not.toThrow()
  })

  it('preserves all data through round-trip', () => {
    const obj = { a: 1, b: 'two', c: [1, 2, 3], nested: { d: true } }
    const output = canonicalize(obj) as string
    expect(JSON.parse(output)).toEqual(obj)
  })
})
