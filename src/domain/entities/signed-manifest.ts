import { Manifest } from './manifest'
import { verifyManifestSignature } from '../services/verify-manifest-signature'

export class SignedManifest {
  constructor(
    public manifest: Manifest,
    public signature: Uint8Array,
    public publicKey: Uint8Array
  ) {}

  async verify(): Promise<boolean> {
    return verifyManifestSignature(this)
  }
}
