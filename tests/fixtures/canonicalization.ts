/**
 * Test Fixtures for Manifest Canonicalization
 * 
 * This module provides utilities for testing the canonicalization process
 * that's critical for manifest signature integrity. It helps create test
 * manifests with controlled variations to verify canonicalization properties.
 */

import { expect } from 'vitest'
import { Manifest } from '../../../src/domain/entities/manifest'
import { CredentialType } from '../../../src/domain/value-objects/credential-type'
import { CredentialId } from '../../../src/domain/value-objects/credential-id'
import { Tier } from '../../../src/domain/value-objects/tier'
import { canonicalizeManifest } from '../../../src/domain/services/manifest-canonicalization'

/**
 * Interface for manifest properties used in test manifest creation
 */
export interface ManifestProperties {
  agent: string
  principal: string
  credentials: Array<{
    type: CredentialType
    id: CredentialId
    tier: Tier
  }>
  createdAt?: number
  expiresAt?: number
}

/**
 * Builder pattern for creating test manifests with controlled properties
 */
export class ManifestBuilder {
  private agent: string = 'agent_default'
  private principal: string = 'principal_default'
  private credentials: Array<any> = []
  private createdAt: number = Date.now()
  private expiresAt: number = Date.now() + 3600000

  withAgent(agent: string): ManifestBuilder {
    this.agent = agent
    return this
  }

  withPrincipal(principal: string): ManifestBuilder {
    this.principal = principal
    return this
  }

  withCredential(credential: {
    type: CredentialType
    id: CredentialId
    tier: Tier
  }): ManifestBuilder {
    this.credentials.push(credential)
    return this
  }

  withCredentials(credentials: Array<{
    type: CredentialType
    id: CredentialId
    tier: Tier
  }>): ManifestBuilder {
    this.credentials = [...credentials]
    return this
  }

  withStandardCredentials(): ManifestBuilder {
    this.credentials = [
      {
        type: CredentialType.from('payment_method'),
        id: CredentialId.from('cred_standard_1'),
        tier: Tier.from(2)
      },
      {
        type: CredentialType.from('identity_document'),
        id: CredentialId.from('cred_standard_2'),
        tier: Tier.from(3)
      }
    ]
    return this
  }

  withTimestamps(createdAt: number, expiresAt: number): ManifestBuilder {
    this.createdAt = createdAt
    this.expiresAt = expiresAt
    return this
  }

  build(): Manifest {
    return new Manifest(
      this.agent,
      this.principal,
      this.credentials,
      this.createdAt,
      this.expiresAt
    )
  }
}

/**
 * Creates multiple variations of the same logical manifest with different
 * structure/formatting to test canonicalization
 */
export function createManifestVariants(props: ManifestProperties): Manifest[] {
  const now = props.createdAt || Date.now()
  const expires = props.expiresAt || (now + 3600000)

  // Base manifest
  const base = new Manifest(
    props.agent,
    props.principal,
    props.credentials,
    now,
    expires
  )

  // Reordered properties
  const reordered = {
    credentials: props.credentials,
    principalId: props.principal,
    agentId: props.agent,
    expiresAt: expires,
    createdAt: now
  }

  // Different array order
  const reorderedArray = new Manifest(
    props.agent,
    props.principal,
    [...props.credentials].reverse(),
    now,
    expires
  )

  // With extra properties (should be ignored in canonicalization)
  const withExtra = {
    ...base,
    extra: 'should be ignored',
    meta: { ignore: 'me' }
  }

  // Different whitespace/formatting
  const prettyFormatted = JSON.parse(JSON.stringify(base, null, 2))
  const compactFormatted = JSON.parse(JSON.stringify(base))

  return [
    base,
    reordered as any,
    reorderedArray,
    withExtra as any,
    prettyFormatted as any,
    compactFormatted as any
  ]
}

/**
 * Asserts that two manifests produce identical canonical forms
 */
export function assertCanonicalEquality(a: any, b: any): void {
  const canonicalA = canonicalizeManifest(a)
  const canonicalB = canonicalizeManifest(b)
  
  expect(Buffer.from(canonicalA)).toEqual(Buffer.from(canonicalB))
}

/**
 * Generates a large manifest for performance testing
 */
export function generateLargeManifest(credentialCount: number): Manifest {
  const credentials = Array(credentialCount).fill(null).map((_, i) => ({
    type: CredentialType.from('payment_method'),
    id: CredentialId.from(`cred_${i}`),
    tier: Tier.from(2)
  }))

  return new ManifestBuilder()
    .withAgent('agent_large')
    .withPrincipal('principal_large')
    .withCredentials(credentials)
    .build()
}

/**
 * Creates a manifest with circular references for testing
 */
export function createCircularManifest(): any {
  const circular: any = {
    agentId: 'agent_circular',
    principalId: 'principal_circular',
    credentials: []
  }
  circular.self = circular
  return circular
}

/**
 * Creates manifest variations that should produce different canonical forms
 */
export function createDistinctManifests(): Manifest[] {
  const builder = new ManifestBuilder()

  return [
    // Base manifest
    builder
      .withAgent('agent_1')
      .withPrincipal('principal_1')
      .withStandardCredentials()
      .build(),

    // Different agent
    builder
      .withAgent('agent_2')
      .withPrincipal('principal_1')
      .withStandardCredentials()
      .build(),

    // Different principal
    builder
      .withAgent('agent_1')
      .withPrincipal('principal_2')
      .withStandardCredentials()
      .build(),

    // Different credentials
    builder
      .withAgent('agent_1')
      .withPrincipal('principal_1')
      .withCredentials([{
        type: CredentialType.from('api_key'),
        id: CredentialId.from('cred_different'),
        tier: Tier.from(1)
      }])
      .build()
  ]
}