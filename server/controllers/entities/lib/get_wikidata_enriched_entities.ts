// Get and format Wikidata entities to match Inventaire entities:
// - simplify claims
// - add attributes: uri, originalLang
// - delete unnecessary attributes and ignore undesired claims
//   such as ISBNs defined on work entities

import { partition, map, compact, keyBy } from 'lodash-es'
import { simplifyAliases, simplifyDescriptions, simplifyLabels, simplifySitelinks, type Item as RawWdEntity } from 'wikibase-sdk'
import { getWdEntitiesLocalLayers, getWdEntityLocalLayer, setTermsFromClaims, termsFromClaimsTypes } from '#controllers/entities/lib/entities'
import { setEntityImageFromImageHashClaims } from '#controllers/entities/lib/format_inv_entity_common'
import type { EntitiesGetterParams } from '#controllers/entities/lib/get_entities_by_uris'
import { getIsbnUriFromClaims } from '#controllers/entities/lib/get_inv_uri_from_doc'
import { getClaimObjectFromClaim, getFirstClaimValue, simplifyInvClaims } from '#controllers/entities/lib/inv_claims_utils'
import { prefixifyWd, unprefixify } from '#controllers/entities/lib/prefix'
import { getWdEntity } from '#data/wikidata/get_entity'
import { hardCodedUsers } from '#db/couchdb/hard_coded_documents'
import { addWdEntityToIndexationQueue } from '#db/elasticsearch/wikidata_entities_indexation_queue'
import { isWdEntityUri } from '#lib/boolean_validations'
import { cache_ } from '#lib/cache'
import { buildLocalUserAcct } from '#lib/federation/remote_user'
import { emit } from '#lib/radio'
import { assertString } from '#lib/utils/assert_types'
import { arrayIncludes, objectEntries } from '#lib/utils/base'
import { warn } from '#lib/utils/logs'
import { formatClaims } from '#lib/wikidata/format_claims'
import { getOriginalLang } from '#lib/wikidata/get_original_lang'
import type { ExtendedEntityType, ExpandedSerializedWdEntity, SerializedWdEntity, WdEntityId, WdEntityUri, InvEntity, SimplifiedSitelinks, EntityUri } from '#types/entity'
import { addImageData } from './add_image_data.js'
import { getWdEntityType } from './get_entity_type.js'
import propagateRedirection from './propagate_redirection.js'

let reindexWdEntity
async function importCircularDependencies () {
  const { indexation } = await import('#db/elasticsearch/indexation')
  reindexWdEntity = indexation('wikidata')
}
setImmediate(importCircularDependencies)

const hookUserAcct = buildLocalUserAcct(hardCodedUsers.hook.anonymizableId)

export async function getWikidataEnrichedEntities (ids: WdEntityId[], { refresh, dry, includeReferences }: EntitiesGetterParams) {
  const [ remoteEntitiesByIds, localEntitiesLayersByIds ] = await Promise.all([
    getCachedEnrichedEntities({ wdIds: ids, refresh, dry }),
    getWdEntitiesLocalLayers(ids),
  ])
  const entities = ids.map(wdId => aggregateWdEntityLayers(wdId, remoteEntitiesByIds[wdId], localEntitiesLayersByIds[wdId]))
  let [ foundEntities, notFoundEntities ] = partition(entities, isNotMissing)
  if (dry) foundEntities = compact(foundEntities)
  const notFound = map(notFoundEntities, 'uri') as WdEntityUri[]
  if (includeReferences) {
    return {
      entities: foundEntities.map(expandClaims) as ExpandedSerializedWdEntity[],
      notFound,
    }
  } else {
    return {
      entities: foundEntities as SerializedWdEntity[],
      notFound,
    }
  }
}

const isNotMissing = entity => entity && entity.type !== 'missing'

export async function getAggregatedWdEntityLayers ({ wdId, refresh, dry }: { wdId: WdEntityId, refresh?: boolean, dry?: boolean }) {
  const [ remoteEntity, localEntityLayer ] = await Promise.all([
    getCachedEnrichedEntity({ wdId, refresh, dry }),
    getWdEntityLocalLayer(wdId),
  ])
  return aggregateWdEntityLayers(wdId, remoteEntity, localEntityLayer)
}

interface SerializedEmptyWdEntity {
  wdId: WdEntityId
  uri: WdEntityUri
  type: 'meta' | 'missing'
  // The following attributes might be set by indexation functions
  _indexationTime?: EpochTimeStamp
  _id?: WdEntityId
  lastrevid?: number
}

function aggregateWdEntityLayers (wdId: WdEntityId, remoteEntity: SerializedWdEntity | SerializedEmptyWdEntity, localEntityLayer: InvEntity) {
  // Known case: when dry=true and getting a cache miss
  if (!remoteEntity) return
  if (localEntityLayer) {
    if ('claims' in remoteEntity) {
      Object.assign(remoteEntity.claims, simplifyInvClaims(localEntityLayer.claims))
      runPostLayerAggregationFormatting(remoteEntity, localEntityLayer)
    } else {
      warn(localEntityLayer, 'local layer is linked to an invalid remote entity')
    }
  }
  remoteEntity.wdId = wdId
  return remoteEntity
}

function runPostLayerAggregationFormatting (remoteEntity: SerializedWdEntity, localEntityLayer: InvEntity) {
  remoteEntity.invId = localEntityLayer._id
  if (localEntityLayer.claims['invp:P2'] != null) {
    setEntityImageFromImageHashClaims(remoteEntity)
  }
  const lockedType = getFirstClaimValue(localEntityLayer.claims, 'invp:P3')
  if (lockedType) remoteEntity.type = lockedType
}

async function getCachedEnrichedEntities ({ wdIds, refresh, dry }: { wdIds: WdEntityId[], refresh?: boolean, dry?: boolean }) {
  const results = await cache_.getMany({
    keysAndArgs: wdIds.map(wdId => {
      const key = `wd:enriched:${wdId}`
      const args = [ wdId, refresh ]
      return [ key, args ]
    }),
    fn: getEnrichedEntity,
    refresh,
    dry,
  })
  return keyBy(results, 'wdId')
}

async function getCachedEnrichedEntity ({ wdId, refresh, dry }: { wdId: WdEntityId, refresh?: boolean, dry?: boolean }) {
  const key = `wd:enriched:${wdId}`
  const fn = getEnrichedEntity.bind(null, wdId, refresh)
  return cache_.get({ key, fn, refresh, dry })
}

type MissingWdEntity = { id: WdEntityId, missing: true }

async function getEnrichedEntity (wdId: WdEntityId, refresh: boolean) {
  const entity = await getWdEntity(wdId)
  const preFormatWdEntity = entity || ({ id: wdId, missing: true } as MissingWdEntity)
  const formattedEntity = await format(preFormatWdEntity)
  addWdEntityToIndexationQueue(wdId)
  // Restrict 'wikidata:entity:refreshed' event to explict refresh request
  // to avoid triggering snowballing item snapshot refreshes
  if (refresh) {
    // Do not await for this emit, as the listeners might call getEntitiesByUris
    // which would trigger a hanging loop
    emit('wikidata:entity:refreshed', formattedEntity)
  }
  return formattedEntity
}

async function format (entity: RawWdEntity | MissingWdEntity) {
  if ('missing' in entity) return formatEmpty('missing', entity)

  const { P31 } = entity.claims
  let type
  if (P31) {
    // /!\ This is a different type (edition, work, etc) than Wikibase entity type (item, property, etc)
    type = getWdEntityType(entity)
  }

  if (type === 'meta') {
    return formatEmpty('meta', entity)
  } else {
    return formatValidEntity(entity, type)
  }
}

async function formatValidEntity (entity: RawWdEntity, type: ExtendedEntityType) {
  const formattedClaims = formatClaims(entity.claims, type)
  const { id: wdId } = entity
  const wdUri = `wd:${wdId}` as WdEntityUri
  const isbnUri = getIsbnUriFromClaims(formattedClaims)
  // When available, prefer the ISBN to the Wikidata id, as Wikidata editions are more likely to be disurpted
  // Ex: A Wikidata edition might be turned into a work, while an inventory item would still want
  // to hold a reference to the edition entity
  let uri: EntityUri
  if (isbnUri) {
    uri = isbnUri
    formattedClaims['invp:P1'] = [ wdUri ]
  } else {
    uri = wdUri
  }
  const serializedEntity: Omit<SerializedWdEntity, 'image'> = {
    uri,
    wdId,
    type,
    labels: simplifyLabels(entity.labels),
    aliases: simplifyAliases(entity.aliases),
    descriptions: simplifyDescriptions(entity.descriptions),
    sitelinks: simplifySitelinks(entity.sitelinks, { keepBadges: true }) as SimplifiedSitelinks,
    claims: formattedClaims,
    originalLang: getOriginalLang(formattedClaims),
    // Required by server/db/elasticsearch/wikidata_entities_indexation_queue.js
    lastrevid: entity.lastrevid,
  }
  if (arrayIncludes(termsFromClaimsTypes, type)) {
    // @ts-expect-error
    setTermsFromClaims(serializedEntity)
  }

  await formatAndPropagateRedirection(entity, serializedEntity as SerializedWdEntity)
  await addImageData(serializedEntity)
  return serializedEntity as SerializedWdEntity
}

async function formatAndPropagateRedirection (entity: RawWdEntity, serializedEntity: SerializedWdEntity) {
  if (entity.redirects != null) {
    // Wikidata internal redirection
    const { from, to } = entity.redirects
    serializedEntity.redirects = {
      from: prefixifyWd(from),
      to: prefixifyWd(to),
    }

    // Take advantage of this request for a Wikidata entity to check
    // if there is a redirection we are not aware of, and propagate it:
    // if the redirected entity is used in Inventaire claims, redirect claims
    // to their new entity
    propagateRedirection(hookUserAcct, serializedEntity.redirects.from, serializedEntity.redirects.to)
    reindexWdEntity({ _id: unprefixify(serializedEntity.redirects.from), redirect: true })
    await emit('wikidata:entity:redirect', serializedEntity.redirects.from, serializedEntity.redirects.to)
  } else if (!isWdEntityUri(serializedEntity.uri)) {
    // Canonical uri redirection
    const wdUri = getFirstClaimValue(serializedEntity.claims, 'invp:P1') as WdEntityUri
    assertString(wdUri)
    serializedEntity.redirects = { from: wdUri, to: serializedEntity.uri }
  }
}

// Keeping just enough data to filter-out while not cluttering the cache
function formatEmpty (type: 'meta' | 'missing', entity: RawWdEntity | MissingWdEntity): SerializedEmptyWdEntity {
  return {
    wdId: entity.id,
    uri: `wd:${entity.id}`,
    type,
  }
}

function expandClaims (entity) {
  for (const [ property, propertyClaims ] of objectEntries(entity.claims)) {
    entity.claims[property] = propertyClaims.map(getClaimObjectFromClaim)
  }
  return entity
}
