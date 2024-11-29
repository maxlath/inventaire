import jiff from 'jiff'
import { cloneDeep, get, isArray, pick } from 'lodash-es'
import { isUserAcct } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { assertNumber, assertObject } from '#lib/utils/assert_types'
import { createBlankEntityDoc } from '#models/entity'
import type { EntityRedirection, InvEntity, InvEntityDoc, NewInvEntity, RemovedPlaceholderEntity } from '#types/entity'
import type { BatchId, OperationPath, Patch, PatchContext, PatchOperation, PatchWithSnapshot } from '#types/patch'
import type { UserAccountUri } from '#types/server'
import { versioned } from './attributes/entity.js'
import validations from './validations/common.js'
import type { SetOptional } from 'type-fest'

interface CreatePatchDocParams {
  userAcct: UserAccountUri
  currentDoc: NewInvEntity | InvEntityDoc
  updatedDoc: InvEntityDoc
  context?: PatchContext
  batchId?: BatchId
}

export function createPatchDoc (params: CreatePatchDocParams) {
  const { userAcct, currentDoc, updatedDoc, context, batchId } = params
  if (!isUserAcct(userAcct)) throw newError('invalid user acct', 500, { userAcct })
  assertObject(currentDoc)
  assertObject(updatedDoc)
  validations.pass('couchUuid', updatedDoc._id)

  if (context != null) assertObject(context)
  if (batchId != null) assertNumber(batchId)

  if (currentDoc === updatedDoc) {
    throw newError('invalid update: same document objects', 500, { currentDoc, updatedDoc })
  }

  const now = Date.now()

  // Use the updated doc _id as the the current doc
  // will miss an _id at creation.
  let { _id: entityId, version: entityVersion } = updatedDoc

  // If for some reason the entity document is malformed and lacks a version number,
  // fallback on using the timestamp, rather than crashing
  entityVersion = entityVersion || now

  const patch: Partial<Patch> = {
    _id: `${entityId}:${entityVersion}`,
    type: 'patch',
    user: userAcct,
    timestamp: now,
    operations: getPatchDiff(currentDoc, updatedDoc),
  }

  if (patch.operations.length === 0) {
    throw newError('empty patch', 500, { currentDoc, updatedDoc })
  }

  // Let the consumer pass any data object helping to contextualize the patch
  // Current uses:
  // - `{ mergeFrom: entityId }` where entityId is the entity being merged
  //   with the current entity. This is useful to be able to easily find
  //   the merge patch during a merge revert
  // - `{ redirectClaims: { fromUri } }` where fromUri is the entity that was merged
  //   in the patched entity, and from which claims that had it as value are being redirected
  // - `{ revertPatch: mergePatchId }` where mergePatchId is the patch where the merge
  //    being reverted was done
  if (context != null) patch.context = context
  if (batchId != null) patch.batch = batchId

  return patch as Omit<Patch, '_rev'>
}

type VersionedInvEntity = Pick<InvEntity | RemovedPlaceholderEntity, 'type' | 'labels' | 'claims'>
type VersionedRedirection = Pick<EntityRedirection, 'type' | 'redirect'>
type VersionedInvEntityDoc = VersionedInvEntity | VersionedRedirection

export function getPatchDiff (currentDoc: NewInvEntity | InvEntityDoc, updatedDoc: InvEntityDoc) {
  const versionedCurrentDoc = pick(currentDoc, versioned) as VersionedInvEntityDoc
  const versionedUpdatedDoc = pick(updatedDoc, versioned) as VersionedInvEntityDoc
  return jiff.diff(versionedCurrentDoc, versionedUpdatedDoc)
}

// Reverts the effects of a patch on a entity doc
export function revertPatch (currentDoc: InvEntityDoc, patch: Patch) {
  if (patch._id.split(':')[0] !== currentDoc._id) {
    throw newError('entity and patch ids do not match', 500, { currentDoc, patch })
  }
  let inverseOperations
  try {
    inverseOperations = jiff.inverse(patch.operations)
    const updatedDoc = applyInverseOperations(currentDoc, inverseOperations)
    return updatedDoc
  } catch (err) {
    err.context = { currentDoc, patch, inverseOperations }
    throw err
  }
}

export function addVersionsSnapshots (patchesDocs: SetOptional<PatchWithSnapshot, 'snapshot'>[]) {
  let previousVersion = getEntityHistoryBase() as InvEntityDoc | NewInvEntity

  // Assumes that patchesDocs are ordered from oldest to newest
  for (const patchDoc of patchesDocs) {
    patchDoc.snapshot = jiff.patch(patchDoc.operations, previousVersion) as InvEntityDoc
    // jiff.patch is non-mutating: we get a new object
    // without modifying the previous snapshot
    previousVersion = patchDoc.snapshot
  }

  return patchesDocs as PatchWithSnapshot[]
}

function applyInverseOperations (currentDoc: InvEntityDoc, inverseOperations: PatchOperation[]) {
  currentDoc = cloneDeep(currentDoc)
  inverseOperations.forEach(fixOperation(currentDoc, inverseOperations))

  const updatedDoc = jiff.patch(inverseOperations, currentDoc)

  // Cleanup: remove empty claims arrays
  for (const prop in updatedDoc.claims) {
    const array = updatedDoc.claims[prop]
    if (array.length === 0) delete updatedDoc.claims[prop]
  }

  return updatedDoc
}

// Make the required modification for the jiff.patch to success
// to work around cases known to crash
function fixOperation (currentDoc: InvEntityDoc, inverseOperations: PatchOperation[]) {
  return function (op: PatchOperation, index: number) {
    const opFn = operationFix[op.op]
    if (opFn != null) return opFn(currentDoc, inverseOperations, op, index)
  }
}

const operationFix = {
  add: (currentDoc: InvEntityDoc, inverseOperations: PatchOperation[], op: PatchOperation) => {
    const { path } = op
    if ('value' in op && isArray(op.value)) {
      const { value } = op
      if (value.length === 1) {
        const currentArray = getFromPatchPath(currentDoc, path)
        // Case when the 'add' operation tries to add an array with a value in it,
        // but this array as been re-created later on: the final result
        // should be an array with the current values + the added value.
        // The operation is thus converted into simply pushing the added value
        // at the end of the existing array
        if (currentArray != null) {
          op.value = value[0]
          op.path += `/${currentArray.length}`
        }
      }
    } else if (path.split('/').length > 3) {
      const parentObjectPath = path.split('/').slice(0, -1).join('/')
      const currentArray = getFromPatchPath(currentDoc, parentObjectPath)
      if (isArray(currentArray)) {
        const valueIndex = parseInt(path.split('/').at(-1))
        // Avoid "InvalidPatchOperationError: target of add outside of array bounds"
        if (valueIndex > currentArray.length) {
          op.path = `${parentObjectPath}/${currentArray.length}` as OperationPath
        }
      }
    }
  },

  test: (currentDoc: InvEntityDoc, inverseOperations: PatchOperation[], op: PatchOperation, index: number) => {
    const nextOp = inverseOperations[index + 1]
    if ((nextOp.path === op.path) && (nextOp.op === 'remove')) {
      // Case when the 'remove' operation tries to remove an array with a value
      // in it, while this array might now contain more values
      if ('value' in op && isArray(op.value) && (op.value.length === 1)) {
        const { value } = op
        op.value = value[0]
        op.path = (nextOp.path = `${op.path}/0` as OperationPath)
      }

      const arrayPath = op.path.replace(/\/\d+$/, '') as OperationPath
      const patchedArray = getFromPatchPath(currentDoc, arrayPath)

      if (!patchedArray) {
        throw newError('unhandled patch case', 500, { currentDoc, inverseOperations, op, index, arrayPath })
      }

      if ('value' in op) {
        const currentValueIndex = patchedArray.indexOf(op.value)
        // Update the operation path to the current value index
        // to avoid removing the wrong value if changes messed with the value index
        op.path = nextOp.path = op.path.replace(/\/\d+$/, `/${currentValueIndex}`) as OperationPath
      }
    }
  },
}

function getFromPatchPath (doc: InvEntityDoc, path: string) {
  const key = path.slice(1).replaceAll('/', '.')
  return get(doc, key)
}

function getEntityHistoryBase () {
  const entityBase = createBlankEntityDoc()
  return pick(entityBase, versioned)
}
