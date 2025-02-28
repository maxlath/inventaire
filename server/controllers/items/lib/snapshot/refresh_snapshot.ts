import { getEntityByUri } from '#controllers/entities/lib/federation/instance_agnostic_entities'
import type { EntityUri } from '#types/entity'
import buildSnapshot from './build_snapshot.js'
import { getWorkAuthorsAndSeries, getEditionGraphEntities } from './get_entities.js'

export const getSnapshotByType = {
  edition: async (uri: EntityUri) => {
    // Get all the entities docs required to build the snapshot
    const [ edition, works, authors, series ] = await getEditionGraphEntities(uri)
    // Build common updated snapshot
    return buildSnapshot.edition(edition, works, authors, series)
  },

  work: async (uri: EntityUri) => {
    const work = await getEntityByUri({ uri })
    const [ authors, series ] = await getWorkAuthorsAndSeries(work)
    return buildSnapshot.work(work, authors, series)
  },
}
