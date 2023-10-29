import { map, uniq, intersection } from 'lodash-es'
import { getInvEntitiesByClaim } from '#controllers/entities/lib/entities'
import { getEntitiesByUris } from '#controllers/entities/lib/get_entities_by_uris'
import getOccurrencesFromEntities from '#controllers/entities/lib/get_occurrences_from_entities'
import getOccurrencesFromExternalSources from '#controllers/entities/lib/get_occurrences_from_external_sources'
import { haveExactMatch } from '#controllers/entities/lib/labels_match'
import properties from '#controllers/entities/lib/properties/properties_values_constraints'
import { getEntityNormalizedTerms } from '#controllers/entities/lib/terms_normalization'
import typeSearch from '#controllers/search/lib/type_search'
import { isNonEmptyString, isNonEmptyArray } from '#lib/boolean_validations'
import { forceArray } from '#lib/utils/base'
import { automerge, validateAndAutomerge } from './automerge.js'

export default async function (entity, existingTasks) {
  const [ newSuggestions, suspectWorksData ] = await Promise.all([
    searchEntityDuplicatesSuggestions(entity),
    getAuthorWorksData(entity._id),
  ])
  if (newSuggestions.length <= 0) return []
  const { labels: worksLabels } = suspectWorksData
  return Promise.all(newSuggestions.map(addOccurrencesToSuggestion(suspectWorksData)))
  .then(filterOrMergeSuggestions(entity, worksLabels))
  .then(filterNewTasks(existingTasks))
}

const filterOrMergeSuggestions = (suspect, workLabels) => async suggestionsSearchResult => {
  const suspectUri = suspect.uri
  const uris = suggestionsSearchResult.map(suggestion => suggestion.uri)
  const { entities: suggestionsByUris } = await getEntitiesByUris({ uris })
  // Merge if entities have a common external identifier
  const suggestionUriCommonExternalId = await findSuggestionWithSameExternalId(suspect, suggestionsByUris)
  if (suggestionUriCommonExternalId) return automerge(suspectUri, suggestionUriCommonExternalId)

  const suspectTerms = getEntityNormalizedTerms(suspect)
  // Do not automerge if author name is in work title
  // as it confuses occurences found on Wikipedia pages
  if (haveExactMatch(suspectTerms, workLabels)) return suggestionsSearchResult

  const sourcedSuggestions = filterSourced(suggestionsSearchResult)
  if (sourcedSuggestions.length === 0) return suggestionsSearchResult
  if (sourcedSuggestions.length > 1) return sourcedSuggestions
  return validateAndAutomerge(suspectUri, sourcedSuggestions[0])
}

async function findSuggestionWithSameExternalId (suspect, suggestionsByUris) {
  // Known case: inv entity had an externalId before wd item
  // Using typeSearch results allows to only merge homonyms,
  // but could be switched to byClaimValue db request (?)
  const suspectExternalIds = getExternalIdsClaimsValues(suspect.claims)
  return Object.keys(suggestionsByUris).find(suggestionUri => {
    const { claims } = suggestionsByUris[suggestionUri]
    const suggestionExternalIds = getExternalIdsClaimsValues(claims)
    return isNonEmptyArray(intersection(suggestionExternalIds, suspectExternalIds))
  })
}

function getExternalIdsClaimsValues (claims) {
  const externalIdsClaims = []

  for (const prop in claims) {
    const values = claims[prop]
    if (properties[prop]) {
      const { isExternalId, format } = properties[prop]
      if (isExternalId) {
        forceArray(values).forEach(value => {
          if (format) value = format(value)
          externalIdsClaims.push(value)
        })
      }
    }
  }

  return externalIdsClaims
}

const filterNewTasks = existingTasks => suggestions => {
  const existingTasksUris = map(existingTasks, 'suggestionUri')
  return suggestions.filter(suggestion => !existingTasksUris.includes(suggestion.uri))
}

const filterSourced = suggestions => suggestions.filter(sug => sug.occurrences.length > 0)

const addOccurrencesToSuggestion = suspectWorksData => async suggestion => {
  if (suggestion == null) return []
  const { labels, langs } = suspectWorksData
  const { uri } = suggestion

  if (labels.length === 0) {
    suggestion.occurrences = []
    return suggestion
  }

  return Promise.all([
    getOccurrencesFromExternalSources(uri, labels, langs),
    getOccurrencesFromEntities(uri, labels),
  ])
  .then(([ externalOccurrences, entitiesOccurrences ]) => {
    suggestion.occurrences = externalOccurrences.concat(entitiesOccurrences)
    return suggestion
  })
}

const getAuthorWorksData = async authorId => {
  const works = await getInvEntitiesByClaim('wdt:P50', `inv:${authorId}`, true, true)
  // works = [
  //   { labels: { fr: 'Matiere et Memoire'} },
  //   { labels: { en: 'foo' } }
  // ]
  const labels = uniq(works.flatMap(getEntityNormalizedTerms))
  const langs = uniq(works.flatMap(getLangs))
  return { authorId, labels, langs }
}

const getLangs = work => Object.keys(work.labels)

const searchEntityDuplicatesSuggestions = async entity => {
  const name = Object.values(entity.labels)[0]
  if (!isNonEmptyString(name)) return []

  const { hits } = await typeSearch({
    search: name,
    types: [ 'humans' ],
    filter: 'wd',
    exact: true,
  })

  return hits.map(formatResult)
}

const formatResult = result => ({
  _score: result._score,
  uri: result._source.uri,
})
