import { getClaimValue, getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { getWikidataOAuthCredentials, validateWikidataOAuth } from '#controllers/entities/lib/wikidata_oauth'
import { newError } from '#lib/error/error'
import type { MinimalRemoteUser } from '#lib/federation/remote_user'
import { mapKeysValues, objectEntries } from '#lib/utils/base'
import { requireJson } from '#lib/utils/json'
import { info, log } from '#lib/utils/logs'
import { relocateQualifierProperties } from '#lib/wikidata/data_model_adapter'
import wdEdit from '#lib/wikidata/edit'
import type { EntityUri, EntityValue, ExpandedClaims, InvExpandedPropertyClaims, InvSnakValue, Labels, PropertyUri, Reference, ReferenceProperty, ReferencePropertySnaks, WdEntityId, WdEntityUri, WdPropertyId, InvClaimObject, Descriptions } from '#types/entity'
import type { User } from '#types/user'
import { prefixifyWd, unprefixify } from './prefix.js'
import { getPropertyDatatype } from './properties/properties_values_constraints.js'
import { validateInvEntity } from './validate_entity.js'
import type { SimplifiedQualifiers, WikimediaLanguageCode } from 'wikibase-sdk'

const wmLanguageCodeByWdId = requireJson('wikidata-lang/mappings/wm_code_by_wd_id.json')

interface CreateWdEntityParams {
  labels: Labels
  descriptions?: Descriptions
  claims: ExpandedClaims
  user: User | MinimalRemoteUser
  isAlreadyValidated?: boolean
}

export interface EntityDraft {
  labels: Labels
  descriptions?: Descriptions
  claims: ExpandedClaims
}

type UnprefixedClaimValue = Omit<InvSnakValue, EntityValue> | WdEntityId
type UnprefixedClaimObject = {
  value: UnprefixedClaimValue
  references?: Reference[]
  qualifiers?: SimplifiedQualifiers
}
export type UnprefixedClaims = Record<WdPropertyId, UnprefixedClaimObject[]>

export async function createWdEntity (params: CreateWdEntityParams) {
  const { labels, descriptions, claims, user, isAlreadyValidated = false } = params
  validateWikidataOAuth(user)
  const credentials = getWikidataOAuthCredentials(user)

  const entity: EntityDraft = { labels, descriptions, claims }

  log(entity, 'wd entity creation')

  if (!isAlreadyValidated) await validateInvEntity(entity)
  validateWikidataCompliance(entity)
  const formattedEntity = format(entity)
  const res = await wdEdit.entity.create(formattedEntity, { credentials })
  const { entity: createdEntity } = res
  if (createdEntity == null) {
    throw newError('invalid wikidata-edit response', 500, { res })
  }
  createdEntity.uri = prefixifyWd(createdEntity.id)
  info(createdEntity.uri, 'created wd entity')
  return createdEntity
}

function validateWikidataCompliance (entity: EntityDraft) {
  const { claims } = entity
  if (claims == null) throw newError('invalid entity', 400, { entity })

  for (const [ property, propertyClaims ] of objectEntries(claims)) {
    if (getPropertyDatatype(property) === 'entity') {
      for (const claim of propertyClaims) {
        const value = getClaimValue(claim) as EntityUri
        if (value.split(':')[0] === 'inv') {
          throw newError('claim value is an inv uri', 400, { property, value })
        }
      }
    }
  }

  return entity
}

function format (entity: EntityDraft) {
  return {
    ...entity,
    claims: formatClaimsForWikidata(entity.claims),
  }
}

export function formatClaimsForWikidata (claims: ExpandedClaims) {
  reshapeMonolingualTextClaims(claims)
  const wdFormattedClaims = mapKeysValues(claims, (property, propertyClaims) => {
    return [
      unprefixify(property),
      unprefixifyClaims(property, propertyClaims),
    ]
  }) as UnprefixedClaims
  // Relocate qualifier properties after unprefixifying,
  // as the unprefixifyClaims function doesn't handle qualifiers
  relocateQualifierProperties(wdFormattedClaims)
  return wdFormattedClaims
}

function unprefixifyClaims (property: PropertyUri, propertyClaims: InvExpandedPropertyClaims) {
  return propertyClaims.map(claim => {
    const { value, references = [] } = claim
    const unprefixedValue = (getPropertyDatatype(property) === 'entity') ? unprefixify(value as WdEntityUri) : value
    return {
      value: unprefixedValue,
      references: references.map(unprefixifyReference),
    }
  })
}

function unprefixifyReference (reference: Reference) {
  return mapKeysValues(reference, (property, propertyValues) => {
    return [
      unprefixify(property),
      unprefixifySnakValues(property, propertyValues),
    ]
  })
}

function unprefixifySnakValues (property: ReferenceProperty, propertyValues: ReferencePropertySnaks) {
  if (getPropertyDatatype(property) === 'entity') {
    return propertyValues.map(unprefixify)
  } else {
    return propertyValues
  }
}

const monolingualProperties = [
  'wdt:P1476',
  'wdt:P1680',
] as const satisfies PropertyUri[]

export function reshapeMonolingualTextClaims (claims: ExpandedClaims) {
  if (!monolingualProperties.find(property => claims[property])) return
  const languageUri = getFirstClaimValue(claims, 'wdt:P407') as WdEntityUri
  if (!languageUri) {
    throw newError('monolingual text claims can not be reshaped in absence of a language claim', 400, { claims })
  }
  const langWdId = unprefixify(languageUri)
  const languageCode = wmLanguageCodeByWdId[langWdId] as WikimediaLanguageCode
  if (!languageCode) {
    throw newError('wikimedia language code not found', 400, { langWdId })
  }
  for (const property of monolingualProperties) {
    reshapeMonolingualTextPropertyClaims(claims, property, languageCode)
  }
}

function reshapeMonolingualTextPropertyClaims (claims: ExpandedClaims, property: PropertyUri, languageCode: WikimediaLanguageCode) {
  if (!claims[property]) return
  claims[property] = claims[property].map((claimObject: InvClaimObject) => {
    const { value, references } = claimObject
    return {
      value: { text: value, language: languageCode },
      references,
    }
  })
}
