import type { AccountUri } from '#server/types/server'
import type { CouchDoc } from '#types/couchdb'
import type { EntityUri, InvClaimValue, InvEntityId, Label } from '#types/entity'
import type { UserId } from '#types/user'

export type PatchId = `${InvEntityId}:${number}`

type OperationPath = '/type' | `/labels${string}` | `/claims${string}` | `/redirect${string}` | `/deletion${string}`
type OperationValue = string | Label | InvClaimValue | InvClaimValue[] | EntityUri | boolean

interface AddOperation {
  op: 'add'
  path: OperationPath
  value: OperationValue
}
interface TestOperation {
  op: 'test'
  path: OperationPath
  value: OperationValue
}
interface ReplaceOperation {
  op: 'replace'
  path: OperationPath
  value: OperationValue
}
interface RemoveOperation {
  op: 'remove'
  path: OperationPath
}

export type PatchOperation = AddOperation | TestOperation | ReplaceOperation | RemoveOperation

export type BatchId = EpochTimeStamp

export interface ActionPatchContext {
  action: 'move-to-wikidata'
}

export interface MergePatchContext {
  mergeFrom: InvEntityId
}

export interface RedirectedClaimsContext {
  redirectClaims: { fromUri: EntityUri }
}

export interface RevertedPatchContext {
  revertPatch: PatchId
}

export interface RestorePatchContext {
  restoredPatch: PatchId
}

export type PatchContext = ActionPatchContext | MergePatchContext | RedirectedClaimsContext | RevertedPatchContext | RestorePatchContext

export interface Patch extends CouchDoc {
  _id: PatchId
  type: 'patch'
  user: UserId | AccountUri
  timestamp: EpochTimeStamp
  operations: PatchOperation[]
  batch?: BatchId
  context?: PatchContext
}

export type NewPatch = Omit<Patch, '_rev'>
