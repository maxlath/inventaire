import { compact } from 'lodash-es'
import type { GetEntitiesByUrisResponse } from '#controllers/entities/by_uris_get'
import type { GetEntitiesByUrisParams } from '#controllers/entities/lib/get_entities_by_uris'
import type { ReverseClaimsParams } from '#controllers/entities/lib/reverse_claims'
import { forwardRemoteError } from '#lib/federation/forward_remote_error'
import { requests_ } from '#lib/requests'
import { assertString } from '#lib/utils/assert_types'
import { buildUrl } from '#lib/utils/url'
import config from '#server/config'
import type { EntityUri, SerializedEntity } from '#types/entity'

const { remoteEntitiesOrigin } = config.federation

export async function getRemoteEntitiesByUris ({ uris }: Pick<GetEntitiesByUrisParams, 'uris'>) {
  uris = compact(uris)
  if (uris.length === 0) return { entities: {}, redirects: {} } satisfies GetEntitiesByUrisResponse
  const remoteUrl = buildUrl(`${remoteEntitiesOrigin}/api/entities`, { action: 'by-uris', uris: uris.join('|') })
  try {
    const res = await requests_.get(remoteUrl)
    return res as GetEntitiesByUrisResponse
  } catch (err) {
    throw forwardRemoteError(err, remoteUrl)
  }
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
  const remoteUrl = buildUrl(`${remoteEntitiesOrigin}/api/entities`, { action: 'reverse-claims', ...params })
  try {
    const { uris } = await requests_.get(remoteUrl)
    return uris as EntityUri[]
  } catch (err) {
    throw forwardRemoteError(err, remoteUrl)
  }
}
