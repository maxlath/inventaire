import { pick } from 'lodash-es'
import { getAggregatedPropertiesValues, getEntitiesAggregatedPropertiesValues } from '#controllers/entities/lib/entities'
import { getEntityByUri } from '#controllers/entities/lib/federation/instance_agnostic_entities'
import { getClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { editionAuthorRelationsProperties, workAuthorRelationsProperties } from '#controllers/entities/lib/properties/properties'
import { objectValues } from '#lib/utils/base'
import type { EntityUri, SerializedEntitiesByUris, SerializedEntity } from '#types/entity'
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
    return buildSnapshot.work(work as SerializedEntity, authors, series)
  },
}

export const buildSnapshotFromEntitiesByType = {
  edition: (edition: SerializedEntity, entitiesByUris: SerializedEntitiesByUris) => {
    const worksUris = edition.claims['wdt:P629'].map(getClaimValue) as EntityUri[]
    const works = objectValues(pick(entitiesByUris, worksUris))
    const worksAuthorsUris = getEntitiesAggregatedPropertiesValues(works, workAuthorRelationsProperties)
    const worksSeriesUris = getEntitiesAggregatedPropertiesValues(works, [ 'wdt:P179' ])
    const editionsAuthorsUris = getAggregatedPropertiesValues(edition.claims, editionAuthorRelationsProperties) as EntityUri[]
    const authors = objectValues(pick(entitiesByUris, worksAuthorsUris.concat(editionsAuthorsUris)))
    const series = objectValues(pick(entitiesByUris, worksSeriesUris))
    return buildSnapshot.edition(edition, works, authors, series)
  },

  work: (work: SerializedEntity, entitiesByUris: SerializedEntitiesByUris) => {
    const worksAuthorsUris = getAggregatedPropertiesValues(work.claims, workAuthorRelationsProperties)
    const worksSeriesUris = getAggregatedPropertiesValues(work.claims, [ 'wdt:P179' ])
    const authors = objectValues(pick(entitiesByUris, worksAuthorsUris))
    const series = objectValues(pick(entitiesByUris, worksSeriesUris))
    return buildSnapshot.work(work, authors, series)
  },
}
