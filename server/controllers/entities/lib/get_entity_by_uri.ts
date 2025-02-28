import { newError } from '#lib/error/error'
import { assertString } from '#lib/utils/assert_types'
import type { EntityUri } from '#types/entity'
import { getEntitiesByUris, getExpandedEntitiesByUris, type EntitiesGetterParams } from './get_entities_by_uris.js'

export type GetEntityByUriArgs = Omit<EntitiesGetterParams, 'uris' | 'includeReferences'> & { uri: EntityUri }

// Get only the entity formatted doc you needs instead of an object
// with entities and redirects
export async function getEntityByUri ({ uri, refresh, dry }: GetEntityByUriArgs) {
  assertString(uri)
  const uris = [ uri ]
  const { entities } = await getEntitiesByUris({ uris, refresh, dry })
  const entity = Object.values(entities)[0]
  if (entity) return entity
  else throw newError('entity not found', 404, { uri })
}

export async function getExpandedEntityByUri ({ uri, refresh, dry }: GetEntityByUriArgs) {
  assertString(uri)
  const uris = [ uri ]
  const { entities } = await getExpandedEntitiesByUris({ uris, refresh, dry })
  return Object.values(entities)[0]
}
