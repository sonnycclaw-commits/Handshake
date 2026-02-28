import { createPrivateKey, createPublicKey, sign, type KeyObject } from 'crypto'
import { canonicalizeManifest } from '../serialization/manifest-canonicalization'
import { SignedManifest } from '../entities/signed-manifest'
import { Manifest } from '../entities/manifest'

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
const MAX_CREDENTIALS = 100

type KeyLike = Uint8Array | Buffer

const isKeyObject = (value: unknown): value is KeyObject => {
  return !!value && typeof value === 'object' && 'type' in (value as Record<string, unknown>)
}

const toKeyObject = (privateKey: KeyLike): KeyObject => {
  const keyBuffer = Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey)

  if (keyBuffer.length === 32) {
    try {
      return createPrivateKey({
        key: Buffer.concat([ED25519_PKCS8_PREFIX, keyBuffer]),
        format: 'der',
        type: 'pkcs8'
      })
    } catch {
      throw new Error('Invalid key type')
    }
  }

  try {
    return createPrivateKey({ key: keyBuffer, format: 'der', type: 'pkcs8' })
  } catch {
    throw new Error('Invalid key type')
  }
}

const derivePublicKey = (privateKey: KeyLike | KeyObject): Uint8Array => {
  const keyObj = isKeyObject(privateKey) ? privateKey : toKeyObject(privateKey)
  const publicKey = createPublicKey(keyObj)
  const spki = publicKey.export({ format: 'der', type: 'spki' }) as Buffer
  return new Uint8Array(spki.slice(-32))
}

export const signManifest = async (manifest: Manifest, privateKey: KeyLike): Promise<SignedManifest> => {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid manifest')
  }

  if (!privateKey) {
    throw new Error('Invalid private key format')
  }

  if (manifest.credentials && manifest.credentials.length > MAX_CREDENTIALS) {
    throw new Error('Manifest exceeds maximum size')
  }

  const keyBuffer = Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey)
  const isValidLength = keyBuffer.length === 32 || keyBuffer.length >= 48
  if (!isValidLength) {
    throw new Error('Invalid private key format')
  }

  const payload = canonicalizeManifest(manifest)
  const keyObj = toKeyObject(privateKey)
  const signature = sign(null, Buffer.from(payload), keyObj)
  const publicKey = derivePublicKey(keyObj)

  return new SignedManifest(manifest, new Uint8Array(signature), publicKey)
}
