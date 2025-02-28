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

import { getEntityByUri } from '#controllers/entities/lib/federation/instance_agnostic_entities'
import { getSnapshotByType } from '#controllers/items/lib/snapshot/refresh_snapshot'
import { assertString } from '#lib/utils/assert_types'
import { logError } from '#lib/utils/logs'
import type { EntityUri } from '#types/entity'
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
