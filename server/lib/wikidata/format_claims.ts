import { pick } from 'lodash-es'
import { simplifyClaims, type Claims as WdClaims } from 'wikibase-sdk'
import { toIsbn13h } from '#lib/isbn/isbn'
import { assert_ } from '#lib/utils/assert_types'
import type { SimplifiedClaimsIncludingWdExtra } from '#server/types/entity'
import { allowlistedProperties } from './allowlisted_properties.js'
import { flattenQualifierProperties } from './data_model_adapter.js'

const options = {
  entityPrefix: 'wd',
  propertyPrefix: 'wdt',
  timeConverter: 'simple-day',
} as const

export function formatClaims (claims: WdClaims) {
  assert_.object(claims)
  const allowlistedClaims = pick(claims, allowlistedProperties)
  const simplifiedClaims: Partial<SimplifiedClaimsIncludingWdExtra> = simplifyClaims(allowlistedClaims, options)
  setInferredClaims(simplifiedClaims)

  flattenQualifierProperties(simplifiedClaims, allowlistedClaims)

  return simplifiedClaims
}

function setInferredClaims (claims: Partial<SimplifiedClaimsIncludingWdExtra>) {
  if (claims['wdt:P957']?.length === 1 && !claims['wdt:P212']) {
    const isbn10h = claims['wdt:P957'][0]
    const isbn13h = toIsbn13h(isbn10h)
    if (isbn13h) claims['wdt:P212'] = [ isbn13h ]
  }
}
