import { compact } from 'lodash-es'
import type { GetEntitiesByUrisResponse } from '#controllers/entities/by_uris_get'
import type { GetEntitiesByUrisParams } from '#controllers/entities/lib/get_entities_by_uris'
import type { ReverseClaimsParams } from '#controllers/entities/lib/reverse_claims'
import type { GetReverseClaimsResponse } from '#controllers/entities/reverse_claims'
import { federatedRequest } from '#lib/federation/federated_requests'
import { assertString } from '#lib/utils/assert_types'
import { buildUrl } from '#lib/utils/url'
import type { EntityUri, SerializedEntity } from '#types/entity'

export async function getRemoteEntitiesByUris ({ uris }: Pick<GetEntitiesByUrisParams, 'uris'>) {
  uris = compact(uris)
  if (uris.length === 0) return { entities: {}, redirects: {} } satisfies GetEntitiesByUrisResponse
  const remoteUrl = buildUrl('/api/entities', { action: 'by-uris', uris: uris.join('|') })
  return federatedRequest<GetEntitiesByUrisResponse>('get', remoteUrl)
}

export async function getRemoteEntitiesList (uris: EntityUri[]) {
  uris = compact(uris)
  if (uris.length === 0) return [] as SerializedEntity[]
  const { entities } = await getRemoteEntitiesByUris({ uris })
  return Object.values(entities)
}

export async function getRemoteEntityByUri ({ uri }: { uri: EntityUri }) {
  assertString(uri)
  const [ entity ] = await getRemoteEntitiesList([ uri ])
  return entity
}

export async function getRemoteReverseClaims (params: ReverseClaimsParams) {
  const remoteUrl = buildUrl('/api/entities', { action: 'reverse-claims', ...params })
  const { uris } = await federatedRequest<GetReverseClaimsResponse>('get', remoteUrl)
  return uris
}
