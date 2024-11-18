import type { GetEntitiesByUrisResponse } from '#controllers/entities/by_uris_get'
import type { GetEntitiesByUrisParams } from '#controllers/entities/lib/get_entities_by_uris'
import type { ReverseClaimsParams } from '#controllers/entities/lib/reverse_claims'
import { requests_ } from '#lib/requests'
import { buildUrl } from '#lib/utils/url'
import config from '#server/config'
import type { EntityUri } from '#server/types/entity'

const { remoteEntitiesOrigin } = config.federation

export async function getEntitiesByUrisFromRemoteInstance ({ uris }: Pick<GetEntitiesByUrisParams, 'uris'>) {
  // if (uris.length === 0) return { entities: {}, redirects: {} } as GetEntitiesByUrisResponse
  const path = buildUrl(`${remoteEntitiesOrigin}/api/entities`, { action: 'by-uris', uris: uris.join('|') })
  const res = await requests_.get(path)
  return res as GetEntitiesByUrisResponse
}

export async function getEntitiesListFromRemoteInstance (uris: EntityUri[]) {
  const { entities } = await getEntitiesByUrisFromRemoteInstance({ uris })
  return Object.values(entities)
}

export async function getEntityByUriFromRemoteInstance ({ uri }: { uri: EntityUri }) {
  const [ entity ] = await getEntitiesListFromRemoteInstance([ uri ])
  return entity
}

export async function getReverseClaimsFromRemoteInstance (params: ReverseClaimsParams) {
  const path = buildUrl(`${remoteEntitiesOrigin}/api/entities`, { action: 'reverse-claims', ...params })
  const { uris } = await requests_.get(path)
  return uris as EntityUri[]
}
