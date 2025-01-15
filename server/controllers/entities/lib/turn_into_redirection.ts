import { compact, pick, uniq } from 'lodash-es'
import { getInvClaimsByClaimValue, getEntityById, putInvEntityUpdate, wdEntityHasALocalLayer } from '#controllers/entities/lib/entities'
import { getClaimValue, hasLocalClaims } from '#controllers/entities/lib/inv_claims_utils'
import { removePlaceholder } from '#controllers/entities/lib/placeholders'
import { isInvEntityUri, isWdEntityUri } from '#lib/boolean_validations'
import { log } from '#lib/utils/logs'
import { convertEntityDocIntoARedirection, preventRedirectionEdit, convertEntityDocIntoALocalLayer, preventLocalLayerEdit, preventRemovedPlaceholderEdit } from '#models/entity'
import type { Claims, EntityUri, InvEntity, InvEntityId, InvEntityUri, PropertyUri } from '#types/entity'
import type { PatchContext } from '#types/patch'
import type { UserAccountUri } from '#types/server'
import propagateRedirection from './propagate_redirection.js'

export async function turnIntoRedirectionOrLocalLayer ({ userAcct, fromId, toUri, previousToUri, context }: { userAcct: UserAccountUri, fromId: InvEntityId, toUri: EntityUri, previousToUri?: EntityUri, context?: PatchContext }) {
  const fromUri = `inv:${fromId}` as InvEntityUri

  const currentFromDoc = await getEntityById(fromId)
  preventRedirectionEdit(currentFromDoc)
  preventLocalLayerEdit(currentFromDoc)
  preventRemovedPlaceholderEdit(currentFromDoc)
  let updatedFromDoc
  if (isWdEntityUri(toUri) && hasLocalClaims(currentFromDoc) && !(await wdEntityHasALocalLayer(toUri))) {
    updatedFromDoc = convertEntityDocIntoALocalLayer(currentFromDoc, toUri)
  } else {
    // If an author has no more links to it, remove it
    const removedIds = await removeObsoletePlaceholderEntities(userAcct, currentFromDoc)
    updatedFromDoc = convertEntityDocIntoARedirection(currentFromDoc, toUri, removedIds)
  }
  await putInvEntityUpdate({
    userAcct,
    currentDoc: currentFromDoc,
    updatedDoc: updatedFromDoc,
    context,
  })
  return propagateRedirection(userAcct, fromUri, toUri, previousToUri)
}

// Removing the entities that were needed only by the entity about to be turned
// into a redirection: this entity now don't have anymore reason to be and is quite
// probably a duplicate of an existing entity referenced by the redirection
// destination entity.
async function removeObsoletePlaceholderEntities (userAcct: UserAccountUri, entityDocBeforeRedirection: InvEntity) {
  const entityUrisToCheck = getEntityUrisToCheck(entityDocBeforeRedirection.claims)
  log(entityUrisToCheck, 'entity uris to check for autoremoval')
  const fromId = entityDocBeforeRedirection._id
  const removedIds = await Promise.all(entityUrisToCheck.map(deleteIfIsolated(userAcct, fromId)))
  return compact(removedIds)
}

function getEntityUrisToCheck (claims: Claims): EntityUri[] {
  const uris = Object.values(pick(claims, propertiesToCheckForPlaceholderDeletion)).flat()
    .map(getClaimValue) as EntityUri[]
  return uniq(uris).filter(uri => isInvEntityUri(uri))
}

const propertiesToCheckForPlaceholderDeletion: PropertyUri[] = [
  // author
  'wdt:P50',
] as const

const deleteIfIsolated = (userAcct: UserAccountUri, fromId: InvEntityId) => async (entityUri: EntityUri) => {
  const [ prefix, entityId ] = entityUri.split(':')
  // Ignore wd or isbn entities
  if (prefix !== 'inv') return

  let results = await getInvClaimsByClaimValue(entityUri)
  results = results.filter(result => result.entity !== fromId)
  if (results.length === 0) return removePlaceholder(userAcct, entityId)
}
