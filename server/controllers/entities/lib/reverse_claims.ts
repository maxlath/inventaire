import { compact, flatten } from 'lodash-es'
import { minimizeSimplifiedSparqlResults, simplifySparqlResults } from 'wikibase-sdk'
import wdk from 'wikibase-sdk/wikidata.org'
import { getInvEntitiesByClaim } from '#controllers/entities/lib/entities'
import { prefixifyWd, unprefixify } from '#controllers/entities/lib/prefix'
import { getPropertyDatatype } from '#controllers/entities/lib/properties/properties_values_constraints'
import { getCachedRelations } from '#controllers/entities/lib/temporarily_cache_relations'
import { runWdQuery } from '#data/wikidata/run_query'
import { isEntityUri, isWdPropertyUri } from '#lib/boolean_validations'
import { cache_ } from '#lib/cache'
import { newError } from '#lib/error/error'
import { requests_ } from '#lib/requests'
import { assertStrings } from '#lib/utils/assert_types'
import { log } from '#lib/utils/logs'
import type { AbsoluteUrl } from '#types/common'
import type { EntityUri, InvSnakValue, PropertyUri, WdEntityId, WdPropertyUri } from '#types/entity'
import { getInvEntityCanonicalUri } from './get_inv_entity_canonical_uri.js'
import { getEntitiesPopularities } from './popularity.js'

const { getReverseClaims: buildGetReverseClaimsUrl } = wdk

const caseInsensitiveProperties = [
  'wdt:P2002',
]

const denylistedProperties = [
  // Too many results, can't be sorted
  'wdt:P31',
  'wdt:P407',
]

export interface ReverseClaimsParams {
  property?: PropertyUri
  value?: InvSnakValue
  refresh?: boolean
  sort?: boolean
  dry?: boolean
}

export async function getReverseClaims (params: ReverseClaimsParams) {
  const { property, value, refresh, sort, dry } = params
  assertStrings([ property, value ])

  if (denylistedProperties.includes(property)) {
    throw newError('denylisted property', 400, { property })
  }

  const foundUris = await Promise.all([
    requestWikidataReverseClaims(property, value, refresh, dry),
    getReverseClaimsFromCachedRelations(property, value),
    invReverseClaims(property, value),
  ])
  const uris = compact(flatten(foundUris)) as EntityUri[]

  if (sort) {
    const scores = await getEntitiesPopularities({ uris })
    return uris.sort(sortByScore(scores))
  } else {
    return uris
  }
}

async function requestWikidataReverseClaims (property: PropertyUri, value: InvSnakValue, refresh?: boolean, dry?: boolean) {
  if (!isWdPropertyUri(property)) return []
  if (isEntityUri(value)) {
    const [ prefix, id ] = value.split(':')
    // If the prefix is 'inv' or 'isbn', no need to check Wikidata
    if (prefix === 'wd') return wikidataReverseClaims(property, id, refresh, dry)
  } else {
    return wikidataReverseClaims(property, value, refresh, dry)
  }
}

async function wikidataReverseClaims (property: WdPropertyUri, value: InvSnakValue, refresh?: boolean, dry?: boolean) {
  if (property in typeTailoredQuery) {
    // TODO: Find the proper way to get property type to be narrowed down to typeTailoredQuery keys without needing a type assertion
    const type = typeTailoredQuery[property as keyof typeof typeTailoredQuery]
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
  const url = buildGetReverseClaimsUrl({ properties: wdProp, values: value, caseInsensitive }) as AbsoluteUrl
  const results = await requests_.get(url)
  return minimizeSimplifiedSparqlResults(simplifySparqlResults(results))
  .map(wdId => prefixifyWd(wdId))
}

async function invReverseClaims (property: PropertyUri, value: InvSnakValue) {
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
} as const

const sortByScore = scores => (a, b) => scores[b] - scores[a]

async function getReverseClaimsFromCachedRelations (property: PropertyUri, value: InvSnakValue) {
  if (!isWdPropertyUri(property)) return []
  if (getPropertyDatatype(property) === 'entity') {
    return getCachedRelations({
      valueUri: value as EntityUri,
      properties: [ property ],
      formatEntity: entity => entity.uri,
    })
  }
}
