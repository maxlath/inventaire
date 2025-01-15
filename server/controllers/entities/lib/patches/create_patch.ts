import { dbFactory } from '#db/couchdb/base'
import { logError } from '#lib/utils/logs'
import { createPatchDoc, getPatchDiff, revertPatch } from '#models/patch'
import type { InvEntityDoc, NewInvEntity } from '#types/entity'
import type { BatchId, NewPatch, Patch, PatchContext, PatchOperation } from '#types/patch'
import type { UserAccountUri } from '#types/server'
import { getEntityLastPatches } from './patches.js'

const designDocName = 'patches'
const db = await dbFactory('patches', designDocName)

interface PatchCreationParams {
  userAcct: UserAccountUri
  currentDoc: NewInvEntity | InvEntityDoc
  updatedDoc: InvEntityDoc
  batchId?: BatchId
  context?: PatchContext
}

export async function createPatch (params: PatchCreationParams) {
  const { currentDoc, updatedDoc, userAcct } = params
  const newPatchDoc = createPatchDoc(params)

  try {
    if (entityHasPreviousVersions(currentDoc)) {
      const [ previousPatchDoc ] = await getEntityLastPatches(currentDoc._id)
      if (lastPatchWasFromSameUser(previousPatchDoc, userAcct)) {
        const aggregatedOperations = getAggregatedOperations(currentDoc, updatedDoc, previousPatchDoc)
        if (isNotSpecialPatch(previousPatchDoc)) {
          if (aggregatedOperationsAreEmpty(aggregatedOperations)) {
            return deletePatch(previousPatchDoc)
          } else if (aggregatedOperationsAreShorter(aggregatedOperations, previousPatchDoc, newPatchDoc)) {
            return updatePreviousPatch(aggregatedOperations, previousPatchDoc)
          }
        }
      }
    }
  } catch (err) {
    err.context ??= params
    logError(err, 'Patch update or deletion failed. Falling back to normal patch')
  }

  return db.postAndReturn(newPatchDoc)
}

function entityHasPreviousVersions (currentDoc: NewInvEntity | InvEntityDoc): currentDoc is InvEntityDoc {
  return '_id' in currentDoc && currentDoc.version > 1
}

function lastPatchWasFromSameUser (previousPatchDoc: Patch, userAcct: UserAccountUri) {
  return previousPatchDoc && previousPatchDoc.user === userAcct
}

function getAggregatedOperations (currentDoc: InvEntityDoc, updatedDoc: InvEntityDoc, previousPatchDoc: Patch) {
  const beforeLastPatch = revertPatch(currentDoc, previousPatchDoc)
  return getPatchDiff(beforeLastPatch, updatedDoc)
}

const isNotSpecialPatch = (patch: Patch) => patch.context == null && patch.batch == null

const aggregatedOperationsAreEmpty = (operations: PatchOperation[]) => operations.length === 0

function aggregatedOperationsAreShorter (aggregatedOperations: PatchOperation[], previousPatchDoc: Patch, newPatchDoc: NewPatch) {
  return aggregatedOperations.length < (previousPatchDoc.operations.length + newPatchDoc.operations.length)
}

async function deletePatch (patch: Patch) {
  await db.delete(patch._id, patch._rev)
}

async function updatePreviousPatch (aggregatedOperations: PatchOperation[], previousPatchDoc: Patch) {
  previousPatchDoc.operations = aggregatedOperations
  return db.putAndReturn(previousPatchDoc)
}
