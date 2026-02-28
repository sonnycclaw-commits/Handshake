import type {
  CredentialService,
  IssueCredentialInput,
  VerifiedCredentialPayload
} from '../../ports/credential-service'

type JwtPayload = {
  iss: string
  sub: string
  aud: string
  iat: number
  exp: number
  agent_id: string
  owner_provider: string
  owner_id: string | null
  owner_display_name: string | null
  privacy_level: string
  verified_at: string
}

type JwtHeader = {
  alg: 'RS256'
  typ: 'JWT'
  kid: string
}

export type JwtCredentialConfig = {
  environment: string
  privateKey: string
  publicKey: string
  keyId?: string
}

export class JwtCredentialService implements CredentialService {
  constructor(private readonly config: JwtCredentialConfig) {}

  async issue(input: IssueCredentialInput): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const exp = now + 86400

    const header: JwtHeader = {
      alg: 'RS256',
      typ: 'JWT',
      kid: this.config.keyId || 'key-1'
    }

    const payload: JwtPayload = {
      iss: issuerFor(this.config.environment),
      sub: input.agentId,
      aud: 'handshake-verified-agent',
      iat: now,
      exp,
      agent_id: input.agentId,
      owner_provider: input.ownerProvider,
      owner_id: input.privacyLevel === 'anonymous' ? null : input.ownerId,
      owner_display_name: input.privacyLevel === 'full' ? input.ownerDisplayName : null,
      privacy_level: input.privacyLevel,
      verified_at: new Date().toISOString()
    }

    const encodedHeader = base64urlEncode(JSON.stringify(header))
    const encodedPayload = base64urlEncode(JSON.stringify(payload))
    const signingInput = `${encodedHeader}.${encodedPayload}`

    const privateKeyBuffer = Uint8Array.from(atob(this.config.privateKey), c => c.charCodeAt(0))
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(signingInput)
    )

    const encodedSignature = base64urlEncode(signature)
    return `${signingInput}.${encodedSignature}`
  }

  async verify(token: string): Promise<VerifiedCredentialPayload | null> {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null

      const [encodedHeader, encodedPayload, encodedSignature] = parts
      const signingInput = `${encodedHeader}.${encodedPayload}`

      const payload = JSON.parse(base64urlDecodeToText(encodedPayload)) as JwtPayload
      if (payload.exp < Math.floor(Date.now() / 1000)) return null
      if (payload.iss !== issuerFor(this.config.environment)) return null

      const publicKeyBuffer = Uint8Array.from(atob(this.config.publicKey), c => c.charCodeAt(0))
      const publicKey = await crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      )

      const signature = base64urlDecodeToBytes(encodedSignature)
      const valid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        publicKey,
        signature,
        new TextEncoder().encode(signingInput)
      )

      if (!valid) return null

      return {
        agentId: payload.agent_id,
        ownerProvider: payload.owner_provider,
        ownerId: payload.owner_id,
        ownerDisplayName: payload.owner_display_name,
        privacyLevel: payload.privacy_level,
        verifiedAt: payload.verified_at,
        exp: payload.exp
      }
    } catch {
      return null
    }
  }
}

function issuerFor(environment: string): string {
  return environment === 'production' ? 'https://handshake.dev' : 'http://localhost:8787'
}

function base64urlEncode(input: string | ArrayBuffer): string {
  const buffer = typeof input === 'string' ? new TextEncoder().encode(input).buffer : input
  const bytes = new Uint8Array(buffer)

  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecodeToText(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  return atob(normalized)
}

function base64urlDecodeToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0))
}
