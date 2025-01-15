import { cloneDeep, keyBy, map } from 'lodash-es'
import { getInvClaimsByClaimValue, getEntitiesByIds, putInvEntityUpdate } from '#controllers/entities/lib/entities'
import { retryOnConflict } from '#lib/retry_on_conflict'
import { log } from '#lib/utils/logs'
import { updateEntityDocClaim } from '#models/entity'
import type { EntityUri, InvEntityDoc, InvEntityId } from '#types/entity'
import type { UserAccountUri } from '#types/server'

async function _redirectClaims (userAcct: UserAccountUri, fromUri: EntityUri, toUri: EntityUri) {
  const results = await getInvClaimsByClaimValue(fromUri)
  const entitiesToEditIds = map(results, 'entity')
  if (entitiesToEditIds.length === 0) return
  log(entitiesToEditIds, 'entitiesToEditIds')
  // Doing all the redirects at once to avoid conflicts
  // within a same entity pointing several times to the redirected entity.
  // There is no identified case at the moment though.
  const entities = await getEntitiesByIds(entitiesToEditIds)
  return redirectEntitiesClaims(results, userAcct, fromUri, toUri, entities)
}

type Results = Awaited<ReturnType<typeof getInvClaimsByClaimValue>>

async function redirectEntitiesClaims (results: Results, userAcct: UserAccountUri, fromUri: EntityUri, toUri: EntityUri, entities: InvEntityDoc[]) {
  const entitiesIndex: Record<InvEntityId, InvEntityDoc> = keyBy(entities, '_id')
  const entitiesIndexBeforeUpdate = cloneDeep(entitiesIndex)

  // Apply all the redirection updates on the entities docs
  results.forEach(applyRedirections(entitiesIndex, fromUri, toUri))

  // Then, post the updates all at once
  const updatesPromises = Object.values(entitiesIndex).map(updatedDoc => {
    const currentDoc = entitiesIndexBeforeUpdate[updatedDoc._id]
    // Add a context in case we need to revert those redirections later on
    const context = { redirectClaims: { fromUri } }
    return putInvEntityUpdate({ userAcct, currentDoc, updatedDoc, context })
  })

  await Promise.all(updatesPromises)
}

const applyRedirections = (entitiesIndex, fromUri, toUri) => result => {
  let newVal
  const { property, entity } = result
  const doc = entitiesIndex[entity]

  // If the toUri is already a claim value, delete the fromUri claim
  // instead of creating a duplicated claim
  if (doc.claims[property].includes(toUri)) {
    newVal = null
  } else {
    newVal = toUri
  }

  entitiesIndex[entity] = updateEntityDocClaim(doc, property, fromUri, newVal)
}

export const redirectClaims = retryOnConflict(_redirectClaims)
