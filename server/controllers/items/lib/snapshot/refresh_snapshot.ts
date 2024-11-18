import { getInvEntitiesUrisByClaims, getInvUrisByClaim } from '#controllers/entities/lib/entities'
import { workAuthorRelationsProperties } from '#controllers/entities/lib/properties/properties'
import { getEntitiesByUris, getEntityByUri } from '#controllers/entities/lib/remote/instance_agnostic_entities'
import { saveSnapshotsInBatch } from '#controllers/items/lib/snapshot/snapshot'
import { debounceByKey } from '#lib/debounce_by_key'
import { info, warn } from '#lib/utils/logs'
import config from '#server/config'
import type { EntityUri, InvEntityDoc, PropertyUri, SerializedEntity } from '#types/entity'
import buildSnapshot from './build_snapshot.js'
import { getWorkAuthorsAndSeries, getEditionGraphEntities } from './get_entities.js'
import { getEntityUriAndType } from './helpers.js'

const { snapshotsDebounceTime } = config

async function refreshSnapshotFromEntity (changedEntityDoc: InvEntityDoc | SerializedEntity) {
  const { uri, type } = getEntityUriAndType(changedEntityDoc)
  if (!refreshTypes.includes(type)) return

  info(`items snapshot refresh: start  ${uri}`)
  const ops = await getSnapshotsByType[type](uri)
  info(`items snapshot refresh: saving ${uri}`)
  return saveSnapshotsInBatch(ops)
}

export async function refreshSnapshotFromUri (changedEntityUri: EntityUri) {
  const entity = await getEntityByUri({ uri: changedEntityUri })
  if (entity) {
    return refreshSnapshotFromEntity(entity)
  } else {
    warn({ changedEntityUri }, 'cannot refresh snapshot: entity not found')
  }
}

export const lazyRefreshSnapshotFromUri = debounceByKey(refreshSnapshotFromUri, snapshotsDebounceTime)

export function lazyRefreshSnapshotFromEntity (changedEntityDoc: InvEntityDoc | SerializedEntity) {
  const { uri } = getEntityUriAndType(changedEntityDoc)
  lazyRefreshSnapshotFromUri(uri)
}

const multiWorkRefresh = (relationProperties: PropertyUri[]) => async (uri: EntityUri) => {
  const uris = await getInvEntitiesUrisByClaims(relationProperties, uri)
  const snapshots = await Promise.all(uris.map(getSnapshotsByType.work))
  return snapshots.flat()
}

const getSnapshotsByType = {
  edition: (uri: EntityUri) => {
    // Get all the entities docs required to build the snapshot
    return getEditionGraphEntities(uri)
    // Build common updated snapshot
    .then(getEditionSnapshot)
  },

  work: async (uri: EntityUri) => {
    const work = await getEntityByUri({ uri })
    const [ authors, series ] = await getWorkAuthorsAndSeries(work)
    const snapshots = await Promise.all([
      getWorkSnapshot(work, authors, series),
      getEditionsSnapshots(uri, [ work ], authors, series),
    ])
    return snapshots.flat()
  },

  human: multiWorkRefresh(workAuthorRelationsProperties),
  serie: multiWorkRefresh([ 'wdt:P179' ]),
}

const refreshTypes = Object.keys(getSnapshotsByType)

function getWorkSnapshot (work: SerializedEntity, authors: SerializedEntity[], series: SerializedEntity[]) {
  return buildSnapshot.work(work, authors, series)
}

async function getEditionsSnapshots (uri: EntityUri, works: SerializedEntity[], authors: SerializedEntity[], series: SerializedEntity[]) {
  const uris = await getInvUrisByClaim('wdt:P629', uri)
  const res = await getEntitiesByUris({ uris })
  const editions = Object.values(res.entities)
  return Promise.all(editions.map(edition => {
    return getEditionSnapshot([ edition, works, authors, series ])
  }))
}

function getEditionSnapshot ([ edition, works, authors, series ]: [ SerializedEntity, SerializedEntity[], SerializedEntity[], SerializedEntity[] ]) {
  return buildSnapshot.edition(edition, works, authors, series)
}
