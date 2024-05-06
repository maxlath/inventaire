import { normalizeIsbn } from '#lib/isbn/isbn'
import { getFirstClaimValue, simplifyInvClaims } from '#models/entity'
import type { InvEntity, IsbnEntityUri } from '#server/types/entity'
import { formatEntityCommon } from './format_entity_common.js'

export function formatEditionEntity (entity: InvEntity) {
  const isbn = getFirstClaimValue(entity.claims, 'wdt:P212')
  return formatEntityCommon({
    ...entity,
    uri: `isbn:${normalizeIsbn(isbn)}` as IsbnEntityUri,
    type: 'edition',
    claims: simplifyInvClaims(entity.claims),
  })
}
