import { difference, map, uniq } from 'lodash-es'
import { getEntitiesByUris } from '#controllers/entities/lib/federation/instance_agnostic_entities'
import { warn } from '#lib/utils/logs'
import type { SerializedEntitiesByUris } from '#types/entity'

export async function replaceEditionsByTheirWork (entities: SerializedEntitiesByUris) {
  const { works, editions } = splitEntities(entities)
  const worksUris = map(works, 'uri')
  const data = { editionsWorksUris: [], editionWorkMap: {} }
  let { editionsWorksUris, editionWorkMap } = editions.reduce(aggregateEditionsWorksUris, data)
  // Do no refetch works already fetched
  editionsWorksUris = uniq(difference(editionsWorksUris, worksUris))
  return getEntitiesByUris({ uris: editionsWorksUris })
  .then(({ entities }) => entities)
  .then(editionsWorksEntities => {
    return {
      works: works.concat(Object.values(editionsWorksEntities)),
      editionWorkMap,
    }
  })
}

function splitEntities (entities: SerializedEntitiesByUris) {
  const entitiesByTypes = { works: [], editions: [] }
  for (const entity of Object.values(entities)) {
    const { type } = entity
    if (type === 'work') entitiesByTypes.works.push(entity)
    else if (type === 'edition') entitiesByTypes.editions.push(entity)
    else warn(entity, 'invalid item entity type')
  }
  return entitiesByTypes
}

function aggregateEditionsWorksUris (data, edition) {
  const worksUris = edition.claims['wdt:P629']
  if (worksUris != null) {
    data.editionWorkMap[edition.uri] = worksUris
    data.editionsWorksUris.push(...worksUris)
  } else {
    warn(edition, 'edition without work')
  }
  return data
}
