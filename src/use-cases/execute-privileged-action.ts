import type { DecisionArtifact, RequestInput } from '../domain/services/request-workflow-types'
import { authorizePrivilegedExecution } from '../domain/services/request-workflow'
import { toResponseClass } from '../domain/constants/reason-codes'
import type { ExecutionContext, TransactionAction, TransactionResult, VaultAdapter } from '../ports/types'

export type ExecutePrivilegedActionInput = {
  request: RequestInput
  artifact?: DecisionArtifact | null
  credentialId: string
  action: TransactionAction
  executionContext: ExecutionContext
}

export type ExecutePrivilegedActionDeps = {
  vault: VaultAdapter
}

export type ExecutePrivilegedActionResult = {
  allowed: boolean
  gateReasonCode: string
  responseClass: 'ok' | 'retryable' | 'blocked' | 'unknown'
  result?: TransactionResult
}

export async function executePrivilegedAction(
  input: ExecutePrivilegedActionInput,
  deps: ExecutePrivilegedActionDeps
): Promise<ExecutePrivilegedActionResult> {
  const gate = await authorizePrivilegedExecution({
    request: input.request,
    artifact: input.artifact,
  })

  if (!gate.allowed) {
    return {
      allowed: false,
      gateReasonCode: gate.reasonCode,
      responseClass: toResponseClass({ decision: 'deny', reasonCode: gate.reasonCode }),
    }
  }

  const result = await deps.vault.execute(
    input.credentialId,
    input.action,
    input.executionContext,
  )

  return {
    allowed: true,
    gateReasonCode: gate.reasonCode,
    responseClass: toResponseClass({ decision: 'allow', reasonCode: gate.reasonCode }),
    result,
  }
}
