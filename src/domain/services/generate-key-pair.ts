import { generateKeyPairSync } from 'crypto'

export const generateKeyPair = async () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicKey: new Uint8Array(publicKey.export({ format: 'der', type: 'spki' })),
    privateKey: new Uint8Array(privateKey.export({ format: 'der', type: 'pkcs8' }))
  }
}
