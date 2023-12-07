import { uniq } from 'lodash-es'
import { getWorksAuthorsUris } from '#controllers/entities/lib/entities'
import { getEntitiesList } from '#controllers/entities/lib/get_entities_list'
import { getEntityByUri } from '#controllers/entities/lib/get_entity_by_uri'
import { error_ } from '#lib/error/error'

export default async item => {
  const { entity: uri } = item
  const entity = await getEntityByUri({ uri })
  if (!entity) throw error_.new('entity not found', 500, { item: item._id, uri })

  let works
  if (entity.type === 'edition') {
    item.edition = entity
    item.publisherUri = entity.claims['wdt:P123'] && entity.claims['wdt:P123'][0]
    if (item.publisherUri) {
      item.publisher = await getEntityByUri({ uri: item.publisherUri })
    }
    item.translatorsUris = entity.claims['wdt:P655']
    if (item.translatorsUris) {
      item.translators = await getEntitiesList(item.translatorsUris)
    }
    item.editionLangUri = entity.claims['wdt:P407'] && entity.claims['wdt:P407'][0]
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
    throw error_.new('invalid item entity type', 500, { item, entity })
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

const aggregateWorksRelationsUris = (works, relationsUrisGetter) => {
  return uniq(works.map(relationsUrisGetter).flat())
}

const getWorkSeriesUris = work => work.claims['wdt:P179']
const getWorkGenresUris = work => work.claims['wdt:P136']
const getWorkSubjetsUris = work => work.claims['wdt:P921']
const getWorkOriginalLangsUris = work => work.claims['wdt:P407']
