import { uniq } from 'lodash-es'
import { getWorksAuthorsUris } from '#controllers/entities/lib/entities'
import { getEntitiesList, getEntityByUri } from '#controllers/entities/lib/federation/instance_agnostic_entities'
import { getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { newError } from '#lib/error/error'

export default async function (item) {
  const { entity: uri } = item
  const entity = await getEntityByUri({ uri })
  if (!entity) throw newError('entity not found', 500, { item: item._id, uri })

  let works
  if (entity.type === 'edition') {
    item.edition = entity
    item.publisherUri = getFirstClaimValue(entity.claims, 'wdt:P123')
    if (item.publisherUri) {
      item.publisher = await getEntityByUri({ uri: item.publisherUri })
    }
    item.translatorsUris = entity.claims['wdt:P655']
    if (item.translatorsUris) {
      item.translators = await getEntitiesList(item.translatorsUris)
    }
    item.editionLangUri = getFirstClaimValue(entity.claims, 'wdt:P407')
    if (item.editionLangUri) {
      item.editionLang = await getEntityByUri({ uri: item.editionLangUri })
    }
    item.worksUris = entity.claims['wdt:P629']
    works = await getEntitiesList(item.worksUris)
  } else if (entity.type === 'work') {
    item.worksUris = [ uri ]
    works = [ entity ]
  } else {
    // Known case: if an item is associated to an Wikidata entity which type was changed
    throw newError('invalid item entity type', 500, { item, entity })
  }

  item.works = works
  item.authorsUris = getWorksAuthorsUris(works)
  item.seriesUris = aggregateWorksRelationsUris(works, getWorkSeriesUris)
  item.genresUris = aggregateWorksRelationsUris(works, getWorkGenresUris)
  item.subjectsUris = aggregateWorksRelationsUris(works, getWorkSubjetsUris)
  item.originalLangsUris = aggregateWorksRelationsUris(works, getWorkOriginalLangsUris)

  const [ authors, series, genres, subjects, originalLangs ] = await Promise.all([
    getEntitiesList(item.authorsUris),
    getEntitiesList(item.seriesUris),
    getEntitiesList(item.genresUris),
    getEntitiesList(item.subjectsUris),
    getEntitiesList(item.originalLangsUris),
  ])

  item.authors = authors
  item.series = series
  item.genres = genres
  item.subjects = subjects
  item.originalLangs = originalLangs

  return item
}

function aggregateWorksRelationsUris (works, relationsUrisGetter) {
  return uniq(works.map(relationsUrisGetter).flat())
}

const getWorkSeriesUris = work => work.claims['wdt:P179']
const getWorkGenresUris = work => work.claims['wdt:P136']
const getWorkSubjetsUris = work => work.claims['wdt:P921']
const getWorkOriginalLangsUris = work => work.claims['wdt:P407']
