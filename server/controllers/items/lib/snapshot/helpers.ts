import { chain } from 'lodash-es'
import { isNonEmptyArray } from '#lib/boolean_validations'
import { getBestLangValue } from '#lib/get_best_lang_value'
import { assertArray, assertString } from '#lib/utils/assert_types'
import { warn } from '#lib/utils/logs'
import type { PropertyUri, SerializedEntity } from '#types/entity'

export function getNames (preferedLang, entities) {
  if (!isNonEmptyArray(entities)) return

  return entities
  .map(getName(preferedLang))
  .join(', ')
}

export function aggregateClaims (entities: SerializedEntity[], property: PropertyUri) {
  assertArray(entities)
  assertString(property)

  return chain(entities)
  .filter(entity => {
    const hasClaims = (entity.claims != null)
    if (hasClaims) return true
    // Trying to identify how entities with no claims arrive here
    warn(entity, 'entity with no claim at aggregateClaims')
    return false
  })
  .map(entity => entity.claims[property])
  .flatten()
  .compact()
  .uniq()
  .value()
}

const getName = lang => entity => {
  const { originalLang, labels } = entity
  return getBestLangValue(lang, originalLang, labels).value
}
