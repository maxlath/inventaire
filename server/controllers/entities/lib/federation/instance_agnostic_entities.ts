import { getRemoteEntitiesByUris, getRemoteEntitiesList, getRemoteEntityByUri, getRemoteReverseClaims } from '#controllers/entities/lib/federation/get_remote_entities_by_uris'
import { getEntitiesByUris as getLocalEntitiesByUris, type GetEntitiesByUrisParams } from '#controllers/entities/lib/get_entities_by_uris'
import { getEntitiesList as getLocalEntitiesList } from '#controllers/entities/lib/get_entities_list'
import { getEntityByUri as getLocalEntityByUri } from '#controllers/entities/lib/get_entity_by_uri'
import { getReverseClaims as getLocalReverseClaims, type ReverseClaimsParams } from '#controllers/entities/lib/reverse_claims'
import { info } from '#lib/utils/logs'
import config from '#server/config'
import type { EntityUri } from '#types/entity'

const { remoteEntitiesOrigin } = config.federation
const federatedMode = remoteEntitiesOrigin != null
if (federatedMode) info(config.federation, 'federated entities mode')

export async function getEntitiesByUris ({ uris }: Pick<GetEntitiesByUrisParams, 'uris'>) {
  if (federatedMode) {
    return getRemoteEntitiesByUris({ uris })
  } else {
    return getLocalEntitiesByUris({ uris })
  }
}

export async function getEntityByUri ({ uri }: { uri: EntityUri }) {
  if (federatedMode) {
    return getRemoteEntityByUri({ uri })
  } else {
    return getLocalEntityByUri({ uri })
  }
}

export async function getEntitiesList (uris: EntityUri[]) {
  if (federatedMode) {
    return getRemoteEntitiesList(uris)
  } else {
    return getLocalEntitiesList(uris)
  }
}

export async function getReverseClaims (params: ReverseClaimsParams) {
  if (federatedMode) {
    return getRemoteReverseClaims(params)
  } else {
    return getLocalReverseClaims(params)
  }
}
