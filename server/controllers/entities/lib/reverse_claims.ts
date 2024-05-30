import { compact, flatten } from 'lodash-es'
import { minimizeSimplifiedSparqlResults, simplifySparqlResults } from 'wikibase-sdk'
import wdk from 'wikibase-sdk/wikidata.org'
import { getInvEntitiesByClaim } from '#controllers/entities/lib/entities'
import { prefixifyWd, unprefixify } from '#controllers/entities/lib/prefix'
import { getPropertyDatatype } from '#controllers/entities/lib/properties/properties_values_constraints'
import { getCachedRelations } from '#controllers/entities/lib/temporarily_cache_relations'
import runWdQuery from '#data/wikidata/run_query'
import { isEntityUri } from '#lib/boolean_validations'
import { cache_ } from '#lib/cache'
import { newError } from '#lib/error/error'
import { requests_ } from '#lib/requests'
import { assert_ } from '#lib/utils/assert_types'
import { log } from '#lib/utils/logs'
import type { EntityUri, InvSnakValue, WdEntityId, WdPropertyUri } from '#server/types/entity'
import type { Url } from '#types/common'
import { getInvEntityCanonicalUri } from './get_inv_entity_canonical_uri.js'
import { getEntitiesPopularities } from './popularity.js'

const { getReverseClaims } = wdk

const caseInsensitiveProperties = [
  'wdt:P2002',
]

const denylistedProperties = [
  // Too many results, can't be sorted
  'wdt:P31',
  'wdt:P407',
]

interface ReverseClaimsParams {
  property?: WdPropertyUri
  value?: InvSnakValue
  refresh?: boolean
  sort?: boolean
  dry?: boolean
}

export async function reverseClaims (params: ReverseClaimsParams) {
  const { property, value, refresh, sort, dry } = params
  assert_.strings([ property, value ])

  if (denylistedProperties.includes(property)) {
    throw newError('denylisted property', 400, { property })
  }

  return Promise.all([
    requestWikidataReverseClaims(property, value, refresh, dry),
    getReverseClaimsFromCachedRelations(property, value),
    invReverseClaims(property, value),
  ])
  .then(flatten)
  .then(compact)
  .then(uris => {
    if (!sort) return uris

    return getEntitiesPopularities({ uris })
    .then(scores => uris.sort(sortByScore(scores)))
  })
}

function requestWikidataReverseClaims (property: WdPropertyUri, value: InvSnakValue, refresh?: boolean, dry?: boolean) {
  if (isEntityUri(value)) {
    const [ prefix, id ] = value.split(':')
    // If the prefix is 'inv' or 'isbn', no need to check Wikidata
    if (prefix === 'wd') return wikidataReverseClaims(property, id, refresh, dry)
  } else {
    return wikidataReverseClaims(property, value, refresh, dry)
  }
}

async function wikidataReverseClaims (property: WdPropertyUri, value: InvSnakValue, refresh?: boolean, dry?: boolean) {
  const type = typeTailoredQuery[property]
  if (type != null) {
    const pid = unprefixify(property)
    const results = await runWdQuery({ query: `${type}_reverse_claims`, pid, qid: value as WdEntityId, refresh, dry })
    return results.map(prefixifyWd)
  } else {
    return generalWikidataReverseClaims(property, value, refresh, dry)
  }
}

function generalWikidataReverseClaims (property: WdPropertyUri, value: InvSnakValue, refresh?: boolean, dry?: boolean) {
  const key = `wd:reverse-claim:${property}:${value}`
  const fn = _wikidataReverseClaims.bind(null, property, value)
  return cache_.get({ key, fn, refresh, dry, dryFallbackValue: [] })
}

async function _wikidataReverseClaims (property: WdPropertyUri, value: InvSnakValue) {
  const caseInsensitive = caseInsensitiveProperties.includes(property)
  const wdProp = unprefixify(property)
  log([ property, value ], 'reverse claim')
  const url = getReverseClaims({ properties: wdProp, values: value, caseInsensitive }) as Url
  const results = await requests_.get(url)
  return minimizeSimplifiedSparqlResults(simplifySparqlResults(results))
  .map(wdId => prefixifyWd(wdId))
}

async function invReverseClaims (property: WdPropertyUri, value: InvSnakValue) {
  try {
    const entities = await getInvEntitiesByClaim(property, value, true, true)
    return entities.map(getInvEntityCanonicalUri)
  } catch (err) {
    // Allow to request reverse claims for properties that aren't yet
    // allowlisted to be added to inv properties: simply ignore inv entities
    if (err.message === "property isn't allowlisted") return []
    else throw err
  }
}

// Customize queries to tailor for specific types of results
// Ex: 'wdt:P921' reverse claims should not include films, etc
// but only works or series
const typeTailoredQuery = {
  // country of citizenship
  'wdt:P27': 'humans',
  // educated at
  'wdt:P69': 'humans',
  // native language
  'wdt:P103': 'humans',
  // occupation
  'wdt:P106': 'humans',
  // publisher
  'wdt:P123': 'editions',
  // award received
  'wdt:P166': 'humans',
  // genre
  'wdt:P135': 'humans',
  // movement
  'wdt:P136': 'works',
  // collection
  'wdt:P195': 'editions',
  // language of work
  'wdt:P407': 'works',
  // edition or translation of
  'wdt:P629': 'editions',
  // translator
  'wdt:P655': 'editions',
  // characters
  'wdt:P674': 'works',
  // narrative location
  'wdt:P840': 'works',
  // main subject
  'wdt:P921': 'works',
  // inspired by
  'wdt:P941': 'works',
}

const sortByScore = scores => (a, b) => scores[b] - scores[a]

async function getReverseClaimsFromCachedRelations (property: WdPropertyUri, value: InvSnakValue) {
  if (getPropertyDatatype(property) === 'entity') {
    return getCachedRelations({
      valueUri: value as EntityUri,
      properties: [ property ],
      formatEntity: entity => entity.uri,
    })
  }
}
