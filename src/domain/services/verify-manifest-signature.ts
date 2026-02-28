import { verify, createPublicKey } from 'crypto'
import { canonicalizeManifest } from './manifest-canonicalization'
import { SignedManifest } from '../entities/signed-manifest'
import { SignatureError, ErrorCode } from '../errors'

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

const isCanonicalPublicKey = (publicKey: Uint8Array | Buffer): boolean => {
  const buf = Buffer.from(publicKey)
  if (buf.length !== 32) return false
  if (buf.every((b) => b === 0)) return false
  if (buf.every((b) => b === 0xff)) return false
  return true
}

const MAX_CREDENTIALS = 1000
const FUTURE_TOLERANCE_MS = 2 * 60 * 1000

const toKeyObject = (publicKey: Uint8Array | Buffer) => {
  const keyBuffer = Buffer.from(publicKey)
  if (keyBuffer.length === 32) {
    return createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, keyBuffer]), format: 'der', type: 'spki' })
  }

  return createPublicKey({ key: keyBuffer, format: 'der', type: 'spki' })
}

export const verifyManifestSignature = async (signed: SignedManifest): Promise<boolean> => {
  if (!signed || typeof signed !== 'object') {
    throw new SignatureError('Invalid signed manifest', ErrorCode.SIGNATURE_INVALID)
  }

  if (!signed.signature || signed.signature.length === 0) {
    throw new SignatureError('Invalid signature', ErrorCode.SIGNATURE_INVALID)
  }
  if (!signed.publicKey || signed.publicKey.length === 0) {
    throw new SignatureError('Invalid public key', ErrorCode.SIGNATURE_INVALID)
  }

  const manifest = signed.manifest
  if (!manifest || typeof manifest !== 'object') {
    throw new SignatureError('Invalid signed manifest', ErrorCode.SIGNATURE_INVALID)
  }

  if (manifest.credentials && manifest.credentials.length > MAX_CREDENTIALS) {
    throw new SignatureError('Invalid signature', ErrorCode.SIGNATURE_INVALID)
  }

  if (typeof manifest.createdAt === 'number' && manifest.createdAt - Date.now() > FUTURE_TOLERANCE_MS) {
    throw new SignatureError('Invalid signature', ErrorCode.SIGNATURE_INVALID)
  }

  if (manifest.isExpired && manifest.isExpired()) {
    throw new SignatureError('Invalid signature', ErrorCode.SIGNATURE_INVALID)
  }

  if (!(signed.publicKey.length === 32 || signed.publicKey.length >= 44)) {
    throw new SignatureError('Invalid public key', ErrorCode.SIGNATURE_INVALID)
  }
  if (signed.signature.length !== 64) {
    throw new SignatureError('Invalid signature', ErrorCode.SIGNATURE_INVALID)
  }
  if (signed.publicKey.length === 32 && !isCanonicalPublicKey(signed.publicKey)) {
    throw new SignatureError('Invalid public key', ErrorCode.SIGNATURE_INVALID)
  }

  try {
    const payload = canonicalizeManifest(manifest)
    const keyObj = toKeyObject(signed.publicKey)
    const valid = verify(null, Buffer.from(payload), keyObj, Buffer.from(signed.signature))
    if (!valid) {
      throw new SignatureError('Invalid signature', ErrorCode.SIGNATURE_INVALID)
    }
    return true
  } catch (error) {
    if (error instanceof SignatureError) throw error
    throw new SignatureError('Invalid signature', ErrorCode.SIGNATURE_INVALID)
  }
}
