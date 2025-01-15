import { getEntityById, putInvEntityUpdate } from '#controllers/entities/lib/entities'
import { getPatchById } from '#controllers/entities/lib/patches/patches'
import { emit } from '#lib/radio'
import { retryOnConflict } from '#lib/retry_on_conflict'
import { revertPatch } from '#models/patch'
import type { Patch, PatchId } from '#types/patch'
import type { UserAccountUri } from '#types/server'
import { validateInvEntity } from './validate_entity.js'

async function _revertFromPatchDoc (patch: Patch, userAcct: UserAccountUri) {
  const entityId = patch._id.split(':')[0]
  const currentDoc = await getEntityById(entityId)
  const updatedDoc = revertPatch(currentDoc, patch)
  await validateInvEntity(updatedDoc)
  const context = { revertPatch: patch._id }
  const docAfterUpdate = await putInvEntityUpdate({ userAcct, currentDoc, updatedDoc, context })
  await emit('entity:revert:edit', updatedDoc)
  return docAfterUpdate
}

export async function revertFromPatchId (patchId: PatchId, userAcct: UserAccountUri) {
  const patch = await getPatchById(patchId)
  return revertFromPatchDoc(patch, userAcct)
}

export const revertFromPatchDoc = retryOnConflict(_revertFromPatchDoc)
