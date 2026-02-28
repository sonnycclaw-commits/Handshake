import { describe, it, expect } from 'vitest'
import { generateKeyPairSync } from 'crypto'

describe('Key Generation (Standard Library)', () => {
  it('generates valid Ed25519 keypair', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    expect(publicKey).toBeDefined()
    expect(privateKey).toBeDefined()
    expect(publicKey.type).toBe('public')
    expect(privateKey.type).toBe('private')
  })

  it('public key can be exported in SPKI format', () => {
    const { publicKey } = generateKeyPairSync('ed25519')
    const spki = publicKey.export({ format: 'der', type: 'spki' })
    expect(spki).toBeInstanceOf(Buffer)
    expect(spki.length).toBeGreaterThan(0)
  })

  it('private key can be exported in PKCS8 format', () => {
    const { privateKey } = generateKeyPairSync('ed25519')
    const pkcs8 = privateKey.export({ format: 'der', type: 'pkcs8' })
    expect(pkcs8).toBeInstanceOf(Buffer)
    expect(pkcs8.length).toBeGreaterThan(0)
  })

  it('generates different keys each time', () => {
    const a = generateKeyPairSync('ed25519')
    const b = generateKeyPairSync('ed25519')
    const spkiA = a.publicKey.export({ format: 'der', type: 'spki' })
    const spkiB = b.publicKey.export({ format: 'der', type: 'spki' })
    expect(Buffer.from(spkiA)).not.toEqual(Buffer.from(spkiB))
  })

  it('uses OS entropy source (implicit)', () => {
    // Node.js crypto uses /dev/urandom or equivalent
    // This is implicit - we trust the standard library
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    expect(publicKey).toBeDefined()
    expect(privateKey).toBeDefined()
  })
})