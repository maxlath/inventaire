import { getEntityByUri } from '#controllers/entities/lib/get_entity_by_uri'
import { getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { unprefixify } from '#controllers/entities/lib/prefix'
import { mergeOrCreateOrUpdateTask } from '#controllers/tasks/lib/merge_or_create_tasks'
import { validateThatEntitiesAreNotRelated, validateAbsenceOfConflictingProperties } from '#controllers/tasks/lib/merge_validation'
import { isIsbnEntityUri, isInvEntityUri } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { getMaybeRemoteReqUser } from '#lib/federation/remote_user'
import { hasDataadminAccess } from '#lib/user_access_levels'
import { log } from '#lib/utils/logs'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { EntityUri, SerializedEntity } from '#types/entity'
import type { AuthentifiedReq, RemoteUserAuthentifiedReq } from '#types/server'
import mergeEntities from './lib/merge_entities.js'

const sanitization = {
  from: {},
  to: {},
}

// Assumptions:
// - ISBN are already desambiguated and should thus never need merge
//   out of the case of merging with an existing Wikidata edition entity
//   but those are ignored for the moment (see https://github.com/inventaire/inventaire/issues/182)
// - The merged entity data may be lost: the entity was probably a placeholder
//   what matters the most is the redirection. Finer reconciling strategy could be developed later

// Only inv entities can be merged yet
const validFromUriPrefix = [ 'inv', 'isbn' ]

async function controller (params: SanitizedParameters, req: AuthentifiedReq | RemoteUserAuthentifiedReq) {
  let { from: fromUri, to: toUri, reqUserAcct } = params
  const [ fromPrefix ] = fromUri.split(':')

  if (!validFromUriPrefix.includes(fromPrefix)) {
    // 'to' prefix doesn't need validation as it can be anything
    const message = `invalid 'from' uri domain: ${fromPrefix}. Accepted domains: ${validFromUriPrefix}`
    throw newError(message, 400, params)
  }

  const user = getMaybeRemoteReqUser(req)
  const isDataadmin = hasDataadminAccess(user)

  log({
    merge: params,
    user: reqUserAcct,
    isDataadmin,
  }, 'entity merge request')

  const { fromEntity, toEntity } = await getMergeEntities(fromUri, toUri)
  validateEntities({ fromUri, toUri, fromEntity, toEntity })
  const entitiesType = validateEntitiesByType({ fromEntity, toEntity })

  fromUri = replaceIsbnUriByInvUri(fromUri, fromEntity)
  toUri = replaceIsbnUriByInvUri(toUri, toEntity)

  validateAbsenceOfConflictingProperties(fromEntity, toEntity)
  validateThatEntitiesAreNotRelated(fromEntity, toEntity)

  if (isDataadmin) {
    await mergeEntities({ userAcct: reqUserAcct, fromUri, toUri })
    return { ok: true }
  } else {
    return mergeOrCreateOrUpdateTask(entitiesType, fromUri, toUri, fromEntity, toEntity, reqUserAcct)
  }
}

async function getMergeEntities (fromUri: EntityUri, toUri: EntityUri) {
  const [
    fromEntity,
    toEntity,
  ] = await Promise.all([
    // Fetch entities separately so that if they won't override one another
    // if they happen to have the same canonical uri (in which case they should be merged)
    getEntityByUri({ uri: fromUri, refresh: true }),
    getEntityByUri({ uri: toUri, refresh: true }),
  ])
  return { fromEntity, toEntity }
}

function validateEntities ({ fromUri, toUri, fromEntity, toEntity }: { fromUri: EntityUri, toUri: EntityUri, fromEntity: SerializedEntity, toEntity: SerializedEntity }) {
  validateEntity(fromEntity, fromUri, 'from')
  validateEntity(toEntity, toUri, 'to')
  if (fromEntity.invId === toEntity.invId) {
    throw newError("can't merge an entity into itself", 400, { fromUri, toUri })
  }
}

function validateEntity (entity: SerializedEntity, originalUri: EntityUri, label: string) {
  if (entity == null) {
    throw newError(`'${label}' entity not found`, 400, { originalUri })
  }
  if (isInvEntityUri(originalUri) && 'wdId' in entity && entity.invId === unprefixify(originalUri)) {
    throw newError(`'${label}' uri refers to a local entity layer`, 400, { entity, originalUri })
  }
  if (isInvEntityUri(originalUri) && entity.uri !== originalUri && `inv:${entity.invId}` !== originalUri) {
    throw newError(`'${label}' entity is already a redirection`, 400, { entity, originalUri })
  }
}

function validateEntitiesByType ({ fromEntity, toEntity }) {
  const { uri: fromUri } = fromEntity
  const { uri: toUri } = toEntity

  if (fromEntity.type !== toEntity.type) {
    // Exception: authors can be organizations and collectives of all kinds
    // which will not get a 'human' type
    if ((fromEntity.type !== 'human') || !(toEntity.type == null)) {
      const message = `type don't match: ${fromEntity.type} / ${toEntity.type}`
      throw newError(message, 400, { fromUri, toUri })
    }
  }

  // Merging editions with ISBNs should only happen in the rare case
  // where the uniqueness check failed because two entities with the same ISBN
  // were created at about the same time. Other cases should be rejected.
  if (fromEntity.type === 'edition') {
    const fromEntityIsbn = getFirstClaimValue(fromEntity.claims, 'wdt:P212')
    const toEntityIsbn = getFirstClaimValue(toEntity.claims, 'wdt:P212')
    if ((fromEntityIsbn != null) && (toEntityIsbn != null) && (fromEntityIsbn !== toEntityIsbn)) {
      throw newError("can't merge editions with different ISBNs", 400, { fromUri, toUri })
    }
  }

  return fromEntity.type
}

function replaceIsbnUriByInvUri (uri, entity) {
  if (isIsbnEntityUri(uri)) {
    const [ prefix ] = uri.split(':')
    // Prefer inv id over isbn to prepare for ./lib/merge_entities
    if (prefix === 'isbn') return `inv:${entity._id}`
  }
  return uri
}

export default { sanitization, controller }
