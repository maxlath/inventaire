import { isEmpty, omitBy, pick } from 'lodash-es'
import { simplifyPropertyClaims, simplifyPropertyQualifiers } from 'wikibase-sdk'
import { formatClaimsForWikidata } from '#controllers/entities/lib/create_wd_entity'
import { expandInvClaims } from '#controllers/entities/lib/inv_claims_utils'
import { updateWdEntityLocalClaims } from '#controllers/entities/lib/update_wd_entity_local_claims'
import { getWikidataOAuthCredentials, hasWikidataOAuth, validateWikidataOAuth } from '#controllers/entities/lib/wikidata_oauth'
import { getWdEntity } from '#data/wikidata/get_entity'
import { isEntityUri, isInvEntityUri, isInvPropertyUri, isWdEntityId } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { newInvalidError } from '#lib/error/pre_filled'
import type { UserWithAcct } from '#lib/federation/remote_user'
import { arrayIncludes } from '#lib/utils/base'
import { LogError, success, warn } from '#lib/utils/logs'
import { qualifierProperties } from '#lib/wikidata/data_model_adapter'
import wdEdit from '#lib/wikidata/edit'
import { validateWdEntityUpdate } from '#lib/wikidata/validate_wd_update'
import type { EntityValue, InvClaimValue, PropertyUri, WdEntityId, Claims, ExpandedClaims } from '#types/entity'
import entitiesRelationsTemporaryCache, { triggerSubjectEntityCacheRefresh } from './entities_relations_temporary_cache.js'
import { unprefixify, prefixifyWd } from './prefix.js'
import { getPropertyDatatype, propertiesValuesConstraints as properties } from './properties/properties_values_constraints.js'
import { cachedRelationProperties } from './temporarily_cache_relations.js'
import type { CustomSimplifiedSnak } from 'wikibase-sdk'

// /!\ There are no automatic tests for this function as it modifies Wikidata

export async function updateWdClaim (user: UserWithAcct, id: WdEntityId, property: PropertyUri, oldValue: InvClaimValue, newValue: InvClaimValue) {
  if (isInvPropertyUri(property)) return updateWdEntityLocalClaims(user, id, property, oldValue, newValue)

  validateWikidataOAuth(user)

  await validateWdEntityUpdate(id, property, oldValue, newValue)

  const prop = properties[property]
  newValue = prop.format != null ? prop.format(newValue) : newValue

  if ((getPropertyDatatype(property) === 'entity')) {
    if (isInvEntityUri(newValue as EntityValue)) {
      throw newError("wikidata entities can't link to inventaire entities", 400)
    }

    if (isEntityUri(oldValue)) oldValue = unprefixify(oldValue)
    if (isEntityUri(newValue)) newValue = unprefixify(newValue)
  }

  const [ propertyPrefix, propertyId ] = property.split(':')

  if (propertyPrefix !== 'wdt') {
    throw newInvalidError('property', propertyPrefix)
  }

  const credentials = getWikidataOAuthCredentials(user)

  let res

  if (qualifierProperties[propertyId]) {
    res = await updateRelocatedClaim({ id, propertyId, newValue, oldValue, credentials })
  } else {
    res = await updateClaim({ id, propertyId, newValue, oldValue, credentials })
  }

  const uri = prefixifyWd(id)

  if (arrayIncludes(cachedRelationProperties, property)) {
    const uri = prefixifyWd(id)
    if (newValue != null && isWdEntityId(newValue)) {
      entitiesRelationsTemporaryCache.set(uri, property, prefixifyWd(newValue))
      .catch(LogError('entitiesRelationsTemporaryCache.set err'))
    }
    if (oldValue != null && isWdEntityId(oldValue)) {
      entitiesRelationsTemporaryCache.del(uri, property, prefixifyWd(oldValue))
      .catch(LogError('entitiesRelationsTemporaryCache.del err'))
    }
  }

  triggerSubjectEntityCacheRefresh(uri)

  return res
}

async function updateClaim ({ id, propertyId, newValue, oldValue, credentials }) {
  if (newValue) {
    if (oldValue) {
      return wdEdit.claim.update({ id, property: propertyId, oldValue, newValue }, { credentials })
    } else {
      return wdEdit.claim.create({ id, property: propertyId, value: newValue }, { credentials })
    }
  } else {
    const guid = await getClaimGuid(id, propertyId, oldValue)
    return wdEdit.claim.remove({ guid }, { credentials })
  }
}

async function updateRelocatedClaim (params) {
  const { id, propertyId, newValue, oldValue, credentials } = params
  const { claimProperty, noClaimErrorMessage, tooManyClaimsErrorMessage } = qualifierProperties[propertyId]
  const propertyClaims = await getPropertyClaims(id, claimProperty)
  if (!propertyClaims) throw newError(noClaimErrorMessage, 400, params)
  if (propertyClaims.length !== 1) throw newError(tooManyClaimsErrorMessage, 400, params)
  const claim = propertyClaims[0]
  const guid = claim.id
  if (newValue) {
    if (oldValue) {
      return wdEdit.qualifier.update({ guid, property: propertyId, oldValue, newValue }, { credentials })
    } else {
      return wdEdit.qualifier.set({ guid, property: propertyId, value: newValue }, { credentials })
    }
  } else {
    const hash = getQualifierHash(claim, propertyId, oldValue)
    return wdEdit.qualifier.remove({ guid, hash }, { credentials })
  }
}

async function getPropertyClaims (id, propertyId) {
  const entity = await getWdEntity(id)
  return entity.claims[propertyId]
}

async function getClaimGuid (id, propertyId, oldVal) {
  const propClaims = await getPropertyClaims(id, propertyId)
  const simplifyPropClaims = simplifyPropertyClaims(propClaims)
  const oldValIndex = simplifyPropClaims.indexOf(oldVal)
  const targetClaim = propClaims[oldValIndex]
  return targetClaim.id
}

function getQualifierHash (claim, property, value) {
  // @ts-expect-error simplifyPropertyQualifiers does not do pattern matching on the keepHashes option
  const qualifiers: CustomSimplifiedSnak[] = simplifyPropertyQualifiers(claim.qualifiers[property], { keepHashes: true })
  const matchingQualifiers = qualifiers.filter(qualifier => {
    return typeof qualifier === 'object' ? qualifier.value === value : false
  })
  if (matchingQualifiers.length !== 1) {
    throw newError('unique matching qualifier not found', 400, { claim, property, value })
  }
  return matchingQualifiers[0].hash
}

export async function addWdClaims (id: WdEntityId, claims: Claims, user: UserWithAcct) {
  if (isEmpty(claims)) return
  const context = { id, claims, user: pick(user, 'acct', 'username') }
  // TODO: Let users without Wikidata OAuth use the botAccountWikidataOAuth crendentials(?)
  if (!hasWikidataOAuth(user)) {
    warn(context, 'Can not addWdClaims without Wikidata OAuth credentials')
    return
  }
  const credentials = getWikidataOAuthCredentials(user)
  const bot = user.type === 'special'
  const expandedClaims = expandInvClaims(claims)
  const formattedClaims = formatClaimsForWikidata(omitLocalClaims(expandedClaims))
  await wdEdit.entity.edit({
    id,
    claims: formattedClaims,
    // See https://github.com/maxlath/wikibase-edit/blob/main/docs/how_to.md#reconciliation-modes
    reconciliation: {
      mode: 'skip-on-any-value',
    },
  }, {
    summary: `add claims: ${Object.keys(formattedClaims).join(', ')}`,
    credentials,
    // bot, // Requires bot rigths, see https://www.wikidata.org/wiki/Wikidata:Bots
    maxlag: bot ? 5 : undefined,
  })
  success(context, 'claims added to Wikidata')
}

export function omitLocalClaims (claims: ExpandedClaims) {
  return omitBy(claims, (propertyClaims, property) => isInvPropertyUri(property))
}
