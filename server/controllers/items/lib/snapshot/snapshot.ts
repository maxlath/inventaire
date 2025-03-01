// Entity data snapshots are an attributes of the snapshot object associated with item documents:
// - entity:title
// - entity:lang
// - entity:authors
// - entity:series
// - entity:image
// - entity:ordinal

// Their role is to keep a copy at hand of data deduced from the item's entity
// and its graph: typically, the edition the item is an instance of, the edition work,
// (or works in case of a multi-works edition), the work(s) authors, the serie(s)
// the work(s) might be part of.
// Being able to have a succint version of those data accessible from the cache
// would allows to display basic data or filter large lists of items by text
// without having to query from 3 to 10+ entities per item.
// But unfortunately, knowing wish entity snapshot to cache and invalidating that cache
// proved to be challanging, in particular in federated mode, thus the current implementation
// relying on the entities cache, rather than a cache dedicated to items snapshots

import { keyBy, map, partition, uniq } from 'lodash-es'
import { getEntitiesAggregatedPropertiesValues } from '#controllers/entities/lib/entities'
import { getEntityByUri, getEntitiesList } from '#controllers/entities/lib/federation/instance_agnostic_entities'
import { editionAuthorRelationsProperties, workAuthorRelationsProperties } from '#controllers/entities/lib/properties/properties'
import { buildSnapshotFromEntitiesByType, getSnapshotByType } from '#controllers/items/lib/snapshot/refresh_snapshot'
import { assertString } from '#lib/utils/assert_types'
import { logError, warn } from '#lib/utils/logs'
import type { EntityUri, SerializedEntitiesByUris, SerializedEntity } from '#types/entity'
import type { ItemSnapshot, SerializedItem } from '#types/item'

export async function addSnapshotToItem (item: SerializedItem) {
  if (item.snapshot) return item

  try {
    assertString(item.entity)
    item.snapshot = await getSnapshot(item.entity)
  } catch (err) {
    err.context ??= {}
    err.context.item = item
    logError(err, 'addSnapshotToItem error')
    item.snapshot ??= {}
  }

  return item
}

async function getSnapshot (uri: EntityUri) {
  const entity = await getEntityByUri({ uri })
  const { type } = entity
  if (getSnapshotByType[type] == null) return {}
  const { value: snapshot } = await getSnapshotByType[type](uri)
  return snapshot as ItemSnapshot
}

export async function addItemsSnapshots (items: SerializedItem[]) {
  const itemsEntitiesUris = uniq(map(items, 'entity'))
  // Bundle items related entities requests, to reduce requests overhead
  // Especially in federated mode
  const entitiesByUris = await getAggregatedItemsRelatedEntities(itemsEntitiesUris)
  for (const item of items) {
    item.snapshot = addSnapshotFromEntities(item, entitiesByUris)
  }
  return items
}

async function getAggregatedItemsRelatedEntities (itemsEntitiesUris: EntityUri[]) {
  const itemsEntities = (await getEntitiesList(itemsEntitiesUris)) as SerializedEntity[]
  const [ itemsEditions, itemsWorks ] = partition(itemsEntities, entity => entity.type === 'edition')
  const worksUris = getEntitiesAggregatedPropertiesValues(itemsEditions, [ 'wdt:P629' ]) as EntityUri[]
  const works = (await getEntitiesList(worksUris)) as SerializedEntity[]
  const allWorks = works.concat(itemsWorks)
  const authorsAndSeriesUris = getEntitiesAggregatedPropertiesValues(allWorks, [ 'wdt:P179', ...workAuthorRelationsProperties ]) as EntityUri[]
  const editionsAuthorsUris = getEntitiesAggregatedPropertiesValues(itemsEditions, editionAuthorRelationsProperties) as EntityUri[]
  const authorsAndSeries = (await getEntitiesList(authorsAndSeriesUris.concat(editionsAuthorsUris))) as SerializedEntity[]
  const allEntities = itemsEntities.concat(works, authorsAndSeries)
  return keyBy(allEntities, 'uri') as SerializedEntitiesByUris
}

function addSnapshotFromEntities (item: SerializedItem, entitiesByUris: SerializedEntitiesByUris) {
  const entity = entitiesByUris[item.entity]
  if (!entity) {
    warn(`item entity not found: ${item.entity}`)
    return {}
  }
  const { type } = entity
  if (getSnapshotByType[type] == null) {
    warn(`invalid item entity type: ${type} (uri: ${item.entity})`)
    return {}
  }
  try {
    const { value: snapshot } = buildSnapshotFromEntitiesByType[type](entity, entitiesByUris)
    return snapshot as ItemSnapshot
  } catch (err) {
    err.context ??= {}
    err.context.item = item._id
    err.context.entity = item.entity
    logError(err, 'failed to build item snapshot')
    return {}
  }
}
