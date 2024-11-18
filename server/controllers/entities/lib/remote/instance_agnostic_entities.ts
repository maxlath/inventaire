import { getEntitiesByUris as getEntitiesByUrisFromLocalInstance, type GetEntitiesByUrisParams } from '#controllers/entities/lib/get_entities_by_uris'
import { getEntitiesList as getEntitiesListFromLocalInstance } from '#controllers/entities/lib/get_entities_list'
import { getEntityByUri as getEntityByUriFromLocalInstance } from '#controllers/entities/lib/get_entity_by_uri'
import { getEntitiesByUrisFromRemoteInstance, getEntitiesListFromRemoteInstance, getEntityByUriFromRemoteInstance, getReverseClaimsFromRemoteInstance } from '#controllers/entities/lib/remote/get_remote_entities_by_uris'
import { getReverseClaims as getReverseClaimsFromLocalInstance, type ReverseClaimsParams } from '#controllers/entities/lib/reverse_claims'
import { info } from '#lib/utils/logs'
import config from '#server/config'
import type { EntityUri } from '#server/types/entity'

const { remoteEntitiesOrigin } = config.federation
const federatedEntities = remoteEntitiesOrigin != null
if (federatedEntities) info({ remoteEntitiesOrigin }, 'federated entities mode')

export async function getEntitiesByUris ({ uris }: Pick<GetEntitiesByUrisParams, 'uris'>) {
  if (federatedEntities) {
    return getEntitiesByUrisFromRemoteInstance({ uris })
  } else {
    return getEntitiesByUrisFromLocalInstance({ uris })
  }
}

export async function getEntityByUri ({ uri }: { uri: EntityUri }) {
  if (federatedEntities) {
    return getEntityByUriFromRemoteInstance({ uri })
  } else {
    return getEntityByUriFromLocalInstance({ uri })
  }
}

export async function getEntitiesList (uris: EntityUri[]) {
  if (federatedEntities) {
    return getEntitiesListFromRemoteInstance(uris)
  } else {
    return getEntitiesListFromLocalInstance(uris)
  }
}

export async function getReverseClaims (params: ReverseClaimsParams) {
  if (federatedEntities) {
    return getReverseClaimsFromRemoteInstance(params)
  } else {
    return getReverseClaimsFromLocalInstance(params)
  }
}
