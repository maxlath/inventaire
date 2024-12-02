import { cloneDeep } from 'lodash-es'
import { getEntityById, putInvEntityUpdate } from '#controllers/entities/lib/entities'
import { getEntityByUri } from '#controllers/entities/lib/get_entity_by_uri'
import { getInvEntityType } from '#controllers/entities/lib/get_entity_type'
import { getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { newError } from '#lib/error/error'
import type { UserWithAcct } from '#lib/federation/remote_user'
import { emit } from '#lib/radio'
import { retryOnConflict } from '#lib/retry_on_conflict'
import { getUserAccessLevels, type AccessLevel } from '#lib/user_access_levels'
import { isLocalEntityLayer, updateEntityDocClaim } from '#models/entity'
import type { ExtendedEntityType, InvClaimValue, InvEntity, InvEntityDoc, InvEntityId, PropertyUri } from '#types/entity'
import type { UserAccountUri } from '#types/server'
import { inferredClaimUpdates } from './inferred_claim_updates.js'
import { validateAndFormatClaim } from './validate_and_format_claim.js'
import { validateClaimProperty } from './validate_claim_property.js'

async function _updateInvClaim (user: UserWithAcct, id: InvEntityId, property: PropertyUri, oldVal?: InvClaimValue, newVal?: InvClaimValue) {
  const { acct: userAcct } = user
  const userAccessLevels = getUserAccessLevels(user)
  let currentDoc: InvEntityDoc
  try {
    currentDoc = await getEntityById(id)
  } catch (err) {
    if (err.statusCode === 404) {
      throw newError('entity not found', 400, { id, property, oldVal, newVal })
    } else {
      throw err
    }
  }
  if ('redirect' in currentDoc || currentDoc.type === 'removed:placeholder') {
    const context = { id, property, oldVal, newVal }
    throw newError('this entity is obsolete', 400, context)
  }
  let type
  if (isLocalEntityLayer(currentDoc)) {
    const remoteUri = getFirstClaimValue(currentDoc.claims, 'invp:P1')
    const remoteEntity = await getEntityByUri({ uri: remoteUri })
    type = remoteEntity.type
  } else {
    type = getInvEntityType(currentDoc.claims['wdt:P31'])
    validateClaimProperty(type, property)
  }
  const updatedDoc = await updateClaim({ _id: id, type, property, oldVal, newVal, userAcct, currentDoc, userAccessLevels })

  await inferredClaimUpdates(updatedDoc as InvEntity, property, oldVal)

  await emit('entity:update:claim', updatedDoc)

  if (property === 'invp:P2' && oldVal != null) {
    await emit('image:needs:check', { container: 'entities', hash: oldVal, context: 'update' })
  }
}

interface UpdateClaimParams {
  _id: InvEntityId
  type: ExtendedEntityType
  property: PropertyUri
  oldVal: InvClaimValue
  newVal: InvClaimValue
  userAcct: UserAccountUri
  currentDoc: InvEntity
  userAccessLevels?: AccessLevel[]
}

async function updateClaim (params: UpdateClaimParams) {
  const { _id, type, property, oldVal, newVal, userAcct, currentDoc, userAccessLevels } = params
  const formattedNewClaim = await validateAndFormatClaim({
    _id,
    type,
    property,
    oldClaim: oldVal,
    newClaim: newVal,
    userAccessLevels,
    letEmptyValuePass: true,
  })
  const updatedDoc = updateEntityDocClaim(cloneDeep(currentDoc), property, oldVal, formattedNewClaim)
  return putInvEntityUpdate({ userAcct, currentDoc, updatedDoc })
}

export const updateInvClaim = retryOnConflict(_updateInvClaim)
