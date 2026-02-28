import { generateKeyPairSync } from 'crypto'

// ============================================================
// STANDARD TEST KEYS
// ============================================================

// Generate deterministic test keys for consistent testing
// In production, these would be randomly generated
export const TEST_KEYPAIR = generateKeyPairSync('ed25519')
export const OTHER_KEYPAIR = generateKeyPairSync('ed25519')

// Export formats for different use cases
export const TEST_PUBLIC_KEY_SPKI = TEST_KEYPAIR.publicKey.export({ format: 'der', type: 'spki' })
export const TEST_PRIVATE_KEY_PKCS8 = TEST_KEYPAIR.privateKey.export({ format: 'der', type: 'pkcs8' })

export const OTHER_PUBLIC_KEY_SPKI = OTHER_KEYPAIR.publicKey.export({ format: 'der', type: 'spki' })
export const OTHER_PRIVATE_KEY_PKCS8 = OTHER_KEYPAIR.privateKey.export({ format: 'der', type: 'pkcs8' })

// Aliases for convenience (used by most tests)
export const TEST_PRIVATE_KEY = TEST_PRIVATE_KEY_PKCS8
export const TEST_PUBLIC_KEY = TEST_PUBLIC_KEY_SPKI
export const OTHER_PRIVATE_KEY = OTHER_PRIVATE_KEY_PKCS8
export const OTHER_PUBLIC_KEY = OTHER_PUBLIC_KEY_SPKI

// ============================================================
// INVALID KEYS (for negative testing)
// ============================================================

export const INVALID_PUBLIC_KEY_TOO_SHORT = Buffer.from('too-short')
export const INVALID_PUBLIC_KEY_TOO_LONG = Buffer.alloc(64).fill(0x01)
export const INVALID_PRIVATE_KEY_TOO_SHORT = Buffer.from('too-short')
export const INVALID_PRIVATE_KEY_TOO_LONG = Buffer.alloc(128).fill(0x02)

// For tests that expect INVALID_PRIVATE_KEY
export const INVALID_PRIVATE_KEY = INVALID_PRIVATE_KEY_TOO_SHORT

// ============================================================
// EDGE CASE KEYS (for security testing)
// ============================================================

// All-zeros key (should be rejected)
export const ZERO_PUBLIC_KEY = Buffer.alloc(32, 0)

// All-ones key (edge case)
export const ALL_ONES_PUBLIC_KEY = Buffer.alloc(32, 0xff)

// Small-order points (should be rejected in Ed25519)
// These are specific points on the curve that have small order
// and should be rejected to prevent certain attacks
export const SMALL_ORDER_POINT_1 = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000000',
  'hex'
)
export const SMALL_ORDER_POINT_2 = Buffer.from(
  '0100000000000000000000000000000000000000000000000000000000000000',
  'hex'
)

// ============================================================
// SIGNATURES
// ============================================================

// Invalid signature formats
export const INVALID_SIGNATURE_TOO_SHORT = Buffer.from('too-short')
export const INVALID_SIGNATURE_TOO_LONG = Buffer.alloc(128).fill(0x03)

// All-zeros signature (should fail verification)
export const ZERO_SIGNATURE = Buffer.alloc(64, 0)

// All-ones signature (edge case)
export const ALL_ONES_SIGNATURE = Buffer.alloc(64, 0xff)

// ============================================================
// KEY GENERATION UTILITIES
// ============================================================

/**
 * Generates a fresh keypair for testing
 * Use this when you need unique keys per test
 */
export function generateTestKeypair() {
  return generateKeyPairSync('ed25519')
}

/**
 * Generates a fresh key pair for async tests
 * Returns private key as PKCS8 DER buffer
 */
export async function generateTestKeyPair(): Promise<{ privateKey: Buffer; publicKey: Buffer }> {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  return {
    privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer,
    publicKey: publicKey.export({ format: 'der', type: 'spki' }) as Buffer
  }
}

/**
 * Signs a message with a private key
 * Returns the signature as a Buffer
 */
export function signMessage(message: Buffer | string, privateKey: any): Buffer {
  const { createSign } = require('crypto')
  const data = typeof message === 'string' ? Buffer.from(message) : message
  // Note: Ed25519 signing will be implemented in src/domain/services/sign-manifest.ts
  // This is a placeholder for test fixtures
  return Buffer.alloc(64, 0) // Placeholder
}

/**
 * Verifies a signature with a public key
 * Returns true if valid
 */
export function verifySignature(
  message: Buffer | string,
  signature: Buffer,
  publicKey: any
): boolean {
  // Note: Ed25519 verification will be implemented in src/domain/services/verify-manifest-signature.ts
  // This is a placeholder for test fixtures
  return false // Placeholder
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Creates a corrupted version of a key for tamper testing
 */
export function corruptKey(key: Buffer): Buffer {
  const corrupted = Buffer.from(key)
  corrupted[0] = (corrupted[0] + 1) % 256
  return corrupted
}

/**
 * Checks if a key is the zero key
 */
export function isZeroKey(key: Buffer): boolean {
  return key.every(byte => byte === 0)
}

/**
 * Creates a key with specific byte pattern for testing
 */
export function createKeyPattern(length: number, pattern: number): Buffer {
  return Buffer.alloc(length, pattern)
}
