import { isEqual } from 'lodash-es'
import { getEntitiesByIsbns } from '#controllers/entities/lib/get_entities_by_isbns'
import { getEntitiesList } from '#controllers/entities/lib/get_entities_list'
import { getEntityByUri } from '#controllers/entities/lib/get_entity_by_uri'
import { haveExactMatch } from '#controllers/entities/lib/labels_match'
import mergeEntities from '#controllers/entities/lib/merge_entities'
import { getSuggestionsAndCreateTasks } from '#controllers/tasks/lib/merge_or_create_tasks'
import { newError, notFoundError } from '#lib/error/error'
import type { SerializedEntity, EntityUri } from '#types/entity'
import type { UserAccountUri } from '#types/server'

export default async function (workUri: EntityUri, isbn: string, userAcct: UserAccountUri) {
  const work = await getEntityByUri({ uri: workUri })
  if (work == null) throw notFoundError({ workUri })

  // Make sure workUri isn't a redirection
  workUri = work.uri

  const { type } = work
  if (type !== 'work') {
    throw newError(`unsupported type: ${type}, only work is supported`, 400, { workUri, work })
  }
  const editionsRes = await getEntitiesByIsbns([ isbn ])
  const edition = editionsRes.entities[0]
  const editionWorksUris = edition.claims['wdt:P629'] as EntityUri[]
  if (isEqual(editionWorksUris, [ workUri ])) return
  const editionWorks = await getEntitiesList(editionWorksUris)
  const toEntities = await mergeIfLabelsMatch(work, editionWorks, userAcct)
  if (toEntities.length === 0) return

  return getSuggestionsAndCreateTasks({
    type: 'deduplicate',
    entitiesType: type,
    toEntities,
    fromEntity: work,
    userAcct,
    clue: isbn,
  })
}

export async function mergeIfLabelsMatch (fromEntity: SerializedEntity, toEntities: SerializedEntity[], userAcct: UserAccountUri) {
  const fromEntityLabels = Object.values(fromEntity.labels)
  for (const toEntity of toEntities) {
    const toEntityLabels = Object.values(toEntity.labels)
    if (haveExactMatch(fromEntityLabels, toEntityLabels)) {
      await mergeEntities({
        userAcct,
        fromUri: fromEntity.uri,
        toUri: toEntity.uri,
      })
      return [] // no suggestions
    }
  }
  return toEntities
}
