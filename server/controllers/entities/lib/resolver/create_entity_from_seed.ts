import { chain, compact, map } from 'lodash-es'
import { findClaimByValue, getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { convertAndCleanupImageUrl } from '#controllers/images/lib/convert_and_cleanup_image_url'
import { getImageByIsbn } from '#data/dataseed/dataseed'
import { isNonEmptyString } from '#lib/boolean_validations'
import { toIsbn13h } from '#lib/isbn/isbn'
import { arrayIncludes } from '#lib/utils/base'
import { logError, warn } from '#lib/utils/logs'
import type { Claims, EntityType, InvSimplifiedPropertyClaims, PropertyUri } from '#types/entity'
import type { BatchId } from '#types/patch'
import type { EditionSeed, EntitySeed } from '#types/resolver'
import type { UserAccountUri } from '#types/server'
import { createInvEntity } from '../create_inv_entity.js'
import { propertiesValuesConstraints as properties } from '../properties/properties_values_constraints.js'

export const createAuthor = (userAcct: UserAccountUri, batchId: BatchId) => (author: EntitySeed) => {
  if (author.uri != null) return author
  addClaimIfValid(author.claims, 'wdt:P31', [ 'wd:Q5' ], 'human')
  return createEntityFromSeed({ seed: author, userAcct, batchId })
}

export const createWork = (userAcct: UserAccountUri, batchId: BatchId, authors: EntitySeed[]) => (work: EntitySeed) => {
  if (work.uri != null) return work
  const authorsUris = compact(map(authors, 'uri'))
  addClaimIfValid(work.claims, 'wdt:P31', [ 'wd:Q47461344' ], 'work')
  addClaimIfValid(work.claims, 'wdt:P50', authorsUris)
  return createEntityFromSeed({ seed: work, userAcct, batchId })
}

export async function createEdition (edition: EditionSeed, works: EntitySeed[], userAcct: UserAccountUri, batchId: BatchId, enrich?: boolean) {
  if (edition.uri != null) return

  const { isbn } = edition
  let { image: imageUrl } = edition
  const worksUris = compact(map(works, 'uri'))

  addClaimIfValid(edition.claims, 'wdt:P31', [ 'wd:Q3331189' ], 'edition')
  addClaimIfValid(edition.claims, 'wdt:P629', worksUris)

  if (isbn != null) {
    const hyphenatedIsbn = toIsbn13h(isbn)
    addClaimIfValid(edition.claims, 'wdt:P212', [ hyphenatedIsbn ])
  }

  const titleClaims = edition.claims['wdt:P1476']
  if (titleClaims == null || titleClaims.length !== 1) {
    const title = buildBestEditionTitle(edition, works)
    if (isNonEmptyString(title)) {
      edition.claims['wdt:P1476'] = [ title ]
    }
  }
  if (getFirstClaimValue(edition.claims, 'wdt:P1476') && !getFirstClaimValue(edition.claims, 'wdt:P1680')) {
    extractSubtitleFromTitle(edition.claims)
  }

  // garantee that an edition shall not have label
  edition.labels = {}

  if (!imageUrl && !getFirstClaimValue(edition.claims, 'invp:P2') && enrich === true && isbn != null) {
    try {
      const { url } = await getImageByIsbn(isbn)
      imageUrl = url
    } catch (err) {
      if (err.statusCode !== 404) {
        logError(err, 'failed to find an image by ISBN')
      }
    }
  }

  if (imageUrl) {
    const { hash: imageHash } = await convertAndCleanupImageUrl({ url: imageUrl, container: 'entities' })
    if (imageHash) edition.claims['invp:P2'] = [ imageHash ]
  }

  return createEntityFromSeed({ seed: edition, userAcct, batchId })
}

// An entity type is required only for properties with validation functions requiring a type
// Ex: typedExternalId properties
function addClaimIfValid (claims: Claims, property: PropertyUri, values: InvSimplifiedPropertyClaims, entityType?: EntityType) {
  for (const value of values) {
    if (value != null && properties[property].validate({ value, entityType })) {
      claims[property] ??= []
      if (!arrayIncludes(claims[property], value)) {
        claims[property].push(value)
      }
    }
  }
}

async function createEntityFromSeed ({ seed, userAcct, batchId }: { seed: EntitySeed, userAcct: UserAccountUri, batchId: BatchId }) {
  let entity
  try {
    entity = await createInvEntity({
      labels: seed.labels,
      claims: seed.claims,
      userAcct,
      batchId,
    })
  } catch (err) {
    if (err.name === 'InvalidClaimValueError' || err.cause?.name === 'InvalidClaimValueError') {
      const { property, value } = err.context
      const invalidClaim = findClaimByValue(seed.claims[property], value)
      if (invalidClaim && !nonRecoverableProperties.has(property)) {
        warn(err, 'InvalidClaimValueError: removing invalid claim')
        seed.claims[property] = seed.claims[property].filter(claim => claim !== invalidClaim)
        return createEntityFromSeed({ seed, userAcct, batchId })
      } else {
        logError(err, 'invalid claim not found, cant recover seed')
      }
    }
    throw err
  }

  seed.uri = entity.uri
  seed.created = true
  // Do not just merge objects, as the created flag
  // would be overriden by the created timestamp
  seed.labels = entity.labels
  seed.claims = entity.claims
}

const nonRecoverableProperties = new Set([
  'wdt:P212',
  'wdt:P957',
])

function buildBestEditionTitle (edition, works) {
  const editionTitleClaim = getFirstClaimValue(edition.claims, 'wdt:P1476')
  if (editionTitleClaim) return editionTitleClaim
  else return guessEditionTitleFromWorksLabels(works)
}

// TODO: give priority to work label in the edition lang
// if this one is known
function guessEditionTitleFromWorksLabels (works) {
  return chain(works)
  .flatMap(work => Object.values(work.labels))
  .uniq()
  .join(' - ')
  .value()
}

function extractSubtitleFromTitle (claims) {
  let title = getFirstClaimValue(claims, 'wdt:P1476')
  let subtitle
  if (title.length > 10 && title.split(subtitleSeparator).length === 2) {
    [ title, subtitle ] = title.split(subtitleSeparator)
    claims['wdt:P1476'] = [ title.trim() ]
    claims['wdt:P1680'] = [ subtitle.trim() ]
  }
}

const subtitleSeparator = /[-—:] /
